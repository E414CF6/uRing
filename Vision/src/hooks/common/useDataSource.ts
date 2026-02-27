import { useMemo } from 'react';
import { noticeService } from '@/services/notice';

/**
 * Hook to expose current data-source mode & label
 */
export function useDataSource() {
    const info = useMemo(
        () => ({
            mode: noticeService.getDataSourceMode(),
            label: noticeService.getDataSourceLabel(),
        }),
        [],
    );

    return info;
}
