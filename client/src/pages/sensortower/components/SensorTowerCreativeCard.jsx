import React, { useMemo } from 'react';
import {
  formatSharePercent,
  getCreativeThumbAspectRatio,
  isNewCreative,
  isVideoCreative,
  resolveCreativeThumbUrl,
} from '../utils/formatGallery.js';
import { getNetworkIconUrl } from '../utils/networkIcons.js';
import CreativeThumbPlayOverlay from './CreativeThumbPlayOverlay.jsx';
import NetworkIcon from './shared/NetworkIcon.jsx';
import './SensorTowerCreativeCard.css';

function SensorTowerCreativeCard({
  creative,
  rank = 1,
  appName: appNameProp,
  appIconUrl,
  onClick,
  batchMode = false,
  selected = false,
  onToggleSelect,
  onEnterBatchMode,
  onRequestDownload,
}) {
  if (!creative) return null;
  const appName = appNameProp || `App ${String(creative.unified_app_id || '').slice(0, 8)}`;
  const thumbUrl = resolveCreativeThumbUrl(creative);
  const shareText = formatSharePercent(creative.grouped_creative_share);
  const network = creative.network || 'Unknown';
  const isNew = isNewCreative(creative.grouped_creative_first_seen_at);
  const isVideo = isVideoCreative(creative);
  const thumbAspect = useMemo(() => getCreativeThumbAspectRatio(creative), [creative]);
  const networkIconUrl = getNetworkIconUrl(network);

  const handleCheckboxClick = (event) => {
    event.stopPropagation();
    if (!batchMode && onEnterBatchMode) {
      onEnterBatchMode();
    }
    onToggleSelect?.();
  };

  const handleDownloadClick = (event) => {
    event.stopPropagation();
    onRequestDownload?.(creative);
  };

  const handleCardClick = (event) => {
    if (
      event.target.closest('.batch-card-checkbox') ||
      event.target.closest('.card-thumbnail-download')
    ) {
      return;
    }
    onClick?.(creative);
  };

  const handleKeyDown = (event) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(creative);
    }
  };

  return (
    <article
      className={`st-creative-card creative-card${onClick ? ' st-creative-card--clickable' : ''}${batchMode ? ' creative-card--batch-mode' : ''}`}
      onClick={onClick ? handleCardClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={`batch-card-checkbox${selected ? ' batch-card-checkbox--checked' : ''}`}
        onClick={handleCheckboxClick}
        role="button"
        aria-label={selected ? '取消选择' : '选择'}
      >
        {selected ? '✓' : ''}
      </div>

      <header className="st-creative-card__header">
        <div className="st-creative-card__header-left">
          {appIconUrl ? (
            <img className="st-creative-card__app-icon-img" src={appIconUrl} alt="" loading="lazy" />
          ) : (
            <span className="st-creative-card__app-icon" aria-hidden>
              {appName.slice(0, 1)}
            </span>
          )}
          <h3 className="st-creative-card__app-name" title={appName}>
            {appName}
          </h3>
        </div>
      </header>
      <div
        className="st-creative-card__thumb-wrap card-thumbnail"
        style={{ aspectRatio: `${thumbAspect.width} / ${thumbAspect.height}` }}
      >
        {thumbUrl ? (
          <img
            className="st-creative-card__thumb"
            src={thumbUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="st-creative-card__thumb-empty">暂无预览</div>
        )}
        {isVideo ? <CreativeThumbPlayOverlay /> : null}
        {onRequestDownload ? (
          <div className="card-thumbnail-download" onClick={handleDownloadClick}>
            <span className="card-download-icon" title={isVideo ? '下载视频' : '下载图片'}>
              ⬇
            </span>
            <span className="card-download-text">{isVideo ? '下载视频' : '下载图片'}</span>
          </div>
        ) : null}
      </div>
      <footer className="st-creative-card__footer">
        <div className="st-creative-card__chips">
          <span className="st-creative-card__chip st-creative-card__chip--rank">#{rank}</span>
          <span className="st-creative-card__chip st-creative-card__chip--share">{shareText}</span>
          {isNew ? <span className="st-creative-card__chip st-creative-card__chip--new">新</span> : null}
        </div>
        <span className="st-creative-card__headline" title={network}>
          {networkIconUrl ? (
            <NetworkIcon network={network} size={20} title={network} />
          ) : (
            <span className="st-creative-card__headline-text">{network}</span>
          )}
        </span>
      </footer>
    </article>
  );
}

export default SensorTowerCreativeCard;
