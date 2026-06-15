import os from 'os';
import * as puppeteerServiceInsightrackr from '../services/puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from '../services/puppeteerService.js';
import * as puppeteerServiceSensorTower from '../services/puppeteerServiceSensorTower.js';
import * as transcodeVideoService from '../services/transcodeVideoService.js';
import { getRecentLogs, clearLogs } from '../utils/memoryLogAppender.js';

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

/** GET /api/health：汇总各平台浏览器实例数、页面数、登录账号及最近错误日志，供排查用 */
export const getHealth = async (req, res) => {
  try {
    let insightrackr;
    let guangdada;
    let sensortower;
    try {
      insightrackr = await puppeteerServiceInsightrackr.getHealthInfo();
    } catch (e) {
      console.error('健康检查 Insightrackr 失败:', e);
      insightrackr = { browserExists: false, pageCount: 0, status: null, email: null, isLoggedIn: false, error: e?.message || String(e) };
    }
    try {
      guangdada = await puppeteerServiceGuangdada.getHealthInfo();
    } catch (e) {
      console.error('健康检查 广大大 失败:', e);
      guangdada = { browserExists: false, pageCount: 0, status: null, email: null, isLoggedIn: false, error: e?.message || String(e) };
    }
    try {
      sensortower = await puppeteerServiceSensorTower.getHealthInfo();
    } catch (e) {
      console.error('健康检查 Sensor Tower 失败:', e);
      sensortower = { browserExists: false, pageCount: 0, status: null, email: null, isLoggedIn: false, error: e?.message || String(e) };
    }

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
      recentLogs = getRecentLogs(80);
      recentErrors = getRecentLogs(50, 'error');
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

/** POST /api/health/clear-logs：清除内存中的日志 */
export const postClearLogs = async (req, res) => {
  try {
    clearLogs();
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
