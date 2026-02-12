/**
 * 使用 ffmpeg.wasm 将视频转为固定尺寸（前景等比 contain 居中 + 背景 cover 模糊）
 * 替代 canvas + MediaRecorder，避免掉帧、码率与坏帧问题
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const LOG_PREFIX = '[videoFFmpeg]';

/**
 * 探测输入视频的帧率与比特率（通过 ffmpeg -i 的 log 解析）
 * @param {import('@ffmpeg/ffmpeg').FFmpeg} ffmpeg
 * @param {string} inputName
 * @returns {Promise<{ fps: number, totalKbps: number, audioKbps: number }>}
 */
async function probeVideoMeta(ffmpeg, inputName) {
  const logLines = [];
  const onLog = ({ message }) => logLines.push(message);
  ffmpeg.on('log', onLog);
  try {
    await ffmpeg.exec(['-i', inputName]);
  } catch (_) {
    // 无输出会报错，忽略
  }
  ffmpeg.off('log', onLog);
  const text = logLines.join('\n');
  let fps = 30;
  let totalKbps = 0;
  let audioKbps = 128;
  const fpsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)/);
  if (fpsMatch) fps = Math.max(1, Math.min(120, parseFloat(fpsMatch[1]) || 30));
  const totalMatch = text.match(/bitrate:\s*(\d+)\s*kb\/s/);
  if (totalMatch) totalKbps = parseInt(totalMatch[1], 10) || 0;
  const audioMatch = text.match(/Audio:.*?\s(\d+)\s*kb\/s/);
  if (audioMatch) audioKbps = parseInt(audioMatch[1], 10) || 128;
  // 视频码率：有总码率时用 total - audio，且不低于分辨率合理下限；无总码率时用较高默认避免糊
  const rawVideoKbps = totalKbps > 0 ? Math.max(100, totalKbps - audioKbps) : 0;
  const minVideoKbps = 2500; // 避免 800×800 等尺寸被压得过低
  const videoKbps = rawVideoKbps > 0 ? Math.max(minVideoKbps, rawVideoKbps) : 5000;
  return { fps, totalKbps, audioKbps, videoKbps };
}

const POOL_SIZE = 3;

/** 创建并加载一个 FFmpeg 实例（供池使用） */
async function loadOneFFmpegInstance() {
  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', () => {});
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const localCore = `${base}/ffmpeg-core.js`;
  const localWasm = `${base}/ffmpeg-core.wasm`;
  const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
  try {
    const coreRes = await fetch(localCore, { method: 'HEAD' });
    const wasmRes = await fetch(localWasm, { method: 'HEAD' });
    if (coreRes.ok && wasmRes.ok) {
      await ffmpeg.load({ coreURL: localCore, wasmURL: localWasm });
    } else {
      throw new Error('local not available');
    }
  } catch (_) {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }
  return ffmpeg;
}

/** 实例池：最多 POOL_SIZE 个实例，供多任务并行；每个任务用独立虚拟文件名避免互相覆盖 */
const pool = { instances: [], inUse: [], waitQueue: [] };
async function acquireFFmpeg() {
  for (let i = 0; i < POOL_SIZE; i++) {
    if (!pool.inUse[i]) {
      if (!pool.instances[i]) {
        pool.instances[i] = await loadOneFFmpegInstance();
      }
      pool.inUse[i] = true;
      return { ffmpeg: pool.instances[i], slotId: i };
    }
  }
  return new Promise((resolve) => {
    pool.waitQueue.push(resolve);
  });
}
function releaseFFmpeg(slotId) {
  pool.inUse[slotId] = false;
  if (pool.waitQueue.length > 0) {
    const resolve = pool.waitQueue.shift();
    pool.inUse[slotId] = true;
    resolve({ ffmpeg: pool.instances[slotId], slotId });
  }
}

/** 兼容：单例 loadFFmpeg 供外部使用（从池取一个实例，用后即还） */
let firstLoadPromise = null;
export async function loadFFmpeg() {
  if (firstLoadPromise) return firstLoadPromise;
  firstLoadPromise = acquireFFmpeg().then(({ ffmpeg, slotId }) => {
    releaseFFmpeg(slotId);
    return ffmpeg;
  });
  return firstLoadPromise;
}

/** 带超时的 fetch，避免 CORS 或无响应挂起 */
async function fetchVideoAsBlob(url, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer', signal: controller.signal });
    const blob = await res.blob();
    return blob;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 使用 ffmpeg 将视频转为目标尺寸的 MP4 Blob（从池取实例 + 独立虚拟文件，可多任务并行）
 * 效果：画布=targetW×targetH，背景=原视频 cover 后 boxblur，前景=原视频 contain 居中
 */
const STEP_PREFIX = '[视频处理]';

export async function processVideoToBlobWithFFmpeg(videoUrl, targetW, targetH, onProgress = null) {
  console.info(STEP_PREFIX, '1/4 拉取视频');
  const videoBlob = await fetchVideoAsBlob(videoUrl);
  console.info(STEP_PREFIX, '2/4 获取 FFmpeg 实例，写入并开始转码');
  const { ffmpeg, slotId } = await acquireFFmpeg();
  const runId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const inputName = `in_${slotId}_${runId}`;
  const outputName = `out_${slotId}_${runId}.mp4`;
  try {
    const W = Number(targetW) || 800;
    const H = Number(targetH) || 800;
    const gblurSigma = 30;

    let lastPercent = 0;
    const maxJump = 20; // ffmpeg.wasm 有时一次报很高，限制单次增幅避免 0→99 秒跳
    ffmpeg.on('progress', ({ progress }) => {
      if (typeof onProgress === 'function') {
        const raw = Math.min(99, Math.round((progress ?? 0) * 100));
        const percent = raw <= lastPercent
          ? lastPercent
          : raw >= 95
            ? raw
            : Math.min(99, lastPercent + maxJump, raw);
        lastPercent = percent;
        onProgress(percent);
      }
    });

    await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));

    const { fps, videoKbps } = await probeVideoMeta(ffmpeg, inputName);

    const filterComplex = [
      '[0:v]split=2[cover][contain]',
      `[cover]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},gblur=sigma=${gblurSigma}[bg]`,
      `[contain]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg]`,
      `[bg][fg]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[v]`,
    ].join(';');

    await ffmpeg.exec([
      '-i', inputName,
      '-filter_complex', filterComplex,
      '-map', '[v]',
      '-map', '0:a?',
      '-r', String(fps),
      '-b:v', `${videoKbps}k`,
      '-maxrate', `${videoKbps}k`,
      '-bufsize', `${Math.min(videoKbps * 2, 10000)}k`,
      '-g', String(Math.round(fps)),
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-y',
      outputName,
    ]);

    console.info(STEP_PREFIX, '3/4 转码完成，读取输出');
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'video/mp4' });

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) {
      console.warn(LOG_PREFIX, '清理虚拟文件失败:', e?.message);
    }

    if (typeof onProgress === 'function') onProgress(100);
    console.info(STEP_PREFIX, '4/4 完成');
    return blob;
  } finally {
    releaseFFmpeg(slotId);
  }
}
