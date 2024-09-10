import * as puppeteerService from '../services/puppeteerService.js';

export const login = async (req, res) => {
    try {
        const data = await puppeteerService.login();
        res.json({ ...data });
    } catch (error) {
        console.error(error);
        logger.info(`请求登录失败${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: '请求登录失败' });
    }
};
