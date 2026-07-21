/** 前端页面路由（避免在 URL 中暴露第三方平台名称） */

export const ROUTES = {
  INSIGHTRACKR: '/creative/radar',
  SENSORTOWER: '/creative/market',
  GUANGDADA: '/creative/discovery',
  GUANGDADA_RANK: '/creative/discovery/rank',
  VIDEO_RESIZE: '/tools/video-resize',
  MATERIAL_HISTORY: '/tools/material-processing/history',
  HEALTH: '/health',
  TRANSCODE_QUEUE: '/health/transcode-queue',
  OPERATION_AUDITS: '/health/operation-audits',
  EXTERNAL_SEARCH_DEBUG: '/external-search-debug',
};

export function isInsightrackrRoute(pathname) {
  return pathname.startsWith(ROUTES.INSIGHTRACKR) || pathname === '/insightrackr';
}

export function isSensortowerRoute(pathname) {
  return pathname.startsWith(ROUTES.SENSORTOWER) || pathname === '/sensortower';
}

export function isGuangdadaRoute(pathname) {
  return pathname.startsWith(ROUTES.GUANGDADA) || pathname === '/guangdada' || pathname.startsWith('/guangdada/');
}

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
