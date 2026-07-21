import React, { useEffect, useRef } from 'react';
import StoreOsIcon from './StoreOsIcon.jsx';
import './AppPickerShared.css';

function DownloadMetricIcon() {
  return (
    <span className="st-is-app-picker__metric-icon" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          fill="currentColor"
          d="M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3zm-1-4-1.41-1.41L13 12.17V4h-2v8.17L8.41 9.59 7 11l5 5z"
        />
      </svg>
    </span>
  );
}

export function getAppStoreVersions(app, platformId = 'unified') {
  const ios = (app?.iosApps || []).map((item) => ({ ...item, os: 'ios' }));
  const android = (app?.androidApps || []).map((item) => ({ ...item, os: 'android' }));
  if (platformId === 'ios') return ios;
  if (platformId === 'android') return android;
  return [...ios, ...android];
}

export function AppNameWithTooltip({ name, className = 'st-is-app-picker__name' }) {
  const textRef = useRef(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return undefined;

    const checkTruncation = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    };

    checkTruncation();
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);

  const label = String(name || '').trim();

  return (
    <span className="st-is-app-picker__name-wrap">
      <span ref={textRef} className={className}>
        {label}
      </span>
      {isTruncated && label ? (
        <span className="st-is-app-picker__name-tooltip" role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}

export function StoreVersionCounts({ iosCount = 0, androidCount = 0, platformId = 'unified' }) {
  const showIos = platformId === 'ios' || platformId === 'unified';
  const showAndroid = platformId === 'android' || platformId === 'unified';

  return (
    <div
      className="st-is-app-picker__store-counts"
      aria-label={`App Store ${iosCount}，Google Play ${androidCount}`}
    >
      {showIos ? (
        <span className="st-is-app-picker__store-count">
          <StoreOsIcon
            os="ios"
            className="st-is-app-picker__store-icon st-is-app-picker__store-icon--ios"
          />
          <span>{iosCount}</span>
        </span>
      ) : null}
      {showAndroid ? (
        <span className="st-is-app-picker__store-count">
          <StoreOsIcon
            os="android"
            className="st-is-app-picker__store-icon st-is-app-picker__store-icon--gp"
          />
          <span>{androidCount}</span>
        </span>
      ) : null}
    </div>
  );
}

export function AppIcon({ app, className }) {
  const [failed, setFailed] = React.useState(false);
  const src = String(app?.iconUrl || '').trim();

  if (src && !failed) {
    return (
      <img
        className={className}
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${className} st-is-app-picker__icon-fallback`}
      style={{ backgroundColor: app?.accent || '#5c6bc0' }}
      aria-hidden
    >
      {app?.name?.charAt(0) || '?'}
    </span>
  );
}

export function AppMetrics({ downloads, revenue }) {
  if (!downloads && !revenue) return null;
  return (
    <div className="st-is-app-picker__metrics">
      {downloads ? (
        <span className="st-is-app-picker__metric">
          <DownloadMetricIcon />
          {downloads}
        </span>
      ) : null}
      {revenue ? (
        <span className="st-is-app-picker__metric st-is-app-picker__metric--revenue">{revenue}</span>
      ) : null}
    </div>
  );
}

function StoreVersionRow({ version, onToggle }) {
  const storeLabel = version.os === 'ios' ? 'App Store' : 'Google Play';
  const selected = version.selected !== false;

  return (
    <li className="st-is-app-picker__version-item">
      <div className="st-is-app-picker__version-row">
        <label
          className={`st-is-app-picker__check-col st-is-app-picker__check-col--version${selected ? ' st-is-app-picker__check-col--checked' : ''}`}
        >
          <input
            type="checkbox"
            className="st-is-app-picker__checkbox"
            checked={selected}
            onChange={() => onToggle?.(version)}
          />
          <span className="st-is-app-picker__check-mark" aria-hidden>
            {selected ? '✓' : ''}
          </span>
        </label>
        <StoreOsIcon
          os={version.os}
          className={`st-is-app-picker__version-store st-is-app-picker__version-store--${version.os}`}
          title={storeLabel}
        />
        <AppIcon app={version} className="st-is-app-picker__version-icon" />
        <div className="st-is-app-picker__version-meta">
          <span className="st-is-app-picker__version-name">{version.name}</span>
          {version.publisher ? (
            <span className="st-is-app-picker__version-publisher">{version.publisher}</span>
          ) : null}
        </div>
        <AppMetrics downloads={version.downloads} revenue={version.revenue} />
      </div>
    </li>
  );
}

export function StoreVersionsPanel({
  app,
  platformId = 'unified',
  onToggleVersion,
  loading,
  error,
}) {
  const versions = getAppStoreVersions(app, platformId);

  if (loading) {
    return <p className="st-is-app-picker__versions-hint">正在加载商店版本…</p>;
  }
  if (error) {
    return (
      <p className="st-is-app-picker__versions-hint st-is-app-picker__versions-hint--error">{error}</p>
    );
  }
  if (!versions.length) {
    return <p className="st-is-app-picker__versions-hint">暂无商店版本数据</p>;
  }

  return (
    <ul className="st-is-app-picker__versions" aria-label={`${app.name} 商店版本`}>
      {versions.map((version) => (
        <StoreVersionRow
          key={`${version.os}-${version.id}`}
          version={version}
          onToggle={(item) => onToggleVersion?.(app.unifiedAppId, item.id, item.os)}
        />
      ))}
    </ul>
  );
}
