import { useState, useEffect, useCallback } from 'react';

import { noticeService } from '@/services/notice';

import type { CrawlStats } from '@/types/notice';

/**
 * Hook to fetch & expose crawl statistics from stats.json
 */
export function useCrawlStats() {
    const [crawlStats, setCrawlStats] = useState<CrawlStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        const response = await noticeService.getCrawlStats();

        if (response.status === 'success') {
            setCrawlStats(response.data);
        } else {
            setError(response.message || 'Failed to load crawl stats');
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { crawlStats, loading, error, refresh: load };
}
