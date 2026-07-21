import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './src/routes/apiRoutes.js';
import { handleIamEntry } from './src/controllers/iam/entryController.js';
import { validateIamConfig, isIamDevBypass } from './src/config/iam.js';
import { puppeteerOptionsSensorTower } from './src/config.js';
import { isRemoteDeployedServer } from './src/utils/browserAntiDetection.js';
import * as puppeteerServiceInsightrackr from './src/services/puppeteerServiceInsightrackr.js';
import * as puppeteerServiceGuangdada from './src/services/puppeteerService.js';
import * as puppeteerServiceSensorTower from './src/services/puppeteerServiceSensorTower.js';
import { logger } from './src/utils/logger.js';
import { initDatabase } from './src/db/pool.js';
import { initTranscodeQueue } from './src/services/transcodeVideoService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (corsOrigins.length > 0) {
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    })
  );
} else if (process.env.NODE_ENV === 'development') {
  const devOrigin = (process.env.DEV_CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  app.use(
    cors({
      origin(origin, callback) {
        // 无 Origin：同源或 server-side 请求
        if (!origin) return callback(null, true);
        if (origin === devOrigin) return callback(null, true);
        try {
          const u = new URL(origin);
          const host = u.hostname;
          const port = u.port || (u.protocol === 'https:' ? '443' : '80');
          // 允许 localhost / 127.0.0.1 / 局域网 IP 访问 Vite(5173) 或直连 API(3000)
          const isLocalHost = host === 'localhost' || host === '127.0.0.1';
          const isLan = /^192\.168\.\d+\.\d+$/.test(host) || /^10\.\d+\.\d+\.\d+$/.test(host);
          if ((isLocalHost || isLan) && (port === '5173' || port === '3000')) {
            return callback(null, true);
          }
        } catch {
          /* ignore */
        }
        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );
} else {
  app.use(cors());
}
// 广大大多模态搜索可把整段 data URL 放在 JSON 里，需单独放宽体积；其余接口仍用较小上限
const jsonParserDefault = express.json({ limit: '2mb' });
const jsonParserGuangdadaMultimodal = express.json({ limit: '80mb' });
app.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/api/catalog/g1/multi-modal-search') {
        return jsonParserGuangdadaMultimodal(req, res, next);
    }
    return jsonParserDefault(req, res, next);
});

// 门户快速登录入口（必须在静态兜底之前）
app.get('/sso/iam-entry', handleIamEntry);

// API 路由必须在静态兜底之前注册，否则 GET /api/* 会被下面的 * 匹配成 index.html
app.use('/api', apiRoutes);

// 开发环境：Express 不托管前端静态资源（由 Vite 5173 提供），避免访问 :3000 根路径出现 Cannot GET /
if (process.env.NODE_ENV !== 'production') {
    const devClientBase = (process.env.DEV_CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (req.path.startsWith('/api')) return next();
        return res.redirect(302, devClientBase + req.originalUrl);
    });
}

// 静态文件服务 - 生产环境使用构建后的 React 应用
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '..', 'dist')));
    // 所有非 API 的非静态请求返回 React 应用（前端路由）
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
    });
}

// 启动 Puppeteer 浏览器实例（Insightrackr + 广大大 + Sensor Tower 各一）
(async () => {
    try {
        console.log('正在初始化浏览器...');
        await Promise.all([
            puppeteerServiceInsightrackr.initializeBrowser(),
            puppeteerServiceGuangdada.initializeBrowser(),
            puppeteerServiceSensorTower.initializeBrowser(),
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
                puppeteerServiceGuangdada.closeBrowser(),
                puppeteerServiceSensorTower.closeBrowser(),
            ]);
            await new Promise((r) => setTimeout(r, 2000)); // 等待进程完全退出
            await Promise.all([
                puppeteerServiceInsightrackr.initializeBrowser(),
                puppeteerServiceGuangdada.initializeBrowser(),
                puppeteerServiceSensorTower.initializeBrowser(),
            ]);
            logger.info('浏览器定时重启完成');
        } catch (err) {
            logger.error('浏览器定时重启失败:', err);
        }
    }, intervalMs);
    console.log(`已启用浏览器定时重启，间隔 ${browserRestartHours} 小时`);
}

// 启动服务器（记录启动时间，供 /health 页展示「上次启动时间」「窗口打开时长」）
const iamMissing = validateIamConfig();
if (iamMissing.length > 0) {
  console.warn(`[IAM] 缺少必要配置: ${iamMissing.join(', ')} — 门户 SSO 登录将不可用，请配置 .env 后重启`);
}
if (isIamDevBypass()) {
  console.warn('[IAM] 本地开发 bypass 已启用（IAM_DEV_BYPASS=true），跳过门户 SSO');
}
if (!puppeteerOptionsSensorTower.headless) {
  console.warn('[Browser] 本地可视模式：Insightrackr / 广大大 / Sensor Tower 将弹出 Chrome 窗口（远程生产或 HEADLESS=true 时关闭）');
} else if (isRemoteDeployedServer()) {
  console.log('[Browser] 远程生产模式：Chrome 无头运行');
}

initDatabase()
  .then(() => initTranscodeQueue())
  .then(() => {
    app.listen(PORT, () => {
      global.serverStartTime = Date.now();
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('数据库/转码队列初始化失败:', err);
    app.listen(PORT, () => {
      global.serverStartTime = Date.now();
      console.log(`Server is running on http://localhost:${PORT} (存储初始化异常，已回退)`);
    });
  });

// 关闭浏览器实例
process.on('SIGINT', async () => {
    await Promise.all([
        puppeteerServiceInsightrackr.closeBrowser(),
        puppeteerServiceGuangdada.closeBrowser(),
        puppeteerServiceSensorTower.closeBrowser(),
    ]);
    process.exit();
});
