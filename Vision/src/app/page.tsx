'use client';

import {
  useInfiniteNotices,
  useNoticeFilters,
  useNoticeStats,
  useCrawlStats,
  useDataSource,
  useIntersectionObserver,
} from '@hooks/index';

import { HeroSection, FilterSidebar, NoticeList, StatsFooter } from '@components/home';
import { LoadingState, ErrorState } from '@components/ui';

export default function Home() {
  // Data source info (local vs S3)
  const { mode: dataSourceMode, label: dataSourceLabel } = useDataSource();

  // Infinite Notices Hook
  const {
    notices,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
  } = useInfiniteNotices();

  // Filter Hook and State Management
  const {
    selectedCampus,
    selectedDept,
    selectedBoard,
    searchQuery,
    setSelectedCampus,
    setSelectedDept,
    setSelectedBoard,
    setSearchQuery,
    resetFilters,
    campuses,
    departments,
    boards,
    filteredNotices,
  } = useNoticeFilters(notices);

  // Notice Statistics (computed from loaded notices)
  const { stats, latestDate } = useNoticeStats(notices);

  // Crawl statistics from stats.json
  const { crawlStats, loading: crawlStatsLoading } = useCrawlStats();

  // Infinite Scroll Observer
  const loadMoreRef = useIntersectionObserver(
    () => {
      if (!loadingMore && hasMore) {
        loadMore();
      }
    },
    { enabled: !loading && !loadingMore && hasMore },
  );

  // Loading State
  if (loading) {
    return <LoadingState />;
  }

  // Error State
  if (error) {
    return <ErrorState message={error} />;
  }

  // Main Render
  return (
    <div className="app-shell">
      <HeroSection
        dataSourceLabel={dataSourceLabel}
        dataSourceMode={dataSourceMode}
        latestDate={latestDate}
        totalNotices={notices.length}
        filteredCount={filteredNotices.length}
        stats={stats}
      />

      <main className="main-grid">
        <FilterSidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCampus={selectedCampus}
          selectedDept={selectedDept}
          selectedBoard={selectedBoard}
          onCampusChange={setSelectedCampus}
          onDeptChange={setSelectedDept}
          onBoardChange={setSelectedBoard}
          campuses={campuses}
          departments={departments}
          boards={boards}
          onResetFilters={resetFilters}
        />

        <NoticeList
          notices={filteredNotices}
          totalCount={notices.length}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreRef={loadMoreRef}
          onResetFilters={resetFilters}
        />
      </main>

      <StatsFooter
        crawlStats={crawlStats}
        dataSourceLabel={dataSourceLabel}
        dataSourceMode={dataSourceMode}
        loading={crawlStatsLoading}
      />
    </div>
  );
}
