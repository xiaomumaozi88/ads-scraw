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

function isHostAllowed(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const lower = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(suffix));
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
  protocol
    .get(decodedUrl, opts, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        res.status(proxyRes.statusCode === 403 ? 502 : proxyRes.statusCode).end();
        return;
      }
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
