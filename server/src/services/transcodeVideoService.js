/**
 * 后端视频转码：下载视频 → ffprobe 探测 → ffmpeg 缩放+模糊背景+overlay → 输出 MP4
 * 与前端 videoFFmpeg 效果一致（帧率、码率、filter_complex）
 */
import { spawnSync } from 'child_process';
import { rmSync, mkdtempSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const DOWNLOAD_TIMEOUT_MS = 45000;
const TRANSCODE_TIMEOUT_MS = 300000; // 5 分钟
const GBLUR_SIGMA = 30;
const MIN_VIDEO_KBPS = 2500;
const FALLBACK_VIDEO_KBPS = 5000;

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
 * 执行转码，输出到 outputPath；与前端 filter 和参数一致
 */
function runFfmpegTranscode(inputPath, outputPath, W, H, fps, videoKbps) {
  const filterComplex = [
    '[0:v]split=2[cover][contain]',
    `[cover]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},gblur=sigma=${GBLUR_SIGMA}[bg]`,
    `[contain]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg]`,
    `[bg][fg]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[v]`,
  ].join(';');
  const args = [
    '-i', inputPath,
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
    outputPath,
  ];
  const result = spawnSync('ffmpeg', args, {
    encoding: 'utf8',
    timeout: TRANSCODE_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const err = (result.stderr || '').slice(-2000);
    throw new Error(`ffmpeg 转码失败: ${err || result.error?.message || '未知错误'}`);
  }
  if (!existsSync(outputPath)) {
    throw new Error('ffmpeg 未生成输出文件');
  }
}

/**
 * 转码视频：下载 → 探测 → 转码，返回输出文件路径；调用方负责读流与清理
 * @param {string} videoUrl - 视频 URL
 * @param {number} targetW - 目标宽
 * @param {number} targetH - 目标高
 * @returns {{ outputPath: string, cleanup: () => void }} outputPath 与清理函数
 */
export async function transcodeVideoToFile(videoUrl, targetW, targetH) {
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
    runFfmpegTranscode(inputPath, outputPath, W, H, fps, videoKbps);
    return { outputPath, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}
