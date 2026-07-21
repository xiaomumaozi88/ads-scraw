import { ROUTES, normalizeAppPath } from '../../config/appRoutes.js';

const DEFAULT_REDIRECT = ROUTES.INSIGHTRACKR;

/**
 * 校验 redirect_url：支持站内相对路径，或受信 origin 下的完整 URL（门户回跳格式）
 * @param {string|undefined} raw
 * @param {string[]} [trustedOrigins] 如 ['http://localhost:5173']
 */
export function sanitizeRedirectUrl(raw, trustedOrigins = []) {
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_REDIRECT;
  }

  let value = String(raw).trim();

  if (value.includes('://') || /^https?:\/\//i.test(value)) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('redirect_url 非法');
    }
    if (!trustedOrigins.includes(parsed.origin)) {
      throw new Error('redirect_url 非法');
    }
    const path = normalizeAppPath(`${parsed.pathname}${parsed.search}`);
    return path && path !== '/' ? path : DEFAULT_REDIRECT;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new Error('redirect_url 非法');
  }

  if (/^\/\w+:/i.test(value)) {
    throw new Error('redirect_url 非法');
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes('://') || decoded.startsWith('//')) {
      throw new Error('redirect_url 非法');
    }
  } catch (e) {
    if (e.message === 'redirect_url 非法') throw e;
    throw new Error('redirect_url 非法');
  }

  return normalizeAppPath(value);
}
