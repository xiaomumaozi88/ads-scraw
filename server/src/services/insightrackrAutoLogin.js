import {
  ensurePlatformLoggedIn,
  getPlatformAutoLoginInfo,
  triggerPlatformLogin,
} from './platformAutoLoginService.js';

/** 兼容旧调用：热云自动登录已统一到 platformAutoLoginService */
export function getInsightrackrAutoLoginInfo() {
  return getPlatformAutoLoginInfo('insightrackr');
}

export async function triggerInsightrackrLogin(options = {}) {
  return triggerPlatformLogin('insightrackr', options);
}

export async function ensureInsightrackrLoggedIn() {
  return ensurePlatformLoggedIn('insightrackr');
}
