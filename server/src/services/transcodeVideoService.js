/**
 * 后端视频转码：下载视频 → ffprobe 探测 → ffmpeg 缩放+模糊背景+overlay → 输出 MP4
 * 与前端 videoFFmpeg 效果一致（帧率、码率、filter_complex）
 * 同时只允许有限个转码任务，避免多请求时 CPU 打满、服务无响应
 */
import { spawn, spawnSync } from 'child_process';
import { rmSync, mkdtempSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, cpus } from 'os';

/** 同时进行的转码任务上限（ffmpeg 极耗 CPU；2 核建议 1，4 核建议 3，6～8 核可 4+） */
const MAX_CONCURRENT_TRANSCODES = 3;

/** 每任务 ffmpeg 线程数：未设时按 CPU 逻辑核心数 75% 再按并发均分，至少 1；也可通过 FFMPEG_THREADS 覆盖 */
const numCpus = cpus?.()?.length ?? 4;
const defaultThreads = Math.max(1, Math.floor((numCpus * 0.75) / MAX_CONCURRENT_TRANSCODES));
const FFMPEG_THREADS = process.env.FFMPEG_THREADS ? parseInt(process.env.FFMPEG_THREADS, 10) : defaultThreads;
const THREADS = Number.isFinite(FFMPEG_THREADS) && FFMPEG_THREADS > 0 ? FFMPEG_THREADS : defaultThreads;

/** 编码预设：越快编码越快、体积略大。可选 ultrafast/superfast/veryfast/faster/fast/medium（默认 fast 平衡速度与体积） */
const FFMPEG_PRESET = process.env.FFMPEG_PRESET || 'fast';

/** 硬件加速：nvenc(NVIDIA)/videotoolbox(macOS)/空=软件编码。无 GPU 时设为空 */
const FFMPEG_HWACCEL = (process.env.FFMPEG_HWACCEL || '').toLowerCase();

/** 输入/输出缓冲区（k），改善内存与 IO 效率 */
const FFMPEG_BUF_SIZE_K = parseInt(process.env.FFMPEG_BUF_SIZE_K || '1024', 10) || 1024;
const MAX_MUXING_QUEUE_SIZE = parseInt(process.env.FFMPEG_MAX_MUXING_QUEUE_SIZE || '1024', 10) || 1024;

/** 可选：将 ffmpeg 绑到指定 CPU 核（如 "1,2,3"），留出核 0 给 Web；不设则 ffmpeg 可用全部核 */
const FFMPEG_CPUS = process.env.FFMPEG_CPUS || '';

const DOWNLOAD_TIMEOUT_MS = 45000;
const TRANSCODE_TIMEOUT_MS = 300000; // 5 分钟
const GBLUR_SIGMA = 30;
const MIN_VIDEO_KBPS = 2500;
const FALLBACK_VIDEO_KBPS = 5000;

/** 转码并发控制：当前正在执行的任务数 */
let runningTranscodes = 0;
/** 等待获得转码槽位的 resolver 队列 */
const transcodeWaitQueue = [];
/** 当前正在执行的任务开始时间（获得槽位时记录），供 /health 排查卡住问题 */
let currentJobStartedAt = null;

/**
 * 获得一个转码槽位（若已达上限则排队等待）
 * @returns {Promise<void>}
 */
function acquireTranscodeSlot() {
  if (runningTranscodes < MAX_CONCURRENT_TRANSCODES) {
    runningTranscodes += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    transcodeWaitQueue.push(resolve);
  });
}

/**
 * 释放一个转码槽位，并唤醒下一个等待者（若有）
 */
function releaseTranscodeSlot() {
  runningTranscodes -= 1;
  if (transcodeWaitQueue.length > 0) {
    runningTranscodes += 1;
    const next = transcodeWaitQueue.shift();
    next();
  }
}

/**
 * 获取转码队列状态，供前端展示及 /health 排查
 * @returns {{ running: number, waiting: number, maxConcurrent: number, currentJobStartedAt: number|null, currentJobDurationMs: number|null, downloadTimeoutMs: number, transcodeTimeoutMs: number }}
 */
export function getTranscodeQueueStatus() {
  const now = Date.now();
  const durationMs = currentJobStartedAt != null ? now - currentJobStartedAt : null;
  return {
    running: runningTranscodes,
    waiting: transcodeWaitQueue.length,
    maxConcurrent: MAX_CONCURRENT_TRANSCODES,
    currentJobStartedAt: currentJobStartedAt ?? null,
    currentJobStartedAtFormatted: currentJobStartedAt
      ? new Date(currentJobStartedAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false, timeZone: 'Asia/Shanghai' })
      : null,
    currentJobDurationMs: durationMs,
    currentJobDurationText: durationMs != null ? formatDurationMs(durationMs) : null,
    downloadTimeoutMs: DOWNLOAD_TIMEOUT_MS,
    transcodeTimeoutMs: TRANSCODE_TIMEOUT_MS,
  };
}

function formatDurationMs(ms) {
  if (ms == null || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}小时${m % 60}分${s % 60}秒`;
  if (m > 0) return `${m}分${s % 60}秒`;
  return `${s}秒`;
}

/**
 * 从 ffmpeg -i 的 stderr 解析 fps 与视频码率（与前端 probeVideoMeta 一致）
 */
function probeVideoMeta(inputPath) {
  const result = spawnSync('ffmpeg', ['-i', inputPath], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const text = (result.stderr || '') + (result.stdout || '');
  let fps = 30;
  let totalKbps = 0;
  let audioKbps = 128;
  const fpsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)/);
  if (fpsMatch) fps = Math.max(1, Math.min(120, parseFloat(fpsMatch[1]) || 30));
  const totalMatch = text.match(/bitrate:\s*(\d+)\s*kb\/s/);
  if (totalMatch) totalKbps = parseInt(totalMatch[1], 10) || 0;
  const audioMatch = text.match(/Audio:.*?\s(\d+)\s*kb\/s/);
  if (audioMatch) audioKbps = parseInt(audioMatch[1], 10) || 128;
  const rawVideoKbps = totalKbps > 0 ? Math.max(100, totalKbps - audioKbps) : 0;
  const videoKbps = rawVideoKbps > 0 ? Math.max(MIN_VIDEO_KBPS, rawVideoKbps) : FALLBACK_VIDEO_KBPS;
  return { fps, videoKbps };
}

/**
 * 下载视频到指定路径
 */
async function downloadVideoToFile(videoUrl, outputPath) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(videoUrl, {
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const buf = await res.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(buf));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 执行转码，输出到 outputPath（异步 spawn，不阻塞事件循环）
 * 优化：线程数、可选硬件编码、编码预设、输入/输出缓冲区、max_muxing_queue_size
 */
function runFfmpegTranscode(inputPath, outputPath, W, H, fps, videoKbps) {
  const filterComplex = [
    '[0:v]split=2[cover][contain]',
    `[cover]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},gblur=sigma=${GBLUR_SIGMA}[bg]`,
    `[contain]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg]`,
    `[bg][fg]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[v]`,
  ].join(';');

  const useHwNvenc = FFMPEG_HWACCEL === 'nvenc';
  const useHwVideotoolbox = FFMPEG_HWACCEL === 'videotoolbox';
  const useHw = useHwNvenc || useHwVideotoolbox;
  const outBufsizeK = Math.min(Math.max(videoKbps * 2, FFMPEG_BUF_SIZE_K), 10000);

  // -bufsize 仅能作为输出编码选项，不能放在 -i 前（会报 "is not a decoding option"）
  const args = [
    '-threads', String(THREADS),
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[v]',
    '-map', '0:a?',
    '-r', String(fps),
    '-b:v', `${videoKbps}k`,
    '-maxrate', `${videoKbps}k`,
    '-bufsize', `${outBufsizeK}k`,
    '-max_muxing_queue_size', String(MAX_MUXING_QUEUE_SIZE),
    '-g', String(Math.round(fps)),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-y',
    outputPath,
  ];

  const pixFmtIdx = args.indexOf('-pix_fmt');
  if (useHwNvenc) {
    args.splice(pixFmtIdx, 0, '-c:v', 'h264_nvenc');
  } else if (useHwVideotoolbox) {
    args.splice(pixFmtIdx, 0, '-c:v', 'h264_videotoolbox');
  } else {
    args.splice(pixFmtIdx, 0, '-c:v', 'libx264', '-preset', FFMPEG_PRESET);
  }

  const useCpus = FFMPEG_CPUS.trim();
  const cmd = useCpus ? 'taskset' : 'ffmpeg';
  const cmdArgs = useCpus ? ['-c', useCpus, 'ffmpeg', ...args] : args;

  return new Promise((resolve, reject) => {
    let settled = false;
    const once = (fn) => (...args) => {
      if (settled) return;
      settled = true;
      fn(...args);
    };
    const child = spawn(cmd, cmdArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    const timeoutId = setTimeout(() => {
      child.kill('SIGKILL');
      once(reject)(new Error(`ffmpeg 转码超时（${TRANSCODE_TIMEOUT_MS / 1000} 秒）`));
    }, TRANSCODE_TIMEOUT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timeoutId);
      if (settled) return;
      settled = true;
      if (code === 0 && existsSync(outputPath)) {
        resolve();
      } else {
        const err = stderr.slice(-2000) || signal || `退出码 ${code}`;
        reject(new Error(`ffmpeg 转码失败: ${err}`));
      }
    });
    child.on('error', (err) => {
      clearTimeout(timeoutId);
      once(reject)(new Error(`ffmpeg 启动失败: ${err?.message || '未知错误'}`));
    });
  });
}

/**
 * 转码视频：下载 → 探测 → 转码，返回输出文件路径；调用方负责读流与清理
 * @param {string} videoUrl - 视频 URL
 * @param {number} targetW - 目标宽
 * @param {number} targetH - 目标高
 * @returns {{ outputPath: string, cleanup: () => void }} outputPath 与清理函数
 */
export async function transcodeVideoToFile(videoUrl, targetW, targetH) {
  await acquireTranscodeSlot();
  currentJobStartedAt = Date.now();
  try {
    const W = Number(targetW) || 800;
    const H = Number(targetH) || 800;
    const workDir = mkdtempSync(join(tmpdir(), 'ads-scraw-transcode-'));
    const inputPath = join(workDir, 'input');
    const outputPath = join(workDir, 'output.mp4');

    function cleanup() {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch (_) {}
    }

    try {
      await downloadVideoToFile(videoUrl, inputPath);
      const { fps, videoKbps } = probeVideoMeta(inputPath);
      await runFfmpegTranscode(inputPath, outputPath, W, H, fps, videoKbps);
      return { outputPath, cleanup };
    } catch (e) {
      cleanup();
      throw e;
    }
  } finally {
    currentJobStartedAt = null;
    releaseTranscodeSlot();
  }
}
