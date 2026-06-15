import React from 'react';
import {
  formatSharePercent,
  getCreativeThumbUrl,
  getNetworkColor,
  isNewCreative,
} from '../utils/formatGallery.js';
import './SensorTowerCreativeCard.css';

function getCtaLabel(adFormats) {
  const fmt = Array.isArray(adFormats) ? adFormats[0] : adFormats;
  if (!fmt) return 'INSTALL NOW';
  const s = String(fmt).toLowerCase();
  if (s.includes('video') || s.includes('playable')) return 'INSTALL NOW';
  if (s.includes('banner') || s.includes('image')) return 'LEARN MORE';
  return 'INSTALL NOW';
}

function SensorTowerCreativeCard({ creative, rank = 1, appName: appNameProp, appIconUrl }) {
  if (!creative) return null;
  const appName = appNameProp || `App ${String(creative.unified_app_id || '').slice(0, 8)}`;
  const thumbUrl = getCreativeThumbUrl(creative.grouped_creative_id);
  const shareText = formatSharePercent(creative.grouped_creative_share);
  const network = creative.network || 'Unknown';
  const isNew = isNewCreative(creative.grouped_creative_first_seen_at);
  const cta = getCtaLabel(creative.grouped_creative_ad_formats);
  const isVideo =
    Array.isArray(creative.grouped_creative_ad_formats) &&
    creative.grouped_creative_ad_formats.some((f) => String(f).toLowerCase().includes('video'));
  const networkColor = getNetworkColor(network);

  return (
    <article className="st-creative-card">
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
        <span
          className="st-creative-card__network-badge"
          style={{ backgroundColor: `${networkColor}18`, color: networkColor, borderColor: `${networkColor}40` }}
          title={network}
        >
          {network.slice(0, 1)}
        </span>
      </header>
      <div className="st-creative-card__copy">
        <p className="st-creative-card__headline">{network}</p>
        <button type="button" className="st-creative-card__cta" tabIndex={-1}>
          {cta}
        </button>
      </div>
      <div className="st-creative-card__thumb-wrap">
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
        {isVideo ? <span className="st-creative-card__play" aria-hidden>▶</span> : null}
      </div>
      <footer className="st-creative-card__footer">
        <div className="st-creative-card__chips">
          <span className="st-creative-card__chip st-creative-card__chip--rank">#{rank}</span>
          <span className="st-creative-card__chip st-creative-card__chip--share">{shareText}</span>
          {isNew ? <span className="st-creative-card__chip st-creative-card__chip--new">新</span> : null}
        </div>
        <span className="st-creative-card__brand" title="Sensor Tower" aria-hidden>
          ST
        </span>
      </footer>
    </article>
  );
}

export default SensorTowerCreativeCard;
