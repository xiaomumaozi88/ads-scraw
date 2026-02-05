import * as puppeteerServiceInsightrackr from '../services/puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from '../services/puppeteerService.js';
import { getRecentLogs, clearLogs } from '../utils/memoryLogAppender.js';

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

    const totalBrowsers = [insightrackr.browserExists, guangdada.browserExists].filter(Boolean).length;
    const totalPages = (insightrackr.pageCount || 0) + (guangdada.pageCount || 0);

    const serverStartTime = global.serverStartTime || null;
    const uptimeMs = serverStartTime ? Date.now() - serverStartTime : null;
    const lastStartTimeFormatted = serverStartTime
      ? new Date(serverStartTime).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false })
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

    res.status(200).json({
      success: true,
      data: {
        insightrackr: {
          name: 'Insightrackr',
          ...insightrackr
        },
        guangdada: {
          name: '广大大',
          ...guangdada
        },
        summary: {
          totalBrowsers,
          totalPages,
          lastStartTime: serverStartTime,
          lastStartTimeFormatted,
          uptimeMs,
          uptimeText
        },
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

/** POST /api/health/reopen-browser：关闭并重新打开各平台浏览器窗口 */
export const postReopenBrowser = async (req, res) => {
  try {
    await puppeteerServiceInsightrackr.closeBrowser();
    await puppeteerServiceGuangdada.closeBrowser();
    await puppeteerServiceInsightrackr.initializeBrowser();
    await puppeteerServiceGuangdada.initializeBrowser();
    res.status(200).json({ success: true, message: '浏览器窗口已重新打开' });
  } catch (error) {
    console.error('重新打开浏览器失败:', error);
    res.status(500).json({ success: false, message: error.message || '重新打开失败' });
  }
};
