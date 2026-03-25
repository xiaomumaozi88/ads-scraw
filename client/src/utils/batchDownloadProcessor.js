/**
 * 批量下载：按固定尺寸输出素材
 * 当原尺寸 != 目标尺寸时：画布=目标尺寸，内容等比缩放完整显示居中，空白区域用高斯模糊填充
 */

import { getProxiedMediaUrl } from './api';
import { getDomesticVideoUrl, isDomesticVideoItem } from './domesticCreativeFormat';

const BLUR_RADIUS = 24;

/**
 * 模拟进度条：在异步操作期间逐步推进 0 → cap（缓动，前快后慢），便于用户感知进度。
 * 与真实进度取 max，cap 内不会超过 100，完成时由调用方传 100。
 * @param {(value: number) => void} onProgress - 进度回调 0–100
 * @param {{ cap?: number, intervalMs?: number, durationMs?: number }} options - cap 默认 90，intervalMs 默认 350，durationMs 默认 50 秒
 * @returns {{ stop: () => void }}
 */
function createSimulatedProgress(onProgress, options = {}) {
  const cap = Math.min(90, options.cap ?? 90);
  const intervalMs = options.intervalMs ?? 350;
  const durationMs = options.durationMs ?? 50000;
  const start = Date.now();
  let timerId = null;

  const tick = () => {
    const elapsed = Date.now() - start;
    // 缓动：前快后慢，接近 cap
    const tau = durationMs / 4;
    const raw = cap * (1 - Math.exp(-elapsed / tau));
    const value = Math.min(cap, Math.round(raw * 10) / 10);
    onProgress(value);
    if (value < cap) {
      timerId = setTimeout(tick, intervalMs);
    }
  };

  timerId = setTimeout(tick, intervalMs);

  return {
    stop() {
      if (timerId != null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}

/** 超时包装：超时后 reject，避免一直卡住；超时时会打印错误 */
function withTimeout(promise, ms, message = '操作超时') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        console.error('[batchDownload] 超时:', message, `(等待 ${ms}ms)`);
        reject(new Error(message));
      }, ms)
    ),
  ]);
}

/** 带超时的 fetch（避免 CORS 或无响应时一直挂起） */
function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') {
        console.error('[batchDownload] fetch 超时:', url?.slice?.(0, 80), err);
        throw new Error('请求超时（请检查地址或网络）');
      }
      console.error('[batchDownload] fetch 失败:', url?.slice?.(0, 80), err);
      throw err;
    })
    .finally(() => clearTimeout(timeoutId));
}

/** 稳定获取卡片项唯一 id（Insightrackr / 广大大），统一返回字符串便于 Set 比较 */
export function getBatchItemId(item, platform) {
  const raw = platform === 'guangdada'
    ? (item.ad_key ?? item.id ?? item.material_key ?? item.creative_id ?? '')
    : (item.id ?? item.search_flag ?? item.ad_key ?? item.bizId ?? item.materialId ?? '');
  return String(raw ?? '');
}

/** 文件名片段：去除特殊字符，保留中文、字母、数字、下划线、横线 */
function sanitizeFilenamePart(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 80) || '';
}

/**
 * 竞品名：应用名 / 产品名 / 开发者名（用于下载文件名）
 */
export function getCompetitorName(item, platform) {
  if (!item) return '';
  if (platform === 'guangdada') {
    return (
      item.advertiser_name ||
      item.app_developer ||
      item.app_name ||
      ''
    );
  }
  const appName = (item.appList?.[0]?.name || '').replace(/<font color='red'>|<\/font>/g, '').trim();
  return appName || item.productName || item.developer || '';
}

/**
 * 构建下载文件名（无扩展名）：竞品_日期_素材ID_尺寸
 * @param {string} competitorName - 竞品名
 * @param {string} dateStr - 日期 YYYYMMDD
 * @param {string} materialId - 素材 ID
 * @param {string} sizeLabel - 尺寸标签，如 原尺寸、720x1280、800x800
 */
export function buildDownloadBaseName(competitorName, dateStr, materialId, sizeLabel) {
  const safeSize = String(sizeLabel || '原尺寸').replace(/[××]/g, 'x').replace(/[（）()]/g, '');
  const parts = [
    sanitizeFilenamePart(competitorName) || 'creative',
    sanitizeFilenamePart(dateStr) || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    sanitizeFilenamePart(materialId) || 'id',
    sanitizeFilenamePart(safeSize) || 'size',
  ];
  return parts.join('_');
}

/** 从 item 提取下载 URL、是否视频、是否 HTML、建议文件名 */
export function getBatchDownloadInfo(item, platform) {
  const sanitize = (s) => (s == null ? '' : String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0, 80));
  if (platform === 'guangdada') {
    const hasIntlResources = Array.isArray(item.resource_urls) && item.resource_urls.length > 0;
    const looksDomesticBba =
      !hasIntlResources && (item.material_key != null || item.creative_id != null);
    if (looksDomesticBba) {
      const rawVideo = getDomesticVideoUrl(item);
      const isVideo = isDomesticVideoItem(item) && !!rawVideo;
      const rawImg =
        item.preview_img ||
        (Array.isArray(item.resources)
          ? item.resources.find((r) => typeof r === 'string' && !/\.(mp4|webm|mov)(\?|$)/i.test(r))
          : '') ||
        '';
      const rawPrimary = rawVideo || rawImg || '';
      const url = rawPrimary ? getProxiedMediaUrl(rawPrimary) : '';
      const title = item.title || item.body || item.message || '';
      const name = (item.app_name || item.material_key || item.creative_id || '') + (title ? `_${title}` : '');
      return { url, isVideo, isHtml: false, filename: sanitize(name) || 'creative' };
    }
    const r0 = item.resource_urls?.[0];
    const isHtml = r0?.type === 4 && r0?.html_url && String(r0.html_url).trim() !== '';
    const isVideo = !isHtml && (item.ads_type === 2 || r0?.type === 2 || !!(r0?.video_url));
    let url = '';
    if (isHtml) url = r0.html_url.trim();
    else if (isVideo) url = r0?.video_url ?? '';
    else url = r0?.image_url ?? item.preview_img_url ?? '';
    const title = item.title || item.message || item.body || '';
    const name = (item.advertiser_name || item.ad_key || '') + (title ? `_${title}` : '');
    return { url, isVideo, isHtml: !!isHtml, filename: sanitize(name) || 'creative' };
  }
  const isVideo = item.materialType === 2 || !!(item.videoUrl && item.videoUrl.trim());
  const url = isVideo
    ? (item.videoUrl || '')
    : (item.thumbnailImageUrl?.[0] ?? item.imageUrl?.[0] ?? '');
  const title = (item.title || item.describe || '').replace(/<font color='red'>|<\/font>/g, '');
  const appName = (item.appList?.[0]?.name || '').replace(/<font color='red'>|<\/font>/g, '');
  const name = title || appName || item.id || item.search_flag || 'creative';
  return { url, isVideo, isHtml: false, filename: sanitize(name) || 'creative' };
}

/**
 * 加载图片并转为 Image 对象（支持跨域）
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

/**
 * 计算等比缩放后水平垂直居中绘制的 src 区域与目标区域
 * scaleMode: 'contain' 完整显示 | 'cover' 铺满
 * 返回整数 drawW/drawH/offsetX/offsetY，保证素材在画布上严格居中
 */
function fitRect(srcW, srcH, dstW, dstH, scaleMode = 'contain') {
  const scale = scaleMode === 'cover'
    ? Math.max(dstW / srcW, dstH / srcH)
    : Math.min(dstW / srcW, dstH / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const offsetX = Math.round((dstW - drawW) / 2);
  const offsetY = Math.round((dstH - drawH) / 2);
  return { drawW, drawH, offsetX, offsetY, scale };
}

/**
 * 图片 → 固定尺寸 Blob（前景等比 contain 居中 + 背景等比 cover 铺满后模糊，无留白）
 * 当原尺寸 = 目标尺寸时直接返回原图 blob，否则按规则处理
 * @param {string} imageUrl - 图片 URL
 * @param {number} targetW - 目标宽
 * @param {number} targetH - 目标高
 * @param {Function} [onProgress] - 进度回调 0–100
 * @returns {Promise<Blob>}
 */
export async function processImageToBlob(imageUrl, targetW, targetH, onProgress = null) {
  const img = await withTimeout(
    loadImage(imageUrl),
    30000,
    '图片加载超时（请检查地址或网络）'
  );
  if (onProgress) onProgress(40);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  if (srcW === targetW && srcH === targetH) {
    const resp = await fetchWithTimeout(imageUrl, { mode: 'cors', referrerPolicy: 'no-referrer' }, 30000);
    const blob = await resp.blob();
    if (onProgress) onProgress(100);
    return blob;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  const cover = fitRect(srcW, srcH, targetW, targetH, 'cover');
  const contain = fitRect(srcW, srcH, targetW, targetH, 'contain');

  // 1) 背景层：原图按原比例放大铺满规定尺寸（cover），居中绘制，无留白，再高斯模糊
  // cover 时 offsetX/offsetY 为负或零，绘制起点 (offsetX, offsetY) 使放大图居中并盖满画布
  ctx.save();
  ctx.filter = `blur(${BLUR_RADIUS}px)`;
  ctx.drawImage(
    img,
    0, 0, srcW, srcH,
    cover.offsetX, cover.offsetY, cover.drawW, cover.drawH
  );
  ctx.restore();

  // 2) 前景层：原图按 contain 等比缩放水平垂直居中，清晰
  ctx.drawImage(
    img,
    0, 0, srcW, srcH,
    contain.offsetX, contain.offsetY, contain.drawW, contain.drawH
  );

  if (onProgress) onProgress(70);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (onProgress) onProgress(100);
        blob ? resolve(blob) : reject(new Error('toBlob 失败'));
      },
      'image/png',
      0.92
    );
  });
}

/**
 * 视频 → 固定尺寸 Blob（优先后端转码，失败则 ffmpeg.wasm，再失败则 canvas+MediaRecorder）
 */
export async function processVideoToBlob(videoUrl, targetW, targetH, onProgress = null) {
  // 1) 优先后端转码（更快、不占浏览器资源）
  try {
    const { transcodeVideoBackend } = await import('./api.js');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 300000);
    const blob = await transcodeVideoBackend(videoUrl, targetW, targetH, controller.signal);
    clearTimeout(t);
    if (typeof onProgress === 'function') onProgress(100);
    return blob;
  } catch (e) {
    if (e?.name === 'AbortError') {
      console.warn('[batchDownload 视频] 后端转码超时，改用前端 ffmpeg');
    } else {
      console.warn('[batchDownload 视频] 后端转码不可用，改用前端 ffmpeg:', e?.message);
    }
  }

  // 2) 前端 ffmpeg.wasm
  try {
    const { processVideoToBlobWithFFmpeg } = await import('./videoFFmpeg.js');
    return await withTimeout(
      processVideoToBlobWithFFmpeg(videoUrl, targetW, targetH, onProgress),
      300000,
      '视频处理超时（约 5 分钟）'
    );
  } catch (e) {
    console.warn('[batchDownload 视频] ffmpeg 处理失败，回退到 canvas:', e?.message);
    return processVideoToBlobCanvas(videoUrl, targetW, targetH, onProgress);
  }
}

/**
 * 视频 → 固定尺寸 Blob（canvas 绘制 + MediaRecorder，回退方案）
 * 逻辑：画布=目标尺寸；背景=原视频 cover 后高斯模糊；前景=原视频 contain 居中
 */
function processVideoToBlobCanvas(videoUrl, targetW, targetH, onProgress = null) {
  const width = targetW;
  const height = targetH;
  const BLUR_PX = 50;
  const DEFAULT_FPS = 30;
  const logPrefix = '[batchDownload 视频]';

  const mainPromise = new Promise((resolve, reject) => {
    fetchWithTimeout(videoUrl, { mode: 'cors', referrerPolicy: 'no-referrer' }, 45000)
      .then((res) => res.blob())
      .then((videoBlob) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        // 不设置 muted / volume=0，否则浏览器可能不解码音频，录不到声音；静音由 Web Audio GainNode 控制
        video.volume = 1;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        document.body.appendChild(video);

        const cleanup = () => {
          URL.revokeObjectURL(video.src);
          if (video.parentNode) video.parentNode.removeChild(video);
        };

        video.onerror = (e) => {
          const msg = video.error ? `code=${video.error.code} message=${video.error.message}` : String(e);
          console.error(logPrefix, 'video.onerror:', msg);
          cleanup();
          reject(new Error('视频加载失败: ' + msg));
        };

        video.onloadedmetadata = () => {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) {
            console.error(logPrefix, '无法获取视频尺寸 vw/vh 为 0');
            cleanup();
            reject(new Error('无法获取视频尺寸'));
            return;
          }

          const videoAspect = vw / vh;
          const outputAspect = width / height;
          // 前景：contain 等比缩放水平垂直居中
          let scaledWidth, scaledHeight, offsetX, offsetY;
          if (videoAspect > outputAspect) {
            scaledWidth = width;
            scaledHeight = Math.round(width / videoAspect);
            offsetX = 0;
            offsetY = Math.round((height - scaledHeight) / 2);
          } else {
            scaledWidth = Math.round(height * videoAspect);
            scaledHeight = height;
            offsetX = Math.round((width - scaledWidth) / 2);
            offsetY = 0;
          }
          // 背景：cover 按原比例放大铺满规定尺寸，无留白
          const coverScale = Math.max(width / vw, height / vh);
          const coverW = Math.round(vw * coverScale);
          const coverH = Math.round(vh * coverScale);
          const coverX = Math.round((width - coverW) / 2);
          const coverY = Math.round((height - coverH) / 2);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

          // 背景层：原视频按原比例放大铺满画布（cover）后高斯模糊，居中绘制，无留白
          const applyBlurBg = () => {
            tempCtx.filter = `blur(${BLUR_PX}px)`;
            tempCtx.drawImage(video, coverX, coverY, coverW, coverH);
            tempCtx.filter = 'none';
            ctx.drawImage(tempCanvas, 0, 0);
          };

          const drawSharp = () => {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(video, offsetX, offsetY, scaledWidth, scaledHeight);
          };

          // Web Audio：在 play() 前接好线，静音输出 + 录制用分支，避免开头“闪一声”
          let audioContext = null;
          let audioDestination = null;
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            try {
              audioContext = new AudioContextClass();
              const audioSource = audioContext.createMediaElementSource(video);
              audioDestination = audioContext.createMediaStreamDestination();
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 0;
              // 一路：静音输出到扬声器
              audioSource.connect(gainNode);
              gainNode.connect(audioContext.destination);
              // 一路：原声进录制（不经过 GainNode）
              audioSource.connect(audioDestination);
            } catch (e) {
              console.warn(logPrefix, 'Web Audio 初始化失败，将仅录画面:', e?.message);
            }
          }

          // 优先使用浏览器原生 MP4（如 Safari），无需 FFmpeg 转码
          const mimeMp4 = MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a')
              ? 'video/mp4;codecs=avc1,mp4a'
              : null;
          const mimeVideoOnly = mimeMp4 || (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
              ? 'video/webm;codecs=vp8'
              : 'video/webm');
          const mimeWithAudio = mimeMp4
            ? mimeMp4
            : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
              ? 'video/webm;codecs=vp9,opus'
              : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                ? 'video/webm;codecs=vp8,opus'
                : mimeVideoOnly);
          let recorder = null;
          let chunks = [];
          let mime = mimeVideoOnly;

          const setupRecorder = (streamToRecord) => {
            const hasAudio = streamToRecord.getAudioTracks().length > 0;
            mime = hasAudio ? mimeWithAudio : mimeVideoOnly;
            const rec = new MediaRecorder(streamToRecord, {
              mimeType: mime,
              videoBitsPerSecond: 2500000,
              audioBitsPerSecond: hasAudio ? 192000 : undefined,
            });
            chunks = [];
            rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
            rec.onstop = () => {
              const blob = new Blob(chunks, { type: mime });
              cleanup();
              if (blob.size < 1000) {
                console.error(logPrefix, '生成的视频过小:', blob.size);
                reject(new Error('生成的视频过小'));
                return;
              }
              resolve(blob);
            };
            rec.onerror = (e) => {
              console.error(logPrefix, 'MediaRecorder.onerror:', e.error?.message ?? e);
              cleanup();
              reject(new Error('视频编码失败: ' + (e.error?.message || '')));
            };
            return rec;
          };

          let lastProgressUpdate = 0;

          /** 绘制一帧到画布（供 captureStream 采集）；可选更新进度 */
          const drawOneFrame = (updateProgress = true) => {
            ctx.clearRect(0, 0, width, height);
            applyBlurBg();
            drawSharp();
            if (updateProgress && onProgress && video.duration > 0) {
              const progress = (video.currentTime / video.duration) * 100;
              const now = performance.now();
              if (now - lastProgressUpdate >= 80) {
                onProgress(Math.min(progress, 99));
                lastProgressUpdate = now;
              }
            }
          };

          /** 结束录制：画最后一帧、进度 100%、延迟后 stop */
          let finishLogged = false;
          const finishRecording = () => {
            if (finishLogged) return;
            finishLogged = true;
            if (captureIntervalId != null) {
              clearInterval(captureIntervalId);
              captureIntervalId = null;
            }
            drawOneFrame(false);
            if (onProgress) onProgress(100);
            setTimeout(() => {
              if (recorder && recorder.state === 'recording') recorder.stop();
            }, 300);
          };

          /** 使用 requestVideoFrameCallback 按源视频逐帧绘制，避免掉帧（支持则优先） */
          const useRequestVideoFrameCallback =
            typeof video.requestVideoFrameCallback === 'function';

          /** 输出帧率：与源视频一致，通过 captureStream(0).getSettings().frameRate 检测，不可用时用 DEFAULT_FPS */
          let effectiveFps = DEFAULT_FPS;
          let effectiveFrameInterval = 1000 / DEFAULT_FPS;

          /** 按 effectiveFps 用 setInterval 驱动抽帧（与源视频帧率一致） */
          let captureIntervalId = null;
          const startFixedRateCapture = () => {
            captureIntervalId = setInterval(() => {
              if (video.ended) {
                finishRecording();
                return;
              }
              if (video.paused) return;
              drawOneFrame(true);
            }, effectiveFrameInterval);
          };

          /** 使用 requestVideoFrameCallback 时：每帧回调绘制一次，与源视频帧率一致 */
          const scheduleVideoFrameCallback = () => {
            if (video.ended) {
              finishRecording();
              return;
            }
            video.requestVideoFrameCallback((now, metadata) => {
              if (video.ended) {
                finishRecording();
                return;
              }
              drawOneFrame(true);
              scheduleVideoFrameCallback();
            });
          };

          const addAudioTracksToStream = (combinedStream) => {
            if (!audioDestination) return;
            const audioTracks = audioDestination.stream.getAudioTracks();
            audioTracks.forEach((track) => {
              track.enabled = true;
              combinedStream.addTrack(track);
            });
          };

          let started = false;
          const startPlayAndRecord = () => {
            if (started) return;
            started = true;
            if (readyWarnTimer) {
              clearTimeout(readyWarnTimer);
              readyWarnTimer = null;
            }
            if (onProgress) onProgress(0);
            video.currentTime = 0;

            video.play().then(() => {
              if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
              }
              // 尝试从源视频轨道读取帧率，使所有尺寸的导出都与原视频帧率一致
              try {
                const srcStream = video.captureStream(0);
                const srcTrack = srcStream?.getVideoTracks?.()?.[0];
                const reported = srcTrack?.getSettings?.()?.frameRate;
                if (typeof reported === 'number' && reported >= 1 && reported <= 120) {
                  effectiveFps = Math.round(reported);
                  effectiveFrameInterval = 1000 / effectiveFps;
                }
              } catch (e) {
                console.warn(logPrefix, '无法读取源视频帧率，使用默认', DEFAULT_FPS, 'fps:', e?.message);
              }

              const canvasStream = canvas.captureStream(effectiveFps);
              const combinedStream = new MediaStream();
              canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

              const startRecorder = () => {
                recorder = setupRecorder(combinedStream);
                recorder.start(100);
                video.addEventListener('ended', finishRecording, { once: true });
                if (useRequestVideoFrameCallback) {
                  scheduleVideoFrameCallback();
                } else {
                  startFixedRateCapture();
                }
              };

              // 播放后等约 300ms 再加音频轨，避免录出来的 WebM 缺音轨或开头无声
              setTimeout(() => {
                addAudioTracksToStream(combinedStream);
                if (combinedStream.getAudioTracks().length === 0 && audioDestination) {
                  setTimeout(() => {
                    addAudioTracksToStream(combinedStream);
                    if (combinedStream.getAudioTracks().length === 0) {
                      console.warn(logPrefix, '未获取到音频轨道，将仅录画面');
                    }
                    startRecorder();
                  }, 300);
                } else {
                  startRecorder();
                }
              }, 300);
            }).catch((e) => {
              console.error(logPrefix, 'video.play() 失败:', e?.message ?? e);
              cleanup();
              reject(new Error('视频播放失败: ' + (e?.message || '')));
            });
          };

          let readyWarnTimer = setTimeout(() => {
            console.warn(logPrefix, '30s 内未触发 canplay/canplaythrough');
          }, 30000);
          video.addEventListener('canplay', startPlayAndRecord, { once: true });
          video.addEventListener('canplaythrough', startPlayAndRecord, { once: true });
          setTimeout(() => startPlayAndRecord(), 1200);
        };

        video.load();
      }
      )
      .catch((e) => {
        console.error(logPrefix, '下载/解析失败:', e?.message ?? e);
        reject(new Error('视频下载失败: ' + (e?.message || '')));
      });
  });
  return withTimeout(mainPromise, 300000, '视频处理超时（约 5 分钟）');
}

/** 预设输出尺寸（原尺寸为第一项且为默认） */
export const BATCH_DOWNLOAD_SIZE_OPTIONS = [
  { label: '原尺寸', originalSize: true },
  { label: '720×1280（竖版）', width: 720, height: 1280 },
  { label: '1280×720（横版）', width: 1280, height: 720 },
  { label: '800×800（方形）', width: 800, height: 800 },
];

/** 自定义尺寸在「选择尺寸」中的下标 */
export const CUSTOM_SIZE_INDEX = BATCH_DOWNLOAD_SIZE_OPTIONS.length;
/** 自定义宽高范围：8～4096（像素） */
export const CUSTOM_SIZE_MIN = 8;
export const CUSTOM_SIZE_MAX = 4096;

/** 比例相等判定容差（避免浮点误差） */
const ASPECT_RATIO_TOLERANCE = 0.02;

/**
 * 判断两组宽高是否同比例（如 600×600 与 800×800 均为 1:1）
 */
export function isSameAspectRatio(w1, h1, w2, h2, tolerance = ASPECT_RATIO_TOLERANCE) {
  if (!w1 || !h1 || !w2 || !h2) return false;
  const r1 = w1 / h1;
  const r2 = w2 / h2;
  return Math.abs(r1 - r2) <= tolerance;
}

/**
 * 获取媒体（图片或视频）的原始宽高，用于「同比例按原图下载」判断。
 * @param {string} url - 媒体 URL
 * @param {boolean} isVideo - 是否视频
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export function getMediaDimensions(url, isVideo) {
  if (!url || typeof url !== 'string') return Promise.resolve(null);
  if (isVideo) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        video.removeAttribute('src');
        video.load();
        if (video.parentNode) video.parentNode.removeChild(video);
      };
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 15000);
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        cleanup();
        resolve(w && h ? { width: w, height: h } : null);
      };
      video.onerror = () => {
        cleanup();
        resolve(null);
      };
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      document.body.appendChild(video);
      video.src = url;
    });
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      resolve(null);
    }, 10000);
    img.onload = () => {
      clearTimeout(timeout);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      resolve(w && h ? { width: w, height: h } : null);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * 批量处理并下载：HTML 直接下载为 .html；视频/图片按尺寸处理或原尺寸下载。
 * 当 targetW/targetH 为 null 时按原尺寸直接下载（不缩放、不重编码）。
 * onProgress(percent?) 可选；baseFilename 可选，若传入则使用「竞品_日期_素材ID_尺寸」格式，否则用原 filename_时间戳。
 */
export async function processAndDownloadItem({ url, isVideo, isHtml, filename }, targetW, targetH, onProgress, baseFilename) {
  let blob;
  let sim = null;
  let lastForwarded = 0;
  let realProgress = 0;

  const forward = (value) => {
    const v = Math.min(100, Math.max(0, value));
    if (v > lastForwarded) {
      lastForwarded = v;
      if (onProgress) onProgress(v);
    }
  };

  const wrappedProgress = onProgress
    ? (p) => {
        if (p != null) realProgress = Math.max(realProgress, Math.min(100, p));
        if (realProgress >= 100) {
          if (sim) {
            sim.stop();
            sim = null;
          }
          forward(100);
          return;
        }
        forward(realProgress);
      }
    : null;

  if (wrappedProgress) {
    sim = createSimulatedProgress(
      (simP) => {
        const combined = Math.min(90, Math.max(simP, realProgress));
        if (combined > lastForwarded) forward(combined);
      },
      { cap: 90, intervalMs: 350, durationMs: 55000 }
    );
  }

  try {
    if (isHtml && url) {
      const resp = await fetchWithTimeout(url, { mode: 'cors', referrerPolicy: 'no-referrer' }, 60000);
      const text = await resp.text();
      blob = new Blob([text], { type: 'text/html;charset=utf-8' });
      if (wrappedProgress) wrappedProgress(100);
    } else {
      const isOriginalSize = targetW == null && targetH == null;
      if (isOriginalSize) {
        const resp = await fetchWithTimeout(url, { mode: 'cors', referrerPolicy: 'no-referrer' }, 60000);
        blob = await resp.blob();
        if (wrappedProgress) wrappedProgress(100);
      } else {
        blob = isVideo
          ? await processVideoToBlob(url, targetW, targetH, wrappedProgress)
          : await processImageToBlob(url, targetW, targetH, wrappedProgress);
        if (!isVideo && wrappedProgress) wrappedProgress(100);
      }
    }
  } finally {
    if (sim) {
      sim.stop();
      sim = null;
    }
  }

  let ext = 'png';
  if (isHtml) {
    ext = 'html';
  } else {
    const fromUrl = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
    if (fromUrl && /^(mp4|webm|mov|avi|jpg|jpeg|png|gif|webp)$/i.test(fromUrl)) {
      ext = fromUrl === 'jpeg' ? 'jpg' : fromUrl;
    } else if (blob.type) {
      if (blob.type === 'video/mp4') ext = 'mp4';
      else if (blob.type === 'video/webm') ext = 'webm';
      else if (blob.type === 'image/jpeg') ext = 'jpg';
      else if (blob.type === 'image/gif') ext = 'gif';
      else if (blob.type === 'image/webp') ext = 'webp';
      else if (isVideo) ext = blob.type === 'video/mp4' ? 'mp4' : 'webm';
    }
  }

  const name = baseFilename != null && String(baseFilename).trim()
    ? String(baseFilename).trim().replace(/\.[a-zA-Z0-9]+$/, '')
    : (filename.replace(/\.[a-zA-Z0-9]+$/, '') || 'creative');
  const finalName = baseFilename != null && String(baseFilename).trim()
    ? `${name}.${ext}`
    : `${name}_${Date.now()}.${ext}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = finalName;
  a.click();
  URL.revokeObjectURL(a.href);
  if (isVideo && wrappedProgress && !isHtml) wrappedProgress(100);
  await new Promise((r) => setTimeout(r, 200));
}
