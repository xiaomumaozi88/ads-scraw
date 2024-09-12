import * as puppeteerService from '../services/puppeteerService.js';

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
        console.error(error);
        logger.error(`获取状态失败: ${error}`)
        res.status(200).json({
            code: 500,
            data: null,
            message: '获取状态失败',
            success: false
        });
    }
};
