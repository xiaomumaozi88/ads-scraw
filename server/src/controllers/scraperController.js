import * as puppeteerService from '../services/puppeteerService.js';
import * as puppeteerServiceA3 from '../services/puppeteerServiceA3.js';
import * as puppeteerServiceInsightrackr from '../services/puppeteerServiceInsightrackr.js';

const A3_GOOGLE_ACCOUNT = 'infocenter@a3games.com';

export const scrape = async (req, res) => {
    const { orderId, accountId, account} = req.body;
    const puppeteerServiceTemp =
        account === A3_GOOGLE_ACCOUNT ?
            puppeteerServiceA3
            : puppeteerService;
    if (!orderId) {
        return res.status(400).json({ data: null, success: false, code: 400, message: '缺少orderId参数'});
    }
    if(!accountId){
        return res.status(400).json({ data: null, success: false, code: 400, message: '缺少accountId参数'});
    }

    try {
        const data = await puppeteerServiceTemp.scrapeData(orderId, accountId);
        res.json(data);
    } catch (error) {
        console.error(error);
        logger.error(`爬取数据失败${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};

// 爬取 display-ads 页面
export const scrapeDisplayAds = async (req, res) => {
    try {
        const data = await puppeteerService.scrapeDisplayAds();
        res.json(data);
    } catch (error) {
        console.error(error);
        logger.error(`爬取 display-ads 页面失败: ${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};

// 执行浏览器操作
export const executeBrowserAction = async (req, res) => {
    try {
        const action = req.body;
        // 优先从 body 获取 site，如果没有则从 query 获取
        const site = action.site || req.query.site;
        
        console.log('执行浏览器操作，site:', site, 'action:', action);
        
        let data;
        if (site === 'insightrackr') {
            // 移除 action 中的 site 字段，避免传递给服务层
            const { site: _, ...actionWithoutSite } = action;
            data = await puppeteerServiceInsightrackr.executeBrowserAction(actionWithoutSite);
        } else {
            const { site: _, ...actionWithoutSite } = action;
            data = await puppeteerService.executeBrowserAction(actionWithoutSite);
        }
        res.json(data);
    } catch (error) {
        console.error(error);
        logger.error(`执行浏览器操作失败: ${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};

// 获取浏览器页面 URL（用于 iframe）
export const getBrowserPageUrl = async (req, res) => {
    try {
        const { site } = req.query;
        let data;
        if (site === 'insightrackr') {
            data = await puppeteerServiceInsightrackr.getBrowserPageUrl();
        } else {
            data = await puppeteerService.getBrowserPageUrl();
        }
        res.json(data);
    } catch (error) {
        console.error(error);
        logger.error(`获取浏览器页面 URL 失败: ${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};

// 爬取 Insightrackr 页面
export const scrapeInsightrackrPage = async (req, res) => {
    try {
        const data = await puppeteerServiceInsightrackr.scrapePage();
        res.json(data);
    } catch (error) {
        console.error(error);
        logger.error(`爬取 Insightrackr 页面失败: ${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};

// 获取浏览器 WebSocket 端点（用于远程连接）
export const getBrowserWSEndpoint = async (req, res) => {
    try {
        const { site } = req.query;
        let wsEndpoint;
        
        if (site === 'insightrackr') {
            wsEndpoint = puppeteerServiceInsightrackr.getBrowserWSEndpoint();
        } else {
            wsEndpoint = puppeteerService.getBrowserWSEndpoint();
        }
        
        if (wsEndpoint) {
            res.json({
                data: { wsEndpoint },
                success: true,
                code: 200,
                message: '获取 WebSocket 端点成功'
            });
        } else {
            res.json({
                data: null,
                success: false,
                code: 'BROWSER_NOT_INITIALIZED',
                message: '浏览器未初始化'
            });
        }
    } catch (error) {
        console.error(error);
        logger.error(`获取浏览器 WebSocket 端点失败: ${error}`);
        res.status(200).json({ data: null, success: false, code: 500, message: error.message });
    }
};
