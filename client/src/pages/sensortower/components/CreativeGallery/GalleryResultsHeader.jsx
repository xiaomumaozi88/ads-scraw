import React from 'react';
import { GALLERY_PAGE_SIZE_OPTIONS, GALLERY_VIEW_MODES } from '../../constants/galleryConstants.js';
import GalleryColumnsDropdown from './GalleryColumnsDropdown.jsx';

function GridViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="2" width="14" height="2.5" rx="0.5" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="0.5" />
      <rect x="1" y="11.5" width="14" height="2.5" rx="0.5" />
    </svg>
  );
}

function GalleryResultsHeader({
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
  const isListView = viewMode === GALLERY_VIEW_MODES.list;
  const total = totalCount != null ? totalCount : displayedCount;
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  return (
    <div className="st-results-head">
      <div className="st-results-head__left">
        {isListView && listColumns ? (
          <GalleryColumnsDropdown
            open={columnsOpen}
            onOpenChange={onColumnsOpenChange}
            selectionState={listColumns.selectionState}
            isColumnVisible={listColumns.isColumnVisible}
            onToggleColumn={listColumns.toggleColumn}
            onSetAllColumns={listColumns.setAllColumns}
            onResetColumns={listColumns.resetColumns}
          />
        ) : null}
        <span className="st-results-head__count">
          {loading
            ? isListView
              ? '加载中…'
              : !displayedCount
                ? '加载中…'
                : `已加载 ${Number(displayedCount).toLocaleString()}${
                    totalCount != null
                      ? ` / 共 ${Number(totalCount).toLocaleString()} 个创意`
                      : ' 个创意'
                  }${loadingMore ? ' · 加载更多…' : ''}`
            : isListView
              ? `共 ${Number(total).toLocaleString()} 个创意`
              : `已加载 ${Number(displayedCount).toLocaleString()}${
                  totalCount != null
                    ? ` / 共 ${Number(totalCount).toLocaleString()} 个创意`
                    : ' 个创意'
                }${loadingMore ? ' · 加载更多…' : ''}`}
        </span>
        <button
          type="button"
          className="st-results-head__analyze"
          disabled={!canAnalyzeAds || !onAnalyzeAds}
          title={canAnalyzeAds ? '在曝光份额页查看所选应用' : '请先选择至少一个应用'}
          onClick={onAnalyzeAds}
        >
          分析广告
        </button>
      </div>
      <div className="st-results-head__right">
        <label className="st-results-head__page-size">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            aria-label={isListView ? '每页行数' : '每次加载行数'}
          >
            {GALLERY_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {isListView ? `${n} 行` : `每次 ${n} 条`}
              </option>
            ))}
          </select>
        </label>
        {isListView ? (
          <div className="st-results-head__pager" aria-label="分页">
            <button
              type="button"
              className="st-results-head__pager-btn"
              disabled={!canPrev}
              onClick={() => onPageChange(page - 1)}
              aria-label="上一页"
            >
              ‹
            </button>
            <span className="st-results-head__pager-info">
              <input
                className="st-results-head__pager-input"
                type="number"
                min={1}
                max={totalPages}
                value={page}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 1 && v <= totalPages) onPageChange(v);
                }}
                disabled={loading}
                aria-label="当前页"
              />
              <span className="st-results-head__pager-total">/ {totalPages}</span>
            </span>
            <button
              type="button"
              className="st-results-head__pager-btn"
              disabled={!canNext}
              onClick={() => onPageChange(page + 1)}
              aria-label="下一页"
            >
              ›
            </button>
          </div>
        ) : null}
        <div className="st-results-head__views" aria-label="视图切换">
          <button
            type="button"
            className={`st-results-head__view${viewMode === GALLERY_VIEW_MODES.grid ? ' st-results-head__view--active' : ''}`}
            aria-pressed={viewMode === GALLERY_VIEW_MODES.grid}
            title="网格"
            onClick={() => onViewModeChange(GALLERY_VIEW_MODES.grid)}
          >
            <GridViewIcon />
          </button>
          <button
            type="button"
            className={`st-results-head__view${viewMode === GALLERY_VIEW_MODES.list ? ' st-results-head__view--active' : ''}`}
            aria-pressed={viewMode === GALLERY_VIEW_MODES.list}
            title="列表"
            onClick={() => onViewModeChange(GALLERY_VIEW_MODES.list)}
          >
            <ListViewIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default GalleryResultsHeader;
