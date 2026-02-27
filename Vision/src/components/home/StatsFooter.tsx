import type { CrawlStats } from '@/types/notice';

interface StatsFooterProps {
    crawlStats: CrawlStats | null;
    dataSourceLabel: string;
    dataSourceMode: string;
    loading: boolean;
}

/**
 * Format an ISO timestamp into a readable local string
 */
function formatTime(iso: string): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return iso;
    }
}

/**
 * Format duration between two ISO timestamps
 */
function formatDuration(start: string, end: string): string {
    if (!start || !end) return '—';
    try {
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (ms < 1000) return `${ms}ms`;
        const seconds = (ms / 1000).toFixed(1);
        return `${seconds}s`;
    } catch {
        return '—';
    }
}

/**
 * Format a percentage (0..1) into a display string
 */
function pct(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

export function StatsFooter({
    crawlStats,
    dataSourceLabel,
    dataSourceMode,
    loading,
}: StatsFooterProps) {
    if (loading) {
        return (
            <footer className="stats-footer">
                <div className="stats-footer-inner">
                    <p className="stats-footer-loading">Loading crawl statistics…</p>
                </div>
            </footer>
        );
    }

    if (!crawlStats) {
        return (
            <footer className="stats-footer">
                <div className="stats-footer-inner">
                    <div className="stats-footer-brand">
                        <span className="stats-footer-logo">uR</span>
                        <span>uRing Viewer — Yonsei University Notice Monitor</span>
                    </div>
                    <p className="stats-footer-sub">
                        Data source: {dataSourceLabel}
                    </p>
                </div>
            </footer>
        );
    }

    const duration = formatDuration(crawlStats.start_time, crawlStats.end_time);

    return (
        <footer className="stats-footer">
            <div className="stats-footer-inner">
                {/* Branding Row */}
                <div className="stats-footer-brand">
                    <span className="stats-footer-logo">uR</span>
                    <div>
                        <span className="stats-footer-title">uRing Viewer</span>
                        <span className="stats-footer-sub">
                            Yonsei University Notice Monitor
                        </span>
                    </div>
                </div>

                {/* Crawl Overview */}
                <div className="stats-grid">
                    <div className="stats-grid-section">
                        <h4 className="stats-section-title">Crawl Overview</h4>
                        <div className="stats-kv-grid">
                            <div className="stats-kv">
                                <span className="stats-kv-label">Last Crawl</span>
                                <span className="stats-kv-value">{formatTime(crawlStats.end_time)}</span>
                            </div>
                            <div className="stats-kv">
                                <span className="stats-kv-label">Duration</span>
                                <span className="stats-kv-value">{duration}</span>
                            </div>
                            <div className="stats-kv">
                                <span className="stats-kv-label">Data Source</span>
                                <span className="stats-kv-value">
                                    <span className={`ds-badge ds-badge-${dataSourceMode}`}>
                                        {dataSourceMode === 's3' ? '☁ S3' : '⬡ Local'}
                                    </span>
                                    {dataSourceLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Collection Stats */}
                    <div className="stats-grid-section">
                        <h4 className="stats-section-title">Collection Stats</h4>
                        <div className="stats-metric-row">
                            <div className="stats-metric">
                                <span className="stats-metric-value">{crawlStats.notice_count.toLocaleString()}</span>
                                <span className="stats-metric-label">Notices</span>
                            </div>
                            <div className="stats-metric">
                                <span className="stats-metric-value">{crawlStats.department_count}</span>
                                <span className="stats-metric-label">Departments</span>
                            </div>
                            <div className="stats-metric">
                                <span className="stats-metric-value">{crawlStats.board_count}</span>
                                <span className="stats-metric-label">Boards</span>
                            </div>
                        </div>
                    </div>

                    {/* Success Rates */}
                    <div className="stats-grid-section">
                        <h4 className="stats-section-title">Success Rates</h4>
                        <div className="stats-bar-group">
                            <div className="stats-bar-item">
                                <div className="stats-bar-header">
                                    <span>Boards</span>
                                    <span>{pct(crawlStats.board_success_rate)}</span>
                                </div>
                                <div className="stats-bar-track">
                                    <div
                                        className="stats-bar-fill stats-bar-fill-teal"
                                        style={{ width: pct(crawlStats.board_success_rate) }}
                                    />
                                </div>
                                <span className="stats-bar-detail">
                                    {crawlStats.board_total - crawlStats.board_failures} / {crawlStats.board_total}
                                    {crawlStats.board_failures > 0 && (
                                        <span className="stats-bar-fail"> ({crawlStats.board_failures} failed)</span>
                                    )}
                                </span>
                            </div>

                            <div className="stats-bar-item">
                                <div className="stats-bar-header">
                                    <span>Notices</span>
                                    <span>{pct(crawlStats.notice_success_rate)}</span>
                                </div>
                                <div className="stats-bar-track">
                                    <div
                                        className="stats-bar-fill stats-bar-fill-accent"
                                        style={{ width: pct(crawlStats.notice_success_rate) }}
                                    />
                                </div>
                                <span className="stats-bar-detail">
                                    {crawlStats.notice_total - crawlStats.notice_failures} / {crawlStats.notice_total}
                                    {crawlStats.notice_failures > 0 && (
                                        <span className="stats-bar-fail"> ({crawlStats.notice_failures} failed)</span>
                                    )}
                                </span>
                            </div>

                            <div className="stats-bar-item">
                                <div className="stats-bar-header">
                                    <span>Details</span>
                                    <span>{pct(crawlStats.detail_success_rate)}</span>
                                </div>
                                <div className="stats-bar-track">
                                    <div
                                        className="stats-bar-fill stats-bar-fill-gold"
                                        style={{ width: pct(crawlStats.detail_success_rate) }}
                                    />
                                </div>
                                <span className="stats-bar-detail">
                                    {crawlStats.detail_total - crawlStats.detail_failures} / {crawlStats.detail_total}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="stats-footer-copy">
                    <p>Provides a unified feed by crawling and refining campus notice data.</p>
                </div>
            </div>
        </footer>
    );
}
