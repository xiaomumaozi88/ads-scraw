import React, { useMemo } from 'react';
import {
  GALLERY_AD_TYPES,
  GALLERY_PLACEMENTS,
} from '../../constants/galleryConstants.js';
import { useCreativeDetailDialog } from '../../hooks/useCreativeDetailDialog.js';
import {
  formatCreativeActiveDuration,
  formatCreativeDimensions,
  formatCreativeFacetValues,
  formatCreativeRegionsZh,
  formatGalleryDateShort,
  formatSharePercent,
  formatVideoDurationSeconds,
  getCreativeImageUrl,
  getCreativePrimaryAdTypeLabel,
  getCreativeVideoUrl,
  isVideoCreative,
  resolveCreativeThumbUrl,
} from '../../utils/formatGallery.js';
import NetworkIcon from '../shared/NetworkIcon.jsx';
import ShareTrendChart from './ShareTrendChart.jsx';
import CreativeThumbPlayOverlay from '../CreativeThumbPlayOverlay.jsx';
import './CreativeDetailModal.css';

function DetailField({ label, value, href, children }) {
  const content = children ?? (
    href && value && value !== '—' ? (
      <a
        className="st-creative-detail__link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {value}
      </a>
    ) : (
      value
    )
  );
  return (
    <div className="st-creative-detail__field">
      <dt className="st-creative-detail__field-label">{label}</dt>
      <dd className="st-creative-detail__field-value">{content}</dd>
    </div>
  );
}

function TextBlock({ label, value }) {
  return (
    <div className="st-creative-detail__text-item">
      <div className="st-creative-detail__text-item-label">{label}</div>
      <p className="st-creative-detail__text-item-value">{value || '—'}</p>
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="st-creative-detail__section">
      <button
        type="button"
        className="st-creative-detail__section-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={`st-creative-detail__chevron${open ? ' st-creative-detail__chevron--open' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? <div className="st-creative-detail__section-body">{children}</div> : null}
    </section>
  );
}

function CreativeDetailModal({
  open,
  creative,
  app,
  rank,
  totalCount,
  filters,
  isLoggedIn,
  onClose,
  onPrev,
  onNext,
  canPrev,
  canNext,
}) {
  const {
    loading,
    error,
    mergedCreative,
    variants,
    selectedVariant,
    selectedVariantIndex,
    setSelectedVariantIndex,
    shareTimeSeries,
  } = useCreativeDetailDialog({ open, creative, filters, isLoggedIn });

  const displayCreative = mergedCreative ?? creative;
  const isVideo = useMemo(() => {
    if (selectedVariant?.adType) return selectedVariant.adType === 'video';
    return isVideoCreative(displayCreative);
  }, [selectedVariant, displayCreative]);

  const fallbackThumbUrl = resolveCreativeThumbUrl(displayCreative);
  const groupedId = displayCreative?.grouped_creative_id;
  const mediaUrl = useMemo(() => {
    if (selectedVariant) {
      if (isVideo) return selectedVariant.videoUrl || selectedVariant.mediaUrl;
      return selectedVariant.imageUrl || selectedVariant.mediaUrl || selectedVariant.thumbUrl;
    }
    if (isVideo) return getCreativeVideoUrl(groupedId);
    return getCreativeImageUrl(groupedId) || fallbackThumbUrl;
  }, [selectedVariant, isVideo, groupedId, fallbackThumbUrl]);

  const posterUrl = selectedVariant?.thumbUrl || fallbackThumbUrl;

  if (!open || !creative) return null;

  const appName =
    displayCreative?.app_name ||
    app?.name ||
    `App ${String(displayCreative?.unified_app_id || '').slice(0, 8)}`;
  const publisher =
    displayCreative?.publisher_name || app?.publisher || '—';
  const appIconUrl = displayCreative?.app_icon_url || app?.iconUrl;
  const network = displayCreative?.network || '—';
  const adTypeLabel = getCreativePrimaryAdTypeLabel(displayCreative, GALLERY_AD_TYPES);
  const formatLabel = formatCreativeFacetValues(
    displayCreative?.grouped_creative_ad_formats,
    GALLERY_AD_TYPES
  );
  const placementLabel = formatCreativeFacetValues(
    displayCreative?.grouped_creative_placements,
    GALLERY_PLACEMENTS
  );
  const shareText = formatSharePercent(displayCreative?.grouped_creative_share);
  const activeDuration = formatCreativeActiveDuration(
    displayCreative?.grouped_creative_first_seen_at,
    displayCreative?.grouped_creative_last_seen_at
  );
  const adCopy =
    selectedVariant?.caption ||
    displayCreative?.grouped_creative_text ||
    displayCreative?.grouped_creative_headline ||
    displayCreative?.grouped_creative_body ||
    '';
  const ctaText = selectedVariant?.cta || '—';
  const videoDurationLabel = formatVideoDurationSeconds(selectedVariant?.duration);
  const dimensionsLabel = formatCreativeDimensions(
    selectedVariant?.width ?? displayCreative?.creative_width,
    selectedVariant?.height ?? displayCreative?.creative_height
  );
  const regionsLabel = formatCreativeRegionsZh(displayCreative?.grouped_creative_regions);
  const landingPageUrl = selectedVariant?.landingPageUrl;
  const landingPageLabel = landingPageUrl
    ? (() => {
        const stripped = landingPageUrl.replace(/^https?:\/\//, '');
        return stripped.length > 52 ? `${stripped.slice(0, 52)}…` : stripped;
      })()
    : '—';

  const thumbStripItems =
    variants.length > 0
      ? variants
      : fallbackThumbUrl
        ? [{ id: 'fallback', thumbUrl: fallbackThumbUrl, adType: isVideo ? 'video' : 'image' }]
        : [];

  return (
    <div className="st-creative-detail" role="presentation" onClick={onClose}>
      <div
        className="st-creative-detail__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="st-creative-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="st-creative-detail__header">
          <div className="st-creative-detail__header-main">
            {appIconUrl ? (
              <img className="st-creative-detail__app-icon" src={appIconUrl} alt="" />
            ) : (
              <span
                className="st-creative-detail__app-icon st-creative-detail__app-icon--placeholder"
                style={{ backgroundColor: app?.accent || '#5c6bc0' }}
              >
                {appName.charAt(0)}
              </span>
            )}
            <div className="st-creative-detail__header-text">
              <h2 id="st-creative-detail-title" className="st-creative-detail__title">
                {appName}
              </h2>
              <p className="st-creative-detail__subtitle">
                {adTypeLabel} · {publisher}
              </p>
            </div>
          </div>
          <button type="button" className="st-creative-detail__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="st-creative-detail__body">
          <div className="st-creative-detail__media">
            <div className="st-creative-detail__player-wrap">
              {loading ? (
                <div className="st-creative-detail__media-loading" role="status">
                  <span className="st-creative-detail__media-loading-spinner" aria-hidden />
                  <span>正在加载创意媒体…</span>
                </div>
              ) : isVideo && mediaUrl ? (
                <video
                  key={selectedVariant?.id || groupedId}
                  className="st-creative-detail__video"
                  src={mediaUrl}
                  poster={posterUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : mediaUrl ? (
                <img
                  key={selectedVariant?.id || groupedId}
                  className="st-creative-detail__image"
                  src={mediaUrl}
                  alt=""
                />
              ) : (
                <div className="st-creative-detail__media-empty">暂无预览</div>
              )}
            </div>
            {error ? <p className="st-creative-detail__media-error">{error}</p> : null}
            {thumbStripItems.length > 0 ? (
              <div className="st-creative-detail__thumb-strip">
                {thumbStripItems.map((variant, idx) => {
                  const isActive = variants.length ? idx === selectedVariantIndex : idx === 0;
                  const thumb = variant.thumbUrl || fallbackThumbUrl;
                  const variantIsVideo = variant.adType === 'video' || isVideo;
                  return (
                    <button
                      key={variant.id || idx}
                      type="button"
                      className={`st-creative-detail__thumb-item${isActive ? ' st-creative-detail__thumb-item--active' : ''}`}
                      onClick={() => setSelectedVariantIndex(idx)}
                      aria-label={`查看素材变体 ${idx + 1}`}
                      aria-pressed={isActive}
                    >
                      {thumb ? <img src={thumb} alt="" /> : null}
                      {variantIsVideo ? <CreativeThumbPlayOverlay size="sm" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="st-creative-detail__info">
            <div className="st-creative-detail__highlights">
              <div className="st-creative-detail__highlight">
                <span className="st-creative-detail__highlight-label">展示份额</span>
                <strong className="st-creative-detail__highlight-value">{shareText}</strong>
              </div>
              <div className="st-creative-detail__highlight">
                <span className="st-creative-detail__highlight-label">网络</span>
                <span className="st-creative-detail__network">
                  <NetworkIcon
                    network={network}
                    className="st-creative-detail__network-badge"
                    size={24}
                    title={network}
                  />
                  <span>{network}</span>
                </span>
              </div>
            </div>

            <dl className="st-creative-detail__fields">
              <DetailField label="类型" value={adTypeLabel} />
              <DetailField label="格式" value={formatLabel} />
              <DetailField label="投放位置" value={placementLabel} />
              <DetailField
                label="首次看到"
                value={formatGalleryDateShort(displayCreative?.grouped_creative_first_seen_at)}
              />
              <DetailField
                label="最后看到"
                value={formatGalleryDateShort(displayCreative?.grouped_creative_last_seen_at)}
              />
              <DetailField label="持续时间" value={activeDuration} />
            </dl>

            <div className="st-creative-detail__chart-block">
              <h3 className="st-creative-detail__chart-title">曝光份额趋势</h3>
              <ShareTrendChart timeSeries={shareTimeSeries} width={360} height={160} />
            </div>

            <CollapsibleSection title="创意文本">
              <TextBlock label="广告文案" value={adCopy} />
              <TextBlock label="行动号召" value={ctaText} />
            </CollapsibleSection>

            <CollapsibleSection title="创意属性">
              <dl className="st-creative-detail__attrs">
                {isVideo ? (
                  <DetailField label="视频时长" value={videoDurationLabel} />
                ) : null}
                <DetailField label="尺寸" value={dimensionsLabel} />
                <DetailField label="国家/地区" value={regionsLabel} />
                <DetailField
                  label="落地页"
                  value={landingPageLabel}
                  href={landingPageUrl || undefined}
                />
              </dl>
            </CollapsibleSection>
          </div>
        </div>

        <footer className="st-creative-detail__footer">
          <div className="st-creative-detail__footer-left">
            <button type="button" className="st-creative-detail__btn st-creative-detail__btn--primary" disabled title="敬请期待">
              导出创意
            </button>
            <button type="button" className="st-creative-detail__btn st-creative-detail__btn--outline" disabled title="敬请期待">
              分享创意
            </button>
          </div>
          <div className="st-creative-detail__pager">
            <button
              type="button"
              className="st-creative-detail__pager-btn"
              onClick={onPrev}
              disabled={!canPrev}
            >
              ‹ 返回
            </button>
            <span className="st-creative-detail__pager-info">
              {rank != null ? rank.toLocaleString() : '—'}
              {totalCount != null ? ` / ${Number(totalCount).toLocaleString()}` : ''}
            </span>
            <button
              type="button"
              className="st-creative-detail__pager-btn"
              onClick={onNext}
              disabled={!canNext}
            >
              下一个 ›
            </button>
          </div>
          <button type="button" className="st-creative-detail__report" disabled title="敬请期待">
            报告问题
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CreativeDetailModal;
