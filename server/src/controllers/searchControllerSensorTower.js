import * as puppeteerService from '../services/puppeteerServiceSensorTower.js';
import { logger } from '../utils/logger.js';

export const search = async (req, res) => {
    try {
        const data = await puppeteerService.search(req.body || {});
        if (data.success) {
            res.json({ ...data });
        } else {
            res.status(200).json({ ...data });
        }
    } catch (error) {
        console.error('Sensor Tower 页面跳转失败:', error);
        logger.error(`Sensor Tower search: ${error.message || error}`);
        res.status(200).json({
            success: false,
            data: null,
            code: 500,
            message: error.message || '请求失败',
        });
    }
};
