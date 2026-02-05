import React, { useMemo } from 'react';
import { Modal, Tooltip } from 'antd';
import './InsightrackrDetailModal.css';

function formatDateYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.split(' ')[0]);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}.${month}.${day}`;
}

function renderWithRedHighlight(str) {
  if (str == null || typeof str !== 'string') return null;
  const re = /<font color='red'>(.*?)<\/font>/g;
  const parts = [];
  let lastIndex = 0;
  let key = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<React.Fragment key={key++}>{str.slice(lastIndex, m.index)}</React.Fragment>);
    }
    parts.push(<span key={key++} style={{ color: 'red' }}>{m[1]}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(<React.Fragment key={key++}>{str.slice(lastIndex)}</React.Fragment>);
  }
  return parts.length === 0 ? str : <>{parts}</>;
}

/**
 * Insightrackr 卡片详情弹窗：左图右文，与参考设计一致
 * @param {Object} item - 创意列表项
 * @param {Array} mediaChannels - 流量渠道列表（来自 mediaDistribute）
 * @param {Array} appList - 应用列表（来自 appDistribute）
 * @param {boolean} open - 是否打开
 * @param {function} onClose - 关闭回调
 * @param {function} onRequestVideoDownload - 下载视频回调（可选）
 */
function InsightrackrDetailModal({ item, mediaChannels = [], appList = [], open, onClose, onRequestVideoDownload }) {
  const { isVideo, thumbnailUrl, videoUrl } = useMemo(() => {
    if (!item) return { isVideo: false, thumbnailUrl: '', videoUrl: '' };
    const isVideo = item.materialType === 2 || (item.videoUrl && item.videoUrl.trim() !== '');
    let thumb = '';
    let video = '';
    if (isVideo) {
      video = item.videoUrl || '';
      thumb = item.thumbnailConverUrl?.trim() || item.converUrl?.trim()
        || (item.thumbnailImageUrl?.[0]) || (item.imageUrl?.[0]) || '';
    } else {
      thumb = item.thumbnailImageUrl?.[0] || item.imageUrl?.[0] || '';
    }
    return { isVideo, thumbnailUrl: thumb, videoUrl: video };
  }, [item]);

  const appSource = appList.length > 0 ? appList : (item?.appList || []);
  const appInfo = appSource[0];
  const appName = appInfo?.name?.replace(/<font color='red'>|<\/font>/g, '') || '';
  const appLogo = appInfo?.logo;
  const appDeveloper = appInfo?.developer ?? '';
  const appProductTypeArr = appInfo?.productType ?? appInfo?.deviceList ?? [];
  const appProductTypeLabel = Array.isArray(appProductTypeArr) && appProductTypeArr.includes(2)
    ? 'iOS App'
    : (Array.isArray(appProductTypeArr) && appProductTypeArr.includes(1) ? 'Android App' : (appInfo?.productTypeName || ''));

  const titleText = item?.title?.replace(/<font color='red'>|<\/font>/g, '') || '';
  const descText = item?.describe?.replace(/<font color='red'>|<\/font>/g, '') || '';
  const lifecycleDays = item?.findCntSum != null ? item.findCntSum : (item?.findCnt ?? '');
  const lifecycleStart = formatDateYYYYMMDD(item?.globalFirstTime);
  const lifecycleEnd = formatDateYYYYMMDD(item?.globalLastTime);

  // 投放设备：常见字段 deviceType / platform，1 或 '1' 为 Android，2 或 '2' 为 iOS
  const deviceType = item?.deviceType ?? item?.platform ?? item?.device;
  const deviceLabel = deviceType === 2 || deviceType === '2' ? 'iOS' : (deviceType === 1 || deviceType === '1' ? 'Android' : (item?.deviceName || '—'));

  // 素材规格：图片/视频 - 竖版/横版 - 宽*高
  const w = item?.width ?? item?.materialWidth;
  const h = item?.height ?? item?.materialHeight;
  const mediaLabel = isVideo ? '视频' : '图片';
  const orient = (w != null && h != null) ? (w >= h ? '横版' : '竖版') : '';
  const sizeStr = (w != null && h != null) ? `${w}*${h}` : '';
  const specLabel = [mediaLabel, orient, sizeStr].filter(Boolean).join(' - ') || (isVideo ? '视频' : '图片');

  const impressionVal = item?.impression ?? '';
  const creativeCntVal = item?.creativeCnt ?? '';
  const countryName = item?.countryName ?? item?.country ?? item?.region ?? '—';

  // 数据统计时间
  const statsTimeStart = lifecycleStart ? lifecycleStart.replace(/\./g, '-') : '—';
  const statsTimeEnd = lifecycleEnd ? lifecycleEnd.replace(/\./g, '-') : '—';

  const handleDownload = (e) => {
    e.stopPropagation();
    if (isVideo && onRequestVideoDownload) {
      onRequestVideoDownload(item);
      onClose?.();
      return;
    }
    const url = isVideo ? videoUrl : thumbnailUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = (titleText || appName || 'creative') + '_' + Date.now() + (isVideo ? '.mp4' : '.jpg');
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  if (!item) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640 + 460 + 24}
      className="insightrackr-detail-modal"
      centered
      destroyOnClose
      closable={false}
    >
      <div className="insightrackr-detail-wrap">
        <div className="insightrackr-detail-left">
          <div className="insightrackr-detail-media">
            {isVideo && videoUrl ? (
              <video src={videoUrl} controls className="insightrackr-detail-video" />
            ) : (
              <img src={thumbnailUrl || undefined} alt="创意素材" className="insightrackr-detail-img" />
            )}
          </div>
        </div>
        <div className="insightrackr-detail-right">
          <div className="insightrackr-detail-body">
            <div className="insightrackr-detail-section insightrackr-detail-basic">
              <div className="insightrackr-detail-grid">
                <div className="insightrackr-detail-label">标题</div>
                <span className="insightrackr-detail-value link line-clamp-2" title={titleText}>
                  {renderWithRedHighlight(item.title) || '—'}
                </span>
                <div className="insightrackr-detail-label">描述</div>
                <span className="insightrackr-detail-value link line-clamp-2" title={descText}>
                  {renderWithRedHighlight(item.describe) || '—'}
                </span>
              </div>
            </div>
            <div className="insightrackr-detail-section insightrackr-detail-metrics">
              <div className="insightrackr-detail-metrics-inner">
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">生命周期</div>
                  <div className="insightrackr-detail-value-inline">
                    <span>{lifecycleDays}天</span>
                    <span className="insightrackr-detail-muted">
                      ({lifecycleStart} - {lifecycleEnd})
                    </span>
                  </div>
                </div>
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">投放设备</div>
                  <div className="insightrackr-detail-value-inline insightrackr-detail-device">
                    {deviceLabel === 'Android' && (
                      <span className="insightrackr-detail-icon-android" aria-hidden>Android</span>
                    )}
                    {deviceLabel === 'iOS' && (
                      <span className="insightrackr-detail-icon-ios" aria-hidden>iOS</span>
                    )}
                    <span className="insightrackr-detail-device-text">{deviceLabel}</span>
                  </div>
                </div>
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">素材规格</div>
                  <div className="insightrackr-detail-value-inline truncate">{specLabel}</div>
                </div>
              </div>
            </div>
            <div className="insightrackr-detail-section insightrackr-detail-stats">
              <div className="insightrackr-detail-stats-inner">
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">曝光预估</div>
                  <span className="insightrackr-detail-num">{impressionVal !== '' ? Number(impressionVal).toLocaleString() : '—'}</span>
                </div>
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">关联创意组数</div>
                  <span className="insightrackr-detail-num">{creativeCntVal !== '' ? creativeCntVal : '—'}</span>
                </div>
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">投放国家/地区</div>
                  <span className="insightrackr-detail-value-inline truncate" title={countryName}>{countryName}</span>
                </div>
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">流量渠道</div>
                  <div className="insightrackr-detail-channels">
                    {mediaChannels.length > 0 ? (
                      mediaChannels.map((ch) => (
                        <span key={ch.id || ch.name} className="insightrackr-detail-channel" title={ch.name}>
                          {ch.logo ? <img src={ch.logo} alt="" className="insightrackr-detail-channel-img" /> : <span>{ch.name}</span>}
                          {ch.cnt != null && <span className="insightrackr-detail-muted">{ch.cnt}</span>}
                        </span>
                      ))
                    ) : (
                      <span className="insightrackr-detail-muted">—</span>
                    )}
                  </div>
                </div>
                <div className="insightrackr-detail-row">
                  <div className="insightrackr-detail-label">在投广告平台</div>
                  <div className="insightrackr-detail-channels">
                    {mediaChannels.length > 0 ? (
                      mediaChannels.slice(0, 3).map((ch) => (
                        <span key={ch.id || ch.name} className="insightrackr-detail-channel" title={ch.name}>
                          {ch.logo ? <img src={ch.logo} alt="" className="insightrackr-detail-channel-img" /> : ch.name}
                        </span>
                      ))
                    ) : (
                      <span className="insightrackr-detail-muted">—</span>
                    )}
                  </div>
                </div>
                <div className="insightrackr-detail-row insightrackr-detail-app-row">
                  <div className="insightrackr-detail-label">在投应用</div>
                  <div className="insightrackr-detail-apps">
                    {(appLogo || appName) ? (
                      <Tooltip
                        title={
                          <div className="insightrackr-detail-app-tooltip">
                            <div className="insightrackr-detail-app-tooltip-row">
                              <span className="insightrackr-detail-app-tooltip-label">产品名称</span>
                              <span className="insightrackr-detail-app-tooltip-value">{appName || '—'}</span>
                            </div>
                            <div className="insightrackr-detail-app-tooltip-row">
                              <span className="insightrackr-detail-app-tooltip-label">产品类型</span>
                              <span className="insightrackr-detail-app-tooltip-value">{appProductTypeLabel || '—'}</span>
                            </div>
                            <div className="insightrackr-detail-app-tooltip-row">
                              <span className="insightrackr-detail-app-tooltip-label">开发者</span>
                              <span className="insightrackr-detail-app-tooltip-value">{appDeveloper || '—'}</span>
                            </div>
                          </div>
                        }
                        overlayInnerStyle={{ minWidth: 320, maxWidth: 480 }}
                      >
                        {appLogo ? (
                          <img src={appLogo} alt="" className="insightrackr-detail-app-logo" />
                        ) : (
                          <span className="insightrackr-detail-app-name">{appName}</span>
                        )}
                      </Tooltip>
                    ) : (
                      <span className="insightrackr-detail-muted">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="insightrackr-detail-footer-note">
              *数据统计时间：{statsTimeStart} ~ {statsTimeEnd}
            </div>
          </div>
        </div>
        <button type="button" className="insightrackr-detail-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
    </Modal>
  );
}

export default InsightrackrDetailModal;
