/**
 * POST /api/transcode-video
 * Body: { videoUrl: string, targetW?: number, targetH?: number }
 * 返回: video/mp4 流
 */
import { createReadStream } from 'fs';
import * as transcodeVideoService from '../services/transcodeVideoService.js';
import log4js from 'log4js';

const logger = log4js.getLogger('transcodeVideo');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function transcodeVideo(req, res) {
  const { videoUrl, targetW, targetH } = req.body || {};
  if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
    res.status(400).json({ message: '缺少参数 videoUrl' });
    return;
  }
  const url = videoUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    res.status(400).json({ message: 'videoUrl 须为 http(s) 地址' });
    return;
  }

  let result;
  try {
    result = await transcodeVideoService.transcodeVideoToFile(
      url,
      targetW ?? 800,
      targetH ?? 800
    );
  } catch (e) {
    logger.warn('转码失败', e?.message);
    res.status(500).json({ message: e?.message || '视频转码失败' });
    return;
  }

  const { outputPath, cleanup } = result;
  res.setHeader('Content-Type', 'video/mp4');
  const stream = createReadStream(outputPath);
  stream.on('error', () => cleanup());
  res.on('close', () => cleanup());
  stream.pipe(res);
}

/**
 * GET /api/transcode-queue
 * 返回转码队列状态，供下载列表展示「当前 N 个处理中，M 个等待」
 */
export async function getTranscodeQueue(req, res) {
  try {
    const status = transcodeVideoService.getTranscodeQueueStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ running: 0, waiting: 0 });
  }
}
