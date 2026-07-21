import os from 'os';
import * as puppeteerServiceInsightrackr from '../services/puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from '../services/puppeteerService.js';
import * as puppeteerServiceSensorTower from '../services/puppeteerServiceSensorTower.js';
import * as transcodeVideoService from '../services/transcodeVideoService.js';
import { getRecentLogs, clearLogs, refreshLogsCacheFromDb } from '../utils/memoryLogAppender.js';
import { getInsightrackrAutoLoginInfo } from '../services/insightrackrAutoLogin.js';
import {
  listPlatformCredentialPublicInfo,
  updatePlatformCredentials,
} from '../services/platformCredentialsService.js';
import { getAllPlatformAutoLoginInfo } from '../services/platformAutoLoginService.js';
import { auditPlatformCredentialUpdate } from '../services/auditLogService.js';
import {
  getContainerRestartInfo,
  restartApplicationContainer,
} from '../services/containerRestartService.js';

function roundMb(bytes) {
  return bytes == null ? null : Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function formatUptime(ms) {
  if (ms == null || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}天 ${h % 24}小时 ${m % 60}分钟`;
  if (h > 0) return `${h}小时 ${m % 60}分钟`;
  if (m > 0) return `${m}分钟`;
  return `${s}秒`;
}

function withTimeout(promise, timeoutMs, fallback) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function getPlatformHealthWithTimeout(label, getter, timeoutMs = 6000) {
  const fallback = {
    browserExists: false,
    pageCount: 0,
    status: null,
    email: null,
    isLoggedIn: false,
    error: `${label} 健康检查超时`,
  };
  try {
    return await withTimeout(getter(), timeoutMs, fallback);
  } catch (e) {
    console.error(`健康检查 ${label} 失败:`, e);
    return {
      ...fallback,
      error: e?.message || String(e),
    };
  }
}

/** GET /api/health：汇总各平台浏览器实例数、页面数、登录账号及最近错误日志，供排查用 */
export const getHealth = async (req, res) => {
  try {
    const [insightrackr, guangdada, sensortower] = await Promise.all([
      getPlatformHealthWithTimeout('Insightrackr', () => puppeteerServiceInsightrackr.getHealthInfo()),
      getPlatformHealthWithTimeout('广大大', () => puppeteerServiceGuangdada.getHealthInfo()),
      getPlatformHealthWithTimeout('Sensor Tower', () => puppeteerServiceSensorTower.getHealthInfo()),
    ]);

    const totalBrowsers = [insightrackr.browserExists, guangdada.browserExists, sensortower.browserExists].filter(Boolean).length;
    const totalPages = (insightrackr.pageCount || 0) + (guangdada.pageCount || 0) + (sensortower.pageCount || 0);

    const serverStartTime = global.serverStartTime || null;
    const uptimeMs = serverStartTime ? Date.now() - serverStartTime : null;
    const lastStartTimeFormatted = serverStartTime
      ? new Date(serverStartTime).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false, timeZone: 'Asia/Shanghai' })
      : null;
    const uptimeText = formatUptime(uptimeMs);

    let recentLogs = [];
    let recentErrors = [];
    try {
      await refreshLogsCacheFromDb(80);
      recentLogs = await getRecentLogs(80);
      recentErrors = await getRecentLogs(50, 'error');
    } catch (e) {
      console.error('健康检查 日志 失败:', e);
    }

    let transcode = null;
    try {
      transcode = transcodeVideoService.getTranscodeQueueStatus();
    } catch (e) {
      console.error('健康检查 转码队列 失败:', e);
      transcode = { error: e?.message || String(e) };
    }

    // 远程调试信息：当设置了 CHROME_REMOTE_DEBUGGING_PORT 时，用于人机验证等远程操作
    const remoteDebug = {};
    const portGuangdada = process.env.CHROME_REMOTE_DEBUGGING_PORT;
    const portInsightrackr = process.env.CHROME_REMOTE_DEBUGGING_PORT_INSIGHTRACKR;
    const portSensorTower = process.env.CHROME_REMOTE_DEBUGGING_PORT_SENSORTOWER;
    if (portGuangdada) {
      remoteDebug.guangdada = {
        enabled: true,
        port: portGuangdada,
        url: `http://localhost:${portGuangdada}`,
        hint: '先建立 SSH 隧道后，在本机 Chrome 打开上述地址即可用 DevTools 查看/操作广大大页面',
      };
    }
    if (portInsightrackr) {
      remoteDebug.insightrackr = {
        enabled: true,
        port: portInsightrackr,
        url: `http://localhost:${portInsightrackr}`,
        hint: '先建立 SSH 隧道后，在本机 Chrome 打开上述地址即可用 DevTools 查看/操作 Insightrackr 页面',
      };
    }
    if (portSensorTower) {
      remoteDebug.sensortower = {
        enabled: true,
        port: portSensorTower,
        url: `http://localhost:${portSensorTower}`,
        hint: '先建立 SSH 隧道后，在本机 Chrome 打开上述地址即可用 DevTools 查看/操作 Sensor Tower 页面',
      };
    }

    let performance = null;
    try {
      const mem = process.memoryUsage();
      const load = os.loadavg();
      const cpu = process.cpuUsage();
      performance = {
        memory: {
          heapUsedMb: roundMb(mem.heapUsed),
          heapTotalMb: roundMb(mem.heapTotal),
          rssMb: roundMb(mem.rss),
          externalMb: roundMb(mem.external),
        },
        loadAvg: Array.isArray(load) && load.length >= 3 ? { '1min': load[0], '5min': load[1], '15min': load[2] } : null,
        cpuUsageSeconds: { user: Math.round((cpu.user || 0) / 1e6 * 10) / 10, system: Math.round((cpu.system || 0) / 1e6 * 10) / 10 },
        processUptimeSeconds: Math.round(process.uptime() * 10) / 10,
        cpus: os.cpus?.()?.length ?? null,
      };
    } catch (e) {
      console.error('健康检查 性能 失败:', e);
      performance = { error: e?.message || String(e) };
    }

    res.status(200).json({
      success: true,
      data: {
        performance,
        transcode,
        insightrackr: {
          name: 'Insightrackr',
          ...insightrackr
        },
        guangdada: {
          name: '广大大',
          ...guangdada
        },
        sensortower: {
          name: 'Sensor Tower',
          ...sensortower
        },
        summary: {
          totalBrowsers,
          totalPages,
          lastStartTime: serverStartTime,
          lastStartTimeFormatted,
          uptimeMs,
          uptimeText
        },
        remoteDebug: Object.keys(remoteDebug).length ? remoteDebug : undefined,
        containerRestart: getContainerRestartInfo(),
        insightrackrAutoLogin: getInsightrackrAutoLoginInfo(),
        platformAutoLogin: getAllPlatformAutoLoginInfo(),
        platformCredentials: listPlatformCredentialPublicInfo(),
        recentLogs,
        recentErrors
      }
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '健康检查失败',
      data: null
    });
  }
};

/** GET /api/health/platform-credentials：运维查看平台自动登录账号配置（不返回密码） */
export const getPlatformCredentials = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: listPlatformCredentialPublicInfo(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取平台账号配置失败' });
  }
};

/** PUT /api/health/platform-credentials/:platform：运维更新平台自动登录账号配置 */
export const putPlatformCredentials = async (req, res) => {
  const platform = String(req.params.platform || '').trim().toLowerCase();
  try {
    const data = updatePlatformCredentials(platform, req.body || {}, req.iamProfile);
    auditPlatformCredentialUpdate({
      platform,
      operatorProfile: req.iamProfile,
      targetAccount: data.email || null,
      success: true,
      message: '平台自动登录账号配置已更新',
      metadata: {
        autoLoginEnabled: data.autoLoginEnabled,
        passwordUpdated: Boolean(req.body && req.body.password),
      },
    });
    res.status(200).json({ success: true, data, message: '平台账号配置已保存' });
  } catch (error) {
    auditPlatformCredentialUpdate({
      platform,
      operatorProfile: req.iamProfile,
      targetAccount: req.body?.email || null,
      success: false,
      message: error.message || '平台自动登录账号配置更新失败',
      metadata: { code: error.code || 'UPDATE_FAILED' },
    });
    res.status(error.code === 'UNKNOWN_PLATFORM' ? 404 : 400).json({
      success: false,
      code: error.code || 'UPDATE_FAILED',
      message: error.message || '保存平台账号配置失败',
    });
  }
};

/** POST /api/health/clear-logs：清除系统日志 */
export const postClearLogs = async (req, res) => {
  try {
    await clearLogs();
    res.status(200).json({ success: true, message: '日志已清除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '清除失败' });
  }
};

/** 关闭后等待 Chrome 进程完全退出，再启动；过短易导致第二实例启动失败（profile/端口占用） */
const BROWSER_REOPEN_DELAY_MS = Math.max(
  0,
  parseInt(process.env.BROWSER_REOPEN_DELAY_MS || '2500', 10)
);

/** POST /api/health/reopen-browser：关闭并重新打开各平台浏览器窗口 */
export const postReopenBrowser = async (req, res) => {
  try {
    await Promise.allSettled([
      puppeteerServiceInsightrackr.closeBrowser(),
      puppeteerServiceGuangdada.closeBrowser(),
      puppeteerServiceSensorTower.closeBrowser(),
    ]);
    await new Promise((r) => setTimeout(r, BROWSER_REOPEN_DELAY_MS));
    // 与 app.js 启动一致：并行拉起双 Chrome，缩短总耗时、避免串行时长时间无响应
    await Promise.all([
      puppeteerServiceInsightrackr.initializeBrowser(),
      puppeteerServiceGuangdada.initializeBrowser(),
      puppeteerServiceSensorTower.initializeBrowser(),
    ]);
    const [insightrackr, guangdada, sensortower] = await Promise.all([
      puppeteerServiceInsightrackr.getHealthInfo(),
      puppeteerServiceGuangdada.getHealthInfo(),
      puppeteerServiceSensorTower.getHealthInfo(),
    ]);
    const irOk = !!insightrackr.browserExists;
    const gdOk = !!guangdada.browserExists;
    const stOk = !!sensortower.browserExists;
    if (irOk && gdOk && stOk) {
      return res.status(200).json({
        success: true,
        message: '浏览器窗口已重新打开',
        data: { insightrackr, guangdada, sensortower },
      });
    }
    const failed = [];
    if (!irOk) failed.push('Insightrackr');
    if (!gdOk) failed.push('广大大');
    if (!stOk) failed.push('Sensor Tower');
    return res.status(200).json({
      success: false,
      message: `以下浏览器未能成功启动：${failed.join('、')}。请查看服务器日志或稍后重试；也可增大环境变量 BROWSER_REOPEN_DELAY_MS（当前 ${BROWSER_REOPEN_DELAY_MS}ms）。`,
      data: { insightrackr, guangdada, sensortower },
    });
  } catch (error) {
    console.error('重新打开浏览器失败:', error);
    res.status(500).json({ success: false, message: error.message || '重新打开失败' });
  }
};

/** POST /api/health/restart-container：通过 Docker API 重启当前应用容器 */
export const postRestartContainer = async (req, res) => {
  try {
    const info = getContainerRestartInfo();
    if (!info.available) {
      return res.status(400).json({
        success: false,
        message:
          '容器重启未就绪：需设置 DOCKER_CONTAINER_RESTART_ENABLED=true 并挂载 /var/run/docker.sock',
        data: info,
      });
    }

    res.status(200).json({
      success: true,
      message: `已发送重启指令，容器「${info.containerName}」将在数秒内重启，页面可能短暂不可用`,
      data: info,
    });

    setTimeout(() => {
      restartApplicationContainer().catch((err) => {
        console.error('容器重启失败:', err);
      });
    }, 300);
  } catch (error) {
    console.error('容器重启失败:', error);
    res.status(500).json({ success: false, message: error.message || '容器重启失败' });
  }
};
