// src/config.js
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveChromeExecutablePath } from './utils/resolveChromeExecutablePath.js';
import {
  ANTI_DETECTION_CHROME_ARGS,
  resolveStealthHeadless,
} from './utils/browserAntiDetection.js';

const __configDir = path.dirname(fileURLToPath(import.meta.url));
/** 仓库根目录（含 `tmp/`）。Puppeteer 的 userDataDir 必须锚定在此，否则相对路径会随 `process.cwd()` 变化，Chrome 每次像新用户一样需重新登录 */
export const REPO_ROOT = path.resolve(__configDir, '..', '..');

function chromeProfileDir(subdir) {
    return path.join(REPO_ROOT, 'tmp', subdir);
}

/** 各 Puppeteer 实例共用；按本机解析，避免 macOS 上使用 npm start（NODE_ENV=production）时仍指向 Linux 的 /usr/bin/google-chrome */
const CHROME_EXECUTABLE_PATH = resolveChromeExecutablePath();

/**
 * 是否无头模式。远程生产（APP_PUBLIC_BASE_URL 指向公网）默认无界面；
 * 本地开发（含 npm start）默认弹出 Chrome，可用 HEADLESS=true 强制无头。
 */
/** Chrome 启动时默认简体中文（UI 语言 + Accept-Language 偏好） */
export const CHROME_ZH_CN_LAUNCH_ARGS = [
  '--lang=zh-CN',
  '--accept-lang=zh-CN,zh;q=0.9,en;q=0.8',
];

export function resolvePuppeteerHeadless(defaultForThisProfile) {
  return resolveStealthHeadless(defaultForThisProfile);
}

export function chromeLaunchArgs(extra = []) {
  return [...CHROME_ZH_CN_LAUNCH_ARGS, ...ANTI_DETECTION_CHROME_ARGS, ...extra];
}

// 广大大使用的配置（userDataDir 独立，避免与 Insightrackr 冲突）
export const puppeteerOptions = process.env.NODE_ENV !== 'development' ? {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(true), // 是否不打开浏览器
    userDataDir: chromeProfileDir('guangdada_spider_usr_dir'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: chromeLaunchArgs([
        '--no-sandbox',
        '--disable-client-side-phishing-detection',
        '--disable-setuid-sandbox',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        // 降低空闲时 CPU 占用（生产环境无界面）
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-session-crashed-bubble',
        '--noerrdialogs',
        // '--single-process',
    ]),
} : {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(false), // 是否不打开浏览器
    userDataDir: chromeProfileDir('guangdada_spider_usr_dir'),
    // macOS Chrome 路径
    executablePath: CHROME_EXECUTABLE_PATH,
    args: chromeLaunchArgs([
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled', // 禁用自动化控制特征
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        '--window-size=1920,1080',
        // '--single-process',
        // '--disable-gpu',
    ]),
};

// Insightrackr 使用的配置（独立 userDataDir，与广大大分开，避免双平台同时登录时第二个浏览器启动失败）
export const puppeteerOptionsInsightrackr = process.env.NODE_ENV !== 'development' ? {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(true),
    userDataDir: chromeProfileDir('insightrackr_spider_usr_dir'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: chromeLaunchArgs([
        '--no-sandbox',
        '--disable-client-side-phishing-detection',
        '--disable-setuid-sandbox',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        // 降低空闲时 CPU 占用（生产环境无界面）
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-session-crashed-bubble',
        '--noerrdialogs',
    ]),
} : {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(false),
    userDataDir: chromeProfileDir('insightrackr_spider_usr_dir'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: chromeLaunchArgs([
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        '--window-size=1920,1080',
    ]),
};

// Sensor Tower（独立 userDataDir，与 Insightrackr / 广大大分开）
export const puppeteerOptionsSensorTower = process.env.NODE_ENV !== 'development' ? {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(true),
    userDataDir: chromeProfileDir('sensortower_spider_usr_dir'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: chromeLaunchArgs([
        '--no-sandbox',
        '--disable-client-side-phishing-detection',
        '--disable-setuid-sandbox',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-session-crashed-bubble',
        '--noerrdialogs',
    ]),
} : {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(false),
    userDataDir: chromeProfileDir('sensortower_spider_usr_dir'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: chromeLaunchArgs([
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        '--window-size=1920,1080',
    ]),
};

// src/config.js
export const puppeteerOptionsA3 = process.env.NODE_ENV !== 'development' ? {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(true), // 是否不打开浏览器
    userDataDir: chromeProfileDir('gpc_order_spider_usr_dir3_a3'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: [
        '--no-sandbox',
        '--disable-client-side-phishing-detection',
        '--disable-setuid-sandbox',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        // '--single-process',
        // '--disable-gpu',
    ],
} : {
    defaultViewport: {
        width: 1920,
        height: 1280,
    },
    headless: resolvePuppeteerHeadless(false), // 是否不打开浏览器
    userDataDir: chromeProfileDir('gpc_order_spider_usr_dir3_a3'),
    executablePath: CHROME_EXECUTABLE_PATH,
    args: [
        '--no-sandbox',
        '--disable-client-side-phishing-detection',
        '--disable-setuid-sandbox',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-speech-api',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-zygote',
        // '--single-process',
        // '--disable-gpu',
    ],
};

/** 国内版 BBA（iframe-cn / bbaapi）代理目标与鉴权；不写入前端 */
export const bbaApiBase = process.env.BBA_API_BASE || 'https://bba.ttads.net';
export const bbaApiAuthorization = process.env.BBA_API_AUTHORIZATION || '';
/** 可选：官网 ad-info 常带 Cookie（如 tfstk=...），缺省时部分账号会返回 40001 */
export const bbaApiCookie = process.env.BBA_API_COOKIE || '';
