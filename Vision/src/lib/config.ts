/**
 * Data source modes
 * - local: Serve from public/v1 (development / offline)
 * - s3:    Fetch from S3 via CloudFront (production)
 */
export type DataSourceMode = 'local' | 's3';

export interface DataSourceConfig {
    mode: DataSourceMode;
    baseUrl: string;
    label: string;
}

/**
 * Resolve the active data-source configuration from environment variables.
 *
 * Environment variables (set in .env.local / .env.production):
 *   NEXT_PUBLIC_DATA_SOURCE  – "local" | "s3"  (default: "local")
 *   NEXT_PUBLIC_CDN_BASE_URL – CloudFront origin, e.g. "https://d1xxx.cloudfront.net/v1"
 */
export function getDataSourceConfig(): DataSourceConfig {
    const mode = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'local') as DataSourceMode;

    if (mode === 's3') {
        const cdnBase = process.env.NEXT_PUBLIC_CDN_BASE_URL;

        if (!cdnBase) {
            console.warn(
                '[uRing] NEXT_PUBLIC_CDN_BASE_URL is not set – falling back to local mode.',
            );
            return {
                mode: 'local',
                baseUrl: '/v1',
                label: 'Local Snapshot (fallback)',
            };
        }

        // Strip trailing slash
        const baseUrl = cdnBase.replace(/\/+$/, '');

        return {
            mode: 's3',
            baseUrl,
            label: `S3 / CloudFront`,
        };
    }

    return {
        mode: 'local',
        baseUrl: '/v1',
        label: 'Local Snapshot (public/v1)',
    };
}

/** Singleton – resolved once at module load */
export const dataSourceConfig = getDataSourceConfig();
