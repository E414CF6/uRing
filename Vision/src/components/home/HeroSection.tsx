import { StatCard, MetaPill } from '@components/ui';

interface HeroSectionProps {
    dataSourceLabel: string;
    dataSourceMode: string;
    latestDate: string | null;
    totalNotices: number;
    filteredCount: number;
    stats: {
        campuses: number;
        departments: number;
        boards: number;
        colleges: number;
    };
}

export function HeroSection({
    dataSourceLabel,
    dataSourceMode,
    latestDate,
    totalNotices,
    filteredCount,
    stats,
}: HeroSectionProps) {
    return (
        <header className="hero">
            <div className="hero-inner">
                <div className="brand-row">
                    <div className="brand-lockup">
                        <div className="brand-mark">uR</div>
                        <div>
                            <div className="brand-tag">uRing Notice Desk</div>
                            <h1 className="hero-title">Yonsei University Notice Viewer</h1>
                            <p className="hero-subtitle">
                                Automatically collects and organizes notices across campuses, departments, and boards.
                                Scroll down to see previous notices.
                            </p>
                        </div>
                    </div>
                    <div className="hero-meta">
                        <MetaPill>
                            <span className={`ds-dot ds-dot-${dataSourceMode}`} />
                            {dataSourceLabel}
                        </MetaPill>
                        <MetaPill>Latest: {latestDate || 'no data'}</MetaPill>
                        <MetaPill>Total: {totalNotices.toLocaleString()} notices</MetaPill>
                    </div>
                </div>
                <div className="hero-stats">
                    <StatCard label="Notices" value={filteredCount.toLocaleString()} />
                    <StatCard label="Campuses" value={stats.campuses} />
                    <StatCard label="Colleges" value={stats.colleges} />
                    <StatCard label="Departments" value={stats.departments} />
                    <StatCard label="Boards" value={stats.boards} />
                </div>
            </div>
        </header>
    );
}
