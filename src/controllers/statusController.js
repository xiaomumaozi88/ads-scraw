import * as puppeteerService from '../services/puppeteerService.js';

export const getStatus = async (req, res) => {
    try {
        const status = await puppeteerService.getStatus();

        res.json({
            code: 200,
            data: {
                status: status.data,
            },
            message: '',
            success: true
        });
    } catch (error) {
        console.error(error);
        res.status(200).json({
            code: 500,
            data: null,
            message: '获取状态失败',
            success: false
        });
    }
};
