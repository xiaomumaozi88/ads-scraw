import { APP_PUBLIC_BASE_URL, IAM_ENTRY_TOKEN_SIGN_KEY, IAM_PLATFORM_CODE, isRelaxedIamAccess, resolvePublicBaseUrl } from '../../config/iam.js';
import { decryptEntryToken } from './entryToken.js';
import { fetchIamProfile } from './profileClient.js';
import { canEnterPlatform } from './permission.js';
import { sanitizeRedirectUrl } from './redirect.js';
import { createSession, setSessionCookie } from './session.js';
import { buildGuestProfile } from './refreshSessionProfile.js';
import { logger } from '../../utils/logger.js';

function auditLog(event, detail) {
  logger.info(`[IAM] ${event}`, detail);
}

export function collectTrustedOrigins(req) {
  const origins = new Set();
  const add = (url) => {
    if (!url) return;
    try {
      origins.add(new URL(url).origin);
    } catch {
      /* ignore */
    }
  };

  add(resolvePublicBaseUrl(req));
  add(APP_PUBLIC_BASE_URL);
  add(process.env.DEV_CLIENT_ORIGIN);

  const host = req?.get?.('host');
  const proto = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';
  if (host) {
    add(`${proto}://${host}`);
    if (process.env.NODE_ENV === 'development' && String(host).endsWith(':3000')) {
      const hostname = String(host).replace(/:3000$/, '');
      add(`${proto}://${hostname}:5173`);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:3000');
  }

  return [...origins];
}

/**
 * 门户 token 换本系统会话
 * @returns {{ redirectPath: string, feishuUserId: string }}
 */
export async function establishSessionFromEntryToken(req, res, token, redirectUrlRaw) {
  if (!token) {
    const err = new Error('缺少登录 token');
    err.code = 'TOKEN_MISSING';
    throw err;
  }

  if (!IAM_ENTRY_TOKEN_SIGN_KEY) {
    const err = new Error('IAM_ENTRY_TOKEN_SIGN_KEY 未配置');
    err.code = 'IAM_NOT_CONFIGURED';
    throw err;
  }

  const { feishuUserId, sessionExpireAt } = decryptEntryToken(String(token), IAM_ENTRY_TOKEN_SIGN_KEY);

  let profile;
  try {
    profile = await fetchIamProfile(feishuUserId);
  } catch (err) {
    if (isRelaxedIamAccess() && (err.code === 'IAM_NOT_FOUND' || err.status === 404)) {
      profile = buildGuestProfile(feishuUserId);
      auditLog('profile_guest', {
        platform_code: IAM_PLATFORM_CODE,
        feishu_user_id: feishuUserId,
      });
    } else {
      auditLog('profile_failed', {
        platform_code: IAM_PLATFORM_CODE,
        feishu_user_id: feishuUserId,
        error: err.message,
      });
      throw err;
    }
  }

  if (!canEnterPlatform(profile)) {
    auditLog('login_denied_not_member', {
      platform_code: IAM_PLATFORM_CODE,
      feishu_user_id: feishuUserId,
      is_super: profile.is_super,
      is_platform_member: profile.is_platform_member,
    });
    const err = new Error('无访问权限');
    err.code = 'NOT_PLATFORM_MEMBER';
    throw err;
  }

  const trustedOrigins = collectTrustedOrigins(req);
  const redirectPath = sanitizeRedirectUrl(redirectUrlRaw, trustedOrigins);
  const session = createSession(profile, sessionExpireAt);
  setSessionCookie(res, session);

  auditLog('login_success', {
    platform_code: IAM_PLATFORM_CODE,
    feishu_user_id: feishuUserId,
    redirect: redirectPath,
  });

  return { redirectPath, feishuUserId };
}
