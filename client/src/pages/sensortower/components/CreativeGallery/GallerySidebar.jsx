import React, { useMemo } from 'react';
import { GALLERY_SORT_OPTIONS } from '../../constants/galleryConstants.js';
import {
  getCreativesWithImpressionsOnlyTooltip,
  getNewCreativesOnlyTooltip,
} from '../../utils/formatGallery.js';
import GalleryDateRangePicker from './GalleryDateRangePicker.jsx';
import GalleryToggleOption from './GalleryToggleOption.jsx';
import GalleryAppPicker from './GalleryAppPicker.jsx';
import GalleryKeywordEditor from './GalleryKeywordEditor.jsx';

function GallerySidebar({
  apps,
  platformId,
  onPlatformChange,
  onToggleApp,
  onToggleStoreVersion,
  onOpenAddApp,
  onRemoveApp,
  onEnrichApp,
  appsPickerCollapsed,
  onAppsPickerCollapse,
  onAppsPickerExpand,
  datePresetId,
  onDatePresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  sortById,
  onSortByIdChange,
  newCreativesOnly,
  onNewCreativesOnlyChange,
  creativesWithImpressionsOnly,
  onCreativesWithImpressionsOnlyChange,
  sidebarTab,
  onSidebarTabChange,
  keywordItems,
  onAddKeyword,
  onToggleKeyword,
}) {
  const newCreativesTooltip = useMemo(
    () => getNewCreativesOnlyTooltip(startDate),
    [startDate]
  );

  return (
    <aside className="st-sidebar" aria-label="创意库筛选侧栏">
      <GalleryDateRangePicker
        datePresetId={datePresetId}
        onDatePresetChange={onDatePresetChange}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
      />

      <div className="st-sidebar__report">
        <span className="st-sidebar__report-label">报告</span>
        <span className="st-sidebar__report-value">广告素材库</span>
      </div>

      <GalleryAppPicker
        apps={apps}
        platformId={platformId}
        onPlatformChange={onPlatformChange}
        collapsed={appsPickerCollapsed}
        onCollapse={onAppsPickerCollapse}
        onExpand={onAppsPickerExpand}
        onToggleApp={onToggleApp}
        onToggleStoreVersion={onToggleStoreVersion}
        onRemoveApp={onRemoveApp}
        onOpenAddApp={onOpenAddApp}
        onEnrichApp={onEnrichApp}
      />

      <div className="st-sidebar__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`st-sidebar__tab${sidebarTab === 'report' ? ' st-sidebar__tab--active' : ''}`}
          onClick={() => onSidebarTabChange('report')}
        >
          报告选项
        </button>
        <button
          type="button"
          role="tab"
          className={`st-sidebar__tab${sidebarTab === 'text' ? ' st-sidebar__tab--active' : ''}`}
          onClick={() => onSidebarTabChange('text')}
        >
          搜索创意文本
        </button>
      </div>

      {sidebarTab === 'text' ? (
        <GalleryKeywordEditor
          keywordItems={keywordItems}
          onAddKeyword={onAddKeyword}
          onToggleKeyword={onToggleKeyword}
        />
      ) : (
        <div className="st-sidebar__report-options">
          <p className="st-sidebar__sort-title">排序依据</p>
          <div className="st-sidebar__sort-group" role="group" aria-label="排序依据">
            {GALLERY_SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`st-sidebar__sort-btn${sortById === opt.id ? ' st-sidebar__sort-btn--active' : ''}`}
                onClick={() => onSortByIdChange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <GalleryToggleOption
            checked={newCreativesOnly}
            onChange={onNewCreativesOnlyChange}
            label="仅显示新创意"
            tooltip={newCreativesTooltip}
          />
          <GalleryToggleOption
            checked={creativesWithImpressionsOnly}
            onChange={onCreativesWithImpressionsOnlyChange}
            label="仅限有曝光份额的创意"
            tooltip={getCreativesWithImpressionsOnlyTooltip()}
          />
        </div>
      )}
    </aside>
  );
}

export default GallerySidebar;
