import React from 'react';
import { buildSummarySubtitle } from '../../utils/formatGallery.js';
import GalleryResultsHeader from './GalleryResultsHeader.jsx';

function GalleryContentHead({
  platformId,
  startDate,
  endDate,
  allRegions,
  allNetworks,
  selectedRegions,
  appSummaries,
  totalCount,
  displayedCount,
  loading,
  loadingMore,
  viewMode,
  onViewModeChange,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  columnsOpen,
  onColumnsOpenChange,
  listColumns,
  canAnalyzeAds,
  onAnalyzeAds,
}) {
  const subtitle = buildSummarySubtitle({
    platformId,
    startDate,
    endDate,
    allRegions,
    allNetworks,
    selectedRegions,
  });

  return (
    <section className="st-content-head">
      <div className="st-content-head__title-row">
        <h2 className="st-content-head__title">广告创意</h2>
        <p className="st-content-head__subtitle">{subtitle}</p>
      </div>

      {appSummaries.length > 0 ? (
        <div className="st-content-head__apps">
          {appSummaries.map((app) => (
            <div key={app.unifiedAppId} className="st-content-head__app-row">
              <div className="st-content-head__app-main">
                {app.iconUrl ? (
                  <img
                    className="st-content-head__app-icon-img"
                    src={app.iconUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="st-content-head__app-icon"
                    style={{ backgroundColor: app.accent || '#5c6bc0' }}
                    aria-hidden
                  >
                    {app.name?.charAt(0) || '?'}
                  </span>
                )}
                <div className="st-content-head__app-text">
                  <span className="st-content-head__app-name">{app.name}</span>
                  <span className="st-content-head__app-publisher">{app.publisher || '—'}</span>
                </div>
              </div>
              <div className="st-content-head__creatives-badge" aria-label={`${app.creativeCount} 个创意`}>
                <span className="st-content-head__creatives-label">Creatives</span>
                <span className="st-content-head__creatives-value">
                  {Number(app.creativeCount ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <GalleryResultsHeader
        totalCount={totalCount}
        displayedCount={displayedCount}
        loading={loading}
        loadingMore={loadingMore}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        columnsOpen={columnsOpen}
        onColumnsOpenChange={onColumnsOpenChange}
        listColumns={listColumns}
        canAnalyzeAds={canAnalyzeAds}
        onAnalyzeAds={onAnalyzeAds}
      />
    </section>
  );
}

export default GalleryContentHead;
