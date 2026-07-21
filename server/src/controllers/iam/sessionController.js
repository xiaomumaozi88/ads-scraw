import { summarizeProfileForClient } from '../../services/iam/permission.js';
import { refreshSessionProfile } from '../../services/iam/refreshSessionProfile.js';
import { isRelaxedIamAccess, isIamDevBypass } from '../../config/iam.js';
import { buildDevBypassProfile } from '../../services/iam/devProfile.js';
import { isDbEnabled } from '../../db/pool.js';
import { clearSessionCookie, readSessionFromRequest } from '../../services/iam/session.js';

export async function getMe(req, res) {
  if (isIamDevBypass()) {
    return res.json({
      success: true,
      code: 200,
      data: {
        authenticated: true,
        profile: summarizeProfileForClient(buildDevBypassProfile()),
        iam_relaxed_access: isRelaxedIamAccess(),
        iam_dev_bypass: true,
        db_enabled: isDbEnabled(),
      },
    });
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: '未登录，请从企业门户进入',
      data: { authenticated: false, requiresPortalLogin: true },
    });
  }

  let profile = session.profile;
  try {
    profile = await refreshSessionProfile(req, res, session);
  } catch {
    // 沿用会话内 profile
  }

  return res.json({
    success: true,
    code: 200,
    data: {
      authenticated: true,
      profile: summarizeProfileForClient(profile),
      iam_relaxed_access: isRelaxedIamAccess(),
      db_enabled: isDbEnabled(),
    },
  });
}

export function postLogout(req, res) {
  clearSessionCookie(res);
  res.json({ success: true, code: 200, message: '已退出登录' });
}
