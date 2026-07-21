/**
 * 后端视频转码：持久化任务队列，支持重启后继续排队任务
 */
import { spawn, spawnSync } from 'child_process';
import { rmSync, mkdtempSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, cpus } from 'os';
import { logger } from '../utils/logger.js';
import {
  initJobStore,
  upsertJob,
  getJob,
  listJobs,
  listRecoverableJobs,
  getOutputPath,
  deleteJobOutput,
  pruneTranscodeOutputFiles,
  TRANSCODE_OUTPUT_RETENTION_MS,
  TRANSCODE_OUTPUT_MAX_BYTES,
} from './transcodeJobStore.js';

const MAX_CONCURRENT_TRANSCODES = (() => {
  const parsed = parseInt(process.env.TRANSCODE_MAX_CONCURRENT || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();

const numCpus = cpus?.()?.length ?? 4;
const defaultThreads = Math.max(1, Math.floor((numCpus * 0.75) / MAX_CONCURRENT_TRANSCODES));
const FFMPEG_THREADS = process.env.FFMPEG_THREADS ? parseInt(process.env.FFMPEG_THREADS, 10) : defaultThreads;
const THREADS = Number.isFinite(FFMPEG_THREADS) && FFMPEG_THREADS > 0 ? FFMPEG_THREADS : defaultThreads;
const FFMPEG_PRESET = process.env.FFMPEG_PRESET || 'fast';
const FFMPEG_HWACCEL = (process.env.FFMPEG_HWACCEL || '').toLowerCase();
const FFMPEG_BUF_SIZE_K = parseInt(process.env.FFMPEG_BUF_SIZE_K || '1024', 10) || 1024;
const MAX_MUXING_QUEUE_SIZE = parseInt(process.env.FFMPEG_MAX_MUXING_QUEUE_SIZE || '1024', 10) || 1024;
const FFMPEG_CPUS = process.env.FFMPEG_CPUS || '';
const OUTPUT_PRUNE_INTERVAL_MS = (() => {
  const parsed = parseInt(process.env.TRANSCODE_OUTPUT_PRUNE_INTERVAL_MS || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60 * 1000;
})();

const DOWNLOAD_TIMEOUT_MS = 45000;
const TRANSCODE_TIMEOUT_MS = 300000;
const GBLUR_SIGMA = 30;
const MIN_VIDEO_KBPS = 2500;
const FALLBACK_VIDEO_KBPS = 5000;

let nextJobSeq = 1;
/** 等待获得转码槽位：{ jobId, resolve } */
const transcodeWaitQueue = [];
let runningTranscodes = 0;
let queueInitialized = false;
let outputPruneTimer = null;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)}${units[index]}`;
}

function pruneTranscodeOutputs(reason = 'periodic') {
  const result = pruneTranscodeOutputFiles();
  if (result.removedCount > 0) {
    logger.info(
      `转码输出清理(${reason}): 删除 ${result.removedCount} 个文件，释放 ${formatBytes(result.removedBytes)}，剩余 ${formatBytes(result.totalBytesAfter)}`
    );
  }
  return result;
}

function startOutputPruneTimer() {
  if (outputPruneTimer || OUTPUT_PRUNE_INTERVAL_MS <= 0) return;
  outputPruneTimer = setInterval(() => {
    try {
      pruneTranscodeOutputs('timer');
    } catch (e) {
      logger.warn('转码输出定时清理失败:', e?.message || String(e));
    }
  }, OUTPUT_PRUNE_INTERVAL_MS);
  outputPruneTimer.unref?.();
}

function truncateUrl(url, max = 72) {
  if (!url) return '';
  const s = String(url);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3)}...`;
}

function formatBeijingTime(ts) {
  if (ts == null) return null;
  return new Date(ts).toLocaleString('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
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

function normalizeCreator(profile) {
  if (!profile) return null;
  const firstText = (...values) => {
    for (const value of values) {
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return null;
  };
  return {
    feishu_user_id: firstText(profile.feishu_user_id, profile.feishuUserId, profile.user_id, profile.id),
    user_name: firstText(
      profile.user_name,
      profile.name,
      profile.display_name,
      profile.displayName,
      profile.real_name,
      profile.realName,
      profile.nickname,
      profile.nick_name,
      profile.feishu_user_name
    ),
    email: firstText(profile.email, profile.user_email, profile.email_address),
  };
}

function refreshQueuePositions() {
  transcodeWaitQueue.forEach((entry, index) => {
    const job = getJob(entry.jobId);
    if (job && job.status === 'queued') {
      job.queuePosition = index + 1;
      upsertJob(job);
    }
  });
}

function createJobRecord(videoUrl, targetW, targetH, meta = {}) {
  const id = `tx-${nextJobSeq++}-${Date.now().toString(36)}`;
  const job = {
    id,
    status: 'queued',
    phase: 'queued',
    enqueuedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    targetW: Number(targetW) || 800,
    targetH: Number(targetH) || 800,
    videoUrl: String(videoUrl).trim(),
    videoUrlPreview: truncateUrl(videoUrl),
    queuePosition: null,
    createdBy: meta.createdBy ?? null,
    clientBatchId: meta.clientBatchId ?? null,
    clientTaskId: meta.clientTaskId ?? null,
    sourceLabel: meta.sourceLabel ?? null,
    errorMessage: null,
  };
  upsertJob(job);
  return job;
}

function markJobRunning(job) {
  runningTranscodes += 1;
  job.status = 'running';
  job.phase = 'downloading';
  job.startedAt = Date.now();
  job.queuePosition = null;
  upsertJob(job);
}

function setJobPhase(jobId, phase) {
  const job = getJob(jobId);
  if (job && job.status === 'running') {
    job.phase = phase;
    upsertJob(job);
  }
}

function markJobCompleted(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  job.status = 'completed';
  job.phase = 'completed';
  job.finishedAt = Date.now();
  job.queuePosition = null;
  upsertJob(job);
}

function markJobFailed(jobId, errorMessage) {
  const job = getJob(jobId);
  if (!job) return;
  job.status = 'failed';
  job.phase = 'failed';
  job.finishedAt = Date.now();
  job.errorMessage = errorMessage || '转码失败';
  job.queuePosition = null;
  upsertJob(job);
}

function acquireTranscodeSlot(job) {
  if (runningTranscodes < MAX_CONCURRENT_TRANSCODES) {
    markJobRunning(job);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    transcodeWaitQueue.push({ jobId: job.id, resolve });
    job.queuePosition = transcodeWaitQueue.length;
    upsertJob(job);
    refreshQueuePositions();
  }).then(() => {
    const latest = getJob(job.id);
    if (latest) markJobRunning(latest);
  });
}

function releaseTranscodeSlot(jobId) {
  runningTranscodes = Math.max(0, runningTranscodes - 1);
  if (transcodeWaitQueue.length > 0) {
    const next = transcodeWaitQueue.shift();
    refreshQueuePositions();
    next.resolve();
  } else {
    refreshQueuePositions();
  }
  scheduleQueuePump();
}

function serializeJob(job, now = Date.now()) {
  const waitDurationMs = job.startedAt != null
    ? job.startedAt - job.enqueuedAt
    : now - job.enqueuedAt;
  const runDurationMs = job.startedAt != null
    ? (job.finishedAt ?? now) - job.startedAt
    : null;
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    queuePosition: job.queuePosition,
    enqueuedAt: job.enqueuedAt,
    enqueuedAtFormatted: formatBeijingTime(job.enqueuedAt),
    startedAt: job.startedAt,
    startedAtFormatted: job.startedAt ? formatBeijingTime(job.startedAt) : null,
    finishedAt: job.finishedAt,
    finishedAtFormatted: job.finishedAt ? formatBeijingTime(job.finishedAt) : null,
    waitDurationMs,
    runDurationMs,
    waitDurationText: formatDurationMs(waitDurationMs),
    runDurationText: runDurationMs != null ? formatDurationMs(runDurationMs) : null,
    targetW: job.targetW,
    targetH: job.targetH,
    targetSize: `${job.targetW}×${job.targetH}`,
    videoUrlPreview: job.videoUrlPreview,
    createdBy: job.createdBy,
    creatorName: job.createdBy?.user_name || job.createdBy?.email || job.createdBy?.feishu_user_id || '—',
    clientBatchId: job.clientBatchId,
    clientTaskId: job.clientTaskId,
    sourceLabel: job.sourceLabel,
    errorMessage: job.errorMessage,
  };
}

export function getTranscodeJob(jobId) {
  const job = getJob(jobId);
  return job ? serializeJob(job) : null;
}

export function listTranscodeJobs(options = {}) {
  return listJobs(options).map((job) => serializeJob(job));
}

export function getTranscodeQueueStatus() {
  const now = Date.now();
  const activeJobs = listJobs({ activeOnly: true, limit: MAX_CONCURRENT_TRANSCODES + 200 })
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
    .map((job) => serializeJob(job, now));

  const runningJobs = activeJobs.filter((j) => j.status === 'running');
  const queuedJobs = activeJobs.filter((j) => j.status === 'queued');
  const firstRunning = runningJobs[0] ?? null;

  return {
    running: runningJobs.length,
    waiting: queuedJobs.length,
    maxConcurrent: MAX_CONCURRENT_TRANSCODES,
    jobs: activeJobs,
    runningJobs,
    queuedJobs,
    currentJobStartedAt: firstRunning?.startedAt ?? null,
    currentJobStartedAtFormatted: firstRunning?.startedAtFormatted ?? null,
    currentJobDurationMs: firstRunning?.runDurationMs ?? null,
    currentJobDurationText: firstRunning?.runDurationText ?? null,
    downloadTimeoutMs: DOWNLOAD_TIMEOUT_MS,
    transcodeTimeoutMs: TRANSCODE_TIMEOUT_MS,
    ffmpegThreads: THREADS,
    ffmpegPreset: FFMPEG_PRESET,
    ffmpegCpus: FFMPEG_CPUS || null,
    outputRetentionMs: TRANSCODE_OUTPUT_RETENTION_MS,
    outputMaxBytes: TRANSCODE_OUTPUT_MAX_BYTES,
    outputPruneIntervalMs: OUTPUT_PRUNE_INTERVAL_MS,
    persistentQueue: true,
  };
}

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

function runFfmpegTranscode(inputPath, outputPath, W, H, fps, videoKbps) {
  const filterComplex = [
    '[0:v]split=2[cover][contain]',
    `[cover]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},gblur=sigma=${GBLUR_SIGMA}[bg]`,
    `[contain]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg]`,
    `[bg][fg]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[v]`,
  ].join(';');

  const useHwNvenc = FFMPEG_HWACCEL === 'nvenc';
  const useHwVideotoolbox = FFMPEG_HWACCEL === 'videotoolbox';
  const outBufsizeK = Math.min(Math.max(videoKbps * 2, FFMPEG_BUF_SIZE_K), 10000);

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

async function executeJob(jobId) {
  const job = getJob(jobId);
  if (!job || job.status === 'completed' || job.status === 'failed') return;

  await acquireTranscodeSlot(job);

  const latest = getJob(jobId);
  if (!latest) {
    releaseTranscodeSlot(jobId);
    return;
  }

  const W = latest.targetW;
  const H = latest.targetH;
  const workDir = mkdtempSync(join(tmpdir(), 'ads-scraw-transcode-'));
  const inputPath = join(workDir, 'input');
  const tempOutputPath = join(workDir, 'output.mp4');
  const persistentOutputPath = getOutputPath(jobId);

  function cleanupWorkDir() {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  try {
    setJobPhase(jobId, 'downloading');
    await downloadVideoToFile(latest.videoUrl, inputPath);
    setJobPhase(jobId, 'probing');
    const { fps, videoKbps } = probeVideoMeta(inputPath);
    setJobPhase(jobId, 'transcoding');
    await runFfmpegTranscode(inputPath, tempOutputPath, W, H, fps, videoKbps);
    copyFileSync(tempOutputPath, persistentOutputPath);
    markJobCompleted(jobId);
    pruneTranscodeOutputs('job-completed');
    logger.info(`转码任务完成: ${jobId}`);
  } catch (e) {
    deleteJobOutput(jobId);
    markJobFailed(jobId, e?.message || String(e));
    logger.warn(`转码任务失败: ${jobId}`, e?.message);
  } finally {
    cleanupWorkDir();
    releaseTranscodeSlot(jobId);
  }
}

const pumping = new Set();

function scheduleQueuePump() {
  const pending = listRecoverableJobs().filter((j) => j.status === 'queued');
  for (const job of pending) {
    if (pumping.has(job.id)) continue;
    pumping.add(job.id);
    executeJob(job.id)
      .catch((err) => logger.error(`转码 worker 异常 ${job.id}:`, err))
      .finally(() => pumping.delete(job.id));
  }
}

export async function initTranscodeQueue() {
  if (queueInitialized) return;
  queueInitialized = true;
  await initJobStore();
  pruneTranscodeOutputs('startup');
  startOutputPruneTimer();
  const recoverable = listRecoverableJobs();
  if (recoverable.length > 0) {
    logger.info(`恢复 ${recoverable.length} 个未完成的转码任务`);
    for (const job of recoverable) {
      if (job.status === 'running') {
        job.status = 'queued';
        job.phase = 'queued';
        job.startedAt = null;
        job.queuePosition = null;
        upsertJob(job);
      }
    }
  }
  scheduleQueuePump();
}

/**
 * 提交转码任务（持久化，重启后可继续）
 */
export function submitTranscodeJob(videoUrl, targetW, targetH, meta = {}) {
  if (!queueInitialized) {
    initTranscodeQueue().catch((err) => logger.error('转码队列初始化失败:', err));
  }
  const job = createJobRecord(videoUrl, targetW, targetH, meta);
  scheduleQueuePump();
  return serializeJob(job);
}

export function waitForTranscodeJob(jobId, { signal, pollIntervalMs = 1500, timeoutMs = TRANSCODE_TIMEOUT_MS + 60000 } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('等待转码结果超时'));
        return;
      }
      const job = getTranscodeJob(jobId);
      if (!job) {
        reject(new Error('转码任务不存在'));
        return;
      }
      if (job.status === 'completed') {
        resolve(job);
        return;
      }
      if (job.status === 'failed') {
        reject(new Error(job.errorMessage || '转码失败'));
        return;
      }
      setTimeout(poll, pollIntervalMs);
    };
    poll();
  });
}

export function getJobOutputFile(jobId) {
  const path = getOutputPath(jobId);
  if (!existsSync(path)) return null;
  return path;
}

export function cleanupJobAfterDownload(jobId) {
  deleteJobOutput(jobId);
}

/**
 * 兼容旧调用：提交并等待完成，返回临时输出路径（用于直接流式响应）
 */
export async function transcodeVideoToFile(videoUrl, targetW, targetH, meta = {}) {
  const submitted = submitTranscodeJob(videoUrl, targetW, targetH, meta);
  await waitForTranscodeJob(submitted.id);
  const outputPath = getJobOutputFile(submitted.id);
  if (!outputPath) throw new Error('转码输出文件不存在');
  return {
    outputPath,
    jobId: submitted.id,
    cleanup: () => cleanupJobAfterDownload(submitted.id),
  };
}

export { normalizeCreator };
