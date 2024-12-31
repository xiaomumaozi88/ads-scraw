import * as puppeteerService from '../services/puppeteerService.js';
import * as puppeteerServiceA3 from '../services/puppeteerServiceA3.js';

export const refreshImgCodeFn = async (req, res) => {
    const {query: {account = 't4f'}} = req;
    const puppeteerServiceTemp =
        account === 'A3' ?
            puppeteerServiceA3
            : puppeteerService;
    try {
        const data = await puppeteerServiceTemp.refreshImgCode();
        res.status(200).json({ ...data});
    } catch (error) {
        console.error(error);
        res.status(200).json({ data: null, success: false, code: 500, message: '' });
    }
};
