import * as puppeteerService from '../services/puppeteerServiceSensorTower.js';
import { logger } from '../utils/logger.js';

export const getStatus = async (req, res) => {
    try {
        const statusObj = await puppeteerService.getStatus();
        res.json({
            code: 200,
            data: statusObj,
            message: '',
            success: true,
        });
    } catch (error) {
        console.error('Sensor Tower 获取状态失败:', error);
        logger.error(`Sensor Tower 获取状态失败: ${error.message || error}`);
        res.status(200).json({
            code: 200,
            data: { status: 'LOGGED_OUT' },
            message: error.message || '获取状态失败',
            success: false,
        });
    }
};
