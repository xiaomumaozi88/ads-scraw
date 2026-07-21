import { IAM_DATA_SOURCE_CODES } from '../../config/iamCatalog.js';
import { ROUTES, isInsightrackrRoute, isSensortowerRoute } from '../../config/appRoutes.js';
import { isRelaxedIamAccess } from '../../config/iam.js';
import {
  isEmployeeProfile,
  isRelatedEmployeeProfile,
  isSuperAdminProfile,
  resolveProfileRole,
  roleCanAccessDataSource,
  IAM_ROLE_CODES,
} from '../../config/iamRoles.js';

/** 运维/外部 API 走独立限制，业务模块按角色数据源授权 */
const RESTRICTED_API_DATA_SOURCES = new Set([
  IAM_DATA_SOURCE_CODES.HEALTH_ADMIN,
  IAM_DATA_SOURCE_CODES.EXTERNAL_API,
]);

export function isPlatformMember(profile) {
  return profile?.is_platform_member === true;
}

/** 是否允许进入平台（SSO 登录准入） */
export function canEnterPlatform(profile) {
  if (!profile) return false;
  if (isRelaxedIamAccess()) return true;
  if (isSuperAdminProfile(profile)) return true;
  if (isRelatedEmployeeProfile(profile)) return true;
  if (isEmployeeProfile(profile)) return true;
  if (profile.is_platform_member === true) return true;
  if (Array.isArray(profile.data_sources) && profile.data_sources.length > 0) return true;
  return false;
}

export function isSuperUser(profile) {
  return isSuperAdminProfile(profile);
}

export function getEnabledDataSources(profile) {
  if (!profile?.data_sources) return [];
  return profile.data_sources.filter((ds) => ds && ds.enabled !== false);
}

export function canAccessHealthAdmin(profile) {
  return isSuperAdminProfile(profile);
}

export function canAccessExternalApi(profile) {
  if (!profile) return false;
  if (isSuperAdminProfile(profile)) return true;
  return getEnabledDataSources(profile).some((ds) => ds.code === IAM_DATA_SOURCE_CODES.EXTERNAL_API);
}

export function canAccessDataSource(profile, dataSourceCode, { productCode, ownerFeishuUserId } = {}) {
  if (!profile || !dataSourceCode) return false;
  if (isSuperAdminProfile(profile)) return true;
  if (dataSourceCode === IAM_DATA_SOURCE_CODES.SENSORTOWER) return false;
  if (RESTRICTED_API_DATA_SOURCES.has(dataSourceCode)) {
    if (dataSourceCode === IAM_DATA_SOURCE_CODES.HEALTH_ADMIN) return canAccessHealthAdmin(profile);
    if (dataSourceCode === IAM_DATA_SOURCE_CODES.EXTERNAL_API) return canAccessExternalApi(profile);
  }

  if (roleCanAccessDataSource(profile, dataSourceCode)) return true;

  const dataSource = getEnabledDataSources(profile).find((ds) => ds.code === dataSourceCode);
  if (!dataSource) return false;

  const productCodes = dataSource.product_codes;
  if (productCodes != null && Array.isArray(productCodes)) {
    if (productCodes.length === 0) return false;
    if (productCode != null && !productCodes.includes(productCode)) return false;
  }

  const scope = dataSource.access_scope || 'ALL';
  if (scope === 'ALL') return true;
  if (scope === 'SELF') {
    return ownerFeishuUserId == null || ownerFeishuUserId === profile.feishu_user_id;
  }
  return false;
}

/** API 路径 → 所需 data_source code；null 表示仅需登录 */
export function resolveApiDataSource(apiPath) {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;

  if (path.startsWith('/insightrackr')) return IAM_DATA_SOURCE_CODES.INSIGHTRACKR;
  if (path.startsWith('/sensortower')) return IAM_DATA_SOURCE_CODES.SENSORTOWER;
  if (path.startsWith('/catalog/g1-cn')) return IAM_DATA_SOURCE_CODES.GUANGDADA;
  if (path.startsWith('/catalog/g1')) return IAM_DATA_SOURCE_CODES.GUANGDADA;
  if (path.startsWith('/guangdada-cn')) return IAM_DATA_SOURCE_CODES.GUANGDADA;
  if (path.startsWith('/guangdada')) return IAM_DATA_SOURCE_CODES.GUANGDADA;
  if (path.startsWith('/transcode-video')) return IAM_DATA_SOURCE_CODES.MATERIAL_TOOLS;
  if (path.startsWith('/transcode-queue')) return IAM_DATA_SOURCE_CODES.HEALTH_ADMIN;
  if (path.startsWith('/transcode-jobs')) return IAM_DATA_SOURCE_CODES.MATERIAL_TOOLS;
  if (path.startsWith('/material-processing')) return IAM_DATA_SOURCE_CODES.MATERIAL_TOOLS;
  if (path.startsWith('/health')) return IAM_DATA_SOURCE_CODES.HEALTH_ADMIN;
  if (path.startsWith('/external')) return IAM_DATA_SOURCE_CODES.EXTERNAL_API;
  if (path.startsWith('/proxy-media') || path.startsWith('/download-image')) return null;
  return undefined;
}

export function canAccessApiPath(profile, apiPath) {
  const required = resolveApiDataSource(apiPath);
  if (required === undefined) return true;
  if (required === null) return true;
  return canAccessDataSource(profile, required);
}

/** 前端路由 → data_source（仅用于菜单） */
export function resolveRouteDataSource(pathname) {
  if (pathname.startsWith('/tools/')) return IAM_DATA_SOURCE_CODES.MATERIAL_TOOLS;
  if (isSensortowerRoute(pathname)) return IAM_DATA_SOURCE_CODES.SENSORTOWER;
  if (isInsightrackrRoute(pathname)) return IAM_DATA_SOURCE_CODES.INSIGHTRACKR;
  if (pathname.startsWith(ROUTES.GUANGDADA) || pathname.startsWith('/guangdada')) return IAM_DATA_SOURCE_CODES.GUANGDADA;
  if (pathname.startsWith('/health')) return IAM_DATA_SOURCE_CODES.HEALTH_ADMIN;
  if (pathname.startsWith('/external-search-debug')) return IAM_DATA_SOURCE_CODES.EXTERNAL_API;
  return null;
}

export function summarizeProfileForClient(profile) {
  if (!profile) return null;
  return {
    platform_code: profile.platform_code,
    feishu_user_id: profile.feishu_user_id,
    user_name: profile.user_name,
    email: profile.email,
    is_platform_member: profile.is_platform_member === true,
    is_super: profile.is_super === true,
    role: resolveProfileRole(profile) ?? IAM_ROLE_CODES.EMPLOYEE,
    business_line_codes: profile.business_line_codes || [],
    role_codes: profile.role_codes || [],
    data_sources: getEnabledDataSources(profile).map((ds) => ({
      code: ds.code,
      name: ds.name,
      access_scope: ds.access_scope || 'ALL',
      product_codes: ds.product_codes ?? null,
      enabled: ds.enabled !== false,
    })),
    session_expire_at: profile.session_expire_at,
  };
}
