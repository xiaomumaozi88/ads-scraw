// src/app.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import apiRoutes from './src/routes/apiRoutes.js';
import * as puppeteerService from './src/services/puppeteerService.js';


const app = express();
const PORT = process.env.PORT || 3000;

// todo 目前是 CORS 允许所有来源，生产环境需要限制来源
app.use(cors());
app.use(bodyParser.json());

// 启动 Puppeteer 浏览器实例
(async () => {
    await puppeteerService.initializeBrowser();
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
    process.exit();
});
