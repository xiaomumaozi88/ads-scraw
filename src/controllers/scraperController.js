import * as puppeteerService from '../services/puppeteerService.js';

export const scrape = async (req, res) => {
    const { orderId, accountId } = req.body;
    if (!orderId) {
        return res.status(400).json({ data: null, success: false, code: 400, message: '缺少orderId参数'});
    }
    if(!accountId){
        return res.status(400).json({ data: null, success: false, code: 400, message: '缺少accountId参数'});
    }

    try {
        const data = await puppeteerService.scrapeData(orderId, accountId);
        res.json(data);
    } catch (error) {
        console.error(error);
        logger.error(`爬取数据失败${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};
