import puppeteerBase from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from './logger.js';

let stealthReady = false;

function ensureStealthPlugin() {
  if (!stealthReady) {
    puppeteer.use(StealthPlugin());
    stealthReady = true;
  }
}

/** puppeteer-extra + stealth（全局单例注册） */
export function getStealthPuppeteer() {
  ensureStealthPlugin();
  return puppeteer;
}

export { puppeteerBase };

export const BROWSER_TIMEZONE = process.env.BROWSER_TIMEZONE?.trim() || 'Asia/Shanghai';
export const BROWSER_ACCEPT_LANGUAGE = process.env.BROWSER_ACCEPT_LANGUAGE?.trim() || 'zh-CN,zh;q=0.9,en;q=0.8';
export const BROWSER_LANGUAGES = Object.freeze(['zh-CN', 'zh', 'en']);

export const BROWSER_VIEWPORT = Object.freeze({
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  hasTouch: false,
  isLandscape: true,
  isMobile: false,
});

/** 与运行环境一致的固定 UA（Linux 生产 / macOS 本地） */
export function resolveBrowserUserAgent() {
  const fromEnv = process.env.BROWSER_USER_AGENT?.trim();
  if (fromEnv) return fromEnv;
  if (process.platform === 'darwin') {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }
  return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
}

/** 各平台 Chrome 启动时追加的反检测参数 */
export const ANTI_DETECTION_CHROME_ARGS = Object.freeze([
  '--disable-blink-features=AutomationControlled',
  '--window-size=1920,1080',
]);

/**
 * headless 解析：
 * - HEADLESS / PUPPETEER_HEADLESS 显式覆盖
 * - NODE_ENV=production 或远程生产（配置了非公网 localhost 的 APP_PUBLIC_BASE_URL）→ 默认无头
 * - 本地开发（含 npm start 且未配远程公网地址）→ 默认弹出 Chrome 便于在原站调试
 */
export function isRemoteDeployedServer() {
  const pub = (process.env.APP_PUBLIC_BASE_URL || '').trim();
  if (!pub) return false;
  try {
    const host = new URL(pub).hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      host.endsWith('.local');
    return !isLocal;
  } catch {
    return false;
  }
}

export function resolveStealthHeadless(defaultHeadless) {
  const v = process.env.HEADLESS ?? process.env.PUPPETEER_HEADLESS;
  if (v !== undefined && v !== '') {
    const s = String(v).trim().toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(s)) return false;
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  }
  if (process.env.NODE_ENV === 'production') {
    return defaultHeadless !== false;
  }
  if (isRemoteDeployedServer()) {
    return defaultHeadless !== false;
  }
  return false;
}

/** 合并 launch 选项：去 automation 标记、统一 headless、追加反检测 args */
export function enhanceLaunchOptions(baseOptions = {}) {
  const headless = resolveStealthHeadless(baseOptions.headless);
  const args = [...(baseOptions.args || [])];
  for (const arg of ANTI_DETECTION_CHROME_ARGS) {
    if (!args.includes(arg)) args.push(arg);
  }
  const ignore = new Set(['--enable-automation']);
  if (Array.isArray(baseOptions.ignoreDefaultArgs)) {
    baseOptions.ignoreDefaultArgs.forEach((a) => ignore.add(a));
  }
  return {
    ...baseOptions,
    headless,
    args,
    ignoreDefaultArgs: [...ignore],
  };
}

/** 页面级：固定时区 / UA / 语言 / 视口（stealth 负责 webdriver 等底层指纹） */
export async function applyPageAntiDetection(page) {
  if (!page) return;
  try {
    if (typeof page.isClosed === 'function' && page.isClosed()) return;
  } catch {
    /* ignore */
  }

  try {
    await page.emulateTimezone(BROWSER_TIMEZONE);
  } catch (err) {
    logger.warn('[AntiDetection] emulateTimezone 失败:', err.message);
  }

  await page.setUserAgent(resolveBrowserUserAgent());
  await page.setViewport({ ...BROWSER_VIEWPORT });
  await page.setExtraHTTPHeaders({
    'Accept-Language': BROWSER_ACCEPT_LANGUAGE,
    'Accept-Encoding': 'gzip, deflate, br',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
  });

  await page.evaluateOnNewDocument(({ languages }) => {
    Object.defineProperty(navigator, 'languages', { get: () => languages });
  }, { languages: [...BROWSER_LANGUAGES] });
}
