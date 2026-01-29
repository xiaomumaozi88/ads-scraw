import * as puppeteerService from '../services/puppeteerServiceInsightrackr.js';
import log4js from 'log4js';

const logger = global.logger || log4js.getLogger('status-controller-insightrackr');

export const getStatus = async (req, res) => {
    try {
        const statusObj = await puppeteerService.getStatus();
        res.json({
            code: 200,
            data: statusObj,
            message: '',
            success: true
        });
    } catch (error) {
        console.error('获取状态失败:', error);
        logger.error(`获取状态失败: ${error.message || error}`);
        // 仍返回 200 且带 data.status，登录状态记在后端、全局共享（localhost 与 IP 访问同一状态）
        res.status(200).json({
            code: 200,
            data: { status: 'LOGGED_OUT' },
            message: error.message || '获取状态失败',
            success: false
        });
    }
};

