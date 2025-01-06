import * as puppeteerService from '../services/puppeteerService.js';
import * as puppeteerServiceA3 from '../services/puppeteerServiceA3.js';
import {A3_GOOGLE_ACCOUNT} from "../constants";

export const login = async (req, res) => {
    try {
        const {query: {account}} = req;
        const puppeteerServiceTemp =
            account === A3_GOOGLE_ACCOUNT ?
                puppeteerServiceA3
                : puppeteerService;
        const data = await puppeteerServiceTemp.login();
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.info(`请求登录失败${error}`);
        res.status(200).json({data: null, success: false, code: 500, message: '请求登录失败'});
    }
};
