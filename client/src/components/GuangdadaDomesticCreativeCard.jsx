import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Tooltip } from 'antd';
import { domesticApiCategoryIdsToLabels } from '../data/domesticCnGameClassifications';
import {
  formatDomesticImpressionDisplay,
  getDomesticVideoUrl,
  isDomesticVideoItem,
} from '../utils/domesticCreativeFormat';
import { getProxiedMediaUrl } from '../utils/api';
import { GUANGDADA_DOMESTIC_METRIC_TOOLTIPS } from '../data/guangdadaDomesticMetricTooltips';
import { getDomesticChannelMediaLabel } from '../data/guangdadaDomesticChannelMedia';
import DomesticChannelIcon from './DomesticChannelIcon';
import iosSvg from '../../assets/ios.svg';
import androidSvg from '../../assets/android.svg';
import wxXiaochengxuPng from '../../assets/wx-xiaochengxu.png';
import wxXiaoyouxiPng from '../../assets/wx-xiaoyouxi.png';
import './GuangdadaDomesticCreativeCard.css';

/** 与筛选「系统」一致：1 iOS、2 安卓、21 微信小程序、22 微信小游戏 */
const DOMESTIC_OS_ICON_BY_VALUE = {
  1: { src: iosSvg, title: 'iOS' },
  2: { src: androidSvg, title: '安卓' },
  21: { src: wxXiaochengxuPng, title: '微信小程序' },
  22: { src: wxXiaoyouxiPng, title: '微信小游戏' },
};

function normalizeDomesticOsList(relatedOs, appOs) {
  const fromRelated = Array.isArray(relatedOs)
    ? relatedOs.map((x) => Number(x)).filter((n) => Number.isFinite(n) && DOMESTIC_OS_ICON_BY_VALUE[n])
    : [];
  if (fromRelated.length > 0) return [...new Set(fromRelated)];
  const n = Number(appOs);
  if (Number.isFinite(n) && DOMESTIC_OS_ICON_BY_VALUE[n]) return [n];
  return [];
}

function GuangdadaDomesticCreativeCard({
  item,
  onOpenDetail,
  batchMode = false,
  selected = false,
  onToggleSelect,
  onEnterBatchMode,
}) {
  const videoRef = useRef(null);
  const [previewHover, setPreviewHover] = useState(false);

  useEffect(() => {
    setPreviewHover(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }, [item?.material_key]);

  const preview = item?.preview_img || item?.resources?.[0] || '';
  /** 与广大大国际版视频一致：zingfront CDN 防盗链时走 /api/proxy-media */
  const previewDisplay = useMemo(() => getProxiedMediaUrl(preview), [preview]);
  const appLogoSrc = useMemo(() => {
    const u = item?.app_logo;
    if (!u || typeof u !== 'string') return '';
    return getProxiedMediaUrl(u);
  }, [item?.app_logo]);
  const titleLine = (item?.title || item?.body || '').trim() || '—';
  const storeUrl = item?.store_url;
  const catLabels = useMemo(() => domesticApiCategoryIdsToLabels(item?.app_category || []), [item?.app_category]);
  const primaryCat = catLabels[0] || '—';
  const moreCats = catLabels.length > 1 ? catLabels.slice(1).join('、') : '';
  const relatedCount = Array.isArray(item?.related_product) ? item.related_product.length : 0;
  const channelIds = Array.isArray(item?.related_channel) ? item.related_channel : [];
  const channelCount = channelIds.length;
  const channelIconsPreview = channelIds.slice(0, 5);
  const impressionFmt = formatDomesticImpressionDisplay(item?.impression);
  const showVideo = isDomesticVideoItem(item);
  const videoUrl = useMemo(() => getDomesticVideoUrl(item), [item]);

  const osValues = useMemo(
    () => normalizeDomesticOsList(item?.related_os, item?.app_os),
    [item?.related_os, item?.app_os]
  );

  const handlePreviewEnter = useCallback(() => {
    if (!showVideo || !videoUrl) return;
    setPreviewHover(true);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.src = getProxiedMediaUrl(videoUrl);
      v.play().catch(() => {});
    });
  }, [showVideo, videoUrl]);

  const handlePreviewLeave = useCallback(() => {
    setPreviewHover(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }, []);

  const hasOs = osValues.length > 0;
  const hasCategory = catLabels.length > 0;
  const categoryRowEcomOnly = !hasOs && !hasCategory;

  const osIcons = !hasOs ? (
    <span className="gdd-creative-card__os-txt">—</span>
  ) : (
      osValues.map((val, idx) => {
        const cfg = DOMESTIC_OS_ICON_BY_VALUE[val];
        return (
          <img
            key={`${item?.material_key || 'm'}-os-${idx}-${val}`}
            src={cfg.src}
            alt={cfg.title}
            className="gdd-creative-card__os-icon"
            title={cfg.title}
          />
        );
      })
    );

  const openDetail = useCallback(() => {
    onOpenDetail?.();
  }, [onOpenDetail]);

  const handleArticleClick = useCallback(
    (e) => {
      if (e.target.closest('.batch-card-checkbox')) return;
      if (onOpenDetail) openDetail();
    },
    [onOpenDetail, openDetail]
  );

  const handleCheckboxClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (!batchMode && onEnterBatchMode) {
        onEnterBatchMode();
      }
      onToggleSelect?.();
    },
    [batchMode, onEnterBatchMode, onToggleSelect]
  );

  return (
    <article
      className={`gdd-creative-card${onOpenDetail ? ' gdd-creative-card--clickable' : ''}${batchMode ? ' gdd-creative-card--batch-mode' : ''}`}
      onClick={onOpenDetail ? handleArticleClick : undefined}
    >
      <div className="gdd-creative-card__top">
        <div
          className="gdd-creative-card__preview-wrap"
          onMouseEnter={handlePreviewEnter}
          onMouseLeave={handlePreviewLeave}
        >
          <div
            className={`batch-card-checkbox ${selected ? 'batch-card-checkbox--checked' : ''}`}
            onClick={handleCheckboxClick}
            role="button"
            aria-label={selected ? '取消选择' : '选择'}
          >
            {selected ? '✓' : ''}
          </div>
          {preview ? (
            showVideo ? (
              <>
                <img
                  src={previewDisplay}
                  alt=""
                  className="gdd-creative-card__preview-img gdd-creative-card__preview-img--blur-bg"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <img
                  src={previewDisplay}
                  alt=""
                  className={`gdd-creative-card__preview-img gdd-creative-card__preview-img--video-contain${previewHover ? ' gdd-creative-card__preview-img--video-poster-hidden' : ''}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <img
                src={previewDisplay}
                alt=""
                className="gdd-creative-card__preview-img"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <div className="gdd-creative-card__preview-placeholder">无预览</div>
          )}
          {showVideo && videoUrl ? (
            <video
              ref={videoRef}
              className="gdd-creative-card__preview-hover-video"
              muted
              playsInline
              loop
              preload="none"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="gdd-creative-card__preview-gradient" />
          {showVideo && !previewHover && (
            <div className="gdd-creative-card__video-badge" aria-hidden>
              <span className="gdd-creative-card__play">▶</span>
            </div>
          )}
        </div>
        <div className="gdd-creative-card__body-bar">
          <p className="gdd-creative-card__body-text" title={titleLine}>
            {titleLine}
          </p>
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="gdd-creative-card__cta"
              onClick={(e) => e.stopPropagation()}
            >
              查看落地页
            </a>
          ) : null}
        </div>
      </div>

      <div className="gdd-creative-card__title-block">
        <img
          src={appLogoSrc}
          alt=""
          className="gdd-creative-card__app-logo"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.target.style.visibility = 'hidden';
          }}
        />
        <div className="gdd-creative-card__title-text">
          <div className="gdd-creative-card__name-line">
            <span className="gdd-creative-card__app-name" title={item?.app_name}>
              {item?.app_name || '—'}
            </span>
            <span className="gdd-creative-card__dates">
              {item?.first_seen || '—'} ~ {item?.last_seen || '—'}
            </span>
          </div>
          <div className="gdd-creative-card__sub-line">
            <span className="gdd-creative-card__domain" title={item?.app_developer || item?.domain}>
              {item?.app_developer || item?.domain || item?.store_id || '—'}
            </span>
            <span className="gdd-creative-card__channel-meta">
              <span className="gdd-creative-card__channel-icons">
                {channelIconsPreview.map((cid, i) => (
                  <DomesticChannelIcon
                    key={`${item?.material_key || 'm'}-ch-${i}-${cid}`}
                    channelId={cid}
                    size={14}
                    title={getDomesticChannelMediaLabel(cid)}
                  />
                ))}
              </span>
              <span className="gdd-creative-card__channel-num">{channelCount || 0}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="gdd-creative-card__category-row">
        {categoryRowEcomOnly ? (
          <span className="gdd-creative-card__category-ecom">电商</span>
        ) : (
          <>
            <span className="gdd-creative-card__os">{osIcons}</span>
            <i className="gdd-creative-card__vline" />
            <span className="gdd-creative-card__cat-primary">{primaryCat}</span>
            {moreCats ? (
              <>
                <i className="gdd-creative-card__vline gdd-creative-card__vline--sm" />
                <span className="gdd-creative-card__cat-more" title={catLabels.join('、')}>
                  {moreCats}
                </span>
              </>
            ) : null}
          </>
        )}
        <span className="gdd-creative-card__products">{relatedCount}个产品使用</span>
      </div>

      <div className="gdd-creative-card__metrics">
        <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.days} overlayStyle={{ maxWidth: 360 }} mouseEnterDelay={0.2}>
          <div className="gdd-creative-card__metric gdd-creative-card__metric--tooltip">
            <p className="gdd-creative-card__metric-val">{item?.days ?? '—'}</p>
            <p className="gdd-creative-card__metric-label">投放天数</p>
          </div>
        </Tooltip>
        <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.creatives} overlayStyle={{ maxWidth: 360 }} mouseEnterDelay={0.2}>
          <div className="gdd-creative-card__metric gdd-creative-card__metric--tooltip">
            <p className="gdd-creative-card__metric-val">{item?.creatives_arr ?? '—'}</p>
            <p className="gdd-creative-card__metric-label">创意组数</p>
          </div>
        </Tooltip>
        <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.impression} overlayStyle={{ maxWidth: 360 }} mouseEnterDelay={0.2}>
          <div className="gdd-creative-card__metric gdd-creative-card__metric--tooltip">
            <p className="gdd-creative-card__metric-val">
              <span>{impressionFmt.main}</span>
              {impressionFmt.unit ? <span className="gdd-creative-card__metric-unit">{impressionFmt.unit}</span> : null}
            </p>
            <p className="gdd-creative-card__metric-label">展示估值</p>
          </div>
        </Tooltip>
        <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.heat} overlayStyle={{ maxWidth: 360 }} mouseEnterDelay={0.2}>
          <div className="gdd-creative-card__metric gdd-creative-card__metric--tooltip">
            <p className="gdd-creative-card__metric-val">{item?.heat ?? '—'}</p>
            <p className="gdd-creative-card__metric-label">热度</p>
          </div>
        </Tooltip>
      </div>

      <button type="button" className="gdd-creative-card__detail">
        查看详情
      </button>
    </article>
  );
}

export default GuangdadaDomesticCreativeCard;
