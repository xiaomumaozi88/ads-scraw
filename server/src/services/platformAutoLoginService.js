import * as puppeteerServiceInsightrackr from './puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from './puppeteerService.js';
import * as puppeteerServiceSensorTower from './puppeteerServiceSensorTower.js';
import { LoginStatus } from '../constants/index.js';
import { logger } from '../utils/logger.js';
import { auditPlatformLoginTrigger } from './auditLogService.js';
import { clearGuangdadaQuotaCache } from './guangdadaQuotaService.js';
import {
  getPlatformCredentialPublicInfo,
  getResolvedPlatformCredentials,
  PLATFORM_CREDENTIALS,
} from './platformCredentialsService.js';

const PLATFORM_ADAPTERS = {
  insightrackr: {
    service: puppeteerServiceInsightrackr,
  },
  guangdada: {
    service: puppeteerServiceGuangdada,
    afterSuccess: () => clearGuangdadaQuotaCache(),
  },
  sensortower: {
    service: puppeteerServiceSensorTower,
  },
};

const loginLocks = new Map();

function normalizePlatform(platform) {
  const code = String(platform || '').trim().toLowerCase();
  if (!PLATFORM_ADAPTERS[code]) {
    const err = new Error('不支持的平台自动登录');
    err.code = 'UNKNOWN_PLATFORM';
    throw err;
  }
  return code;
}

function displayName(platform) {
  return PLATFORM_CREDENTIALS[platform]?.name || platform;
}

async function readOnlineStatus(platform) {
  const current = await PLATFORM_ADAPTERS[platform].service.getStatus();
  return current?.status === LoginStatus.ONLINE ? current : null;
}

function loginInProgressResponse(platform) {
  return {
    success: false,
    code: 'LOGIN_IN_PROGRESS',
    message: `${displayName(platform)} 正在登录中，请稍后再试`,
  };
}

async function runWithLoginLock(platform, fn) {
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      loginLocks.delete(platform);
    }
  })();
  loginLocks.set(platform, promise);
  return promise;
}

function recordTriggerAudit(platform, result, operatorProfile, targetAccount) {
  auditPlatformLoginTrigger({
    platform,
    operatorProfile,
    targetAccount: targetAccount || null,
    success: result.success === true,
    alreadyOnline: result.alreadyOnline === true,
    message: result.message,
    metadata: result.code ? { code: result.code } : undefined,
  });
  return result;
}

export function getPlatformAutoLoginInfo(platform) {
  const code = normalizePlatform(platform);
  const { email: _email, ...publicInfo } = getPlatformCredentialPublicInfo(code);
  return {
    ...publicInfo,
    loginInProgress: loginLocks.has(code),
    manualLoginOnly: false,
  };
}

export function getAllPlatformAutoLoginInfo() {
  return Object.keys(PLATFORM_ADAPTERS).reduce((acc, code) => {
    acc[code] = getPlatformAutoLoginInfo(code);
    return acc;
  }, {});
}

export async function triggerPlatformLogin(platform, options = {}) {
  const code = normalizePlatform(platform);
  const { operatorProfile } = options;
  const operatorName =
    operatorProfile?.user_name || operatorProfile?.email || operatorProfile?.feishu_user_id || 'unknown';
  const credential = getResolvedPlatformCredentials(code);

  try {
    const online = await readOnlineStatus(code);
    if (online) {
      logger.info(`[${displayName(code)}] ${operatorName} 触发登录：已在线，跳过`);
      return recordTriggerAudit(code, {
        success: true,
        alreadyOnline: true,
        message: `${displayName(code)} 已登录`,
        data: online,
      }, operatorProfile, credential.email || online.email);
    }
  } catch (error) {
    logger.warn(`[${displayName(code)}] 读取登录状态失败，继续尝试登录:`, error.message);
  }

  if (loginLocks.has(code)) {
    return recordTriggerAudit(code, loginInProgressResponse(code), operatorProfile, credential.email);
  }

  if (!credential.configured) {
    return recordTriggerAudit(code, {
      success: false,
      code: 'MISSING_CREDENTIALS',
      message: `服务端未配置 ${displayName(code)} 自动登录账号或密码`,
    }, operatorProfile, credential.email);
  }

  return runWithLoginLock(code, async () => {
    try {
      const online = await readOnlineStatus(code);
      if (online) {
        return recordTriggerAudit(code, {
          success: true,
          alreadyOnline: true,
          message: `${displayName(code)} 已登录`,
          data: online,
        }, operatorProfile, credential.email || online.email);
      }
    } catch (error) {
      logger.warn(`[${displayName(code)}] 锁内读取状态失败:`, error.message);
    }

    logger.info(`[${displayName(code)}] ${operatorName} 触发自动登录...`);
    const result = await PLATFORM_ADAPTERS[code].service.login(
      credential.email,
      credential.password
    );

    if (result?.success) {
      PLATFORM_ADAPTERS[code].afterSuccess?.();
      logger.info(`[${displayName(code)}] ${operatorName} 触发登录成功`);
      return recordTriggerAudit(code, {
        success: true,
        alreadyOnline: false,
        message: result.message || '登录成功',
        data: result.data ?? null,
      }, operatorProfile, credential.email);
    }

    logger.error(`[${displayName(code)}] ${operatorName} 触发登录失败:`, result?.message);
    return recordTriggerAudit(code, {
      success: false,
      code: result?.code || 'LOGIN_FAILED',
      message: result?.message || '登录失败',
      data: result?.data ?? null,
    }, operatorProfile, credential.email);
  });
}

export async function ensurePlatformLoggedIn(platform) {
  const code = normalizePlatform(platform);
  const credential = getResolvedPlatformCredentials(code);
  if (!credential.configured) {
    logger.info(`[${displayName(code)}] 未配置自动登录账号或密码，跳过自动登录`);
    return { skipped: true, reason: 'missing_credentials' };
  }
  if (!credential.autoLoginEnabled) {
    logger.info(`[${displayName(code)}] 自动登录已关闭，跳过`);
    return { skipped: true, reason: 'disabled' };
  }
  if (loginLocks.has(code)) {
    logger.info(`[${displayName(code)}] 登录进行中，跳过自动登录`);
    return { skipped: true, reason: 'login_in_progress' };
  }

  try {
    const online = await readOnlineStatus(code);
    if (online) {
      logger.info(`[${displayName(code)}] 已在线，跳过自动登录`);
      return { skipped: true, alreadyOnline: true };
    }
  } catch (error) {
    logger.warn(`[${displayName(code)}] 读取登录状态失败，仍尝试自动登录:`, error.message);
  }

  return runWithLoginLock(code, async () => {
    logger.info(`[${displayName(code)}] 开始自动登录...`);
    const result = await PLATFORM_ADAPTERS[code].service.login(
      credential.email,
      credential.password
    );
    if (result?.success) {
      PLATFORM_ADAPTERS[code].afterSuccess?.();
      logger.info(`[${displayName(code)}] 自动登录成功`);
      return { success: true, message: result.message || '自动登录成功' };
    }
    logger.error(`[${displayName(code)}] 自动登录失败:`, result?.message || '未知错误');
    return {
      success: false,
      code: result?.code || 'LOGIN_FAILED',
      message: result?.message || '自动登录失败',
    };
  });
}

export async function ensureAllConfiguredPlatformsLoggedIn(platforms = Object.keys(PLATFORM_ADAPTERS)) {
  const results = {};
  for (const platform of platforms) {
    const code = normalizePlatform(platform);
    try {
      results[code] = await ensurePlatformLoggedIn(code);
    } catch (error) {
      logger.warn(`[${displayName(code)}] 自动登录异常:`, error.message);
      results[code] = { success: false, message: error.message || '自动登录异常' };
    }
  }
  return results;
}
