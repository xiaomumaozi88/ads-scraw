/** 与 client/src/config/routes.js 保持一致 */

export const ROUTES = {
  INSIGHTRACKR: '/creative/radar',
  SENSORTOWER: '/creative/market',
  GUANGDADA: '/creative/discovery',
  VIDEO_RESIZE: '/tools/video-resize',
  MATERIAL_HISTORY: '/tools/material-processing/history',
  HEALTH: '/health',
  EXTERNAL_SEARCH_DEBUG: '/external-search-debug',
};

export function isInsightrackrRoute(pathname) {
  return pathname.startsWith(ROUTES.INSIGHTRACKR) || pathname === '/insightrackr';
}

export function isSensortowerRoute(pathname) {
  return pathname.startsWith(ROUTES.SENSORTOWER) || pathname === '/sensortower';
}

/** IAM 回跳等场景：将旧路径规范为新路径 */
export function normalizeAppPath(pathname) {
  if (pathname === '/guangdada' || pathname.startsWith('/guangdada/')) {
    return ROUTES.GUANGDADA + pathname.slice('/guangdada'.length);
  }
  if (pathname === '/insightrackr' || pathname.startsWith('/insightrackr/')) {
    return ROUTES.INSIGHTRACKR + pathname.slice('/insightrackr'.length);
  }
  if (pathname === '/sensortower' || pathname.startsWith('/sensortower/')) {
    return ROUTES.SENSORTOWER + pathname.slice('/sensortower'.length);
  }
  return pathname;
}
