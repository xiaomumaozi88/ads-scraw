import React, { useMemo, useState, useEffect } from 'react';

function CreativeCardGuangdada({ item }) {
  // 使用 useMemo 缓存计算结果，避免每次渲染都重新计算
  const { isVideo, thumbnailUrl, videoUrl, videoDuration } = useMemo(() => {
    let isVideo = false;
    let thumbnailUrl = '';
    let videoUrl = '';
    let videoDuration = null;
    
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
    
    // 调试日志
    console.log('[CreativeCardGuangdada] 资源类型判断:', {
      'item.ad_key': item.ad_key,
      'ads_type': item.ads_type,
      'resource_type': item.resource_urls?.[0]?.type,
      'hasVideoUrl': hasVideoUrl,
      'isVideo': isVideo,
      'thumbnailUrl': thumbnailUrl,
      'videoUrl': videoUrl,
      'videoDuration': videoDuration
    });
    
    return { isVideo, thumbnailUrl, videoUrl, videoDuration };
  }, [item.resource_urls, item.preview_img_url, item.video_duration, item.ad_key, item.ads_type]);
  
  // 使用 state 来跟踪图片加载错误，防止无限循环
  const [imageError, setImageError] = useState(false);
  // 视频播放状态
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  
  // 当 thumbnailUrl 变化时，重置错误状态
  useEffect(() => {
    setImageError(false);
  }, [thumbnailUrl]);

  // 提取应用信息
  const appName = item.advertiser_name || 'N/A';
  const developerName = item.app_developer || 'N/A';

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

  return (
    <div className="creative-card guangdada-card">
      {/* 产品信息头部 */}
      {(item.logo_url || appName !== 'N/A') && (
        <div className="card-header">
          {item.logo_url && (
            <img 
              src={item.logo_url} 
              alt={appName}
              className="card-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <div className="card-header-info">
            <div className="card-app-name">{appName}</div>
            {developerName !== 'N/A' && (
              <div className="card-developer">{developerName}</div>
            )}
          </div>
          <div className="card-menu">⋯</div>
        </div>
      )}
      
      {/* 媒体预览区域 */}
      <div className="card-thumbnail">
        {thumbnailUrl && !imageError ? (
          <img
            key={`${item.ad_key}-${thumbnailUrl}`}
            src={thumbnailUrl}
            alt="Creative Thumbnail"
            onError={handleImageError}
            onLoad={() => {
              console.log('[CreativeCardGuangdada] 图片加载成功:', {
                'ad_key': item.ad_key,
                'thumbnailUrl': thumbnailUrl
              });
            }}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
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
        
        {/* 重投标签 - 左上角 */}
        {item.resume_advertising_flag && (
          <div className="resume-badge">重投</div>
        )}
        
        {/* 播放按钮和时长 - 居中显示（视频资源） */}
        {isVideo && (
          <div 
            className="play-icon-center"
            onClick={(e) => {
              e.stopPropagation();
              setShowVideoPlayer(true);
            }}
          >
            <span className="play-symbol">▶</span>
            {videoDuration && <span className="video-duration">{videoDuration}s</span>}
          </div>
        )}
        
        {/* 日期范围 - 底部右侧 */}
        {lifecycleStart !== 'N/A' && lifecycleEnd !== 'N/A' && (
          <div className="date-range-badge">
            {lifecycleStart}-{lifecycleEnd}
          </div>
        )}
      </div>
      
      {/* 性能指标区域 */}
      <div className="card-metrics">
        <div className="metrics-header">
          <div className="guangdada-logo">G</div>
        </div>
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
            if (e.target.className === 'video-player-modal') {
              setShowVideoPlayer(false);
            }
          }}
        >
          <div className="video-player-container">
            <button 
              className="video-player-close"
              onClick={() => setShowVideoPlayer(false)}
            >
              ×
            </button>
            <video 
              src={videoUrl} 
              controls 
              autoPlay
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
