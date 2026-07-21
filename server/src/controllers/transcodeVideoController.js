/**
 * 视频转码 API
 */
import { createReadStream } from 'fs';
import * as transcodeVideoService from '../services/transcodeVideoService.js';
import { isSuperUser, canAccessHealthAdmin } from '../services/iam/permission.js';
import { auditTranscodeJobSubmit } from '../services/auditLogService.js';
import { logger } from '../utils/logger.js';

function canAccessJob(profile, job) {
  if (!profile || !job) return false;
  if (isSuperUser(profile)) return true;
  if (canAccessHealthAdmin(profile)) return true;
  const creatorId = job.createdBy?.feishu_user_id;
  return creatorId != null && creatorId === profile.feishu_user_id;
}

function buildCreatorMeta(req, body = {}) {
  return {
    createdBy: transcodeVideoService.normalizeCreator(req.iamProfile),
    clientBatchId: body.clientBatchId ?? null,
    clientTaskId: body.clientTaskId ?? null,
    sourceLabel: body.sourceLabel ?? null,
  };
}

function auditDirectTranscodeSubmit(req, url, targetW, targetH, meta, job = null, extra = {}) {
  if (meta.clientBatchId) return;
  auditTranscodeJobSubmit({
    operatorProfile: req.iamProfile,
    videoUrl: url,
    targetW,
    targetH,
    jobId: job?.id ?? extra.jobId ?? null,
    clientBatchId: meta.clientBatchId,
    clientTaskId: meta.clientTaskId,
    sourceLabel: meta.sourceLabel,
    success: extra.success !== false,
    message: extra.message,
  });
}

/**
 * POST /api/transcode-video
 * 提交任务；默认 async=1 返回 jobId，async=0 时同步等待并返回 MP4 流
 */
export async function transcodeVideo(req, res) {
  const { videoUrl, targetW, targetH, async: asyncFlag, ...rest } = req.body || {};
  if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
    res.status(400).json({ message: '缺少参数 videoUrl' });
    return;
  }
  const url = videoUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    res.status(400).json({ message: 'videoUrl 须为 http(s) 地址' });
    return;
  }

  const meta = buildCreatorMeta(req, rest);
  const waitSync = asyncFlag === false || asyncFlag === 0 || asyncFlag === '0';
  const resolvedTargetW = targetW ?? 800;
  const resolvedTargetH = targetH ?? 800;

  if (!waitSync) {
    const job = transcodeVideoService.submitTranscodeJob(url, resolvedTargetW, resolvedTargetH, meta);
    auditDirectTranscodeSubmit(req, url, resolvedTargetW, resolvedTargetH, meta, job);
    res.status(202).json({ jobId: job.id, status: job.status, job });
    return;
  }

  let result;
  try {
    result = await transcodeVideoService.transcodeVideoToFile(
      url,
      resolvedTargetW,
      resolvedTargetH,
      meta
    );
  } catch (e) {
    logger.warn('转码失败', e?.message);
    auditDirectTranscodeSubmit(req, url, resolvedTargetW, resolvedTargetH, meta, null, {
      success: false,
      message: e?.message || '转码任务提交失败',
    });
    res.status(500).json({ message: e?.message || '视频转码失败' });
    return;
  }
  auditDirectTranscodeSubmit(req, url, resolvedTargetW, resolvedTargetH, meta, null, {
    jobId: result?.jobId,
  });

  const { outputPath, cleanup } = result;
  res.setHeader('Content-Type', 'video/mp4');
  const stream = createReadStream(outputPath);
  stream.on('error', () => cleanup());
  res.on('close', () => cleanup());
  stream.pipe(res);
}

export async function getTranscodeQueue(req, res) {
  try {
    const status = transcodeVideoService.getTranscodeQueueStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ running: 0, waiting: 0 });
  }
}

export async function listTranscodeJobs(req, res) {
  try {
    const isAdmin = isSuperUser(req.iamProfile)
      || canAccessHealthAdmin(req.iamProfile);
    const activeOnly = req.query.active !== '0';
    const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 500);
    let jobs = transcodeVideoService.listTranscodeJobs({ activeOnly, limit: isAdmin ? limit : 500 });
    if (!isAdmin) {
      const uid = req.iamProfile?.feishu_user_id;
      jobs = jobs.filter((j) => j.createdBy?.feishu_user_id === uid).slice(0, limit);
    }
    res.json({ jobs, total: jobs.length });
  } catch (e) {
    res.status(500).json({ jobs: [], message: e?.message || '读取失败' });
  }
}

export async function getTranscodeJobById(req, res) {
  const job = transcodeVideoService.getTranscodeJob(req.params.id);
  if (!job) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }
  if (!canAccessJob(req.iamProfile, job)) {
    res.status(403).json({ message: '无权查看该任务' });
    return;
  }
  res.json(job);
}

export async function downloadTranscodeJob(req, res) {
  const rawJob = transcodeVideoService.getTranscodeJob(req.params.id);
  if (!rawJob) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }
  if (!canAccessJob(req.iamProfile, rawJob)) {
    res.status(403).json({ message: '无权下载该任务' });
    return;
  }
  if (rawJob.status !== 'completed') {
    res.status(409).json({ message: '任务尚未完成', status: rawJob.status, phase: rawJob.phase });
    return;
  }
  const outputPath = transcodeVideoService.getJobOutputFile(req.params.id);
  if (!outputPath) {
    res.status(410).json({ message: '输出文件已过期或被清理' });
    return;
  }
  res.setHeader('Content-Type', 'video/mp4');
  const stream = createReadStream(outputPath);
  const cleanup = () => transcodeVideoService.cleanupJobAfterDownload(req.params.id);
  stream.on('error', cleanup);
  res.on('close', cleanup);
  stream.pipe(res);
}
