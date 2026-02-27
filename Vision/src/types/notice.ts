/**
 * Raw notice format from JSON files
 */
export interface RawNotice {
    id: string;
    title: string;
    link: string;
    metadata: {
        campus: string;
        college: string;
        department_name: string;
        board_name: string;
        date: string;
        pinned: boolean;
    };
}

/**
 * Response format for current.json
 */
export interface CurrentResponse {
    updated_at: string;
    count: number;
    notices: RawNotice[];
}

/**
 * Flattened Notice Interface (used by UI)
 */
export interface Notice {
    id: string;
    campus: string;
    college: string;
    department_name: string;
    board_name: string;
    title: string;
    date: string;
    link: string;
    pinned: boolean;
}

/**
 * Notice Statistics Type
 */
export interface NoticeStats {
    total: number;
    campuses: number;
    departments: number;
    boards: number;
    colleges: number;
}

/**
 * Archive Period Type
 */
export interface ArchivePeriod {
    year: number;
    month: number;
}

/**
 * Crawl statistics from stats.json
 */
export interface CrawlStats {
    start_time: string;
    end_time: string;
    notice_count: number;
    department_count: number;
    board_count: number;
    board_total: number;
    board_failures: number;
    board_success_rate: number;
    notice_total: number;
    notice_failures: number;
    notice_success_rate: number;
    detail_total: number;
    detail_failures: number;
    detail_success_rate: number;
}

/**
 * Index metadata from index.json (header only – not the full token map)
 */
export interface IndexMeta {
    version: number;
    notice_count: number;
    token_count: number;
}
