/** 企业门户 IAM 重登地址（与门户约定格式） */

export const DEFAULT_PORTAL_URL = 'https://touka.plus';
export const DEFAULT_PLATFORM_CODE = 'ads-scraw';

export function resolvePortalUrl() {
  const fromEnv = import.meta.env.VITE_IAM_PORTAL_URL;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim().replace(/\/$/, '');
  return DEFAULT_PORTAL_URL;
}

export function resolvePlatformCode() {
  const fromEnv = import.meta.env.VITE_IAM_PLATFORM_CODE;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return DEFAULT_PLATFORM_CODE;
}

/**
 * 未登录时跳转门户重登
 * https://touka.plus/?redirect_url={encodeURIComponent(业务页面完整URL)}&platform_code={平台编码}
 */
export function buildPortalReLoginUrl(returnFullUrl) {
  const portalBase = resolvePortalUrl();
  const platformCode = resolvePlatformCode();
  const url = new URL(portalBase.endsWith('/') ? portalBase : `${portalBase}/`);
  url.searchParams.set('redirect_url', returnFullUrl);
  url.searchParams.set('platform_code', platformCode);
  return url.toString();
}

/** URL 上是否带有门户回跳的 entry token */
export function getPortalEntryTokenFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const token = params.get('token');
  if (!token || !String(token).trim()) return null;
  return {
    token: String(token).trim(),
    redirectUrl: params.get('redirect_url') || `${window.location.origin}${window.location.pathname}`,
  };
}

/** 将页面 URL 上的 token 交给后端 /sso/iam-entry 换会话 */
export function redirectToSsoEntry(token, redirectUrl) {
  const qs = new URLSearchParams();
  qs.set('token', token);
  qs.set('redirect_url', redirectUrl);
  window.location.replace(`/sso/iam-entry?${qs.toString()}`);
}
