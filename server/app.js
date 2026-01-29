import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import log4js from 'log4js';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './src/routes/apiRoutes.js';
import dayjs from 'dayjs';
import * as puppeteerServiceInsightrackr from './src/services/puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from './src/services/puppeteerService.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
global.logger = log4js.getLogger('insightrackr-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// todo 目前是 CORS 允许所有来源，生产环境需要限制来源
app.use(cors());
app.use(bodyParser.json());

// 静态文件服务 - 生产环境使用构建后的 React 应用
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '..', 'dist')));
    // 所有非 API 路由返回 React 应用
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
    });
}

// 启动 Puppeteer 浏览器实例（Insightrackr + 广大大各一个）
(async () => {
    try {
        console.log('正在初始化浏览器...');
        await Promise.all([
            puppeteerServiceInsightrackr.initializeBrowser(),
            puppeteerServiceGuangdada.initializeBrowser()
        ]);
        console.log('浏览器初始化完成');
    } catch (error) {
        console.error('浏览器初始化失败:', error);
        logger.error('浏览器初始化失败:', error);
    }
})();


// 使用 API 路由
app.use('/api', apiRoutes);

// 启动服务器
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// 关闭浏览器实例
process.on('SIGINT', async () => {
    await Promise.all([
        puppeteerServiceInsightrackr.closeBrowser(),
        puppeteerServiceGuangdada.closeBrowser()
    ]);
    process.exit();
});
