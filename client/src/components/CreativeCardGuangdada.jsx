import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Popover } from 'antd';
import { getProxiedMediaUrl, getDownloadImageUrl } from '../utils/api';

function CreativeCardGuangdada({ item, batchMode = false, selected = false, onToggleSelect, onEnterBatchMode, onOpenDetail, onRequestVideoDownload, onBlockAdvertiser }) {
  // 使用 useMemo 缓存计算结果，避免每次渲染都重新计算
  const { isVideo, thumbnailUrl, videoUrl, videoDuration, htmlUrl } = useMemo(() => {
    let isVideo = false;
    let thumbnailUrl = '';
    let videoUrl = '';
    let videoDuration = null;
    let htmlUrl = '';
    
    // 判断是否为视频：优先检查 ads_type (2=视频)，其次检查 resource_urls[0].type (2=视频)，最后检查是否有 video_url
    const adsTypeIsVideo = item.ads_type === 2;
    const resourceTypeIsVideo = item.resource_urls && 
                                Array.isArray(item.resource_urls) && 
                                item.resource_urls.length > 0 && 
                                item.resource_urls[0].type === 2;
    const hasVideoUrl = item.resource_urls && 
                       Array.isArray(item.resource_urls) && 
                       item.resource_urls.length > 0 && 
                       item.resource_urls[0].video_url && 
                       item.resource_urls[0].video_url.trim() !== '';
    
    isVideo = adsTypeIsVideo || resourceTypeIsVideo || hasVideoUrl;
    
    if (item.resource_urls && Array.isArray(item.resource_urls) && item.resource_urls.length > 0) {
      const resource = item.resource_urls[0];
      // type 4：HTML 资源，支持 iframe 展示
      if (resource.type === 4 && resource.html_url && String(resource.html_url).trim() !== '') {
        htmlUrl = resource.html_url.trim();
      }
      if (isVideo) {
        // 视频资源：优先使用 preview_img_url 作为预览图，否则使用 resource.image_url
        videoUrl = resource.video_url || '';
        thumbnailUrl = item.preview_img_url || resource.image_url || '';
      } else {
        // 图片资源：优先使用 resource.image_url，其次使用 preview_img_url
        thumbnailUrl = resource.image_url || item.preview_img_url || '';
      }
    } else {
      // 如果没有 resource_urls，使用 preview_img_url
      thumbnailUrl = item.preview_img_url || '';
    }
    
    videoDuration = item.video_duration || null;
    
    return { isVideo, thumbnailUrl, videoUrl, videoDuration, htmlUrl };
  }, [item.resource_urls, item.preview_img_url, item.video_duration, item.ad_key, item.ads_type]);

  // 视频时长展示：≥60s 为 "1m12s"，否则 "59s"
  const videoDurationLabel = videoDuration != null && videoDuration !== ''
    ? (() => {
        const sec = typeof videoDuration === 'number' ? videoDuration : parseInt(videoDuration, 10);
        if (Number.isNaN(sec) || sec < 0) return null;
        if (sec >= 60) return `${Math.floor(sec / 60)}m${sec % 60}s`;
        return `${sec}s`;
      })()
    : null;

  // 使用 state 来跟踪图片加载错误，防止无限循环
  const [imageError, setImageError] = useState(false);
  // 视频播放状态
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  /** hover 播放按钮时的预览视频，移出时暂停并清空 src 以释放内存 */
  const videoHoverRef = useRef(null);
  /** 从悬停播放按钮到视频开始播放之间的加载状态，用于显示加载动画 */
  const [isHoverVideoLoading, setIsHoverVideoLoading] = useState(false);

  // 当 thumbnailUrl 变化时，重置错误状态
  useEffect(() => {
    setImageError(false);
  }, [thumbnailUrl]);

  // 卸载时释放 hover 视频，避免内存泄漏
  useEffect(() => {
    return () => {
      const v = videoHoverRef.current;
      if (v) {
        v.pause();
        v.removeAttribute('src');
        v.load();
      }
    };
  }, []);

  // 提取应用信息：电商/品牌(app_type===3) 时 card-app-name 等优先展示 page_name，否则 advertiser_name
  const appName = item.app_type === 3 && (item.page_name != null && String(item.page_name).trim() !== '')
    ? String(item.page_name).trim()
    : (item.advertiser_name || 'N/A');
  const developerName = item.app_developer || 'N/A';
  // 电商/品牌时 card-developer 展示 ecom_advertiser_id，否则展示开发者
  const developerDisplay = item.app_type === 3? item.ecom_advertiser_id : developerName;
  const showDeveloper = item.app_type === 3
    ? (item.ecom_advertiser_id != null && item.ecom_advertiser_id !== '')
    : (developerName !== 'N/A');

  // 仅当无 logo（logo_url 为空）时使用新头部（应用类型图标+广告商+设备+省略号）；有 logo 时保持原头部（logo+应用名+开发者）
  const hasLogo = !!(item.logo_url && String(item.logo_url).trim());
  const useNewHeader = !hasLogo;

  // 提取生命周期信息
  let lifecycleStart = 'N/A';
  let lifecycleEnd = 'N/A';
  let lifecycleDays = 'N/A';
  
  if (item.first_seen) {
    lifecycleStart = new Date(item.first_seen * 1000).toLocaleDateString('zh-CN', { 
      year: '2-digit', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '/');
  }
  if (item.last_seen) {
    lifecycleEnd = new Date(item.last_seen * 1000).toLocaleDateString('zh-CN', { 
      year: '2-digit', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '/');
  }
  lifecycleDays = item.days_count || 'N/A';

  // 格式化展示次数
  const impressionEstimate = item.impression
    ? (item.impression >= 1000000
      ? `${(item.impression / 1000000).toFixed(0)}M`
      : (item.impression >= 1000
        ? `${(item.impression / 1000).toFixed(0)}K`
        : item.impression))
    : 'N/A';

  // 格式化人气值
  const exposureValue = item.all_exposure_value
    ? (item.all_exposure_value >= 10000
      ? `${(item.all_exposure_value / 10000).toFixed(1)}万`
      : item.all_exposure_value)
    : null;

  // 提取标题/描述
  const title = item.title || item.message || item.body || '';

  const handleImageError = (e) => {
    console.error('[CreativeCardGuangdada] 图片加载失败:', {
      'ad_key': item.ad_key,
      'thumbnailUrl': thumbnailUrl,
      'failedSrc': e.target.src
    });
    // 防止无限循环：如果已经处理过错误，不再尝试
    if (imageError) {
      return;
    }
    setImageError(true);
  };

  // 格式化日期显示（广大大平台格式：26/01/26）
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  // 格式化投放天数显示
  const daysCountDisplay = lifecycleDays !== 'N/A' ? `${lifecycleDays}天` : 'N/A';
  
  // 格式化最后看见日期
  const lastSeenDisplay = item.last_seen ? formatDate(item.last_seen) : 'N/A';

  // 下载素材：从 URL 解析后缀、安全文件名、触发下载
  const getExtensionFromUrl = (urlString) => {
    if (!urlString || typeof urlString !== 'string') return '';
    const pathOnly = urlString.split('?')[0];
    const lastSegment = pathOnly.split('/').pop() || '';
    const match = lastSegment.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : '';
  };
  const sanitizeFileName = (str) => {
    if (str == null || typeof str !== 'string') return '';
    return String(str)
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || '';
  };
  const getDownloadBaseName = () => {
    const t = title && title.trim();
    if (t) return sanitizeFileName(t);
    if (appName && appName !== 'N/A') return sanitizeFileName(appName);
    return sanitizeFileName(String(item.ad_key || '')) || `creative_${Date.now()}`;
  };
  const handleDownload = (e) => {
    e.stopPropagation();
    // 视频、图片均走尺寸选择弹窗；仅 HTML 直接下载
    if (onRequestVideoDownload && !htmlUrl) {
      onRequestVideoDownload(item);
      return;
    }
    if (htmlUrl) {
      const baseName = getDownloadBaseName();
      const filename = `${baseName}_${Date.now()}.html`;
      fetch(htmlUrl, { mode: 'cors', referrerPolicy: 'no-referrer' })
        .then((res) => res.text())
        .then((text) => {
          const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch(() => {
          window.open(htmlUrl, '_blank', 'noopener');
        });
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
    fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' })
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
  const downloadUrl = htmlUrl ? htmlUrl : (isVideo ? videoUrl : thumbnailUrl);

  const handleCardClick = (e) => {
    if (
      e.target.closest('.batch-card-checkbox') ||
      e.target.closest('.card-thumbnail-download') ||
      e.target.closest('.play-icon-center')
    )
      return;
    onOpenDetail?.(item);
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (!batchMode && onEnterBatchMode) {
      onEnterBatchMode();
    }
    onToggleSelect?.();
  };

  /** 下载当前 app icon（card-logo 图片）：文件名 = 产品名称_时间.png，走后端代理触发直接下载 */
  const handleDownloadAppIcon = (e) => {
    e.stopPropagation();
    const url = item.logo_url && String(item.logo_url).trim();
    if (!url) return;
    const now = new Date();
    const timeStr =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const productName = (appName !== 'N/A' ? appName : item.advertiser_name) || 'app';
    const safeName = String(productName).replace(/[/\\:*?"<>|\s]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'app';
    const filename = `${safeName}_${timeStr}.png`;
    const downloadUrl = getDownloadImageUrl(url, filename);
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`creative-card guangdada-card${onOpenDetail ? ' creative-card--clickable' : ''}${batchMode ? ' creative-card--batch-mode' : ''}`}
      onClick={handleCardClick}
      role={onOpenDetail ? 'button' : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onKeyDown={onOpenDetail ? (e) => e.key === 'Enter' && handleCardClick(e) : undefined}
    >
      <div
        className={`batch-card-checkbox ${selected ? 'batch-card-checkbox--checked' : ''}`}
        onClick={handleCheckboxClick}
        role="button"
        aria-label={selected ? '取消选择' : '选择'}
      >
        {selected ? '✓' : ''}
      </div>
      {/* 卡片头部：无 logo 时用新样式（应用类型图标+广告商+设备+省略号），有 logo 时用原样式（logo+应用名+开发者） */}
      {useNewHeader ? (
        <div className="card-header guangdada-card-header guangdada-card-header-with-ellipsis">
          <div className="guangdada-header-icon-wrap" title="应用信息">
            <div className="guangdada-header-avatar">
              <span className="guangdada-header-avatar-icon guangdada-header-avatar-icon--show" aria-hidden>
                {item.app_type === 1 ? (
                  <svg className="guangdada-icon-game" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0 0 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.31 3.3 19 4.8 19c.12 0 .23-.02.34-.02L9.71 17h4.58l4.57 1.98c.11 0 .22.02.34.02 1.5 0 2.6-1.69 2.18-2.91zM12 15c-1.93 0-3.5-1.57-3.5-3.5S10.07 8 12 8s3.5 1.57 3.5 3.5S13.93 15 12 15z"/></svg>
                ) : (
                  <svg className="guangdada-icon-app" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                )}
              </span>
            </div>
            <span className="guangdada-header-icon-tooltip">应用<br />信息</span>
          </div>
          <div className="guangdada-header-body">
            <div className="guangdada-header-name-row">
              <div className="guangdada-header-advertiser" title={appName !== 'N/A' ? appName : (item.advertiser_name || '')}>
                {appName !== 'N/A' ? appName : '—'}
              </div>
            </div>
            <div className="guangdada-header-device-row">
              {item.app_type === 3 && (item.ecom_advertiser_id != null && item.ecom_advertiser_id !== '') ? (
                <span className="guangdada-header-ecom-advertiser-id" title={`电商广告主ID: ${item.ecom_advertiser_id}`}>
                 {String(item.ecom_advertiser_id)}
                </span>
              ) : (
                <>
                  {item.os === 4 || item.app_support_pc ? (
                    <span className="guangdada-icon-computer" title="PC" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
                    </span>
                  ) : item.os === 1 || item.os === '1' ? (
                    <span className="guangdada-icon-android" title="Android" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.27-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.41-1.35-3.3-2.21-5.46-2.21-2.16 0-4.05.86-5.46 2.21L2.66 5.67c-.19-.28-.54-.37-.83-.22-.31.16-.43.54-.27.85L4.4 9.48C2.91 11.06 2 13.05 2 15.22c0 3.34 2.72 6.06 6.06 6.06 3.34 0 6.06-2.72 6.06-6.06 0-2.17-.91-4.16-2.4-5.74zM5.03 13.33c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.91 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                    </span>
                  ) : item.os === 2 || item.os === '2' ? (
                    <span className="guangdada-icon-ios" title="iOS" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13 1.86 1.12 2.57 1.9 4.05 1.9-.08 1.2-.5 2.39-1.12 3.45zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {(onBlockAdvertiser || item.logo_url) ? (
            <Popover
              trigger="click"
              placement="bottomRight"
              content={
                <div className="guangdada-header-ellipsis-popover">
                  {onBlockAdvertiser && (
                    <button
                      type="button"
                      className="guangdada-header-ellipsis-action"
                      onClick={() => onBlockAdvertiser(item)}
                    >
                      不看该广告主创意
                    </button>
                  )}
                  {item.logo_url && (
                    <button
                      type="button"
                      className="guangdada-header-ellipsis-action"
                      onClick={handleDownloadAppIcon}
                    >
                      下载当前 app icon
                    </button>
                  )}
                </div>
              }
            >
              <button type="button" className="guangdada-header-ellipsis" aria-label="更多" onClick={(e) => e.stopPropagation()}>
                <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M176 511a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0z"/></svg>
              </button>
            </Popover>
          ) : (
            <button type="button" className="guangdada-header-ellipsis" aria-label="更多" onClick={(e) => e.stopPropagation()}>
              <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M176 511a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0z"/></svg>
            </button>
          )}
        </div>
      ) : (item.logo_url || appName !== 'N/A') ? (
        <div className="card-header guangdada-card-header-with-ellipsis">
          {item.logo_url && (
            <img
              src={item.logo_url}
              alt={appName}
              className="card-logo"
              referrerPolicy="no-referrer"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="card-header-info">
            <div className="card-app-name">{appName}</div>
            <div className="card-developer">{developerDisplay}</div>
          </div>
          {(onBlockAdvertiser || item.logo_url) ? (
            <Popover
              trigger="click"
              placement="bottomRight"
              content={
                <div className="guangdada-header-ellipsis-popover">
                  {onBlockAdvertiser && (
                    <button
                      type="button"
                      className="guangdada-header-ellipsis-action"
                      onClick={() => onBlockAdvertiser(item)}
                    >
                      不看该广告主创意
                    </button>
                  )}
                  {item.logo_url && (
                    <button
                      type="button"
                      className="guangdada-header-ellipsis-action"
                      onClick={handleDownloadAppIcon}
                    >
                      下载当前 app icon
                    </button>
                  )}
                </div>
              }
            >
              <button type="button" className="guangdada-header-ellipsis" aria-label="更多" onClick={(e) => e.stopPropagation()}>
                <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M176 511a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0z"/></svg>
              </button>
            </Popover>
          ) : (
            <button type="button" className="guangdada-header-ellipsis" aria-label="更多" onClick={(e) => e.stopPropagation()}>
              <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M176 511a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0zm280 0a56 56 0 10112 0 56 56 0 10-112 0z"/></svg>
            </button>
          )}
        </div>
      ) : null}
      
      {/* 媒体预览区域：支持图片、视频预览图或 type=4 的 html_url iframe */}
      <div className={`card-thumbnail${htmlUrl ? ' card-thumbnail--html' : ''}`}>
        {htmlUrl ? (
          <div className="card-thumbnail-iframe-wrap">
            <iframe
              src={htmlUrl}
              title="创意预览"
              className="card-thumbnail-iframe"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
            />
          </div>
        ) : thumbnailUrl && !imageError ? (
          <img
            key={`${item.ad_key}-${thumbnailUrl}`}
            src={getProxiedMediaUrl(thumbnailUrl)}
            alt="Creative Thumbnail"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
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
            {imageError ? '图片加载失败' : '暂无图片'}
          </div>
        )}
        
        {/* 左上角标签：重投、HTML */}
        <div className="guangdada-card-badges">
          {item.resume_advertising_flag && (
            <div className="resume-badge">重投</div>
          )}
          {htmlUrl && (
            <div className="html-badge">HTML</div>
          )}
        </div>
        
        {/* hover 播放按钮时在缩略图上叠加播放视频，移出时停止并清空 src 控制内存 */}
        {isVideo && videoUrl && (
          <video
            ref={videoHoverRef}
            className="card-thumbnail-hover-video"
            muted
            playsInline
            loop
            referrerPolicy="no-referrer"
            aria-hidden
          />
        )}
        {/* 悬停到视频开始播放前显示加载动画，避免黑屏 */}
        {isVideo && isHoverVideoLoading && (
          <div className="card-thumbnail-hover-loading" aria-hidden>
            <span className="card-thumbnail-hover-spinner" />
          </div>
        )}
        {isVideo && (
          <div
            className="play-icon-center"
            onClick={(e) => {
              e.stopPropagation();
              setShowVideoPlayer(true);
            }}
            onMouseEnter={() => {
              const v = videoHoverRef.current;
              if (!v || !videoUrl) return;
              const url = getProxiedMediaUrl(videoUrl);
              const onPlaying = () => setIsHoverVideoLoading(false);
              const onError = () => setIsHoverVideoLoading(false);
              v.addEventListener('playing', onPlaying, { once: true });
              v.addEventListener('error', onError, { once: true });
              v.onmouseleaveCleanup = () => {
                v.removeEventListener('playing', onPlaying);
                v.removeEventListener('error', onError);
              };
              setIsHoverVideoLoading(true);
              v.src = url;
              v.play().catch(() => setIsHoverVideoLoading(false));
            }}
            onMouseLeave={() => {
              setIsHoverVideoLoading(false);
              const v = videoHoverRef.current;
              if (v) {
                if (v.onmouseleaveCleanup) {
                  v.onmouseleaveCleanup();
                  v.onmouseleaveCleanup = null;
                }
                v.pause();
                v.removeAttribute('src');
                v.load();
              }
            }}
          >
            <span className="play-symbol">▶</span>
            {videoDurationLabel && <span className="video-duration">{videoDurationLabel}</span>}
          </div>
        )}
        
        {/* 日期范围 - 底部右侧 */}
        {lifecycleStart !== 'N/A' && lifecycleEnd !== 'N/A' && (
          <div className="date-range-badge">
            {lifecycleStart}-{lifecycleEnd}
          </div>
        )}
        {/* 下载按钮 - 底部，hover 时显示（参考 Insightrackr） */}
        {downloadUrl && (
          <div className="card-thumbnail-download" onClick={handleDownload}>
            <span className="card-download-icon" title={htmlUrl ? '下载HTML' : isVideo ? '下载视频' : '下载图片'}>⬇</span>
            <span className="card-download-text">{htmlUrl ? '下载HTML' : isVideo ? '下载视频' : '下载图片'}</span>
          </div>
        )}
      </div>
      
      {/* 性能指标区域：新头部时仅展示平台标签；原头部时展示广告商+平台 */}
      <div className="card-metrics">
        {(!useNewHeader || (item.platform != null && item.platform !== '')) && (
          <div className="metrics-header">
            {!useNewHeader && (
              <span className="metrics-header-advertiser" title={item.advertiser_name || ''}>
                {item.advertiser_name || '—'}
              </span>
            )}
            {item.platform != null && item.platform !== '' && (
              <span className="metrics-header-platform">
                {Array.isArray(item.platform) ? item.platform.join(', ') : String(item.platform)}
              </span>
            )}
          </div>
        )}
        <div className="metrics-primary">
          {exposureValue && (
            <div className="metric-primary-item">
              <span className="metric-label">人气值</span>
              <span className="metric-value">{exposureValue}</span>
            </div>
          )}
          <div className="metric-primary-item">
            <span className="metric-label">投放天数</span>
            <span className="metric-value">{daysCountDisplay}</span>
          </div>
          <div className="metric-primary-item">
            <span className="metric-label">最后看见</span>
            <span className="metric-value">{lastSeenDisplay}</span>
          </div>
        </div>
        <div className="metrics-secondary">
          <span className="metric-tag">展示估值: {impressionEstimate}</span>
          {item.heat && <span className="metric-tag">热度: {item.heat}</span>}
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
              src={getProxiedMediaUrl(videoUrl)} 
              controls 
              autoPlay
              referrerPolicy="no-referrer"
              className="video-player"
            >
              您的浏览器不支持视频播放
            </video>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreativeCardGuangdada;
