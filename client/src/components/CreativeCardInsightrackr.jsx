import React, { useMemo, useState } from 'react';

// 将日期格式化为 DD.MM.YY（如 26.01.01）
function formatDateDDMMYY(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.split(' ')[0]);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${year}.${month}.${day}`;
}

// 解析 <font color='red'>...</font> 并渲染为标红 React 节点，无标签则返回纯文本
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

function CreativeCardInsightrackr({ item, sortField = '11', sortRule = 'desc', mediaChannels = [], appList = [], batchMode = false, selected = false, onToggleSelect, onEnterBatchMode, onOpenDetail, onRequestVideoDownload, isPlayable = false }) {
  // 试玩广告：用 playHtmlUrl 在卡片内嵌 iframe 展示，无详情弹窗
  const playHtmlUrl = isPlayable && item.playHtmlUrl ? (item.playHtmlUrl.trim() || '') : '';
  // 使用 useMemo 缓存计算结果
  const { isVideo, thumbnailUrl, videoUrl } = useMemo(() => {
    if (isPlayable) return { isVideo: false, thumbnailUrl: '', videoUrl: '' };
    const isVideo = item.materialType === 2 || (item.videoUrl && item.videoUrl.trim() !== '');
    
    let thumbnailUrl = '';
    let videoUrl = '';
    if (isVideo) {
      videoUrl = item.videoUrl || '';
      thumbnailUrl = item.thumbnailConverUrl && item.thumbnailConverUrl.trim() !== ''
        ? item.thumbnailConverUrl
        : (item.converUrl && item.converUrl.trim() !== ''
          ? item.converUrl
          : (item.thumbnailImageUrl && item.thumbnailImageUrl.length > 0
            ? item.thumbnailImageUrl[0]
            : (item.imageUrl && item.imageUrl.length > 0
              ? item.imageUrl[0]
              : '')));
    } else {
      thumbnailUrl = item.thumbnailImageUrl && item.thumbnailImageUrl.length > 0
        ? item.thumbnailImageUrl[0]
        : (item.imageUrl && item.imageUrl.length > 0
          ? item.imageUrl[0]
          : '');
    }
    
    return { isVideo, thumbnailUrl, videoUrl };
  }, [isPlayable, item.materialType, item.videoUrl, item.thumbnailConverUrl, item.converUrl, item.thumbnailImageUrl, item.imageUrl]);
  
  // 使用 state 来跟踪图片加载错误和视频播放状态
  const [imageError, setImageError] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // 应用信息：优先使用 distribute/app 返回的 appList，否则回退到 item.appList
  const appSource = appList.length > 0 ? appList : (item.appList || []);
  // 去标签后的名称（用于下载文件名等）
  const appName = appSource.length > 0
    ? (appSource[0].name || '').replace(/<font color='red'>|<\/font>/g, '') || ''
    : '';
  // 原始名称（用于展示标红）
  const appNameRaw = appSource.length > 0 ? (appSource[0].name || '') : '';
  const developerNameRaw = appSource.length > 0 ? (appSource[0].developer ?? '') : '';
  const appLogo = appSource.length > 0 ? appSource[0].logo : null;

  // 生命周期：findCntSum 天数，日期格式 DD.MM.YY
  const lifecycleDays = item.findCntSum != null ? item.findCntSum : (item.findCnt != null ? item.findCnt : '');
  const lifecycleStart = formatDateDDMMYY(item.globalFirstTime);
  const lifecycleEnd = formatDateDDMMYY(item.globalLastTime);

  // 曝光预估、关联创意组数（用于 card-lifecycle）
  const formatImpression = (val) => {
    if (val == null || val === '') return null;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
    return String(n);
  };
  const formatCreativeCnt = (val) => {
    if (val == null || val === '') return null;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
    return String(n);
  };
  const impressionDisplay = formatImpression(item.impression);
  const creativeCntDisplay = formatCreativeCnt(item.creativeCnt);

  // 根据排序字段格式化标签显示内容
  const getMetricsLabel = useMemo(() => {
    const field = sortField || '11'; // 默认相关性
    
    switch (field) {
      case '11': // 相关性 - 使用 impression 字段
        if (!item.impression) return null;
        const impressionValue = item.impression >= 100000000
          ? `${(item.impression / 100000000).toFixed(0)} 亿`
          : (item.impression >= 10000
            ? `${(item.impression / 10000).toFixed(0)} 万`
            : item.impression.toString());
        return `曝光预估 ${impressionValue}`;
      
      case '14': // 关联创意组数
        if (!item.creativeCnt) return null;
        const creativeValue = item.creativeCnt >= 10000
          ? `${(item.creativeCnt / 10000).toFixed(0)}万`
          : item.creativeCnt.toString();
        return `关联创意组数 ${creativeValue}`;
      
      case '3': // 首次发现时间（向上取整）
        if (!item.globalFirstTime) return null;
        const firstTime = new Date(item.globalFirstTime);
        const now = new Date();
        const hoursDiff = Math.ceil((now - firstTime) / (1000 * 60 * 60));
        let timeStr = '';
        if (hoursDiff < 1) {
          timeStr = '<1h';
        } else if (hoursDiff < 5) {
          timeStr = `<5h`;
        } else if (hoursDiff < 24) {
          timeStr = `<${hoursDiff}h`;
        } else {
          const days = Math.ceil(hoursDiff / 24);
          timeStr = `<${days}d`;
        }
        return `首次发现时间 ${timeStr}`;
      
      case '4': // 投放天数
        if (item.findCnt === undefined || item.findCnt === null) return null;
        const days = item.findCnt || 0;
        return `投放天数 ${days}d`;
      
      case '15': // 曝光预估
        if (!item.impression) return null;
        const exposureValue = item.impression >= 100000000
          ? `${(item.impression / 100000000).toFixed(0)}亿`
          : (item.impression >= 10000
            ? `${(item.impression / 10000).toFixed(0)}万`
            : item.impression.toString());
        return `曝光预估 ${exposureValue}`;
      
      case '8': // 播放
        if (!item.playCnt && item.playCnt !== 0) return null;
        const playValue = item.playCnt >= 100000000
          ? `${(item.playCnt / 100000000).toFixed(0)}亿`
          : (item.playCnt >= 10000
            ? `${(item.playCnt / 10000).toFixed(0)}万`
            : item.playCnt.toString());
        return `播放 ${playValue}`;
      
      case '5': // 点赞
        if (!item.likeCnt && item.likeCnt !== 0) return null;
        const likeValue = item.likeCnt >= 10000
          ? `${(item.likeCnt / 10000).toFixed(0)}万`
          : item.likeCnt.toString();
        return `点赞 ${likeValue}`;
      
      case '6': // 评论
        if (!item.commentCnt && item.commentCnt !== 0) return null;
        const commentValue = item.commentCnt >= 10000
          ? `${(item.commentCnt / 10000).toFixed(0)}万`
          : item.commentCnt.toString();
        return `评论 ${commentValue}`;
      
      case '7': // 转发
        if (!item.shareCnt && item.shareCnt !== 0) return null;
        const shareValue = item.shareCnt >= 10000
          ? `${(item.shareCnt / 10000).toFixed(0)}万`
          : item.shareCnt.toString();
        return `转发 ${shareValue}`;
      
      case '16': // 受众人群数量
        if (!item.adReach && item.adReach !== 0) return null;
        const reachValue = item.adReach >= 100000000
          ? `${(item.adReach / 100000000).toFixed(0)}亿`
          : (item.adReach >= 10000
            ? `${(item.adReach / 10000).toFixed(0)}万`
            : item.adReach.toString());
        return `受众人数数量 ${reachValue}`;
      
      case '17': // 素材热度
        if (!item.heatValue && item.heatValue !== 0) return null;
        const heatValue = item.heatValue >= 10000
          ? `${(item.heatValue / 10000).toFixed(0)}万`
          : item.heatValue.toString();
        return `素材热度 ${heatValue}`;
      
      default:
        // 默认显示曝光预估
        if (!item.impression) return null;
        const defaultValue = item.impression >= 100000000
          ? `${(item.impression / 100000000).toFixed(0)} 亿`
          : (item.impression >= 10000
            ? `${(item.impression / 10000).toFixed(0)} 万`
            : item.impression.toString());
        return `曝光预估 ${defaultValue}`;
    }
  }, [sortField, item.impression, item.creativeCnt, item.globalFirstTime, item.findCnt, item.playCnt, item.likeCnt, item.commentCnt, item.shareCnt, item.adReach, item.heatValue]);

  // 格式化展示次数（保留用于其他地方）
  const impressionEstimate = item.impression
    ? (item.impression >= 1000000000
      ? `${(item.impression / 1000000000).toFixed(0)}B`
      : (item.impression >= 1000000
        ? `${(item.impression / 1000000).toFixed(0)}M`
        : (item.impression >= 1000
          ? `${(item.impression / 1000).toFixed(0)}K`
          : item.impression)))
    : '';

  // 视频时长：videoTimeSpan 单位秒，格式为 MM:SS，例如 12 -> 00:12
  const videoDurationFormatted = useMemo(() => {
    if (!isVideo) return null;
    const sec = item.videoTimeSpan;
    if (sec === undefined || sec === null) return null;
    const s = Math.floor(Number(sec) % 60);
    const m = Math.floor(Number(sec) / 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [isVideo, item.videoTimeSpan]);

  // 提取标题/描述
  const title = item.title
    ? item.title.replace(/<font color='red'>|<\/font>/g, '')
    : (item.describe
      ? item.describe.replace(/<font color='red'>|<\/font>/g, '')
      : 'No Title/Description');

  const handleImageError = (e) => {
    // 防止无限循环：如果已经处理过错误，不再尝试
    if (imageError) {
      return;
    }
    setImageError(true);
    // 使用一个简单的占位符（1x1 透明像素的 data URL）
    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
    e.target.style.backgroundColor = '#f0f0f0';
    e.target.style.opacity = '0.5';
  };

  // 从 URL 解析文件后缀：先去掉查询参数，再从路径取最后一个扩展名
  const getExtensionFromUrl = (urlString) => {
    if (!urlString || typeof urlString !== 'string') return '';
    const pathOnly = urlString.split('?')[0];
    const lastSegment = pathOnly.split('/').pop() || '';
    const match = lastSegment.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : '';
  };

  // 去掉文件名中的特殊字符，保留中文、字母、数字、空格等
  const sanitizeFileName = (str) => {
    if (str == null || typeof str !== 'string') return '';
    return String(str)
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || '';
  };

  // 下载文件名：有标题用标题（去特殊字符），无标题用产品名，再无则用 id
  const getDownloadBaseName = () => {
    const hasTitle = title && title !== 'No Title/Description';
    if (hasTitle) return sanitizeFileName(title);
    if (appName) return sanitizeFileName(appName);
    const id = item.id ?? item.search_flag ?? item.ad_key ?? item.bizId ?? item.materialId ?? '';
    return sanitizeFileName(String(id)) || `creative_${Date.now()}`;
  };

  // 下载素材：视频、图片均走尺寸选择弹窗
  const handleDownload = (e) => {
    e.stopPropagation();
    if (onRequestVideoDownload) {
      onRequestVideoDownload(item);
      return;
    }
    const url = isVideo ? videoUrl : thumbnailUrl;
    if (!url) return;
    const extFromUrl = getExtensionFromUrl(url);
    const ext = isVideo
      ? (extFromUrl === 'mp4' || extFromUrl === 'webm' || extFromUrl === 'mov' ? extFromUrl : 'mp4')
      : (extFromUrl === 'gif' || extFromUrl === 'png' || extFromUrl === 'webp' ? extFromUrl : 'jpg');
    const baseName = getDownloadBaseName();
    const filename = `${baseName}_${Date.now()}.${ext}`;
    fetch(url, { mode: 'cors' })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => {
        window.open(url, '_blank', 'noopener');
      });
  };

  const downloadUrl = isVideo ? videoUrl : thumbnailUrl;

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (!batchMode && onEnterBatchMode) {
      onEnterBatchMode();
    }
    onToggleSelect?.();
  };

  const handleCardClick = (e) => {
    if (e.target.closest('.batch-card-checkbox') || e.target.closest('.card-thumbnail-download') || e.target.closest('.play-icon-center') || e.target.closest('.video-player-modal') || e.target.closest('.card-thumbnail-open-playable')) {
      return;
    }
    onOpenDetail?.(item);
  };

  const effectiveOnOpenDetail = isPlayable ? undefined : onOpenDetail;

  return (
    <div
      className={`creative-card${effectiveOnOpenDetail ? ' creative-card--clickable' : ''}${batchMode ? ' creative-card--batch-mode' : ''}${isPlayable ? ' creative-card--playable' : ''}`}
      role={effectiveOnOpenDetail ? 'button' : undefined}
      tabIndex={effectiveOnOpenDetail ? 0 : undefined}
      onKeyDown={effectiveOnOpenDetail ? (e) => e.key === 'Enter' && handleCardClick(e) : undefined}
      onClick={effectiveOnOpenDetail ? handleCardClick : undefined}
    >
      <div
        className={`batch-card-checkbox ${selected ? 'batch-card-checkbox--checked' : ''}`}
        onClick={handleCheckboxClick}
        role="button"
        aria-label={selected ? '取消选择' : '选择'}
      >
        {selected ? '✓' : ''}
      </div>
      <div className={`card-thumbnail${isPlayable && playHtmlUrl ? ' card-thumbnail--playable' : ''}`}>
        {isPlayable && playHtmlUrl ? (
          <div className="card-thumbnail-playable-wrap">
            <iframe
              src={playHtmlUrl}
              title="试玩广告"
              className="card-thumbnail-iframe"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : !imageError && thumbnailUrl ? (
          <img
            key={thumbnailUrl}
            src={thumbnailUrl}
            alt="Creative Thumbnail"
            onError={handleImageError}
            loading="lazy"
            style={{
              objectFit: 'contain' // 展示完整原图，不裁剪
            }}
          />
        ) : (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '14px'
          }}>
            图片加载失败
          </div>
        )}
        {/* 悬浮在左上角的红色标签 - 根据排序字段动态显示 */}
        {getMetricsLabel && (
          <div className="card-metrics-badge">
            {getMetricsLabel}
          </div>
        )}
        {/* 视频时长 - hover 时显示在右上角 */}
        {isVideo && videoDurationFormatted && (
          <div className="video-duration-badge">{videoDurationFormatted}</div>
        )}
        {/* 试玩广告：在新窗口打开 */}
        {isPlayable && playHtmlUrl && (
          <div className="card-thumbnail-open-playable" onClick={(e) => { e.stopPropagation(); window.open(playHtmlUrl, '_blank', 'noopener'); }}>
            <span className="card-download-icon" title="在新窗口打开试玩">↗</span>
            <span className="card-download-text">打开试玩</span>
          </div>
        )}
        {/* 视频播放按钮 - 居中显示，可点击 */}
        {isVideo && (
          <div 
            className="play-icon-center"
            onClick={(e) => {
              e.stopPropagation();
              if (videoUrl) {
                setShowVideoPlayer(true);
              }
            }}
          >
            <span className="play-symbol">▶</span>
          </div>
        )}
        {/* 下载按钮 - 位于 thumbnail 底部，hover 卡片时显示（试玩广告不显示，改用「打开试玩」） */}
        {!isPlayable && downloadUrl && (
          <div className="card-thumbnail-download" onClick={handleDownload}>
            <span className="card-download-icon" title={isVideo ? '下载视频' : '下载图片'}>⬇</span>
            <span className="card-download-text">{isVideo ? '下载视频' : '下载图片'}</span>
          </div>
        )}
      </div>
      <div className="card-details">
        {/* 组1：标题、描述、流量分布渠道 */}
        <div className="card-details-group">
          {title && title !== 'No Title/Description' && (
            <p className="card-title"><b>标题</b>{' '}{renderWithRedHighlight(item.title || item.describe || '')}</p>
          )}
          {item.describe && item.describe !== title && (
            <p className="card-description"><b>描述</b>{' '}{renderWithRedHighlight(item.describe)}</p>
          )}
          {mediaChannels.length > 0 && (
            <div className="card-media-channels">
              <span className="card-label"><b>流量分布渠道：</b></span>
              <div className="card-channel-icons">
                {mediaChannels.map((ch) => (
                  <span key={ch.id || ch.name} className="channel-item" title={`${ch.name}${ch.cnt != null ? ` (${ch.cnt})` : ''}`}>
                    {ch.logo ? (
                      <img src={ch.logo} alt={ch.name || ''} className="channel-icon" />
                    ) : (
                      <span className="channel-name">{ch.name || ch.id}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* 组2：生命周期、曝光预估、关联创意组数（组间细线分割） */}
        <div className="card-details-group card-details-group--metrics">
          <div className="card-lifecycle-group">
          <p className="card-lifecycle-row">
            <b>生命周期(天)</b>{' '}{lifecycleDays !== '' ? `${lifecycleDays} / ${lifecycleStart} - ${lifecycleEnd}` : '—'}
          </p>
          {impressionDisplay != null && (
            <p className="card-lifecycle-row">
              <b>曝光预估</b>{' '}{impressionDisplay}
            </p>
          )}
          {creativeCntDisplay != null && (
            <p className="card-lifecycle-row">
              <b>关联创意组数</b>{' '}{creativeCntDisplay}
            </p>
          )}
          </div>
        </div>
        {/* Part 4: 广告发行商信息（App 信息） */}
        <div className="card-app-info">
          {appLogo && (
            <img src={appLogo} alt="" className="card-app-logo" />
          )}
          <div>
            {appNameRaw && <p className="card-app-name">{renderWithRedHighlight(appNameRaw)}</p>}
            {developerNameRaw && <p className="card-developer">{renderWithRedHighlight(developerNameRaw)}</p>}
          </div>
        </div>
      </div>
      
      {/* 视频播放模态框 */}
      {showVideoPlayer && isVideo && videoUrl && (
        <div 
          className="video-player-modal"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target.className === 'video-player-modal') {
              setShowVideoPlayer(false);
            }
          }}
        >
          <div className="video-player-container">
            <button 
              type="button"
              className="video-player-close"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoPlayer(false);
              }}
            >
              ×
            </button>
            <video 
              src={videoUrl} 
              controls 
              autoPlay
              className="video-player"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh'
              }}
            >
              您的浏览器不支持视频播放
            </video>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreativeCardInsightrackr;
