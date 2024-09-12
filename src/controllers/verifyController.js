import * as puppeteerService from '../services/puppeteerService.js';
import {verifyCode} from "../services/puppeteerService.js";

export const verify = async (req, res) => {
    const { code } = req.body;

    console.log('接受到验证码参数', code);

    if (!code) {
        return res.status(400).json({ data: null, success: false, code: 400, message: '缺少验证码参数' });
    }
    try {
        const data = await puppeteerService.verifyCode(code);
        res.status(200).json({ ...data});
    } catch (error) {
        console.error(error);
        res.status(200).json({ data: null, success: false, code: 500, message: '' });
    }
};
