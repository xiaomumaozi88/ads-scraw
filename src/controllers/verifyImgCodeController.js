import * as puppeteerService from '../services/puppeteerService.js';
import * as puppeteerServiceA3 from '../services/puppeteerServiceA3.js';
import {A3_GOOGLE_ACCOUNT} from "../constants";

export const verifyImgCodeFn = async (req, res) => {
    const { code, account } = req.body;
    const puppeteerServiceTemp =
        account === A3_GOOGLE_ACCOUNT ?
            puppeteerServiceA3
            : puppeteerService;
    console.log('接受到图形验证码参数', code);

    if (!code) {
        return res.status(400).json({ data: null, success: false, code: 400, message: '缺少图形验证码参数' });
    }
    try {
        const data = await puppeteerServiceTemp.verifyImgCode(code);
        res.status(200).json({ ...data});
    } catch (error) {
        console.error(error);
        res.status(200).json({ data: null, success: false, code: 500, message: '' });
    }
};
