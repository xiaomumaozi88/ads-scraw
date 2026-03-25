import React, { useCallback, useEffect, useMemo } from 'react';
import { Modal, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { GUANGDADA_DOMESTIC_METRIC_TOOLTIPS } from '../data/guangdadaDomesticMetricTooltips';
import { domesticMaterialTypeLabel } from '../data/guangdadaDomesticCreativeType';
import { getDomesticChannelMediaLabel } from '../data/guangdadaDomesticChannelMedia';
import DomesticChannelIcon from './DomesticChannelIcon';
import { DOMESTIC_PLACEMENT_LABEL_MAP } from '../data/guangdadaDomesticPlacementByChannel';
import {
  formatDomesticImpressionDisplay,
  getDomesticVideoUrl,
  isDomesticVideoItem,
} from '../utils/domesticCreativeFormat';
import { getProxiedMediaUrl } from '../utils/api';
import './GuangdadaDomesticDetailModal.css';

function ChevronArrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="40" height="40" aria-hidden>
      <path
        d="M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z"
        fill="currentColor"
      />
    </svg>
  );
}

function domesticPlacementLabel(item) {
  const raw = item?.ad_pos ?? item?.ad_position ?? item?.ad_pos_id;
  if (raw == null || raw === '' || Number(raw) === 0) return '';
  return DOMESTIC_PLACEMENT_LABEL_MAP[String(raw)] || '';
}

function domesticChannelDisplayLines(item) {
  const placement = domesticPlacementLabel(item);
  const channels = Array.isArray(item?.related_channel) ? item.related_channel : [];
  if (placement) {
    return [{ key: 'placement', text: placement, channelIds: [...channels] }];
  }
  if (channels.length === 0) return [{ key: 'none', text: '—', channelIds: [] }];
  return channels.map((id, i) => ({
    key: `ch-${i}-${id}`,
    text: getDomesticChannelMediaLabel(id) || String(id),
    channelIds: [id],
  }));
}

function primaryDownloadUrl(item) {
  const v = getDomesticVideoUrl(item);
  if (v) return v;
  const img = item?.preview_img || item?.resources?.[0];
  return typeof img === 'string' ? img : '';
}

function GuangdadaDomesticDetailModal({ open, onClose, list, index, onNavigate, onRequestDownload }) {
  const item = list?.[index];
  const n = list?.length ?? 0;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && n > 1) {
        e.preventDefault();
        onNavigate((index - 1 + n) % n);
      }
      if (e.key === 'ArrowRight' && n > 1) {
        e.preventDefault();
        onNavigate((index + 1) % n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, n, index, onNavigate]);

  const copyText = useMemo(() => {
    const t = (item?.body || item?.title || '').trim();
    return t || '—';
  }, [item?.body, item?.title]);

  const preview = item?.preview_img || item?.resources?.[0] || '';
  const previewDisplay = useMemo(
    () => (typeof preview === 'string' && preview ? getProxiedMediaUrl(preview) : ''),
    [preview]
  );
  const storeUrl = item?.store_url;
  const showVideo = item ? isDomesticVideoItem(item) : false;
  const videoUrl = useMemo(() => (item ? getDomesticVideoUrl(item) : ''), [item?.material_key, item?.resources]);
  const impressionFmt = formatDomesticImpressionDisplay(item?.impression);
  const channelLines = useMemo(
    () => (item ? domesticChannelDisplayLines(item) : []),
    [item?.material_key, item?.related_channel, item?.ad_pos, item?.ad_position]
  );
  const products = Array.isArray(item?.related_product) ? item.related_product : [];
  const productCount = products.length || (item?.app_name ? 1 : 0);
  const firstLogo = products[0]?.app_logo || item?.app_logo || '';
  const firstLogoDisplay = useMemo(
    () => (typeof firstLogo === 'string' && firstLogo ? getProxiedMediaUrl(firstLogo) : ''),
    [firstLogo]
  );
  const timeRange =
    item?.first_seen != null && item?.last_seen != null
      ? `${item.first_seen} ～ ${item.last_seen}`
      : '—';
  const materialType = domesticMaterialTypeLabel(item?.type);
  const sizeStr = item?.preview_img_size || '—';

  const handleDownload = useCallback(() => {
    if (!item) return;
    if (typeof onRequestDownload === 'function') {
      onRequestDownload(item);
      return;
    }
    const url = primaryDownloadUrl(item);
    if (!url) return;
    const proxied = getProxiedMediaUrl(url);
    window.open(proxied, '_blank', 'noopener,noreferrer');
  }, [item, onRequestDownload]);

  const goPrev = useCallback(() => {
    if (n < 2) return;
    onNavigate((index - 1 + n) % n);
  }, [n, index, onNavigate]);

  const goNext = useCallback(() => {
    if (n < 2) return;
    onNavigate((index + 1) % n);
  }, [n, index, onNavigate]);

  return (
    <Modal
      open={open && !!item}
      onCancel={onClose}
      footer={null}
      width={1080}
      centered
      destroyOnClose
      styles={{ body: { padding: '12px 16px 16px' } }}
      title={null}
    >
      <div className="gdd-domestic-detail">
        {n > 1 && (
          <>
            <button type="button" className="gdd-domestic-detail__arrow gdd-domestic-detail__arrow--prev" aria-label="上一条" onClick={goPrev}>
              <ChevronArrow />
            </button>
            <button type="button" className="gdd-domestic-detail__arrow gdd-domestic-detail__arrow--next" aria-label="下一条" onClick={goNext}>
              <ChevronArrow />
            </button>
          </>
        )}

        <div className="gdd-domestic-detail__row">
          <div className="gdd-domestic-detail__left">
            <div className="gdd-domestic-detail__preview-wrap">
              {showVideo && videoUrl ? (
                <video
                  className="gdd-domestic-detail__preview-video"
                  src={getProxiedMediaUrl(videoUrl)}
                  controls
                  playsInline
                  poster={previewDisplay || undefined}
                  preload="metadata"
                  referrerPolicy="no-referrer"
                />
              ) : preview ? (
                <img
                  src={previewDisplay}
                  alt={item?.app_name || ''}
                  className="gdd-domestic-detail__preview-img"
                  referrerPolicy="no-referrer"
                  onClick={() => window.open(previewDisplay || preview, '_blank', 'noopener,noreferrer')}
                />
              ) : (
                <span style={{ color: '#909399', padding: 40 }}>无预览</span>
              )}
            </div>

            <div className="gdd-domestic-detail__text-block">
              <p className="gdd-domestic-detail__copy">{copyText}</p>
              <p className="gdd-domestic-detail__copy">{copyText}</p>
            </div>
            {storeUrl ? (
              <div className="gdd-domestic-detail__cta-row">
                <a href={storeUrl} target="_blank" rel="noopener noreferrer nofollow">
                  <button type="button">查看落地页</button>
                </a>
              </div>
            ) : null}
          </div>

          <div className="gdd-domestic-detail__right">
            <p className="gdd-domestic-detail__material-title">创意信息</p>

            <div className="gdd-domestic-detail__num-row" role="group" aria-label="创意指标">
              <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.days} overlayStyle={{ maxWidth: 360 }}>
                <div className="gdd-domestic-detail__num-item">
                  <p className="gdd-domestic-detail__num-val">{item?.days ?? '—'}</p>
                  <p className="gdd-domestic-detail__num-label">投放天数</p>
                </div>
              </Tooltip>
              <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.creatives} overlayStyle={{ maxWidth: 360 }}>
                <div className="gdd-domestic-detail__num-item">
                  <p className="gdd-domestic-detail__num-val">{item?.creatives_arr ?? '—'}</p>
                  <p className="gdd-domestic-detail__num-label">创意组数</p>
                </div>
              </Tooltip>
              <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.impression} overlayStyle={{ maxWidth: 360 }}>
                <div className="gdd-domestic-detail__num-item">
                  <p className="gdd-domestic-detail__num-val">
                    <span>{impressionFmt.main}</span>
                    {impressionFmt.unit ? (
                      <span className="gdd-domestic-detail__num-unit">{impressionFmt.unit}</span>
                    ) : null}
                  </p>
                  <p className="gdd-domestic-detail__num-label">展示估值</p>
                </div>
              </Tooltip>
              <Tooltip title={GUANGDADA_DOMESTIC_METRIC_TOOLTIPS.heat} overlayStyle={{ maxWidth: 360 }}>
                <div className="gdd-domestic-detail__num-item">
                  <p className="gdd-domestic-detail__num-val">{item?.heat ?? '—'}</p>
                  <p className="gdd-domestic-detail__num-label">热度</p>
                </div>
              </Tooltip>
            </div>

            <ul className="gdd-domestic-detail__meta">
              <li>
                <span className="gdd-domestic-detail__meta-title">投放渠道 :</span>
                <div className="gdd-domestic-detail__meta-body">
                  {channelLines.map((line) => (
                    <div key={line.key} className="gdd-domestic-detail__channel-row">
                      <span className="gdd-domestic-detail__channel-icons">
                        {(line.channelIds || []).map((cid, i) => (
                          <DomesticChannelIcon
                            key={`${line.key}-ic-${i}-${cid}`}
                            channelId={cid}
                            size={16}
                            title={getDomesticChannelMediaLabel(cid)}
                          />
                        ))}
                      </span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              </li>
              <li>
                <span className="gdd-domestic-detail__meta-title">投放产品 :</span>
                <div className="gdd-domestic-detail__meta-body">
                  <div className="gdd-domestic-detail__products-row">
                    {firstLogo ? (
                      <img src={firstLogoDisplay} alt="" className="gdd-domestic-detail__product-logo" referrerPolicy="no-referrer" />
                    ) : null}
                  </div>
                </div>
              </li>
              <li className="gdd-domestic-detail__product-count">共{productCount || 0}个产品</li>
              <li>
                <span className="gdd-domestic-detail__meta-title">投放时间 :</span>
                <span className="gdd-domestic-detail__meta-body">{timeRange}</span>
              </li>
              <li>
                <span className="gdd-domestic-detail__meta-title">素材类型 :</span>
                <span className="gdd-domestic-detail__meta-body">{materialType}</span>
              </li>
              <li>
                <span className="gdd-domestic-detail__meta-title">素材尺寸 :</span>
                <span className="gdd-domestic-detail__meta-body">{sizeStr}</span>
              </li>
            </ul>

            <div className="gdd-domestic-detail__actions">
              <button type="button" className="gdd-domestic-detail__btn-download" onClick={handleDownload}>
                下载素材
                <DownloadOutlined />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default GuangdadaDomesticDetailModal;
