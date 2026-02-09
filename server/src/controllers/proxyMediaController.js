/**
 * GET /api/proxy-media?url=ENCODED_URL
 * 代理拉取第三方媒体（视频/图片），避免 CDN 防盗链（Referer）导致部署到非白名单域名时 403。
 * 仅允许白名单域名（如 zingfront.com 及其子域）。
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

const ALLOWED_HOST_SUFFIXES = [
  '.zingfront.com',
  'zingfront.com',
];

/** 下载图片接口允许的域名（app icon、常见 CDN） */
const DOWNLOAD_IMAGE_HOST_SUFFIXES = [
  'zingfront.com',
  '.zingfront.com',
  'googleusercontent.com',
  '.googleusercontent.com',
  'ggpht.com',
  '.ggpht.com',
  'mzstatic.com',
  '.mzstatic.com',
  'apple.com',
  '.apple.com',
  'apple.co',
  '.apple.co',
  'fbcdn.net',
  '.fbcdn.net',
  'cdninstagram.com',
  '.cdninstagram.com',
  'guangdada.net',
  '.guangdada.net',
];

function isHostAllowed(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const lower = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(suffix));
}

function isDownloadImageHostAllowed(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const lower = hostname.toLowerCase();
  return DOWNLOAD_IMAGE_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(suffix));
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getProxyMedia(req, res) {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ message: '缺少参数 url' });
    return;
  }
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(rawUrl.trim());
  } catch {
    res.status(400).json({ message: 'url 格式无效' });
    return;
  }
  let parsed;
  try {
    parsed = new URL(decodedUrl);
  } catch {
    res.status(400).json({ message: 'url 格式无效' });
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ message: '仅支持 http/https' });
    return;
  }
  if (!isHostAllowed(parsed.hostname)) {
    res.status(403).json({ message: '该域名不允许代理' });
    return;
  }

  const protocol = parsed.protocol === 'https:' ? https : http;
  const opts = {
    headers: {
      Referer: '',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  };
  // 转发 Range 请求，使视频进度条可拖动（服务端需返回 206 Partial Content）
  const range = req.headers.range;
  if (range && typeof range === 'string') {
    opts.headers.Range = range;
  }
  protocol
    .get(decodedUrl, opts, (proxyRes) => {
      const status = proxyRes.statusCode;
      if (status !== 200 && status !== 206) {
        res.status(status === 403 ? 502 : status).end();
        return;
      }
      res.status(status);
      const contentType = proxyRes.headers['content-type'];
      if (contentType) res.setHeader('Content-Type', contentType);
      const contentLength = proxyRes.headers['content-length'];
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = proxyRes.headers['content-range'];
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = proxyRes.headers['accept-ranges'];
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      proxyRes.pipe(res);
    })
    .on('error', (err) => {
      res.status(502).json({ message: err.message || '代理请求失败' });
    });
}

/**
 * GET /api/download-image?url=ENCODED_URL&filename=app-icon.png
 * 代理拉取图片并强制浏览器下载（Content-Disposition: attachment），用于 app icon 等直接下载。
 * 仅允许白名单域名。
 */
export async function getDownloadImage(req, res) {
  const rawUrl = req.query.url;
  const filename = (req.query.filename && String(req.query.filename).trim()) || 'app-icon.png';
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ message: '缺少参数 url' });
    return;
  }
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(rawUrl.trim());
  } catch {
    res.status(400).json({ message: 'url 格式无效' });
    return;
  }
  let parsed;
  try {
    parsed = new URL(decodedUrl);
  } catch {
    res.status(400).json({ message: 'url 格式无效' });
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ message: '仅支持 http/https' });
    return;
  }
  if (!isDownloadImageHostAllowed(parsed.hostname)) {
    res.status(403).json({ message: '该域名不允许代理下载' });
    return;
  }

  const protocol = parsed.protocol === 'https:' ? https : http;
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'app-icon.png';
  protocol
    .get(decodedUrl, {
      headers: {
        Referer: '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, (proxyRes) => {
      const status = proxyRes.statusCode;
      if (status !== 200) {
        res.status(status === 403 ? 502 : status).end();
        return;
      }
      res.status(200);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      const contentType = proxyRes.headers['content-type'];
      if (contentType) res.setHeader('Content-Type', contentType);
      const contentLength = proxyRes.headers['content-length'];
      if (contentLength) res.setHeader('Content-Length', contentLength);
      proxyRes.pipe(res);
    })
    .on('error', (err) => {
      res.status(502).json({ message: err.message || '代理请求失败' });
    });
}
