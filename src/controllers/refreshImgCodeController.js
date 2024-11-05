import * as puppeteerService from '../services/puppeteerService.js';

export const refreshImgCodeFn = async (req, res) => {

    try {
        const data = await puppeteerService.refreshImgCode();
        res.status(200).json({ ...data});
    } catch (error) {
        console.error(error);
        res.status(200).json({ data: null, success: false, code: 500, message: '' });
    }
};
