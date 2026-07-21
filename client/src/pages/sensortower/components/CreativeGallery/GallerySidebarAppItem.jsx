import React from 'react';
import {
  AppIcon,
  AppNameWithTooltip,
  StoreVersionCounts,
  StoreVersionsPanel,
} from '../shared/AppPickerShared.jsx';

function GallerySidebarAppItem({
  app,
  platformId,
  expanded,
  loadingVersions,
  versionsError,
  onToggleExpand,
  onToggleApp,
  onToggleStoreVersion,
  onRemoveApp,
}) {
  const selected = !!app.selected;

  return (
    <li className="st-sidebar__app-item">
      <div className={`st-sidebar__app-card${expanded ? ' st-sidebar__app-card--expanded' : ''}`}>
        <div
          className={`st-is-app-picker__row st-sidebar__app-row${selected ? ' st-is-app-picker__row--selected' : ''}`}
        >
          <label
            className={`st-is-app-picker__check-col${selected ? ' st-is-app-picker__check-col--checked' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="st-is-app-picker__checkbox"
              checked={selected}
              onChange={() => onToggleApp(app.unifiedAppId)}
            />
            <span className="st-is-app-picker__check-mark" aria-hidden>
              {selected ? '✓' : ''}
            </span>
          </label>

          <button
            type="button"
            className="st-sidebar__app-label"
            aria-expanded={expanded}
            aria-label={`${app.name} 商店版本`}
            onClick={onToggleExpand}
          >
            <StoreVersionCounts
              iosCount={app.iosCount}
              androidCount={app.androidCount}
              platformId={platformId}
            />
            <AppIcon
              app={app}
              className="st-is-app-picker__row-icon st-is-app-picker__row-icon--compact"
            />
            <div className="st-is-app-picker__meta">
              <AppNameWithTooltip name={app.name} className="st-is-app-picker__name st-sidebar__app-name" />
              <span className="st-is-app-picker__publisher">{app.publisher}</span>
            </div>
            <span className="st-sidebar__app-label-caret" aria-hidden>
              <span className={`st-ffd__caret${expanded ? ' st-ffd__caret--open' : ''}`} />
            </span>
          </button>

          <button
            type="button"
            className="st-is-app-picker__remove st-sidebar__app-remove"
            onClick={() => onRemoveApp(app.unifiedAppId)}
            aria-label={`移除 ${app.name}`}
          >
            ×
          </button>
        </div>

        {expanded ? (
          <StoreVersionsPanel
            app={app}
            platformId={platformId}
            onToggleVersion={onToggleStoreVersion}
            loading={loadingVersions}
            error={versionsError}
          />
        ) : null}
      </div>
    </li>
  );
}

export default GallerySidebarAppItem;
