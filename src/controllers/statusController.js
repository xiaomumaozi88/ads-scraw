import * as puppeteerService from '../services/puppeteerService.js';
import * as puppeteerServiceA3 from '../services/puppeteerServiceA3.js';

export const getStatus = async (req, res) => {
    const { account } = req.query;
    const puppeteerServiceTemp =
        account === 'A3' ?
            puppeteerServiceA3
            : puppeteerService;
    try {
        const statusObj = await puppeteerServiceTemp.getStatus();
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
