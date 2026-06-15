import React, { useEffect, useMemo, useState } from 'react';
import { useCreativeGallery } from '../../hooks/useCreativeGallery.js';
import { useGalleryListColumns } from '../../hooks/useGalleryListColumns.js';
import { exportCreativesCsv } from '../../utils/formatGallery.js';
import GallerySidebar from './GallerySidebar.jsx';
import GalleryMainToolbar from './GalleryMainToolbar.jsx';
import GalleryFilterBar from './GalleryFilterBar.jsx';
import GalleryContentHead from './GalleryContentHead.jsx';
import AddAppModal from './AddAppModal.jsx';
import SensorTowerCreativeCard from '../SensorTowerCreativeCard.jsx';
import GalleryCreativesList from './GalleryCreativesList.jsx';
import { GALLERY_VIEW_MODES } from '../../constants/galleryConstants.js';
import './CreativeGallery.css';

function CreativeGallery({ isLoggedIn, onRequireLogin, addLog }) {
  const gallery = useCreativeGallery({ isLoggedIn, onRequireLogin, addLog });
  const listColumns = useGalleryListColumns();
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    if (gallery.viewMode !== GALLERY_VIEW_MODES.list) setColumnsOpen(false);
  }, [gallery.viewMode]);

  const appsById = useMemo(() => {
    const m = new Map();
    gallery.apps.forEach((a) => m.set(a.unifiedAppId, a));
    return m;
  }, [gallery.apps]);

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
          onOpenAddApp={() => gallery.setAddAppModalOpen(true)}
          onRemoveApp={gallery.removeApp}
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
          keywords={gallery.keywords}
          onKeywordsChange={gallery.setKeywords}
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
          />
          {gallery.error ? (
            <p className="st-gallery__error" role="alert">
              {gallery.error}
            </p>
          ) : null}
          <div className="st-gallery__grid-wrap">
            {gallery.loading && !gallery.creativesRows.length ? (
              <p className="st-gallery__loading">正在加载创意…</p>
            ) : null}
            {!gallery.loading && !gallery.creativesRows.length && !gallery.error ? (
              <p className="st-gallery__empty">
                {isLoggedIn
                  ? '暂无创意数据，请添加应用或调整筛选条件。'
                  : '登录后将加载创意数据，可先配置筛选条件并添加应用。'}
              </p>
            ) : null}
            {gallery.viewMode === GALLERY_VIEW_MODES.list ? (
              <GalleryCreativesList
                rows={gallery.creativesRows}
                appsById={appsById}
                page={gallery.page}
                pageSize={gallery.pageSize}
                visibleColumns={listColumns.visibleColumns}
              />
            ) : (
              <div className="st-gallery__grid">
                {gallery.creativesRows.map((item, idx) => {
                  const app = appsById.get(item.unified_app_id);
                  return (
                    <SensorTowerCreativeCard
                      key={item.grouped_creative_id || `${item.unified_app_id}-${idx}`}
                      creative={item}
                      rank={(gallery.page - 1) * gallery.pageSize + idx + 1}
                      appName={app?.name}
                      appIconUrl={app?.iconUrl}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreativeGallery;
