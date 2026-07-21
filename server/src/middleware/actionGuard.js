import { APP_PUBLIC_BASE_URL } from '../config/iam.js';
import { verifyActionToken } from '../services/actionTokenService.js';

const PROTECTED_PREFIXES = [
  '/health',
  '/insightrackr',
  '/sensortower',
  '/catalog/g1',
  '/catalog/g1-cn',
  '/transcode-video',
  '/transcode-queue',
  '/transcode-jobs',
  '/material-processing',
];

const EXEMPT_PREFIXES = [
  '/iam',
  '/security/action-token',
  '/proxy-media',
  '/download-image',
  '/external',
];

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function requestOrigin(req) {
  const origin = normalizeOrigin(req.get('origin'));
  if (origin) return origin;
  const referer = normalizeOrigin(req.get('referer'));
  return referer;
}

function sameOriginFromRequestHost(req, origin) {
  if (!origin) return false;
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return false;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return origin === `${proto}://${host}`.replace(/\/$/, '');
}

function allowedOrigins() {
  const values = [
    ...parseOrigins(process.env.ACTION_ALLOWED_ORIGINS),
    ...parseOrigins(process.env.CORS_ORIGINS),
    APP_PUBLIC_BASE_URL,
    process.env.APP_FRONTEND_BASE_URL,
    process.env.FRONTEND_PUBLIC_BASE_URL,
    process.env.CLIENT_PUBLIC_BASE_URL,
    process.env.DEV_CLIENT_ORIGIN,
  ];
  if (process.env.NODE_ENV === 'development') {
    values.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  return new Set(values.map(normalizeOrigin).filter(Boolean));
}

function isGuardEnabled() {
  return String(process.env.ACTION_GUARD_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function isProtectedPath(path) {
  if (EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function shouldValidateOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
  return process.env.NODE_ENV === 'production'
    || String(process.env.ACTION_ORIGIN_CHECK_IN_DEV || '').toLowerCase() === 'true';
}

function reject(res, status, code, message, detail = null) {
  return res.status(status).json({
    success: false,
    code,
    message,
    data: detail ? { detail } : null,
  });
}

export function actionGuardMiddleware(req, res, next) {
  if (!isGuardEnabled()) return next();
  if (req.method === 'OPTIONS') return next();

  const path = req.path || '/';
  if (!isProtectedPath(path)) return next();

  if (shouldValidateOrigin(req)) {
    const origin = requestOrigin(req);
    const allowed = allowedOrigins();
    if (!origin || (!allowed.has(origin) && !sameOriginFromRequestHost(req, origin))) {
      return reject(res, 403, 'ORIGIN_NOT_ALLOWED', '请求来源不被允许', {
        origin: origin || null,
      });
    }
  }

  const token = req.get('x-action-token') || req.get('x-csrf-token');
  const verification = verifyActionToken(token, req.iamProfile);
  if (!verification.ok) {
    return reject(res, 403, 'ACTION_TOKEN_INVALID', '操作令牌无效或已过期', {
      reason: verification.reason,
    });
  }

  return next();
}
