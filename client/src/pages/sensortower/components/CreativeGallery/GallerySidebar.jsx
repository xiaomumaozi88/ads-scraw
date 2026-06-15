import React, { useMemo } from 'react';
import { GALLERY_PLATFORMS, GALLERY_SORT_OPTIONS } from '../../constants/galleryConstants.js';
import {
  getCreativesWithImpressionsOnlyTooltip,
  getNewCreativesOnlyTooltip,
} from '../../utils/formatGallery.js';
import GalleryDateRangePicker from './GalleryDateRangePicker.jsx';
import GalleryToggleOption from './GalleryToggleOption.jsx';

function PlatformSegmentIcon({ platformId }) {
  if (platformId === 'ios') {
    return (
      <span className="st-sidebar__platform-icon" aria-hidden>
        
      </span>
    );
  }
  if (platformId === 'android') {
    return (
      <svg className="st-sidebar__platform-svg" viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M8 5.5v13l10-6.5z" />
      </svg>
    );
  }
  return (
    <svg className="st-sidebar__platform-svg" viewBox="0 0 24 24" aria-hidden>
      <circle cx="10" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function GallerySidebar({
  apps,
  platformId,
  onPlatformChange,
  onToggleApp,
  onOpenAddApp,
  onRemoveApp,
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
  keywords,
  onKeywordsChange,
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

      <button type="button" className="st-sidebar__add-app" onClick={onOpenAddApp}>
        <span className="st-sidebar__add-icon" aria-hidden>
          +
        </span>
        添加应用
      </button>

      <div className="st-sidebar__platform" role="tablist" aria-label="平台">
        {GALLERY_PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            title={p.title}
            aria-selected={platformId === p.id}
            className={`st-sidebar__platform-btn${platformId === p.id ? ' st-sidebar__platform-btn--active' : ''}`}
            onClick={() => onPlatformChange(p.id)}
          >
            <PlatformSegmentIcon platformId={p.id} />
            <span className="st-sidebar__platform-label">{p.label}</span>
          </button>
        ))}
      </div>

      {apps.length === 0 ? (
        <p className="st-sidebar__empty-apps">点击「添加应用」搜索并选择要分析的应用。</p>
      ) : (
        <ul className="st-sidebar__apps">
          {apps.map((app, idx) => (
            <li key={app.unifiedAppId} className="st-sidebar__app-item">
              <label className="st-sidebar__app-label">
                <input
                  type="checkbox"
                  checked={!!app.selected}
                  onChange={() => onToggleApp(app.unifiedAppId)}
                />
                <span className="st-sidebar__app-order">{idx + 1}</span>
                {app.iconUrl ? (
                  <img className="st-sidebar__app-icon-img" src={app.iconUrl} alt="" loading="lazy" />
                ) : (
                  <span
                    className="st-sidebar__app-icon"
                    style={{ backgroundColor: app.accent || '#5c6bc0' }}
                    aria-hidden
                  >
                    {app.name?.charAt(0) || '?'}
                  </span>
                )}
                <span className="st-sidebar__app-meta">
                  <span className="st-sidebar__app-name">{app.name}</span>
                  <span className="st-sidebar__app-publisher">{app.publisher}</span>
                </span>
              </label>
              <button
                type="button"
                className="st-sidebar__app-remove"
                onClick={() => onRemoveApp(app.unifiedAppId)}
                aria-label={`移除 ${app.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

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
        <div className="st-sidebar__keywords">
          <div className="st-sidebar__keywords-row">
            <input
              className="st-sidebar__input st-sidebar__input--grow"
              placeholder="添加关键词…"
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
            />
            <button type="button" className="st-sidebar__kw-add" aria-label="添加关键词">
              +
            </button>
          </div>
          <p className="st-sidebar__kw-hint">
            <span>关键字</span>
            <span className="st-sidebar__info" title="创意文本搜索将随官方 API 支持后接入">
              ⓘ
            </span>
          </p>
        </div>
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
