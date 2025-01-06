import * as puppeteerService from '../services/puppeteerService.js';
import * as puppeteerServiceA3 from '../services/puppeteerServiceA3.js';

export const clearLogin = async (req, res) => {
    const { account } = req.body;
    const puppeteerServiceTemp =
        account === 'a3' ?
            puppeteerServiceA3
            : puppeteerService;
    try {
        await puppeteerServiceTemp.clearLogin();
        res.json({ data: null, success: true, code: 200, message: '登录状态已清除'});
    } catch (error) {
        console.error(error);
        res.status(200).json({ data: null, success: false, code: 500, message: '登录状态清除失败' });
    }
};
