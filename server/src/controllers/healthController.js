import * as puppeteerServiceInsightrackr from '../services/puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from '../services/puppeteerService.js';
import { getRecentLogs } from '../utils/memoryLogAppender.js';

/** GET /api/health：汇总各平台浏览器实例数、页面数、登录账号及最近错误日志，供排查用 */
export const getHealth = async (req, res) => {
  try {
    const [insightrackr, guangdada] = await Promise.all([
      puppeteerServiceInsightrackr.getHealthInfo(),
      puppeteerServiceGuangdada.getHealthInfo()
    ]);

    const totalBrowsers = [insightrackr.browserExists, guangdada.browserExists].filter(Boolean).length;
    const totalPages = (insightrackr.pageCount || 0) + (guangdada.pageCount || 0);

    const recentLogs = getRecentLogs(80);
    const recentErrors = getRecentLogs(50, 'error');

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
          totalPages
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
