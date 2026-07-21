import { IAM_PLATFORM_CODE, isRelaxedIamAccess } from '../../config/iam.js';
import { IAM_ROLE_CODES } from '../../config/iamRoles.js';
import { fetchIamProfile } from './profileClient.js';
import { setSessionCookie } from './session.js';
import { logger } from '../../utils/logger.js';

export function buildGuestProfile(feishuUserId) {
  return {
    platform_code: IAM_PLATFORM_CODE,
    feishu_user_id: feishuUserId,
    user_name: null,
    email: null,
    is_super: false,
    is_platform_member: false,
    role_codes: isRelaxedIamAccess() ? [IAM_ROLE_CODES.EMPLOYEE] : [],
    data_sources: [],
  };
}

/**
 * 从 IAM 拉取最新 profile 并写回 Cookie，避免 IAM 变更后会话仍用旧权限
 */
export async function refreshSessionProfile(req, res, session) {
  const feishuUserId = session.profile?.feishu_user_id;
  if (!feishuUserId) return session.profile;

  let profile;
  try {
    profile = await fetchIamProfile(feishuUserId);
  } catch (err) {
    if (isRelaxedIamAccess() && (err.code === 'IAM_NOT_FOUND' || err.status === 404)) {
      profile = buildGuestProfile(feishuUserId);
      profile.user_name = session.profile.user_name ?? profile.user_name;
      profile.email = session.profile.email ?? profile.email;
    } else {
      logger.warn('[IAM] refresh profile 失败，沿用会话缓存:', err.message);
      return session.profile;
    }
  }

  const expireAt = session.profile.session_expire_at ?? session.expire_at;
  const nextSession = {
    ...session,
    profile: {
      ...profile,
      session_expire_at: expireAt,
    },
  };
  setSessionCookie(res, nextSession);
  return nextSession.profile;
}
