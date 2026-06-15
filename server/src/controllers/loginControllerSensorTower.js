import * as puppeteerService from '../services/puppeteerServiceSensorTower.js';
import { logger } from '../utils/logger.js';

export const login = async (req, res) => {
    try {
        const { email, password, otp, authLink } = req.body || {};
        const data = await puppeteerService.login(email, password, otp, authLink);
        res.json({ ...data });
    } catch (error) {
        console.error('Sensor Tower 登录失败:', error);
        logger.error(`Sensor Tower 登录: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: `请求登录失败: ${error.message}`,
        });
    }
};
