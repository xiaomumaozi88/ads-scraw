import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCreativeGallery } from '../../hooks/useCreativeGallery.js';
import { useGalleryListColumns } from '../../hooks/useGalleryListColumns.js';
import { useGalleryBatchDownload } from '../../hooks/useGalleryBatchDownload.jsx';
import { exportCreativesCsv, getCreativeGalleryRowKey } from '../../utils/formatGallery.js';
import GallerySidebar from './GallerySidebar.jsx';
import GalleryMainToolbar from './GalleryMainToolbar.jsx';
import GalleryFilterBar from './GalleryFilterBar.jsx';
import GalleryContentHead from './GalleryContentHead.jsx';
import AddAppModal from './AddAppModal.jsx';
import SensorTowerCreativeCard from '../SensorTowerCreativeCard.jsx';
import GalleryCreativesList from './GalleryCreativesList.jsx';
import CreativeDetailModal from './CreativeDetailModal.jsx';
import { GALLERY_VIEW_MODES } from '../../constants/galleryConstants.js';
import './CreativeGallery.css';

function CreativeGallery({ isLoggedIn, onRequireLogin, addLog, onAnalyzeAds }) {
  const gallery = useCreativeGallery({ isLoggedIn, onRequireLogin, addLog });
  const listColumns = useGalleryListColumns();
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState(null);
  const gridWrapRef = useRef(null);
  const loadSentinelRef = useRef(null);

  useEffect(() => {
    if (gallery.viewMode !== GALLERY_VIEW_MODES.list) setColumnsOpen(false);
  }, [gallery.viewMode]);

  useEffect(() => {
    if (gallery.loading && !gallery.creativesRows.length) {
      setDetailIndex(null);
    }
  }, [gallery.loading, gallery.creativesRows.length]);

  const appsById = useMemo(() => {
    const m = new Map();
    gallery.apps.forEach((a) => m.set(a.unifiedAppId, a));
    return m;
  }, [gallery.apps]);

  const batchDownload = useGalleryBatchDownload(gallery.creativesRows, appsById);

  const canAnalyzeAds = useMemo(
    () => gallery.apps.some((a) => a.selected),
    [gallery.apps]
  );

  const handleAnalyzeAds = useCallback(() => {
    if (!onAnalyzeAds || !canAnalyzeAds) return;
    onAnalyzeAds({
      platformId: gallery.platformId,
      startDate: gallery.startDate,
      endDate: gallery.endDate,
      allRegions: gallery.allRegions,
      selectedRegions: gallery.selectedRegions,
      allNetworks: gallery.allNetworks,
      selectedNetworks: gallery.selectedNetworks,
      apps: gallery.apps,
    });
  }, [
    onAnalyzeAds,
    canAnalyzeAds,
    gallery.platformId,
    gallery.startDate,
    gallery.endDate,
    gallery.allRegions,
    gallery.selectedRegions,
    gallery.allNetworks,
    gallery.selectedNetworks,
    gallery.apps,
  ]);

  const selectedCreative = detailIndex != null ? gallery.creativesRows[detailIndex] : null;
  const selectedApp = selectedCreative ? appsById.get(selectedCreative.unified_app_id) : null;

  const openCreativeDetail = useCallback((creative) => {
    const index = gallery.creativesRows.findIndex(
      (row) => getCreativeGalleryRowKey(row) === getCreativeGalleryRowKey(creative)
    );
    if (index >= 0) setDetailIndex(index);
  }, [gallery.creativesRows]);

  const handleDetailPrev = useCallback(() => {
    setDetailIndex((prev) => (prev != null && prev > 0 ? prev - 1 : prev));
  }, []);

  const isGridView = gallery.viewMode === GALLERY_VIEW_MODES.grid;
  const isListView = gallery.viewMode === GALLERY_VIEW_MODES.list;

  const handleDetailNext = useCallback(() => {
    setDetailIndex((prev) => {
      if (prev == null) return prev;
      if (prev < gallery.creativesRows.length - 1) return prev + 1;
      if (isGridView && gallery.hasMore && !gallery.loadingMore) gallery.loadMore();
      return prev;
    });
  }, [gallery.creativesRows.length, gallery.hasMore, gallery.loadingMore, gallery.loadMore, isGridView]);

  useEffect(() => {
    if (!isGridView || detailIndex == null) return;
    if (
      detailIndex >= gallery.creativesRows.length - 2 &&
      gallery.hasMore &&
      !gallery.loadingMore
    ) {
      gallery.loadMore();
    }
  }, [
    isGridView,
    detailIndex,
    gallery.creativesRows.length,
    gallery.hasMore,
    gallery.loadingMore,
    gallery.loadMore,
  ]);

  useEffect(() => {
    if (!isGridView) return undefined;
    const root = gridWrapRef.current;
    const sentinel = loadSentinelRef.current;
    if (!root || !sentinel || !gallery.hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          gallery.loadMore();
        }
      },
      { root, rootMargin: '160px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isGridView, gallery.hasMore, gallery.loadMore, gallery.creativesRows.length]);

  useEffect(() => {
    if (isListView) {
      gridWrapRef.current?.scrollTo({ top: 0 });
      setDetailIndex(null);
    }
  }, [isListView, gallery.page]);

  const handleExport = () => {
    exportCreativesCsv(gallery.creativesRows);
    addLog?.('已导出 CSV', 'success');
  };

  return (
    <div className="st-gallery">
      <div className="st-gallery__body">
        <GallerySidebar
          apps={gallery.apps}
          platformId={gallery.platformId}
          onPlatformChange={gallery.setPlatformId}
          onToggleApp={gallery.toggleAppSelected}
          onToggleStoreVersion={gallery.toggleStoreVersion}
          onOpenAddApp={() => gallery.setAddAppModalOpen(true)}
          onRemoveApp={gallery.removeApp}
          onEnrichApp={gallery.enrichAppDetails}
          appsPickerCollapsed={gallery.appsPickerCollapsed}
          onAppsPickerCollapse={gallery.collapseAppsPicker}
          onAppsPickerExpand={gallery.expandAppsPicker}
          datePresetId={gallery.datePresetId}
          onDatePresetChange={gallery.applyDatePreset}
          startDate={gallery.startDate}
          endDate={gallery.endDate}
          onStartDateChange={gallery.setStartDate}
          onEndDateChange={gallery.setEndDate}
          sortById={gallery.sortById}
          onSortByIdChange={gallery.setSortById}
          newCreativesOnly={gallery.newCreativesOnly}
          onNewCreativesOnlyChange={gallery.setNewCreativesOnly}
          creativesWithImpressionsOnly={gallery.creativesWithImpressionsOnly}
          onCreativesWithImpressionsOnlyChange={gallery.setCreativesWithImpressionsOnly}
          sidebarTab={gallery.sidebarTab}
          onSidebarTabChange={gallery.setSidebarTab}
          keywordItems={gallery.keywordItems}
          onAddKeyword={gallery.addKeyword}
          onToggleKeyword={gallery.toggleKeyword}
        />
        <AddAppModal
          open={gallery.addAppModalOpen}
          onClose={() => gallery.setAddAppModalOpen(false)}
          onSelectApp={gallery.addAppFromSearch}
        />
        <div className="st-gallery__main">
          <GalleryMainToolbar
            allRegions={gallery.allRegions}
            onAllRegionsChange={gallery.handleAllRegionsChange}
            selectedRegions={gallery.selectedRegions}
            onSelectedRegionsChange={gallery.setSelectedRegions}
            allNetworks={gallery.allNetworks}
            onAllNetworksChange={gallery.handleAllNetworksChange}
            selectedNetworks={gallery.selectedNetworks}
            onSelectedNetworksChange={gallery.setSelectedNetworks}
            onExportCsv={handleExport}
            exportDisabled={!gallery.creativesRows.length || gallery.loading}
          />
          <GalleryFilterBar
            platformId={gallery.platformId}
            selectedAdTypes={gallery.selectedAdTypes}
            onSelectedAdTypesChange={gallery.setSelectedAdTypes}
            allPlacements={gallery.allPlacements}
            onAllPlacementsChange={gallery.handleAllPlacementsChange}
            selectedPlacements={gallery.selectedPlacements}
            onSelectedPlacementsChange={gallery.setSelectedPlacements}
            placementCountMap={gallery.placementCountMap}
            adTypeCountMap={gallery.adTypeCountMap}
            allAdObjectives={gallery.allAdObjectives}
            onAllAdObjectivesChange={gallery.handleAllAdObjectivesChange}
            selectedAdObjectives={gallery.selectedAdObjectives}
            onSelectedAdObjectivesChange={gallery.setSelectedAdObjectives}
            adObjectiveCountMap={gallery.adObjectiveCountMap}
            allAspectRatios={gallery.allAspectRatios}
            onAllAspectRatiosChange={gallery.handleAllAspectRatiosChange}
            selectedAspectRatios={gallery.selectedAspectRatios}
            onSelectedAspectRatiosChange={gallery.setSelectedAspectRatios}
            aspectRatioCountMap={gallery.aspectRatioCountMap}
            allVideoDurations={gallery.allVideoDurations}
            onAllVideoDurationsChange={gallery.handleAllVideoDurationsChange}
            selectedVideoDurations={gallery.selectedVideoDurations}
            onSelectedVideoDurationsChange={gallery.setSelectedVideoDurations}
            videoDurationCountMap={gallery.videoDurationCountMap}
          />
          <GalleryContentHead
            platformId={gallery.platformId}
            startDate={gallery.startDate}
            endDate={gallery.endDate}
            allRegions={gallery.allRegions}
            allNetworks={gallery.allNetworks}
            selectedRegions={gallery.selectedRegions}
            appSummaries={gallery.appSummaries}
            totalCount={gallery.totalCount}
            displayedCount={gallery.creativesRows.length}
            loading={gallery.loading}
            loadingMore={gallery.loadingMore}
            viewMode={gallery.viewMode}
            onViewModeChange={gallery.handleViewModeChange}
            page={gallery.page}
            pageSize={gallery.pageSize}
            totalPages={gallery.totalPages}
            onPageChange={gallery.setPage}
            onPageSizeChange={gallery.handlePageSizeChange}
            columnsOpen={columnsOpen}
            onColumnsOpenChange={setColumnsOpen}
            listColumns={listColumns}
            canAnalyzeAds={canAnalyzeAds}
            onAnalyzeAds={handleAnalyzeAds}
          />
          {gallery.error ? (
            <p className="st-gallery__error" role="alert">
              {gallery.error}
            </p>
          ) : null}
          <div className="st-gallery__grid-wrap" ref={gridWrapRef}>
            {isGridView && gallery.creativesRows.length > 0 ? batchDownload.batchToolbar : null}
            {gallery.loading && !gallery.creativesRows.length && !isListView ? (
              <p className="st-gallery__loading">正在加载创意…</p>
            ) : null}
            {!gallery.loading && !gallery.creativesRows.length && !gallery.error ? (
              <p className="st-gallery__empty">
                {isLoggedIn
                  ? '暂无创意数据，请添加应用或调整筛选条件。'
                  : '登录后将加载创意数据，可先配置筛选条件并添加应用。'}
              </p>
            ) : null}
            {gallery.creativesRows.length > 0 || (gallery.loading && isListView) ? (
              <div
                className={
                  gallery.loading && isListView ? 'st-gallery__grid-content--loading' : undefined
                }
              >
                {gallery.viewMode === GALLERY_VIEW_MODES.list ? (
                  <GalleryCreativesList
                    rows={gallery.creativesRows}
                    appsById={appsById}
                    page={gallery.page}
                    pageSize={gallery.pageSize}
                    visibleColumns={listColumns.visibleColumns}
                    onCreativeClick={openCreativeDetail}
                  />
                ) : (
                  <div className="st-gallery__grid">
                    {gallery.creativesRows.map((item, idx) => {
                      const app = appsById.get(item.unified_app_id);
                      return (
                        <SensorTowerCreativeCard
                          key={getCreativeGalleryRowKey(item) || `creative-${idx}`}
                          creative={item}
                          rank={idx + 1}
                          appName={app?.name}
                          appIconUrl={app?.iconUrl}
                          onClick={openCreativeDetail}
                          {...batchDownload.getCardBatchProps(item)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            {gallery.loading && isListView ? (
              <div className="st-gallery__loading-overlay" role="status" aria-live="polite">
                <span className="st-gallery__loading-overlay-spinner" aria-hidden />
                <span>正在加载创意…</span>
              </div>
            ) : null}
            {isGridView && gallery.creativesRows.length > 0 && gallery.hasMore ? (
              <div ref={loadSentinelRef} className="st-gallery__load-sentinel" aria-hidden />
            ) : null}
            {isGridView && gallery.loadingMore ? (
              <p className="st-gallery__loading-more">正在加载更多创意…</p>
            ) : null}
          </div>
        </div>
      </div>

      {batchDownload.sizeModal}

      <CreativeDetailModal
        open={detailIndex != null}
        creative={selectedCreative}
        app={selectedApp}
        filters={gallery.filters}
        isLoggedIn={isLoggedIn}
        rank={
          detailIndex != null
            ? isListView
              ? (gallery.page - 1) * gallery.pageSize + detailIndex + 1
              : detailIndex + 1
            : null
        }
        totalCount={gallery.totalCount}
        onClose={() => setDetailIndex(null)}
        onPrev={handleDetailPrev}
        onNext={handleDetailNext}
        canPrev={detailIndex != null && detailIndex > 0}
        canNext={
          detailIndex != null &&
          (detailIndex < gallery.creativesRows.length - 1 || (isGridView && gallery.hasMore))
        }
      />
    </div>
  );
}

export default CreativeGallery;
