import { dataSourceConfig } from '@/lib/config';

import type { DataSourceConfig } from '@/lib/config';
import type { ApiResponse } from '@/types/api';
import type {
    Notice,
    RawNotice,
    CurrentResponse,
    ArchivePeriod,
    CrawlStats,
    IndexMeta,
} from '@/types/notice';

/**
 * Flatten a raw notice (nested metadata) into the UI-friendly Notice shape
 */
function flattenNotice(raw: RawNotice): Notice {
    return {
        id: raw.id,
        title: raw.title,
        link: raw.link,
        campus: raw.metadata.campus,
        college: raw.metadata.college,
        department_name: raw.metadata.department_name,
        board_name: raw.metadata.board_name,
        date: raw.metadata.date,
        pinned: raw.metadata.pinned,
    };
}

/**
 * uRing API Client
 *
 * Supports two data-source modes controlled via environment variables:
 *   - local  -> reads from public/v1 (Next.js static files)
 *   - s3     -> reads from an S3 / CloudFront distribution
 */
export class NoticeApiClient {
    private basePath: string;
    readonly dataSource: DataSourceConfig;

    constructor(config: DataSourceConfig = dataSourceConfig) {
        this.basePath = config.baseUrl;
        this.dataSource = config;
    }

    // ─── Internal helpers ────────────────────────────────────────

    /**
     * Fetch JSON data (common method)
     */
    private async fetchJson<T>(path: string): Promise<ApiResponse<T>> {
        const url = `${this.basePath}${path}`;

        try {
            const response = await fetch(url, {
                // For S3/CloudFront, bypass browser cache so fresh data propagates
                cache: this.dataSource.mode === 's3' ? 'no-store' : 'default',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} – ${url}`);
            }

            const data = await response.json();
            return { status: 'success', data };
        } catch (error) {
            console.error(`[uRing] fetch failed -> ${url}`, error);
            return {
                status: 'error',
                data: [] as T,
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ─── Public API ──────────────────────────────────────────────

    /**
     * Fetch current notices
     * current.json has { updated_at, count, notices: RawNotice[] } wrapper
     */
    async fetchCurrent(): Promise<ApiResponse<Notice[]>> {
        const response = await this.fetchJson<CurrentResponse>('/current.json');

        if (response.status === 'success') {
            const raw = response.data;
            const notices = Array.isArray(raw?.notices) ? raw.notices : [];
            return { status: 'success', data: notices.map(flattenNotice) };
        }

        return { status: 'error', data: [], message: response.message };
    }

    /**
     * Fetch the `updated_at` timestamp from current.json
     */
    async fetchCurrentMeta(): Promise<ApiResponse<{ updated_at: string; count: number }>> {
        const response = await this.fetchJson<CurrentResponse>('/current.json');

        if (response.status === 'success') {
            return {
                status: 'success',
                data: {
                    updated_at: response.data.updated_at,
                    count: response.data.count,
                },
            };
        }

        return {
            status: 'error',
            data: { updated_at: '', count: 0 },
            message: response.message,
        };
    }

    /**
     * Fetch notices for a specific month
     * Stack files are plain RawNotice[] arrays
     */
    async fetchByMonth(year: number, month: number): Promise<ApiResponse<Notice[]>> {
        const monthStr = month.toString().padStart(2, '0');
        const response = await this.fetchJson<RawNotice[]>(`/stacks/${year}/${monthStr}.json`);

        if (response.status === 'success') {
            const raw = Array.isArray(response.data) ? response.data : [];
            return { status: 'success', data: raw.map(flattenNotice) };
        }

        return { status: 'error', data: [], message: response.message };
    }

    /**
     * Fetch notices for multiple months
     */
    async fetchByMonths(periods: ArchivePeriod[]): Promise<ApiResponse<Notice[]>> {
        try {
            const results = await Promise.all(
                periods.map((period) => this.fetchByMonth(period.year, period.month)),
            );

            const allNotices = results.flatMap((result) =>
                result.status === 'success' ? result.data : [],
            );

            // Sort by date (latest first)
            allNotices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            return { status: 'success', data: allNotices };
        } catch (error) {
            console.error('[uRing] fetchByMonths failed:', error);
            return {
                status: 'error',
                data: [],
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Fetch crawl statistics (stats.json)
     */
    async fetchStats(): Promise<ApiResponse<CrawlStats>> {
        return this.fetchJson<CrawlStats>('/stats.json');
    }

    /**
     * Fetch index metadata (header only – not the full token map)
     */
    async fetchIndexMeta(): Promise<ApiResponse<IndexMeta>> {
        return this.fetchJson<IndexMeta>('/index.json');
    }
}

/**
 * Default API client instance – uses the resolved data-source config
 */
export const noticeApi = new NoticeApiClient();
