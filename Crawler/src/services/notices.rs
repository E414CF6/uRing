//! Notice crawler service.
//!
//! Fetches notices from department boards using configured CSS selectors.
//! Uses board URL as cache key to avoid ID collisions across departments.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use futures::stream::{self, StreamExt};
use reqwest::Client;
use scraper::Selector;

use crate::error::{AppError, Result};
use crate::models::{
    Board, Campus, Config, CrawlError, CrawlOutcome, CrawlStage, DepartmentRef, Notice,
};
use crate::utils::{extract_notice_id, http, resolve_url};

/// Parsed CSS selectors for a board, ready for use.
#[derive(Clone)]
struct BoardSelectors {
    row: Selector,
    title: Selector,
    date: Selector,
    author: Option<Selector>,
    link: Option<Selector>,
}

/// Result of fetching a board's notice list.
struct BoardListResult {
    notices: Vec<Notice>,
    row_total: usize,
    row_failures: usize,
}

/// Service for crawling notices from department boards.
pub struct NoticeCrawler {
    config: Arc<Config>,
    client: Client,
}

impl NoticeCrawler {
    /// Create a new notice crawler.
    pub fn new(config: Arc<Config>, client: Client) -> Result<Self> {
        Ok(Self { config, client })
    }

    /// Fetch all notices from all campuses concurrently.
    ///
    /// Single-stage pipeline: fetch board listing → parse rows → deduplicate.
    pub async fn fetch_all(&self, campuses: &[Campus]) -> Result<CrawlOutcome> {
        let concurrency = self.config.crawler.max_concurrent.max(1);

        // Build selector cache keyed by board URL (unique) to avoid ID collisions
        let (selector_cache, selector_errors, invalid_urls) = Self::build_selector_cache(campuses);
        let selector_cache = Arc::new(selector_cache);

        // Collect all (department, board) jobs, filtering out boards with bad selectors
        let board_jobs: Vec<_> = campuses
            .iter()
            .flat_map(|c| c.all_departments())
            .flat_map(|dept_ref| {
                dept_ref
                    .dept
                    .boards
                    .iter()
                    .map(move |board| (dept_ref, board))
            })
            .collect();

        let valid_jobs: Vec<_> = board_jobs
            .iter()
            .filter(|(_, b)| !invalid_urls.contains(b.url.as_str()))
            .collect();

        let mut outcome = CrawlOutcome {
            board_total: board_jobs.len(),
            board_failures: board_jobs.len() - valid_jobs.len(),
            errors: selector_errors,
            ..CrawlOutcome::default()
        };

        // Fetch all board listings concurrently
        let mut notice_buffer = Vec::new();
        let mut board_stream = stream::iter(valid_jobs)
            .map(|(dept_ref, board)| {
                let cache = Arc::clone(&selector_cache);
                async move {
                    let selectors = cache
                        .get(board.url.as_str())
                        .cloned()
                        .ok_or_else(|| AppError::crawl(&board.url, "Missing selector cache entry"));
                    let result = match selectors {
                        Ok(sel) => self.fetch_board_list(*dept_ref, board, &sel).await,
                        Err(err) => Err(err),
                    };
                    (board, result)
                }
            })
            .buffer_unordered(concurrency);

        while let Some((board, result)) = board_stream.next().await {
            match result {
                Ok(list) => {
                    outcome.notice_total += list.row_total;
                    outcome.notice_failures += list.row_failures;
                    notice_buffer.extend(list.notices);
                }
                Err(error) => {
                    outcome.board_failures += 1;
                    outcome.errors.push(Self::make_error(
                        CrawlStage::BoardList,
                        Some(board),
                        Some(&board.url),
                        None,
                        &error,
                    ));
                    log::warn!(
                        "Board fetch failed: {} ({}): {}",
                        board.name,
                        board.url,
                        error
                    );
                }
            }
        }

        // Deduplicate by canonical ID
        let mut seen = HashSet::new();
        notice_buffer.retain(|n| seen.insert(n.canonical_id()));

        outcome.detail_total = notice_buffer.len();
        outcome.notices = notice_buffer;
        Ok(outcome)
    }

    /// Fetch and parse a single board's notice list page.
    async fn fetch_board_list(
        &self,
        dept_ref: DepartmentRef<'_>,
        board: &Board,
        selectors: &BoardSelectors,
    ) -> Result<BoardListResult> {
        self.apply_request_delay().await;

        let document = http::fetch_page_async(&self.client, &board.url).await?;
        let base_url = url::Url::parse(&board.url)?;
        let mut notices = Vec::new();
        let mut row_total = 0;
        let mut row_failures = 0;

        for row in document.select(&selectors.row) {
            row_total += 1;
            if let Some(notice) = self.parse_notice_row(
                &row,
                selectors,
                &board.selectors.attr_name,
                dept_ref,
                board,
                &base_url,
            ) {
                notices.push(notice);
            } else {
                row_failures += 1;
            }
        }

        Ok(BoardListResult {
            notices,
            row_total,
            row_failures,
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn parse_notice_row(
        &self,
        row: &scraper::ElementRef,
        selectors: &BoardSelectors,
        attr_name: &str,
        dept_ref: DepartmentRef<'_>,
        board: &Board,
        base_url: &url::Url,
    ) -> Option<Notice> {
        let title_elem = row.select(&selectors.title).next()?;
        let date_elem = row.select(&selectors.date).next()?;
        let author_elem = selectors
            .author
            .as_ref()
            .and_then(|sel| row.select(sel).next());

        let raw_title: String = title_elem.text().collect();
        let raw_date: String = date_elem.text().collect();
        let raw_author: String = author_elem.map_or(String::new(), |el| el.text().collect());

        let title = self.config.cleaning.clean_title(&raw_title);
        let date = self.config.cleaning.clean_date(&raw_date);

        if title.is_empty() {
            return None;
        }

        let link_elem = selectors
            .link
            .as_ref()
            .and_then(|sel| row.select(sel).next())
            .or(Some(title_elem));
        let raw_link = link_elem
            .and_then(|e| e.value().attr(attr_name))
            .unwrap_or("");
        let link = resolve_url(base_url, raw_link);
        let source_id = extract_notice_id(&link);

        Some(Notice {
            campus: dept_ref.campus.to_string(),
            college: dept_ref.college.unwrap_or("").to_string(),
            department_id: dept_ref.dept.id.clone(),
            department_name: dept_ref.dept.name.clone(),
            board_id: board.id.clone(),
            board_name: board.name.clone(),
            title,
            author: raw_author.trim().to_string(),
            date,
            link,
            source_id,
            is_pinned: false, // TODO: Detect pinned notices from row styling
        })
    }

    async fn apply_request_delay(&self) {
        let delay_ms = self.config.crawler.request_delay_ms;
        if delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }
    }

    /// Build selector cache keyed by board **URL** (globally unique).
    ///
    /// Previous implementation used `board.id` as key, which collided across
    /// departments sharing the same board type (e.g., many "notice" boards).
    fn build_selector_cache(
        campuses: &[Campus],
    ) -> (
        std::collections::HashMap<String, Arc<BoardSelectors>>,
        Vec<CrawlError>,
        HashSet<String>,
    ) {
        let mut cache = std::collections::HashMap::new();
        let mut errors = Vec::new();
        let mut invalid_urls = HashSet::new();

        for campus in campuses {
            for dept_ref in campus.all_departments() {
                for board in &dept_ref.dept.boards {
                    let row = match Self::parse_selector(&board.selectors.row_selector) {
                        Ok(sel) => sel,
                        Err(err) => {
                            errors.push(Self::make_error(
                                CrawlStage::Selector,
                                Some(board),
                                Some(&board.url),
                                None,
                                &err,
                            ));
                            invalid_urls.insert(board.url.clone());
                            continue;
                        }
                    };
                    let title = match Self::parse_selector(&board.selectors.title_selector) {
                        Ok(sel) => sel,
                        Err(err) => {
                            errors.push(Self::make_error(
                                CrawlStage::Selector,
                                Some(board),
                                Some(&board.url),
                                None,
                                &err,
                            ));
                            invalid_urls.insert(board.url.clone());
                            continue;
                        }
                    };
                    let date = match Self::parse_selector(&board.selectors.date_selector) {
                        Ok(sel) => sel,
                        Err(err) => {
                            errors.push(Self::make_error(
                                CrawlStage::Selector,
                                Some(board),
                                Some(&board.url),
                                None,
                                &err,
                            ));
                            invalid_urls.insert(board.url.clone());
                            continue;
                        }
                    };
                    let author = board.selectors.author_selector.as_ref().and_then(|sel| {
                        Self::parse_selector(sel)
                            .map_err(|err| {
                                errors.push(Self::make_error(
                                    CrawlStage::Selector,
                                    Some(board),
                                    Some(&board.url),
                                    None,
                                    &err,
                                ));
                            })
                            .ok()
                    });
                    let link = board.selectors.link_selector.as_ref().and_then(|sel| {
                        Self::parse_selector(sel)
                            .map_err(|err| {
                                errors.push(Self::make_error(
                                    CrawlStage::Selector,
                                    Some(board),
                                    Some(&board.url),
                                    None,
                                    &err,
                                ));
                            })
                            .ok()
                    });

                    cache.insert(
                        board.url.clone(),
                        Arc::new(BoardSelectors {
                            row,
                            title,
                            date,
                            author,
                            link,
                        }),
                    );
                }
            }
        }

        (cache, errors, invalid_urls)
    }

    fn make_error(
        stage: CrawlStage,
        board: Option<&Board>,
        url: Option<&str>,
        notice_id: Option<&str>,
        error: &AppError,
    ) -> CrawlError {
        CrawlError {
            stage,
            board_id: board.map(|b| b.id.clone()),
            board_name: board.map(|b| b.name.clone()),
            url: url.map(str::to_string),
            notice_id: notice_id.map(str::to_string),
            message: error.to_string(),
            retryable: error.is_retryable(),
        }
    }

    fn parse_selector(s: &str) -> Result<Selector> {
        Selector::parse(s).map_err(|e| AppError::selector(s, format!("{e:?}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_selector_valid() {
        assert!(NoticeCrawler::parse_selector("div.class").is_ok());
        assert!(NoticeCrawler::parse_selector("tr:has(a)").is_ok());
    }

    #[test]
    fn test_parse_selector_invalid() {
        assert!(NoticeCrawler::parse_selector("[[invalid").is_err());
    }
}
