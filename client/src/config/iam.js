/** 与后端 iamCatalog 中 data_sources code 保持一致 */

import { ROUTES, isInsightrackrRoute, isSensortowerRoute } from './routes';
import {
  isEmployeeProfile,
  isRelatedEmployeeProfile,
  isSuperAdminProfile,
  resolveProfileRole,
  roleCanAccessDataSource,
} from './iamRoles';

export const IAM_DATA_SOURCES = {
  INSIGHTRACKR: 'insightrackr',
  SENSORTOWER: 'sensortower',
  GUANGDADA: 'guangdada',
  MATERIAL_TOOLS: 'material_tools',
  HEALTH_ADMIN: 'health_admin',
  EXTERNAL_API: 'external_api',
};

/** 由 AuthContext 注入；未注入时与后端默认一致（宽松） */
let relaxedIamAccess = import.meta.env.VITE_IAM_RELAXED_ACCESS !== 'false';

export function setRelaxedIamAccess(value) {
  relaxedIamAccess = value !== false;
}

export function isRelaxedIamAccess() {
  return relaxedIamAccess;
}

export const ROUTE_DATA_SOURCE = {
  [ROUTES.INSIGHTRACKR]: IAM_DATA_SOURCES.INSIGHTRACKR,
  [ROUTES.SENSORTOWER]: IAM_DATA_SOURCES.SENSORTOWER,
  [ROUTES.GUANGDADA]: IAM_DATA_SOURCES.GUANGDADA,
  [ROUTES.VIDEO_RESIZE]: IAM_DATA_SOURCES.MATERIAL_TOOLS,
  [ROUTES.MATERIAL_HISTORY]: IAM_DATA_SOURCES.MATERIAL_TOOLS,
  [ROUTES.HEALTH]: IAM_DATA_SOURCES.HEALTH_ADMIN,
  [ROUTES.EXTERNAL_SEARCH_DEBUG]: IAM_DATA_SOURCES.EXTERNAL_API,
};

export function resolveRouteDataSource(pathname) {
  if (pathname.startsWith('/tools/material-processing/history')) {
    return IAM_DATA_SOURCES.MATERIAL_TOOLS;
  }
  if (pathname.startsWith('/tools/video-resize')) return IAM_DATA_SOURCES.MATERIAL_TOOLS;
  if (pathname.startsWith('/external-search-debug')) return IAM_DATA_SOURCES.EXTERNAL_API;
  if (pathname.startsWith('/health')) return IAM_DATA_SOURCES.HEALTH_ADMIN;
  if (pathname.startsWith(ROUTES.GUANGDADA) || pathname.startsWith('/guangdada')) return IAM_DATA_SOURCES.GUANGDADA;
  if (isSensortowerRoute(pathname)) return IAM_DATA_SOURCES.SENSORTOWER;
  if (isInsightrackrRoute(pathname)) return IAM_DATA_SOURCES.INSIGHTRACKR;
  return null;
}

function getEnabledDataSources(profile) {
  if (!profile?.data_sources) return [];
  return profile.data_sources.filter((ds) => ds && ds.enabled !== false);
}

/** 模块可见性：侧栏菜单与直接访问页面路由共用 */
export function hasMenuDataSource(profile, code) {
  if (!profile || !code) return false;
  if (isSuperAdminProfile(profile)) return true;
  if (code === IAM_DATA_SOURCES.SENSORTOWER) return false;
  if (code === IAM_DATA_SOURCES.HEALTH_ADMIN || code === IAM_DATA_SOURCES.EXTERNAL_API) {
    return false;
  }
  if (roleCanAccessDataSource(profile, code)) return true;
  return getEnabledDataSources(profile).some((ds) => ds.code === code && ds.enabled !== false);
}

export function canAccessHealthAdmin(profile) {
  return isSuperAdminProfile(profile);
}

export function canAccessExternalApi(profile) {
  if (!profile) return false;
  if (isSuperAdminProfile(profile)) return true;
  return getEnabledDataSources(profile).some((ds) => ds.code === IAM_DATA_SOURCES.EXTERNAL_API);
}

export function canAccessMaterialProcessingHistory(profile) {
  if (!profile) return false;
  return hasMenuDataSource(profile, IAM_DATA_SOURCES.MATERIAL_TOOLS);
}

export function canEnterPlatform(profile) {
  if (!profile) return false;
  if (isRelaxedIamAccess()) return true;
  if (isSuperAdminProfile(profile)) return true;
  if (isRelatedEmployeeProfile(profile)) return true;
  if (isEmployeeProfile(profile)) return true;
  if (profile.is_platform_member) return true;
  if (Array.isArray(profile.data_sources) && profile.data_sources.length > 0) return true;
  return false;
}

export function canAccessRoute(profile, pathname) {
  const dataSource = resolveRouteDataSource(pathname);
  if (!dataSource) return true;
  return hasMenuDataSource(profile, dataSource);
}

export function getFirstAllowedRoute(profile) {
  const order = [
    ROUTES.INSIGHTRACKR,
    ROUTES.SENSORTOWER,
    ROUTES.GUANGDADA,
    ROUTES.VIDEO_RESIZE,
    ROUTES.MATERIAL_HISTORY,
    ROUTES.HEALTH,
  ];
  for (const route of order) {
    const ds = resolveRouteDataSource(route);
    if (!ds || hasMenuDataSource(profile, ds)) return route;
  }
  return ROUTES.INSIGHTRACKR;
}

export {
  isSuperAdminProfile,
  isEmployeeProfile,
  isRelatedEmployeeProfile,
  resolveProfileRole,
};
