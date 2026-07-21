/** IAM / 企业门户接入配置（密钥仅服务端使用，勿写入前端） */

export const IAM_PLATFORM_CODE = process.env.IAM_PLATFORM_CODE || 'ads-scraw';

export const IAM_BASE_URL = (process.env.IAM_BASE_URL || 'https://iam.corp.touka.plus').replace(/\/$/, '');

export const IAM_API_KEY = process.env.IAM_API_KEY || '';

/** 门户 token 解密密钥，必须与 IAM/门户侧 ENTRY_TOKEN_SIGN_KEY 完全一致 */
export const IAM_ENTRY_TOKEN_SIGN_KEY = String(
  process.env.IAM_ENTRY_TOKEN_SIGN_KEY || process.env.ENTRY_TOKEN_SIGN_KEY || ''
).trim();

export const APP_SESSION_SECRET =
  process.env.APP_SESSION_SECRET || 'dev-only-change-in-production-ads-scraw';

/** 企业门户 IAM 重登入口（未配置时使用 https://touka.plus） */
export const IAM_PORTAL_URL = process.env.IAM_PORTAL_URL || 'https://touka.plus';

export const APP_PUBLIC_BASE_URL = (process.env.APP_PUBLIC_BASE_URL || '').replace(/\/$/, '');

export const SESSION_COOKIE_NAME = 'ads_scraw_session';

export function sessionCookieOptions() {
  // 生产默认 Secure；纯 HTTP 访问（如 IP:3000）须 COOKIE_SECURE=false，否则浏览器丢弃 Cookie → SSO 死循环
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false'
      && process.env.NODE_ENV === 'production'
      && !isHttpOnlyPublicBaseUrl());
  return {
    httpOnly: true,
    secure,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/',
    maxAge: undefined,
  };
}

function isHttpOnlyPublicBaseUrl() {
  const base = APP_PUBLIC_BASE_URL;
  if (base) return base.startsWith('http://');
  return false;
}

export function resolvePublicBaseUrl(req) {
  if (APP_PUBLIC_BASE_URL) return APP_PUBLIC_BASE_URL;

  const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host');
  const proto = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';

  if (host) {
    if (process.env.NODE_ENV === 'development' && String(host).endsWith(':3000')) {
      const hostname = String(host).replace(/:3000$/, '');
      let vitePort = '5173';
      try {
        vitePort = new URL(process.env.DEV_CLIENT_ORIGIN || 'http://localhost:5173').port || '5173';
      } catch {
        /* keep default */
      }
      return `${proto}://${hostname}:${vitePort}`;
    }
    return `${proto}://${host}`;
  }

  if (process.env.NODE_ENV === 'development') {
    return (process.env.DEV_CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  }

  return `${proto}://localhost`;
}

export function validateIamConfig() {
  const missing = [];
  if (!IAM_API_KEY) missing.push('IAM_API_KEY');
  if (!IAM_ENTRY_TOKEN_SIGN_KEY) missing.push('IAM_ENTRY_TOKEN_SIGN_KEY');
  if (!APP_SESSION_SECRET || APP_SESSION_SECRET === 'dev-only-change-in-production-ads-scraw') {
    if (process.env.NODE_ENV === 'production') missing.push('APP_SESSION_SECRET');
  }
  return missing;
}

/**
 * 临时宽松模式：门户 SSO 通过即可使用除 health_admin、external_api 外的模块。
 * 设为 false 恢复严格 IAM 数据源校验。
 */
export function isRelaxedIamAccess() {
  const v = process.env.IAM_RELAXED_ACCESS;
  if (v === undefined || v === '') return true;
  return v === 'true';
}

/**
 * 本地开发跳过门户 SSO。
 * .env: IAM_DEV_BYPASS=true
 * 若已配置公网 APP_PUBLIC_BASE_URL（生产部署），则永不 bypass。
 */
export function isIamDevBypass() {
  if (process.env.NODE_ENV !== 'development') return false;
  const v = process.env.IAM_DEV_BYPASS;
  if (!v) return false;
  if (!['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase())) {
    return false;
  }
  const pub = (process.env.APP_PUBLIC_BASE_URL || '').trim();
  if (pub) {
    try {
      const host = new URL(pub).hostname;
      const isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.endsWith('.local');
      if (!isLocal) return false;
    } catch {
      return false;
    }
  }
  return true;
}
