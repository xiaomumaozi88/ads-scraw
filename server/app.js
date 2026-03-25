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
import memoryLogAppender from './src/utils/memoryLogAppender.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置日志记录（main 输出到控制台，memory 写入内存供 /health 展示）
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
        memory: {
            type: memoryLogAppender,
            layout: { type: 'messagePassThrough' },
        },
    },
    categories: { default: { appenders: ['main', 'memory'], level: 'info' } },
});
global.logger = log4js.getLogger('insightrackr-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// todo 目前是 CORS 允许所有来源，生产环境需要限制来源
app.use(cors());
app.use(bodyParser.json());

// API 路由必须在静态兜底之前注册，否则 GET /api/* 会被下面的 * 匹配成 index.html
app.use('/api', apiRoutes);

// 静态文件服务 - 生产环境使用构建后的 React 应用
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '..', 'dist')));
    // 所有非 API 的非静态请求返回 React 应用（前端路由）
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

// 可选：定时重启浏览器以释放长期运行带来的 CPU/内存累积（不重启 Node 进程）
// 设置环境变量 BROWSER_RESTART_INTERVAL_HOURS=6 表示每 6 小时重启一次浏览器，设为 0 或不设则关闭
const browserRestartHours = parseInt(process.env.BROWSER_RESTART_INTERVAL_HOURS || '0', 10);
if (browserRestartHours > 0) {
    const intervalMs = browserRestartHours * 60 * 60 * 1000;
    setInterval(async () => {
        try {
            logger.info('定时重启浏览器以降低 CPU/内存占用...');
            await Promise.all([
                puppeteerServiceInsightrackr.closeBrowser(),
                puppeteerServiceGuangdada.closeBrowser()
            ]);
            await new Promise((r) => setTimeout(r, 2000)); // 等待进程完全退出
            await Promise.all([
                puppeteerServiceInsightrackr.initializeBrowser(),
                puppeteerServiceGuangdada.initializeBrowser()
            ]);
            logger.info('浏览器定时重启完成');
        } catch (err) {
            logger.error('浏览器定时重启失败:', err);
        }
    }, intervalMs);
    console.log(`已启用浏览器定时重启，间隔 ${browserRestartHours} 小时`);
}

// 启动服务器（记录启动时间，供 /health 页展示「上次启动时间」「窗口打开时长」）
app.listen(PORT, () => {
    global.serverStartTime = Date.now();
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
