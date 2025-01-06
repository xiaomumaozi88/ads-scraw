import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import log4js from 'log4js';
import cors from 'cors';
import apiRoutes from './src/routes/apiRoutes.js';
import dayjs from 'dayjs';
import * as puppeteerService from './src/services/puppeteerService.js';
import * as puppeteerServiceA3 from './src/services/puppeteerServiceA3.js';
dotenv.config();

// 配置日志记录
log4js.configure({
    appenders: {
        main: {
            type: 'stdout',
            layout: {
                type: 'pattern',
                pattern: '%x{date} %p [%c,1,2,false] %z --- [nio-4001-exec-1] server.index : %m%n',
                tokens: {
                    date: () => dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
                },
            },
        },
    },
    categories: { default: { appenders: ['main'], level: 'info' } },
});
global.logger = log4js.getLogger('gp-order-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// todo 目前是 CORS 允许所有来源，生产环境需要限制来源
app.use(cors());
app.use(bodyParser.json());

// 启动 Puppeteer 浏览器实例
(async () => {
    await puppeteerService.initializeBrowser();
    await puppeteerService.checkLoginStatus();
    // 定时检查登录状态，每隔 2 分钟（120000 毫秒）执行一次
    setInterval(async () => {
        const data = await puppeteerService.getStatus();
        logger.info(`自动更新t4f当前登录状态: ${data.status}`)
    }, 120000); // 每 2 分钟检查一次
})();

(async () => {
    await puppeteerServiceA3.initializeBrowser();
    await puppeteerServiceA3.checkLoginStatus();
    // 定时检查登录状态，每隔 2 分钟（120000 毫秒）执行一次
    setInterval(async () => {
        const data = await puppeteerServiceA3.getStatus();
        logger.info(`自动更新a3当前登录状态: ${data.status}`)
    }, 120000); // 每 2 分钟检查一次
})();


// 使用 API 路由
app.use('/api', apiRoutes);

// 启动服务器
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// 关闭浏览器实例
process.on('SIGINT', async () => {
    await puppeteerService.closeBrowser();
    await puppeteerServiceA3.closeBrowser();
    process.exit();
});
