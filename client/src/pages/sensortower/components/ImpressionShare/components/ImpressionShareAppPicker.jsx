import React, { useState } from 'react';
import { IS_PLATFORMS } from '../../../constants/impressionShareConstants.js';

function PlatformSegmentIcon({ platformId }) {
  if (platformId === 'ios') {
    return (
      <span className="st-is-app-picker__platform-glyph" aria-hidden>
        
      </span>
    );
  }
  if (platformId === 'android') {
    return (
      <svg className="st-is-app-picker__platform-svg" viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M8 5.5v13l10-6.5z" />
      </svg>
    );
  }
  return (
    <svg className="st-is-app-picker__platform-svg" viewBox="0 0 24 24" aria-hidden>
      <circle cx="10" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function StoreVersionCounts({ iosCount = 0, androidCount = 0 }) {
  return (
    <div className="st-is-app-picker__store-counts" aria-label={`App Store ${iosCount}，Google Play ${androidCount}`}>
      <span className="st-is-app-picker__store-count">
        <span className="st-is-app-picker__store-icon st-is-app-picker__store-icon--ios" aria-hidden>
          
        </span>
        <span>{iosCount}</span>
      </span>
      <span className="st-is-app-picker__store-count">
        <span className="st-is-app-picker__store-icon st-is-app-picker__store-icon--gp" aria-hidden>
          ▶
        </span>
        <span>{androidCount}</span>
      </span>
    </div>
  );
}

function AppIcon({ app, className }) {
  if (app.iconUrl) {
    return <img className={className} src={app.iconUrl} alt="" loading="lazy" />;
  }
  return (
    <span
      className={`${className} st-is-app-picker__icon-fallback`}
      style={{ backgroundColor: app.accent || '#5c6bc0' }}
      aria-hidden
    >
      {app.name?.charAt(0) || '?'}
    </span>
  );
}

function ImpressionShareAppPicker({
  apps,
  platformId,
  onPlatformChange,
  collapsed,
  onCollapse,
  onExpand,
  onToggleApp,
  onRemoveApp,
  onOpenAddApp,
}) {
  const [expandedAppId, setExpandedAppId] = useState(null);

  const platformMeta = IS_PLATFORMS.find((p) => p.id === platformId) || IS_PLATFORMS[2];
  const selectedApps = apps.filter((a) => a.selected);

  if (!apps.length) {
    return (
      <p className="st-sidebar__empty-apps">点击「添加应用」搜索并选择要分析的应用。</p>
    );
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="st-is-app-picker__summary"
        onClick={onExpand}
        aria-label="展开应用选择，当前为收起状态"
      >
        <div className="st-is-app-picker__summary-head">
          <PlatformSegmentIcon platformId={platformId} />
          <span className="st-is-app-picker__summary-label">{platformMeta.label}</span>
        </div>
        <div className="st-is-app-picker__summary-icons">
          {selectedApps.map((app) => (
            <AppIcon key={app.unifiedAppId} app={app} className="st-is-app-picker__summary-icon" />
          ))}
        </div>
      </button>
    );
  }

  return (
    <div className="st-is-app-picker st-is-app-picker--editing">
      <div className="st-sidebar__platform st-is-app-picker__platform" role="tablist" aria-label="平台">
        {IS_PLATFORMS.map((p) => (
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

      <ul className="st-is-app-picker__list">
        {apps.map((app) => {
          const isExpanded = expandedAppId === app.unifiedAppId;
          return (
            <li key={app.unifiedAppId} className="st-is-app-picker__item">
              <div className="st-is-app-picker__row">
                <label className="st-is-app-picker__check-col">
                  <input
                    type="checkbox"
                    className="st-is-app-picker__checkbox"
                    checked={!!app.selected}
                    onChange={() => onToggleApp(app.unifiedAppId)}
                  />
                </label>
                <StoreVersionCounts iosCount={app.iosCount} androidCount={app.androidCount} />
                <AppIcon app={app} className="st-is-app-picker__row-icon" />
                <div className="st-is-app-picker__meta">
                  <span className="st-is-app-picker__name">{app.name}</span>
                  <span className="st-is-app-picker__publisher">{app.publisher}</span>
                </div>
                <button
                  type="button"
                  className="st-is-app-picker__caret-btn"
                  aria-expanded={isExpanded}
                  aria-label={`${app.name} 版本`}
                  onClick={() =>
                    setExpandedAppId(isExpanded ? null : app.unifiedAppId)
                  }
                >
                  <span className="st-ffd__caret" aria-hidden />
                </button>
                <button
                  type="button"
                  className="st-is-app-picker__remove"
                  onClick={() => onRemoveApp(app.unifiedAppId)}
                  aria-label={`移除 ${app.name}`}
                >
                  ×
                </button>
              </div>
              {isExpanded ? (
                <p className="st-is-app-picker__versions-hint">各商店版本列表将在接入 API 后展示。</p>
              ) : null}
            </li>
          );
        })}
      </ul>

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

export default ImpressionShareAppPicker;
