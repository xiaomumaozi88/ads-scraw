import React, { useState } from 'react';
import { GALLERY_PLATFORMS } from '../../constants/galleryConstants.js';
import PlatformSegmentIcon from '../PlatformSegmentIcon.jsx';
import { AppIcon } from '../shared/AppPickerShared.jsx';
import GallerySidebarAppItem from './GallerySidebarAppItem.jsx';
import '../shared/AppPickerShared.css';

const MAX_SUMMARY_ICONS = 6;

function GalleryAppPickerSummary({ apps, platformId, platformLabel, onExpand }) {
  const selectedApps = apps.filter((a) => a.selected);
  const displayApps = selectedApps.length > 0 ? selectedApps : apps;
  if (!displayApps.length) return null;

  const visibleApps = displayApps.slice(0, MAX_SUMMARY_ICONS);
  const overflowCount = displayApps.length - visibleApps.length;
  const isMulti = displayApps.length > 1;

  return (
    <button
      type="button"
      className="st-gallery-app-picker__summary"
      onClick={onExpand}
      aria-label={`展开应用选择，已选 ${displayApps.length} 个应用`}
    >
      <div className="st-gallery-app-picker__summary-platform">
        <PlatformSegmentIcon platformId={platformId} />
        <span>{platformLabel}</span>
      </div>
      <div
        className={`st-gallery-app-picker__summary-icons${isMulti ? ' st-gallery-app-picker__summary-icons--multi' : ''}`}
      >
        {visibleApps.map((app) => (
          <AppIcon
            key={app.unifiedAppId}
            app={app}
            className="st-gallery-app-picker__summary-icon"
          />
        ))}
        {overflowCount > 0 ? (
          <span className="st-gallery-app-picker__summary-overflow">+{overflowCount}</span>
        ) : null}
      </div>
    </button>
  );
}

function GalleryAppPicker({
  apps,
  platforms = GALLERY_PLATFORMS,
  platformId,
  onPlatformChange,
  collapsed,
  onCollapse,
  onExpand,
  onToggleApp,
  onToggleStoreVersion,
  onRemoveApp,
  onOpenAddApp,
  onEnrichApp,
}) {
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [loadingVersionsId, setLoadingVersionsId] = useState(null);
  const [versionsErrorById, setVersionsErrorById] = useState({});

  const platformMeta = platforms.find((p) => p.id === platformId) ?? platforms[0];

  const handleToggleExpand = async (app) => {
    const isExpanded = expandedAppId === app.unifiedAppId;
    if (isExpanded) {
      setExpandedAppId(null);
      return;
    }

    setExpandedAppId(app.unifiedAppId);
    setVersionsErrorById((prev) => ({ ...prev, [app.unifiedAppId]: '' }));

    const hasVersions = (app.iosApps?.length || 0) + (app.androidApps?.length || 0) > 0;
    if (hasVersions || !onEnrichApp) return;

    setLoadingVersionsId(app.unifiedAppId);
    try {
      await onEnrichApp(app.unifiedAppId);
    } catch (e) {
      setVersionsErrorById((prev) => ({
        ...prev,
        [app.unifiedAppId]: e?.message || '加载商店版本失败',
      }));
    } finally {
      setLoadingVersionsId(null);
    }
  };

  const addAppButton = (
    <button type="button" className="st-gallery-app-picker__add-btn" onClick={onOpenAddApp}>
      <span className="st-gallery-app-picker__add-icon" aria-hidden>
        ⊞
      </span>
      添加应用
    </button>
  );

  if (collapsed) {
    return (
      <div className="st-gallery-app-picker st-gallery-app-picker--collapsed">
        {addAppButton}
        {apps.length > 0 ? (
          <GalleryAppPickerSummary
            apps={apps}
            platformId={platformId}
            platformLabel={platformMeta.label}
            onExpand={onExpand}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="st-is-app-picker st-gallery-app-picker st-gallery-app-picker--editing">
      {addAppButton}

      <div className="st-sidebar__platform st-is-app-picker__platform" role="tablist" aria-label="平台">
        {platforms.map((p) => (
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
        <p className="st-sidebar__empty-apps st-gallery-app-picker__empty">点击「添加应用」搜索并选择要分析的应用。</p>
      ) : (
        <ul className="st-sidebar__apps st-sidebar__apps--picker st-gallery-app-picker__list">
          {apps.map((app) => (
            <GallerySidebarAppItem
              key={app.unifiedAppId}
              app={app}
              platformId={platformId}
              expanded={expandedAppId === app.unifiedAppId}
              loadingVersions={loadingVersionsId === app.unifiedAppId}
              versionsError={versionsErrorById[app.unifiedAppId]}
              onToggleExpand={() => handleToggleExpand(app)}
              onToggleApp={onToggleApp}
              onToggleStoreVersion={onToggleStoreVersion}
              onRemoveApp={onRemoveApp}
            />
          ))}
        </ul>
      )}

      <div className="st-is-app-picker__footer">
        <button type="button" className="st-is-app-picker__done-btn" onClick={onCollapse}>
          完成
        </button>
        <button
          type="button"
          className="st-is-app-picker__footer-icon"
          aria-label="添加应用"
          onClick={onOpenAddApp}
        >
          <span className="st-is-app-picker__footer-icon-glyph" aria-hidden>
            ⊞+
          </span>
        </button>
        <button type="button" className="st-is-app-picker__footer-icon" aria-label="更多操作">
          ⋮
        </button>
      </div>
    </div>
  );
}

export default GalleryAppPicker;
