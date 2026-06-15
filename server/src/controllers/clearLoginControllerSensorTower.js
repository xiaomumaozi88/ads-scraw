import * as puppeteerService from '../services/puppeteerServiceSensorTower.js';

export const clearLogin = async (req, res) => {
    try {
        const data = await puppeteerService.clearLogin();
        res.json({ ...data });
    } catch (error) {
        console.error('Sensor Tower 清除登录失败:', error);
        res.status(200).json({
            success: false,
            code: 500,
            message: `清除失败: ${error.message}`,
        });
    }
};
