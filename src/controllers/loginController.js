import * as puppeteerService from '../services/puppeteerService.js';

export const login = async (req, res) => {
    try {
        await puppeteerService.login();
        res.json({ data: null, success: true, code: 200, message: '验证码已发送'});
    } catch (error) {
        console.error(error);
        logger.info(`请求登录失败${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: '请求登录失败' });
    }
};
