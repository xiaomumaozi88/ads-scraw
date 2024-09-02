// src/controllers/scraperController.js
import * as puppeteerService from '../services/puppeteerService.js';

export const scrape = async (req, res) => {
    const { orderId } = req.body;

    console.log('接受参数', orderId);
    if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
    }

    try {
        const data = await puppeteerService.scrapeData(orderId);
        res.json({ data, success: true, code: 200 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ data: null, success: false, code: 500 });
    }
};
