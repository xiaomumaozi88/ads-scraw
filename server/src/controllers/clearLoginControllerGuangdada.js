import * as puppeteerService from '../services/puppeteerService.js';
import { logger } from '../utils/logger.js';

export const clearLogin = async (req, res) => {
    try {
        const data = await puppeteerService.clearLogin();
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.error(`清除登录状态失败: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: `清除登录状态失败: ${error.message}`
        });
    }
};
