/**
 * 批量下载：按固定尺寸输出素材
 * 当原尺寸 != 目标尺寸时：画布=目标尺寸，内容等比缩放完整显示居中，空白区域用高斯模糊填充
 */

const BLUR_RADIUS = 24;

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
    ? (item.ad_key ?? item.id ?? '')
    : (item.id ?? item.search_flag ?? item.ad_key ?? item.bizId ?? item.materialId ?? '');
  return String(raw ?? '');
}

/** 从 item 提取下载 URL、是否视频、建议文件名 */
export function getBatchDownloadInfo(item, platform) {
  const sanitize = (s) => (s == null ? '' : String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0, 80));
  if (platform === 'guangdada') {
    const isVideo = item.ads_type === 2 || (item.resource_urls?.[0]?.type === 2) || !!(item.resource_urls?.[0]?.video_url);
    const url = isVideo
      ? (item.resource_urls?.[0]?.video_url ?? '')
      : (item.resource_urls?.[0]?.image_url ?? item.preview_img_url ?? '');
    const title = item.title || item.message || item.body || '';
    const name = (item.advertiser_name || item.ad_key || '') + (title ? `_${title}` : '');
    return { url, isVideo, filename: sanitize(name) || 'creative' };
  }
  const isVideo = item.materialType === 2 || !!(item.videoUrl && item.videoUrl.trim());
  const url = isVideo
    ? (item.videoUrl || '')
    : (item.thumbnailImageUrl?.[0] ?? item.imageUrl?.[0] ?? '');
  const title = (item.title || item.describe || '').replace(/<font color='red'>|<\/font>/g, '');
  const appName = (item.appList?.[0]?.name || '').replace(/<font color='red'>|<\/font>/g, '');
  const name = title || appName || item.id || item.search_flag || 'creative';
  return { url, isVideo, filename: sanitize(name) || 'creative' };
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
 * 计算等比缩放后居中绘制的 src 区域与目标区域
 * scaleMode: 'contain' 完整显示 | 'cover' 铺满
 */
function fitRect(srcW, srcH, dstW, dstH, scaleMode = 'contain') {
  const scale = scaleMode === 'cover'
    ? Math.max(dstW / srcW, dstH / srcH)
    : Math.min(dstW / srcW, dstH / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const offsetX = (dstW - drawW) / 2;
  const offsetY = (dstH - drawH) / 2;
  return { drawW, drawH, offsetX, offsetY, scale };
}

/**
 * 图片 → 固定尺寸 Blob（等比缩放居中 + 空白区高斯模糊）
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
    const resp = await fetchWithTimeout(imageUrl, { mode: 'cors' }, 30000);
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

  // 1) 背景层：原图按 cover 缩放后高斯模糊铺满画布
  ctx.save();
  ctx.filter = `blur(${BLUR_RADIUS}px)`;
  ctx.drawImage(
    img,
    0, 0, srcW, srcH,
    -cover.offsetX, -cover.offsetY, cover.drawW, cover.drawH
  );
  ctx.restore();

  // 2) 前景层：原图按 contain 等比缩放居中，清晰
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
 * 视频 → 固定尺寸 Blob（移植自 cat-catch：等比缩放居中 + 空白区拉伸模糊）
 * 逻辑：画布=目标尺寸；背景=原视频拉伸铺满画布后高斯模糊；前景=原视频等比 contain 居中
 * @param {string} videoUrl - 视频 URL
 * @param {number} targetW - 目标宽
 * @param {number} targetH - 目标高
 * @param {Function} [onProgress] - 进度回调 (0-100)
 * @returns {Promise<Blob>}
 */
export function processVideoToBlob(videoUrl, targetW, targetH, onProgress = null) {
  const width = targetW;
  const height = targetH;
  const BLUR_PX = 50;
  const TARGET_FPS = 30;
  const frameInterval = 1000 / TARGET_FPS;
  const logPrefix = '[batchDownload 视频]';

  const mainPromise = new Promise((resolve, reject) => {
    console.log(logPrefix, '开始 fetch 视频:', videoUrl?.slice?.(0, 80));
    fetchWithTimeout(videoUrl, { mode: 'cors' }, 45000)
      .then((res) => res.blob())
      .then((videoBlob) => {
        const originalVideoBlob = videoBlob;
        console.log(logPrefix, 'fetch 完成, blob 大小:', videoBlob?.size, 'bytes');
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.muted = true;
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
          const dur = video.duration;
          console.log(logPrefix, 'onloadedmetadata:', vw, 'x', vh, 'duration=', dur);
          if (!vw || !vh) {
            console.error(logPrefix, '无法获取视频尺寸 vw/vh 为 0');
            cleanup();
            reject(new Error('无法获取视频尺寸'));
            return;
          }

          const videoAspect = vw / vh;
          const outputAspect = width / height;
          let scaledWidth, scaledHeight, offsetX, offsetY;
          if (videoAspect > outputAspect) {
            scaledWidth = width;
            scaledHeight = width / videoAspect;
            offsetX = 0;
            offsetY = (height - scaledHeight) / 2;
          } else {
            scaledWidth = height * videoAspect;
            scaledHeight = height;
            offsetX = (width - scaledWidth) / 2;
            offsetY = 0;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

          const applyBlurBg = () => {
            tempCtx.clearRect(0, 0, width, height);
            tempCtx.filter = `blur(${BLUR_PX}px)`;
            tempCtx.drawImage(video, 0, 0, width, height);
            tempCtx.filter = 'none';
            ctx.drawImage(tempCanvas, 0, 0);
          };

          const drawSharp = () => {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(video, offsetX, offsetY, scaledWidth, scaledHeight);
          };

          const mimeVideoOnly = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
              ? 'video/webm;codecs=vp8'
              : 'video/webm';
          const mimeWithAudio = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
              ? 'video/webm;codecs=vp8,opus'
              : mimeVideoOnly;
          let recorder = null;
          let chunks = [];
          let mime = mimeVideoOnly;

          const setupRecorder = (streamToRecord) => {
            mime = streamToRecord.getAudioTracks().length > 0 ? mimeWithAudio : mimeVideoOnly;
            const rec = new MediaRecorder(streamToRecord, {
              mimeType: mime,
              videoBitsPerSecond: 2500000,
              audioBitsPerSecond: streamToRecord.getAudioTracks().length > 0 ? 128000 : undefined,
            });
            chunks = [];
            rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
            const hasAudio = streamToRecord.getAudioTracks().length > 0;
            rec.onstop = async () => {
              let blob = new Blob(chunks, { type: mime });
              console.log(logPrefix, '录制结束, 输出 blob 大小:', blob.size, '含音频:', hasAudio);
              cleanup();
              if (blob.size < 1000) {
                console.error(logPrefix, '生成的视频过小:', blob.size);
                reject(new Error('生成的视频过小'));
                return;
              }
              if (!hasAudio && originalVideoBlob) {
                try {
                  const { mergeAudioIntoVideo } = await import('./ffmpegMergeAudio.js');
                  console.log(logPrefix, '使用 FFmpeg 合并原视频音频…');
                  blob = await mergeAudioIntoVideo(originalVideoBlob, blob);
                  console.log(logPrefix, '合并后 blob 大小:', blob.size);
                } catch (e) {
                  console.warn(logPrefix, 'FFmpeg 合并失败，返回仅画面:', e?.message);
                }
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

          let lastVideoTime = -1;
          let lastProgressUpdate = 0;

          let drawFrameLogged = false;
          const drawFrame = (timestamp) => {
            if (video.ended) {
              if (!drawFrameLogged) {
                console.log(logPrefix, 'video.ended, 准备停止录制');
                drawFrameLogged = true;
              }
              ctx.clearRect(0, 0, width, height);
              applyBlurBg();
              drawSharp();
              if (onProgress) onProgress(100);
              setTimeout(() => {
                if (recorder && recorder.state === 'recording') recorder.stop();
              }, 300);
              return;
            }

            if (video.paused) {
              requestAnimationFrame(drawFrame);
              return;
            }

            const now = timestamp || performance.now();
            const t = video.currentTime;
            const elapsed = lastVideoTime >= 0 ? t - lastVideoTime : frameInterval / 1000;
            if (elapsed >= 1 / TARGET_FPS || lastVideoTime < 0) {
              ctx.clearRect(0, 0, width, height);
              applyBlurBg();
              drawSharp();
              lastVideoTime = t;
              if (onProgress && video.duration > 0) {
                const progress = (t / video.duration) * 100;
                if (now - lastProgressUpdate >= 80) {
                  onProgress(Math.min(progress, 99));
                  lastProgressUpdate = now;
                }
              }
            }
            requestAnimationFrame(drawFrame);
          };

          let started = false;
          const startPlayAndRecord = () => {
            if (started) return;
            started = true;
            if (readyWarnTimer) {
              clearTimeout(readyWarnTimer);
              readyWarnTimer = null;
            }
            console.log(logPrefix, '开始播放与录制, duration=', video.duration);
            if (onProgress) onProgress(0);
            video.currentTime = 0;
            video
              .play()
              .then(() => {
                const canvasStream = canvas.captureStream(TARGET_FPS);
                recorder = setupRecorder(canvasStream);
                recorder.start(100);
                requestAnimationFrame(drawFrame);
              })
              .catch((e) => {
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

        console.log(logPrefix, '调用 video.load()，等待 canplay / canplaythrough 或 1.2s 后自动启动…');
        video.load();
      }
      )
      .catch((e) => {
        console.error(logPrefix, '下载/解析失败:', e?.message ?? e);
        reject(new Error('视频下载失败: ' + (e?.message || '')));
      });
  });
  return withTimeout(mainPromise, 120000, '视频处理超时（约 2 分钟）');
}

/** 预设输出尺寸 */
export const BATCH_DOWNLOAD_SIZE_OPTIONS = [
  { label: '720×1280（竖版）', width: 720, height: 1280 },
  { label: '1280×720（横版）', width: 1280, height: 720 },
  { label: '800×800（方形）', width: 800, height: 800 },
];

/**
 * 批量处理并下载：根据 isVideo 调用 processImageToBlob 或 processVideoToBlob，然后触发下载
 * onProgress(percent?) 可选，图片完成时调用 onProgress(100)，视频处理中会多次调用 0–100
 */
export async function processAndDownloadItem({ url, isVideo, filename }, targetW, targetH, onProgress) {
  const blob = isVideo
    ? await processVideoToBlob(url, targetW, targetH, onProgress)
    : await processImageToBlob(url, targetW, targetH, onProgress);
  if (!isVideo && onProgress) onProgress(100);
  const ext = isVideo ? 'webm' : 'png';
  const name = filename.replace(/\.[a-zA-Z0-9]+$/, '') || 'creative';
  const finalName = `${name}.${ext}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = finalName;
  a.click();
  URL.revokeObjectURL(a.href);
  if (isVideo && onProgress) onProgress(100);
}
