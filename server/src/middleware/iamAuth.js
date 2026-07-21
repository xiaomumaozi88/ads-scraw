import { canAccessApiPath } from '../services/iam/permission.js';
import { readSessionFromRequest } from '../services/iam/session.js';
import { isIamDevBypass } from '../config/iam.js';
import { buildDevBypassProfile } from '../services/iam/devProfile.js';

const PUBLIC_PREFIXES = ['/iam/catalog'];

function isPublicIamPath(path) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function iamAuthMiddleware(req, res, next) {
  const apiPath = req.path || '/';

  if (isPublicIamPath(apiPath)) {
    return next();
  }

  if (apiPath === '/iam/me' || apiPath === '/iam/logout') {
    return next();
  }

  if (isIamDevBypass()) {
    req.iamProfile = buildDevBypassProfile();
    req.iamAuthenticated = true;
    return next();
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: '未登录，请从企业门户进入',
      data: { requiresPortalLogin: true },
    });
  }

  req.iamProfile = session.profile;
  req.iamAuthenticated = true;

  if (!canAccessApiPath(session.profile, apiPath)) {
    return res.status(403).json({
      success: false,
      code: 403,
      message: '无该模块访问权限',
      data: { requiresPermission: true },
    });
  }

  return next();
}
