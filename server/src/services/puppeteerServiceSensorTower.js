import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { puppeteerOptionsSensorTower, REPO_ROOT, chromeLaunchArgs } from '../config.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { LoginStatus } from '../constants/index.js';
import { logger } from '../utils/logger.js';
import { resolveChromeExecutablePath } from '../utils/resolveChromeExecutablePath.js';
import {
    isSingletonLockLaunchError,
    prepareChromeUserDataDirForLaunch,
} from '../utils/removeChromeUserDataSingletonLocks.js';

puppeteer.use(StealthPlugin());

const SENSORTOWER_APP_ORIGIN = 'https://app.sensortower-china.com';
const SENSOR_TOWER_LOCALE = 'zh-CN';

function isSensorTowerAppHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') return false;
    return (
        hostname === 'app.sensortower-china.com' ||
        hostname === 'app.sensortower.com' ||
        hostname.endsWith('.sensortower-china.com')
    );
}

/**
 * 为 Sensor Tower 站内 URL 统一附加 locale=zh-CN（已有则覆盖为 zh-CN）
 */
function withSensorTowerLocale(url) {
    if (!url || typeof url !== 'string') return url;
    const parsed = parseUrlSafe(url.trim());
    if (!parsed || !isSensorTowerAppHostname(parsed.hostname)) return url;
    parsed.searchParams.set('locale', SENSOR_TOWER_LOCALE);
    return parsed.toString();
}

const LOGIN_URL = withSensorTowerLocale(`${SENSORTOWER_APP_ORIGIN}/users/sign_in`);
const DEFAULT_GALLERY_URL = withSensorTowerLocale(
    process.env.SENSORTOWER_DEFAULT_GALLERY_URL ||
        `${SENSORTOWER_APP_ORIGIN}/app-analysis/creative-gallery`
);
const DEFAULT_IMPRESSION_SHARE_URL = withSensorTowerLocale(
    `${SENSORTOWER_APP_ORIGIN}/app-analysis/impression-share`
);

const IMPRESSION_SHARE_QUERY_IDS = new Set([
    'impression_share_chart',
    'impression_share_table',
]);

function isImpressionShareQueryId(queryIdentifier) {
    return IMPRESSION_SHARE_QUERY_IDS.has(String(queryIdentifier || '').trim());
}

function isTargetImpressionShareUrl(url) {
    const current = parseUrlSafe(url);
    if (!current) return false;
    return (
        isSensorTowerAppHostname(current.hostname) &&
        current.pathname === '/app-analysis/impression-share'
    );
}

const selectors = {
    email: '#email',
    password: '#password',
    otp: '#otp_attempt',
    form: 'form#new_user',
    submit: 'form#new_user input[type="submit"].btn-primary',
};

let browser;
let loginPage;
/** 防止 nodemon 并发多次 initializeBrowser 争抢同一 userDataDir */
let initializeBrowserPromise = null;
/** 最近一次启动浏览器失败原因，便于接口返回与排查 */
let lastSensorTowerLaunchError = null;
let lastPassiveDetectAt = 0;

const loginInfo = {
    cookies: null,
    email: null,
    sessionSnapshot: null,
    sessionSnapshotSavedAt: null,
};

const status = {
    current: LoginStatus.LOGGED_OUT,
    update(newStatus) {
        this.current = newStatus;
        logger.info(`[Sensor Tower] 当前状态: ${this.current}`);
    },
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const SESSION_SNAPSHOT_DIR = path.join(REPO_ROOT, 'tmp', 'sensortower');
const SESSION_SNAPSHOT_FILE = path.join(SESSION_SNAPSHOT_DIR, 'session-snapshot.json');

function attachSensorTowerLocaleGuard(page) {
    if (page._stLocaleGuardAttached) return;
    page._stLocaleGuardAttached = true;
    let fixing = false;
    let localeFixCount = 0;
    const MAX_LOCALE_FIX = 5;

    page.on('framenavigated', async (frame) => {
        if (frame !== page.mainFrame() || fixing || page.isClosed()) return;
        if (localeFixCount >= MAX_LOCALE_FIX) return;
        try {
            const raw = frame.url();
            const parsed = parseUrlSafe(raw);
            if (!parsed || !isSensorTowerAppHostname(parsed.hostname)) return;
            if (parsed.searchParams.get('locale') === SENSOR_TOWER_LOCALE) return;
            const next = withSensorTowerLocale(raw);
            if (next === raw) return;
            fixing = true;
            localeFixCount += 1;
            await gotoSensorTowerPage(page, next).catch(() => {});
        } finally {
            fixing = false;
        }
    });
}

async function gotoSensorTowerPage(page, url, options = {}) {
    const target = withSensorTowerLocale(url);
    const timeout = options.timeout ?? 120000;
    const waitUntil = options.waitUntil ?? 'domcontentloaded';
    try {
        await page.goto(target, { timeout, waitUntil });
    } catch (e) {
        if (!options.fallbackWaitUntil) throw e;
        await page.goto(target, { timeout, waitUntil: options.fallbackWaitUntil });
    }
    return page.url();
}

async function setupAntiDetection(page) {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {}, loadTimes: function () {}, csi: function () {}, app: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    });
    await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
    });
    attachSensorTowerLocaleGuard(page);
    attachCsrfCapture(page);
}

/** 从同源 API 响应头缓存 x-csrf-token（与官方后台 fetch 行为一致） */
function attachCsrfCapture(page) {
    if (page._stCsrfCaptureAttached) return;
    page._stCsrfCaptureAttached = true;
    if (!page._stCsrfToken) page._stCsrfToken = '';

    page.on('response', (response) => {
        try {
            const url = response.url();
            if (!url.includes('sensortower')) return;
            const headers = response.headers();
            const token =
                headers['x-csrf-token'] ||
                headers['X-CSRF-Token'] ||
                headers['x-csrf-token'.toLowerCase()] ||
                '';
            if (token && token.length >= 16) {
                page._stCsrfToken = token;
            }
        } catch (_) {
            /* ignore */
        }
    });
}

function stripLaunchUndefined(obj) {
    const o = { ...obj };
    Object.keys(o).forEach((k) => {
        if (o[k] === undefined || o[k] === '') delete o[k];
    });
    return o;
}

/**
 * 首轮启动：可执行文件须存在于磁盘；否则用 channel 调用本机已安装的 Chrome（不依赖 PUPPETEER 自带 Chromium 是否已下载）。
 */
function buildSensorTowerPrimaryLaunchOptions() {
    const st = puppeteerOptionsSensorTower;
    const o = { ...st };
    let ex = o.executablePath;
    if (ex && !fs.existsSync(ex)) delete o.executablePath;
    if (!o.executablePath) {
        const r = resolveChromeExecutablePath();
        if (r && fs.existsSync(r)) o.executablePath = r;
    }
    if (!o.executablePath || (o.executablePath && !fs.existsSync(o.executablePath))) {
        delete o.executablePath;
        o.channel = 'chrome';
    }
    return stripLaunchUndefined(o);
}

function buildSensorTowerFallbackLaunchOptions() {
    const opt = puppeteerOptionsSensorTower;
    let executablePath = opt.executablePath;
    if (!executablePath || !fs.existsSync(executablePath)) {
        executablePath = resolveChromeExecutablePath();
    }
    const out = {
        headless: opt.headless !== undefined ? opt.headless : process.env.NODE_ENV === 'production',
        userDataDir: opt.userDataDir,
        executablePath,
        args: chromeLaunchArgs([
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
            '--no-zygote',
            '--no-first-run',
            '--no-default-browser-check',
        ]),
        defaultViewport: opt.defaultViewport || { width: 1920, height: 1280 },
    };
    if (!out.executablePath || !fs.existsSync(out.executablePath)) {
        delete out.executablePath;
        out.channel = 'chrome';
    }
    return stripLaunchUndefined(out);
}

/** 仅 channel + 精简参数，避免与首次尝试完全重复时可再走一轮 */
function buildSensorTowerChannelOnlyLaunchOptions() {
    const opt = puppeteerOptionsSensorTower;
    const fb = buildSensorTowerFallbackLaunchOptions();
    return stripLaunchUndefined({
        headless: fb.headless,
        userDataDir: opt.userDataDir,
        defaultViewport: fb.defaultViewport,
        args: fb.args,
        channel: 'chrome',
    });
}

/** 最后尝试：不显式指定浏览器，使用 Puppeteer 默认（自带 Chromium，若已下载） */
function buildSensorTowerBundledOnlyLaunchOptions() {
    const opt = puppeteerOptionsSensorTower;
    const fb = buildSensorTowerFallbackLaunchOptions();
    return stripLaunchUndefined({
        headless: fb.headless,
        userDataDir: opt.userDataDir,
        defaultViewport: fb.defaultViewport,
        args: fb.args,
    });
}

function logBrowserLaunchError(label, err) {
    logger.error(`${label}:`, err?.message || err);
    if (err?.stack) logger.error(`${label} stack:`, err.stack);
}

async function afterSensorTowerBrowserLaunched() {
    if (!browser) return;
    try {
        await browser.defaultBrowserContext().overridePermissions(`${SENSORTOWER_APP_ORIGIN}/`, [
            'clipboard-read',
            'clipboard-write',
        ]);
    } catch (e) {
        logger.warn('[Sensor Tower] overridePermissions:', e.message);
    }
}

const SENSOR_TOWER_PROFILE_CLOSE_MS = Math.max(
    0,
    parseInt(process.env.BROWSER_PROFILE_CLOSE_DELAY_MS || '800', 10)
);

function attachSensorTowerDebugPort(launchOpts) {
    const debugPort = process.env.CHROME_REMOTE_DEBUGGING_PORT_SENSORTOWER;
    if (!debugPort) return launchOpts;
    const o = { ...launchOpts, args: [...(launchOpts.args || []), `--remote-debugging-port=${debugPort}`] };
    logger.info('[Sensor Tower] 远程调试端口:', debugPort);
    return o;
}

async function doInitializeSensorTowerBrowser() {
    if (browser) {
        try {
            await browser.close();
        } catch (e) {
            logger.warn('关闭旧 Sensor Tower 浏览器失败:', e.message);
        }
        browser = null;
    }
    if (SENSOR_TOWER_PROFILE_CLOSE_MS > 0) {
        await delay(SENSOR_TOWER_PROFILE_CLOSE_MS);
    }
    prepareChromeUserDataDirForLaunch(puppeteerOptionsSensorTower.userDataDir);
    await delay(350);

    lastSensorTowerLaunchError = null;
    const attempts = [
        { name: 'primary', build: buildSensorTowerPrimaryLaunchOptions },
        { name: 'fallback-minimal', build: buildSensorTowerFallbackLaunchOptions },
        { name: 'channel-only', build: buildSensorTowerChannelOnlyLaunchOptions },
        { name: 'bundled-default', build: buildSensorTowerBundledOnlyLaunchOptions },
    ];

    for (let i = 0; i < attempts.length; i++) {
        try {
            if (i > 0) {
                prepareChromeUserDataDirForLaunch(puppeteerOptionsSensorTower.userDataDir);
                await delay(400);
            }
            let launchOpts = attempts[i].build();
            launchOpts = attachSensorTowerDebugPort(launchOpts);
            browser = await puppeteer.launch(launchOpts);
            await browser.version();
            await afterSensorTowerBrowserLaunched();
            logger.info(`[Sensor Tower] 浏览器已启动（${attempts[i].name}，第 ${i + 1}/${attempts.length} 种配置）`);
            return;
        } catch (e) {
            lastSensorTowerLaunchError = e?.message || String(e);
            logBrowserLaunchError(`[Sensor Tower] 启动失败 [${attempts[i].name}]`, e);
            browser = null;
            if (isSingletonLockLaunchError(e)) {
                logger.warn('[Sensor Tower] 检测到 profile 单例锁冲突，清理后重试…');
                prepareChromeUserDataDirForLaunch(puppeteerOptionsSensorTower.userDataDir);
                await delay(500);
            }
        }
    }
    logger.error('[Sensor Tower] 全部启动方式均失败，最后错误:', lastSensorTowerLaunchError);
}

export const initializeBrowser = async () => {
    if (initializeBrowserPromise) {
        return initializeBrowserPromise;
    }
    initializeBrowserPromise = doInitializeSensorTowerBrowser().finally(() => {
        initializeBrowserPromise = null;
    });
    return initializeBrowserPromise;
};

export const closeBrowser = async () => {
    loginPage = null;
    if (!browser) return;
    try {
        await browser.close();
    } catch (e) {
        logger.warn('关闭 Sensor Tower 浏览器失败:', e.message);
    }
    browser = null;
    if (SENSOR_TOWER_PROFILE_CLOSE_MS > 0) {
        await delay(SENSOR_TOWER_PROFILE_CLOSE_MS);
    }
    prepareChromeUserDataDirForLaunch(puppeteerOptionsSensorTower.userDataDir);
};

function getLoginInfo() {
    return {
        email: loginInfo.email,
        isLoggedIn: status.current === LoginStatus.ONLINE,
    };
}

async function checkBrowserConnection() {
    if (!browser) return false;
    try {
        await browser.version();
        return true;
    } catch (error) {
        logger.error('[Sensor Tower] 浏览器连接断开:', error.message);
        try {
            await browser.close();
        } catch (_) {}
        browser = null;
        return false;
    }
}

/** 关闭除 keepPage 外的标签页 */
async function closeOtherPages(keepPage) {
    if (!browser || !keepPage) return;
    try {
        const pages = await browser.pages();
        for (const p of pages) {
            if (p !== keepPage && !p.isClosed()) await p.close().catch(() => {});
        }
    } catch (e) {
        logger.warn('[Sensor Tower] closeOtherPages:', e.message);
    }
}

function isSignInUrl(url) {
    return typeof url === 'string' && url.includes('/users/sign_in');
}

function isNewDeviceUrl(url) {
    return typeof url === 'string' && url.includes('/users/new-device');
}

function parseUrlSafe(url) {
    try {
        return new URL(url);
    } catch {
        return null;
    }
}

function collectSearchParamsMultiMap(urlObj) {
    const map = new Map();
    for (const [k, v] of urlObj.searchParams.entries()) {
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(v);
    }
    for (const arr of map.values()) arr.sort();
    return map;
}

/**
 * creative-gallery 页面判定：
 * - 只要求在 app-analysis/creative-gallery 页面（忽略 query）
 */
function isTargetCreativeGalleryUrl(url) {
    const current = parseUrlSafe(url);
    if (!current) return false;
    return current.origin === SENSORTOWER_APP_ORIGIN && current.pathname === '/app-analysis/creative-gallery';
}

async function hasLoginForm(page) {
    try {
        return await page.evaluate(() => {
            const form = document.querySelector('form#new_user');
            const email = document.querySelector('#email');
            return !!(form || email);
        });
    } catch {
        return false;
    }
}

/**
 * 等待登录态相关跳转稳定：
 * - 可能先落到业务页，随后被 302/前端路由重定向回 /users/sign_in
 * - 不能只看一次 url，否则会把“短暂业务页”误判为已登录
 */
async function waitForAuthRouteToStabilize(page, options = {}) {
    const timeoutMs = options.timeoutMs ?? 9000;
    const stableCountNeeded = options.stableCountNeeded ?? 3;
    const pollMs = options.pollMs ?? 450;
    const deadline = Date.now() + timeoutMs;

    let lastUrl = '';
    let stableCount = 0;
    while (Date.now() < deadline) {
        const u = page.url();
        if (u === lastUrl) {
            stableCount += 1;
        } else {
            stableCount = 1;
            lastUrl = u;
        }
        if (stableCount >= stableCountNeeded) break;
        await delay(pollMs);
    }
    return page.url();
}

async function isOtpVisible(page) {
    try {
        return await page.evaluate(() => {
            const wrap = document.querySelector('.otp-container');
            if (!wrap) return false;
            const style = window.getComputedStyle(wrap);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
    } catch {
        return false;
    }
}

async function waitSubmitEnabled(page, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await page.evaluate(() => {
            const btn = document.querySelector('form#new_user input[type="submit"].btn-primary');
            return !!(btn && !btn.disabled);
        });
        if (ok) return;
        await delay(200);
    }
    throw new Error('提交按钮长时间不可用，请检查邮箱格式或页面是否加载完整');
}

async function clickFormSubmit(page) {
    await waitSubmitEnabled(page);
    await page.click(selectors.submit);
    await delay(400);
}

async function gotoCreativeGallery(page) {
    await gotoSensorTowerPage(page, DEFAULT_GALLERY_URL, {
        waitUntil: 'networkidle2',
        fallbackWaitUntil: 'domcontentloaded',
    }).catch(async () => {
        await gotoSensorTowerPage(page, DEFAULT_GALLERY_URL);
    });
    await waitForAuthRouteToStabilize(page, { timeoutMs: 8000, stableCountNeeded: 2, pollMs: 400 });
    return page.url();
}

/**
 * 登录判定规则：
 * 跳到目标 creative-gallery 后，连续 5 秒未跳转到其它页面，才视为已登录。
 */
async function confirmGalleryStableForLogin(page, timeoutMs = 5000) {
    const firstUrl = page.url();
    if (!isTargetCreativeGalleryUrl(firstUrl)) return { ok: false, finalUrl: firstUrl };
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        await delay(300);
        const cur = page.url();
        if (isSignInUrl(cur) || isNewDeviceUrl(cur) || !isTargetCreativeGalleryUrl(cur)) {
            return { ok: false, finalUrl: cur };
        }
    }
    return { ok: true, finalUrl: page.url() };
}

async function buildSessionSnapshot(page) {
    const [cookies, storage] = await Promise.all([
        page.cookies().catch(() => []),
        page
            .evaluate(() => {
                const readStorage = (target) => {
                    const out = {};
                    try {
                        for (let i = 0; i < target.length; i += 1) {
                            const key = target.key(i);
                            if (!key) continue;
                            out[key] = target.getItem(key);
                        }
                    } catch (_) {}
                    return out;
                };
                return {
                    localStorage: readStorage(window.localStorage),
                    sessionStorage: readStorage(window.sessionStorage),
                    href: window.location.href,
                    origin: window.location.origin,
                    title: document.title,
                    userAgent: navigator.userAgent,
                };
            })
            .catch(() => ({
                localStorage: {},
                sessionStorage: {},
                href: '',
                origin: '',
                title: '',
                userAgent: '',
            })),
    ]);
    return {
        capturedAt: new Date().toISOString(),
        cookies,
        ...storage,
    };
}

async function captureAndPersistSessionSnapshot(page) {
    const snapshot = await buildSessionSnapshot(page);
    loginInfo.cookies = snapshot.cookies;
    loginInfo.sessionSnapshot = snapshot;
    loginInfo.sessionSnapshotSavedAt = snapshot.capturedAt;
    try {
        await fsPromises.mkdir(SESSION_SNAPSHOT_DIR, { recursive: true });
        await fsPromises.writeFile(SESSION_SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (e) {
        logger.warn('[Sensor Tower] 保存 session snapshot 失败:', e.message);
    }
    return snapshot;
}

async function readCsrfTokenFromPage(page) {
    try {
        const token = await page.evaluate(() => {
            const fromMeta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            if (fromMeta) return fromMeta;

            const fromData =
                document.querySelector('[data-csrf-token]')?.getAttribute('data-csrf-token') ||
                document.querySelector('[data-csrf]')?.getAttribute('data-csrf') ||
                '';
            if (fromData) return fromData;

            const fromInput =
                document.querySelector('input[name="authenticity_token"]')?.value ||
                document.querySelector('input[name="csrf-token"]')?.value ||
                '';
            if (fromInput) return fromInput;

            const readStorage = (store) => {
                try {
                    return (
                        store.getItem('csrfToken') ||
                        store.getItem('csrf-token') ||
                        store.getItem('X-CSRF-TOKEN') ||
                        ''
                    );
                } catch {
                    return '';
                }
            };
            const fromStorage =
                readStorage(window.sessionStorage) || readStorage(window.localStorage) || '';
            if (fromStorage) return fromStorage;

            const cookieMap = Object.fromEntries(
                document.cookie
                    .split(';')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((p) => {
                        const idx = p.indexOf('=');
                        const k = idx >= 0 ? p.slice(0, idx) : p;
                        const v = idx >= 0 ? p.slice(idx + 1) : '';
                        return [k, decodeURIComponent(v)];
                    })
            );
            const fromCookie =
                cookieMap['XSRF-TOKEN'] ||
                cookieMap['x-csrf-token'] ||
                cookieMap['csrf-token'] ||
                cookieMap['_csrf'] ||
                '';
            if (fromCookie) return fromCookie;

            const fromGlobalCandidates = [
                window.__CSRF_TOKEN__,
                window.csrfToken,
                window.CSRF_TOKEN,
                window?.gon?.csrf_token,
                window?.app?.csrfToken,
                window?.App?.csrfToken,
            ].filter(Boolean);
            if (fromGlobalCandidates.length) return String(fromGlobalCandidates[0] || '');

            const scriptText = Array.from(document.scripts || [])
                .map((s) => s.textContent || '')
                .join('\n');
            const patterns = [
                /csrf(?:_|-)?token["']?\s*[:=]\s*["']([^"']{16,})["']/i,
                /"x-csrf-token"\s*:\s*"([^"]{16,})"/i,
                /x-csrf-token['"]\s*,\s*['"]([^'"]{16,})['"]/i,
            ];
            for (const re of patterns) {
                const m = scriptText.match(re);
                if (m?.[1]) return m[1];
            }

            return '';
        });
        return String(token || '').trim();
    } catch {
        return '';
    }
}

async function readCsrfTokenFromBrowserCookies(page) {
    try {
        const cookies = await page.cookies(SENSORTOWER_APP_ORIGIN);
        for (const c of cookies) {
            if (!/csrf|xsrf/i.test(c.name)) continue;
            const v = String(c.value || '').trim();
            if (v.length >= 16) return decodeURIComponent(v);
        }
    } catch (_) {
        /* ignore */
    }
    return '';
}

async function resolveCsrfToken(page) {
    attachCsrfCapture(page);
    const cached = String(page._stCsrfToken || '').trim();
    if (cached.length >= 16) return cached;

    const fromDom = await readCsrfTokenFromPage(page);
    if (fromDom.length >= 16) {
        page._stCsrfToken = fromDom;
        return fromDom;
    }

    const fromCookies = await readCsrfTokenFromBrowserCookies(page);
    if (fromCookies.length >= 16) {
        page._stCsrfToken = fromCookies;
        return fromCookies;
    }

    return '';
}

async function ensureCsrfTokenOnPage(page) {
    let token = await resolveCsrfToken(page);
    if (token) return token;

    await page
        .reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
        .catch(() => {});
    await delay(600);

    await page
        .waitForFunction(
            () => {
                const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (meta && meta.length >= 16) return true;
                const g = window.__CSRF_TOKEN__ || window.csrfToken || window?.gon?.csrf_token;
                return !!(g && String(g).length >= 16);
            },
            { timeout: 15000 }
        )
        .catch(() => {});

    token = await resolveCsrfToken(page);
    if (token) return token;

    await fetchSensorTowerApi(page, {
        method: 'GET',
        endpoint: '/api/unified/search_entities?entity_type=app&term=a&limit=1',
        skipCsrfEnsure: true,
    });
    return resolveCsrfToken(page);
}

/**
 * 进入创意库并等待页面注入 CSRF（官方 POST /api/creatives/facets 须带 x-csrf-token）
 */
async function ensureCsrfTokenReady(page) {
    let token = await resolveCsrfToken(page);
    if (token) return token;

    const onGallery = isTargetCreativeGalleryUrl(page.url());
    if (!onGallery) {
        await gotoCreativeGallery(page);
    } else {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
        await delay(600);
    }

    await page
        .waitForFunction(
            () => {
                const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (meta && meta.length >= 16) return true;
                const g = window.__CSRF_TOKEN__ || window.csrfToken || window?.gon?.csrf_token;
                return !!(g && String(g).length >= 16);
            },
            { timeout: 15000 }
        )
        .catch(() => {});

    token = await resolveCsrfToken(page);
    if (token) return token;

    // 轻量同源 GET，便于从响应头捕获 x-csrf-token
    await fetchSensorTowerApi(page, {
        method: 'GET',
        endpoint: '/api/unified/search_entities?entity_type=app&term=a&limit=1',
        skipCsrfEnsure: true,
    });
    return resolveCsrfToken(page);
}

const UNIFIED_APP_ID_RE = /^[a-f0-9]{24}$/i;

async function evaluateSensorTowerFetch(page, { method, endpoint, body, csrfToken }) {
    return page.evaluate(
        async ({ methodArg, endpointArg, bodyArg, csrfTokenArg }) => {
            try {
                const headers = {
                    accept: '*/*',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
                };
                if (bodyArg) headers['content-type'] = 'application/json';
                if (csrfTokenArg) headers['x-csrf-token'] = csrfTokenArg;
                const r = await fetch(endpointArg, {
                    method: methodArg,
                    credentials: 'include',
                    headers,
                    body: bodyArg ? JSON.stringify(bodyArg) : undefined,
                });
                const text = await r.text();
                let json = null;
                try {
                    json = text ? JSON.parse(text) : null;
                } catch (_) {}
                const respCsrf =
                    r.headers.get('x-csrf-token') || r.headers.get('X-CSRF-Token') || '';
                return {
                    ok: r.ok,
                    status: r.status,
                    text,
                    json,
                    endpoint: endpointArg,
                    responseCsrf: respCsrf,
                };
            } catch (e) {
                return {
                    ok: false,
                    status: 0,
                    text: String(e),
                    json: null,
                    endpoint: endpointArg,
                    responseCsrf: '',
                };
            }
        },
        {
            methodArg: method,
            endpointArg: endpoint,
            bodyArg: body,
            csrfTokenArg: csrfToken,
        }
    );
}

/**
 * 在已登录页面上下文中请求 Sensor Tower 同源 API
 */
async function fetchSensorTowerApi(
    page,
    { method = 'GET', endpoint, body = null, skipCsrfEnsure = false } = {}
) {
    const needsCsrf = method !== 'GET' && method !== 'HEAD';
    let csrfToken = await resolveCsrfToken(page);

    if (needsCsrf && !csrfToken && !skipCsrfEnsure) {
        csrfToken = await ensureCsrfTokenReady(page);
    }

    let res = await evaluateSensorTowerFetch(page, { method, endpoint, body, csrfToken });

    if (res.responseCsrf && res.responseCsrf.length >= 16) {
        page._stCsrfToken = res.responseCsrf;
    }

    if (needsCsrf && !csrfToken && res.responseCsrf?.length >= 16) {
        csrfToken = res.responseCsrf;
        res = await evaluateSensorTowerFetch(page, { method, endpoint, body, csrfToken });
    }

    if (needsCsrf && !csrfToken && !skipCsrfEnsure && (res.status === 401 || res.status === 403 || res.status === 422)) {
        csrfToken = await ensureCsrfTokenReady(page);
        if (csrfToken) {
            res = await evaluateSensorTowerFetch(page, { method, endpoint, body, csrfToken });
        }
    }

    return {
        ...res,
        csrfTokenPresent: !!(csrfToken || page._stCsrfToken),
    };
}

function normalizeAppSearchItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const unifiedAppId = String(
        raw.unified_app_id ?? raw.app_id ?? raw.id ?? raw.entity_id ?? ''
    ).trim();
    if (!UNIFIED_APP_ID_RE.test(unifiedAppId)) return null;
    const iconRaw = raw.icon_url ?? raw.icon ?? raw.artwork_url ?? raw.app_icon_url ?? '';
    let iconUrl = typeof iconRaw === 'string' ? iconRaw : '';
    if (iconUrl && iconUrl.startsWith('/')) {
        iconUrl = `${SENSORTOWER_APP_ORIGIN}${iconUrl}`;
    }
    return {
        unifiedAppId,
        name: String(raw.name ?? raw.unified_app_name ?? raw.app_name ?? raw.title ?? '').trim(),
        publisher: String(
            raw.publisher_name ?? raw.publisher ?? raw.developer ?? raw.company ?? ''
        ).trim(),
        iconUrl,
        iosCount: raw.ios_app_count ?? raw.apple_app_count ?? raw.ios_count ?? null,
        androidCount: raw.android_app_count ?? raw.google_play_app_count ?? raw.android_count ?? null,
        downloads: raw.downloads ?? raw.downloads_humanized ?? raw.downloads_label ?? null,
        revenue: raw.revenue ?? raw.revenue_humanized ?? raw.revenue_label ?? null,
    };
}

function extractAppsFromSearchResponse(json) {
    if (!json) return [];
    const buckets = [];
    if (Array.isArray(json)) buckets.push(json);
    if (Array.isArray(json.data)) buckets.push(json.data);
    if (Array.isArray(json.apps)) buckets.push(json.apps);
    if (Array.isArray(json.entities)) buckets.push(json.entities);
    if (Array.isArray(json.results)) buckets.push(json.results);
    const out = [];
    const seen = new Set();
    for (const bucket of buckets) {
        for (const item of bucket) {
            const norm = normalizeAppSearchItem(item);
            if (!norm || seen.has(norm.unifiedAppId)) continue;
            seen.add(norm.unifiedAppId);
            out.push(norm);
        }
    }
    return out;
}

/**
 * 搜索应用 / 最近使用（在浏览器会话内调用 ST 同源 API）
 */
async function searchAppsOnPage(page, { term = '', limit = 20, mode = 'search' } = {}) {
    const q = String(term || '').trim();
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const candidates =
        mode === 'recent' || !q
            ? [
                  '/api/unified/recently_used_applications',
                  '/api/unified/recent_apps',
                  '/api/user/recently_used_apps',
                  '/api/apps/recently_used',
              ]
            : [
                  `/api/unified/search_entities?entity_type=app&term=${encodeURIComponent(q)}&limit=${lim}`,
                  `/api/ios/search_entities?entity_type=app&term=${encodeURIComponent(q)}&limit=${lim}`,
                  `/api/android/search_entities?entity_type=app&term=${encodeURIComponent(q)}&limit=${lim}`,
                  `/api/autocomplete/apps?term=${encodeURIComponent(q)}&limit=${lim}`,
              ];

    const attempts = [];
    for (const path of candidates) {
        const res = await fetchSensorTowerApi(page, { method: 'GET', endpoint: path });
        attempts.push({ path, status: res.status, ok: res.ok });
        if (!res.ok) continue;
        const apps = extractAppsFromSearchResponse(res.json);
        if (apps.length) {
            return { apps, endpoint: path, attempts };
        }
    }
    return { apps: [], endpoint: null, attempts };
}

/**
 * 在当前登录会话中请求 Sensor Tower creatives/facets
 * @param {import('puppeteer').Page} page
 * @param {string} queryIdentifier
 * @param {object} payload
 */
async function requestCreativeFacets(page, queryIdentifier, payload) {
    const q = String(queryIdentifier || '').trim();
    if (!q) {
        return {
            success: false,
            code: 'INVALID_ARGUMENT',
            message: '缺少 queryIdentifier',
            data: null,
        };
    }

    await ensureCsrfTokenReady(page);

    const endpoint = `/api/creatives/facets?query_identifier=${encodeURIComponent(q)}`;
    const res = await fetchSensorTowerApi(page, {
        method: 'POST',
        endpoint,
        body: payload || {},
    });

    if (!res.csrfTokenPresent) {
        return {
            success: false,
            code: 'CSRF_TOKEN_MISSING',
            message: '无法获取 x-csrf-token，请在浏览器中打开创意库页面后重试',
            data: { endpoint, status: res.status },
        };
    }

    if (!res.ok) {
        return {
            success: false,
            code: 'SENSORTOWER_HTTP_ERROR',
            message: `facets 请求失败: HTTP ${res.status}`,
            data: {
                status: res.status,
                body: res.json ?? res.text ?? null,
                endpoint,
                csrfTokenPresent: res.csrfTokenPresent,
            },
        };
    }
    return {
        success: true,
        code: 200,
        message: 'ok',
        data: {
            endpoint,
            csrfTokenPresent: res.csrfTokenPresent,
            response: res.json ?? res.text ?? null,
        },
    };
}

/**
 * 在当前登录会话中请求 Sensor Tower apps/facets（展示份额等）
 */
async function requestAppsFacets(page, queryIdentifier, payload) {
    const q = String(queryIdentifier || '').trim();
    if (!q) {
        return {
            success: false,
            code: 'INVALID_ARGUMENT',
            message: '缺少 queryIdentifier',
            data: null,
        };
    }

    await ensureCsrfTokenOnPage(page);

    const endpoint = `/api/v2/apps/facets?query_identifier=${encodeURIComponent(q)}`;
    const res = await fetchSensorTowerApi(page, {
        method: 'POST',
        endpoint,
        body: payload || {},
    });

    if (!res.csrfTokenPresent) {
        return {
            success: false,
            code: 'CSRF_TOKEN_MISSING',
            message: '无法获取 x-csrf-token，请在浏览器中打开展示份额页面后重试',
            data: { endpoint, status: res.status },
        };
    }

    if (!res.ok) {
        return {
            success: false,
            code: 'SENSORTOWER_HTTP_ERROR',
            message: `facets 请求失败: HTTP ${res.status}`,
            data: {
                status: res.status,
                body: res.json ?? res.text ?? null,
                endpoint,
                csrfTokenPresent: res.csrfTokenPresent,
            },
        };
    }
    return {
        success: true,
        code: 200,
        message: 'ok',
        data: {
            endpoint,
            csrfTokenPresent: res.csrfTokenPresent,
            response: res.json ?? res.text ?? null,
        },
    };
}

async function gotoImpressionSharePage(page) {
    const target = DEFAULT_IMPRESSION_SHARE_URL;
    await gotoSensorTowerPage(page, target, {
        waitUntil: 'domcontentloaded',
        fallbackWaitUntil: 'domcontentloaded',
    }).catch(async () => {
        await gotoSensorTowerPage(page, target);
    });
    await delay(500);
}

async function setInputValue(page, selector, value) {
    await page.waitForSelector(selector, { timeout: 30000 });
    await page.$eval(
        selector,
        (el, v) => {
            const input = /** @type {HTMLInputElement} */ (el);
            input.focus();
            input.value = v;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        String(value ?? '')
    );
}

function isHttpUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

async function openAuthorizationLinkInNewTab(authLink) {
    if (!isHttpUrl(authLink)) {
        return { success: false, message: '邮箱授权链接格式不正确，请粘贴完整的 http(s) 链接' };
    }
    let tab;
    try {
        tab = await browser.newPage();
        await setupAntiDetection(tab);
        await gotoSensorTowerPage(tab, authLink);
        await waitForAuthRouteToStabilize(tab, { timeoutMs: 7000, stableCountNeeded: 2, pollMs: 400 });
        return {
            success: true,
            currentUrl: tab.url(),
            title: await tab.title().catch(() => ''),
        };
    } catch (e) {
        if (tab && !tab.isClosed()) await tab.close().catch(() => {});
        return { success: false, message: `打开邮箱授权链接失败: ${e.message || String(e)}` };
    }
}

/**
 * 登录态探测：若创意库等页面未跳登录页则视为已登录
 * @param {string|null|undefined} expectedEmail
 * @param {{ adoptPage?: boolean, closeOthers?: boolean }} [options]
 */
async function tryDetectAlreadyLoggedIn(expectedEmail, options = {}) {
    const adoptPage = options.adoptPage !== false;
    const closeOthers = options.closeOthers !== false;
    let page;
    try {
        page = await browser.newPage();
        await setupAntiDetection(page);
        await gotoSensorTowerPage(page, DEFAULT_GALLERY_URL);
        const u = await waitForAuthRouteToStabilize(page, { timeoutMs: 9000, stableCountNeeded: 3, pollMs: 450 });
        const loginFormVisible = await hasLoginForm(page);
        if (!isSignInUrl(u) && !isNewDeviceUrl(u) && !loginFormVisible && u.includes('app.sensortower-china.com')) {
            const currentUrl = await gotoCreativeGallery(page);
            if (isSignInUrl(currentUrl) || isNewDeviceUrl(currentUrl)) {
                await page.close().catch(() => {});
                return false;
            }
            const stable = await confirmGalleryStableForLogin(page, 5000);
            if (!stable.ok) {
                await page.close().catch(() => {});
                return false;
            }
            status.update(LoginStatus.ONLINE);
            loginInfo.email = expectedEmail || loginInfo.email || process.env.SENSORTOWER_EMAIL || null;
            await captureAndPersistSessionSnapshot(page);
            if (adoptPage) {
                loginPage = page;
                if (closeOthers) await closeOtherPages(page);
            } else {
                await page.close().catch(() => {});
            }
            return true;
        }
        await page.close().catch(() => {});
    } catch (e) {
        logger.warn('[Sensor Tower] 登录前检测失败:', e.message);
        if (page && !page.isClosed()) await page.close().catch(() => {});
    }
    return false;
}

async function checkLoginStatus() {
    if (!loginPage || loginPage.isClosed()) return;
    try {
        const u = await waitForAuthRouteToStabilize(loginPage, { timeoutMs: 4500, stableCountNeeded: 2, pollMs: 300 });
        const loginFormVisible = await hasLoginForm(loginPage);
        if (!isSignInUrl(u) && !isNewDeviceUrl(u) && !loginFormVisible && u.includes('app.sensortower-china.com')) {
            status.update(LoginStatus.ONLINE);
        } else if (isSignInUrl(u) || isNewDeviceUrl(u) || loginFormVisible) {
            status.update(LoginStatus.LOGGED_OUT);
        }
    } catch (e) {
        logger.warn('[Sensor Tower] checkLoginStatus:', e.message);
    }
}

export const getStatus = async () => {
    try {
        if (!browser) {
            await initializeBrowser();
            if (!browser) {
                return { status: LoginStatus.LOGGED_OUT, email: null };
            }
        }
        if (loginPage && !loginPage.isClosed()) {
            await checkLoginStatus();
        } else if (status.current !== LoginStatus.ONLINE) {
            // 状态轮询时，若 page 引用丢失但 profile 中可能仍有有效会话，则做一次低频被动探测
            const now = Date.now();
            if (now - lastPassiveDetectAt > 10000) {
                lastPassiveDetectAt = now;
                // 低频探测命中已登录时，保留该标签页作为 loginPage（默认停留 creative-gallery）；
                // 不关闭其它页，避免影响用户当前窗口。
                await tryDetectAlreadyLoggedIn(loginInfo.email || process.env.SENSORTOWER_EMAIL || null, {
                    adoptPage: true,
                    closeOthers: false,
                });
            }
        }
        return {
            status: status.current,
            email: status.current === LoginStatus.ONLINE ? loginInfo.email : null,
        };
    } catch (e) {
        logger.error('[Sensor Tower] getStatus:', e);
        return { status: LoginStatus.LOGGED_OUT, email: null };
    }
};

export const getHealthInfo = async () => {
    if (!browser) {
        return { browserExists: false, pageCount: 0, status: status.current, email: null, isLoggedIn: false };
    }
    try {
        const pages = await browser.pages();
        const info = getLoginInfo();
        return {
            browserExists: true,
            pageCount: pages.length,
            status: status.current,
            email: info.email ?? null,
            isLoggedIn: info.isLoggedIn,
        };
    } catch (e) {
        const info = getLoginInfo();
        return {
            browserExists: true,
            pageCount: 0,
            status: status.current,
            email: info.email ?? null,
            isLoggedIn: info.isLoggedIn,
            error: e.message,
        };
    }
};

/**
 * @param {string} email
 * @param {string} password
 * @param {string} [otp] - 多因素一次性密码（兼容保留）
 * @param {string} [authLink] - 邮箱授权链接（新设备授权）
 */
export const login = async (email, password, otp, authLink) => {
    const loginEmail = email || process.env.SENSORTOWER_EMAIL || '';
    const loginPassword = password || process.env.SENSORTOWER_PASSWORD || '';
    const otpInput = (otp && String(otp).trim()) || '';
    const authLinkInput = (authLink && String(authLink).trim()) || '';
    // 兼容旧客户端：若仍把链接塞在 otp 字段里，也当作授权链接处理
    const effectiveAuthLink = authLinkInput || (isHttpUrl(otpInput) ? otpInput : '');
    const effectiveOtp = effectiveAuthLink ? '' : otpInput;

    let connected = await checkBrowserConnection();
    if (!browser || !connected) {
        await initializeBrowser();
        if (!browser) {
            const hint =
                lastSensorTowerLaunchError ||
                '未知错误';
            return {
                data: { launchError: lastSensorTowerLaunchError },
                success: false,
                code: 'BROWSER_NOT_INITIALIZED',
                message: `浏览器未初始化：${hint}。请确认已安装 Google Chrome，或设置环境变量 PUPPETEER_EXECUTABLE_PATH 指向 chrome 可执行文件后重启服务。`,
            };
        }
    }

    // 授权链接直登：不再重复走邮箱密码流程
    if (effectiveAuthLink) {
        const openResult = await openAuthorizationLinkInNewTab(effectiveAuthLink);
        if (!openResult.success) {
            status.update(LoginStatus.LOGGED_OUT);
            return {
                data: { openResult },
                success: false,
                code: 'NEW_DEVICE_VERIFICATION',
                message: openResult.message || '邮箱授权链接打开失败，请检查后重试',
            };
        }

        const recovered = await tryDetectAlreadyLoggedIn(loginEmail || loginInfo.email || process.env.SENSORTOWER_EMAIL || null, {
            adoptPage: true,
            closeOthers: false,
        });
        if (recovered && loginPage && !loginPage.isClosed()) {
            return {
                data: {
                    url: loginPage.url(),
                    title: await loginPage.title().catch(() => ''),
                    sessionSnapshotPath: SESSION_SNAPSHOT_FILE,
                    sessionCapturedAt: loginInfo.sessionSnapshotSavedAt,
                },
                success: true,
                code: 200,
                message: '邮箱授权链接验证成功，已进入系统',
            };
        }

        status.update(LoginStatus.LOGGED_OUT);
        return {
            data: { openResult },
            success: false,
            code: 'NEW_DEVICE_VERIFICATION',
            message: '已打开邮箱授权链接，但会话尚未就绪，请确认链接有效并稍后重试',
        };
    }

    if (!loginEmail || !loginPassword) {
        return {
            data: null,
            success: false,
            code: 'MISSING_CREDENTIALS',
            message: '缺少邮箱或密码',
        };
    }

    if (await tryDetectAlreadyLoggedIn(loginEmail)) {
        return {
            data: { url: loginPage?.url(), message: '已存在有效会话' },
            success: true,
            code: 200,
            message: '已经登录，无需再次登录',
        };
    }

    let page;
    try {
        page = await browser.newPage();
        await setupAntiDetection(page);
        await gotoSensorTowerPage(page, LOGIN_URL);
        await page.waitForSelector(selectors.email, { timeout: 30000 });

        await setInputValue(page, selectors.email, loginEmail);
        await delay(300);

        await clickFormSubmit(page);

        await page.waitForFunction(
            () => {
                const pw = document.querySelector('#password');
                const box = pw && pw.closest('.password-field');
                if (!pw) return false;
                if (box) {
                    const st = box.getAttribute('style') || '';
                    if (st.includes('display: none') || st.includes('display:none')) return false;
                }
                return true;
            },
            { timeout: 45000 }
        );

        await setInputValue(page, selectors.password, loginPassword);
        await delay(300);

        await clickFormSubmit(page);

        await delay(1500);

        let cur = page.url();
        if (isNewDeviceUrl(cur)) {
            if (!effectiveAuthLink) {
                loginPage = page;
                status.update(LoginStatus.LOGGED_OUT);
                return {
                    data: { url: cur },
                    success: false,
                    code: 'NEW_DEVICE_VERIFICATION',
                    message: '检测到新浏览器授权页面，请在“邮箱授权链接”输入框粘贴邮件中的链接后再次点击登录。',
                };
            }
            const openResult = await openAuthorizationLinkInNewTab(effectiveAuthLink);
            if (!openResult.success) {
                loginPage = page;
                status.update(LoginStatus.LOGGED_OUT);
                return {
                    data: { url: cur, openResult },
                    success: false,
                    code: 'NEW_DEVICE_VERIFICATION',
                    message: openResult.message || '邮箱授权链接打开失败，请检查后重试',
                };
            }
            cur = await gotoCreativeGallery(page);
        }

        if (await isOtpVisible(page)) {
            const otpCode = effectiveOtp;
            if (!otpCode) {
                loginPage = page;
                status.update(LoginStatus.LOGGED_OUT);
                return {
                    data: null,
                    success: false,
                    code: 'OTP_REQUIRED',
                    message: '账号已开启多因素验证，请在请求中提供 otp 字段后重试',
                };
            }
            await setInputValue(page, selectors.otp, otpCode);
            await delay(200);
            await clickFormSubmit(page);
            await delay(2000);
            cur = page.url();
        }

        if (isNewDeviceUrl(cur)) {
            if (effectiveAuthLink) {
                const openResult = await openAuthorizationLinkInNewTab(effectiveAuthLink);
                if (openResult.success) {
                    cur = await gotoCreativeGallery(page);
                }
            }
        }

        if (isNewDeviceUrl(cur)) {
            loginPage = page;
            status.update(LoginStatus.LOGGED_OUT);
            return {
                data: { url: cur },
                success: false,
                code: 'NEW_DEVICE_VERIFICATION',
                message:
                    '仍处于新浏览器授权页面，请确认“邮箱授权链接”可在当前会话成功打开后重试。',
            };
        }

        if (isSignInUrl(cur)) {
            const errText = await page
                .evaluate(() => {
                    const flash = document.querySelector('.alert-danger, .flash-alert, [role="alert"]');
                    return flash ? flash.textContent?.trim() : '';
                })
                .catch(() => '');
            loginPage = page;
            status.update(LoginStatus.LOGGED_OUT);
            return {
                data: null,
                success: false,
                code: 'LOGIN_FAILED',
                message: errText ? `登录失败: ${errText}` : '登录失败：仍停留在登录页，请检查账号密码或 OTP',
            };
        }

        loginInfo.email = loginEmail;
        const finalUrl = await gotoCreativeGallery(page);
        if (isSignInUrl(finalUrl)) {
            status.update(LoginStatus.LOGGED_OUT);
            loginPage = page;
            return {
                data: null,
                success: false,
                code: 'LOGIN_FAILED',
                message: '跳转创意库时被重定向到登录页，会话可能无效',
            };
        }
        const stable = await confirmGalleryStableForLogin(page, 5000);
        if (!stable.ok) {
            status.update(LoginStatus.LOGGED_OUT);
            loginPage = page;
            return {
                data: null,
                success: false,
                code: 'LOGIN_FAILED',
                message: '跳转到创意库后 5 秒内发生跳转，会话可能未稳定或已失效',
            };
        }

        await captureAndPersistSessionSnapshot(page);
        status.update(LoginStatus.ONLINE);
        loginPage = page;
        await closeOtherPages(page);

        return {
            data: {
                url: finalUrl,
                title: await page.title().catch(() => ''),
                sessionSnapshotPath: SESSION_SNAPSHOT_FILE,
                sessionCapturedAt: loginInfo.sessionSnapshotSavedAt,
            },
            success: true,
            code: 200,
            message: '登录成功',
        };
    } catch (error) {
        logger.error('[Sensor Tower] 登录异常:', error);
        if (page && !page.isClosed()) {
            loginPage = page;
        }
        status.update(LoginStatus.LOGGED_OUT);
        return {
            data: null,
            success: false,
            code: 'LOGIN_ERROR',
            message: error.message || String(error),
        };
    }
};

export const clearLogin = async () => {
    if (loginPage && !loginPage.isClosed()) {
        await loginPage.close().catch(() => {});
        loginPage = null;
    }
    loginInfo.cookies = null;
    loginInfo.email = null;
    loginInfo.sessionSnapshot = null;
    loginInfo.sessionSnapshotSavedAt = null;
    await fsPromises.unlink(SESSION_SNAPSHOT_FILE).catch(() => {});
    status.update(LoginStatus.LOGGED_OUT);
    return { success: true, code: 200, message: '已清除登录状态' };
};

/**
 * 在已登录页面上跳转（例如创意库）；用于前端「同步打开默认页」
 * @param {{ url?: string }} body
 */
export const search = async (body) => {
    const action = body && body.action ? String(body.action) : '';

    if (action === 'searchApps') {
        if (status.current !== LoginStatus.ONLINE || !loginPage || loginPage.isClosed()) {
            await tryDetectAlreadyLoggedIn(loginInfo.email || process.env.SENSORTOWER_EMAIL || null, {
                adoptPage: true,
                closeOthers: false,
            });
        }
        if (status.current !== LoginStatus.ONLINE || !loginPage || loginPage.isClosed()) {
            return {
                success: false,
                code: 'NOT_LOGGED_IN',
                message: '未登录 Sensor Tower',
                data: null,
            };
        }
        try {
            const mode = body.mode === 'recent' ? 'recent' : 'search';
            const result = await searchAppsOnPage(loginPage, {
                term: body.term,
                limit: body.limit,
                mode,
            });
            return {
                success: true,
                code: 200,
                message: 'ok',
                data: {
                    apps: result.apps,
                    endpoint: result.endpoint,
                    attempts: result.attempts,
                },
            };
        } catch (e) {
            logger.error('[Sensor Tower] searchApps:', e);
            return {
                success: false,
                code: 'SEARCH_APPS_ERROR',
                message: e.message || String(e),
                data: null,
            };
        }
    }

    if (status.current !== LoginStatus.ONLINE || !loginPage || loginPage.isClosed()) {
        // 状态可能已 ONLINE 但 loginPage 引用缺失，先尝试恢复一次会话页
        await tryDetectAlreadyLoggedIn(loginInfo.email || process.env.SENSORTOWER_EMAIL || null, {
            adoptPage: true,
            closeOthers: false,
        });
    }
    if (status.current !== LoginStatus.ONLINE || !loginPage || loginPage.isClosed()) {
        return {
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '未登录 Sensor Tower',
            data: null,
        };
    }
    const target = withSensorTowerLocale(
        (body && body.url && String(body.url).trim()) || DEFAULT_GALLERY_URL
    );
    const hasFacetsQuery = !!(body && body.queryIdentifier);
    const queryId = hasFacetsQuery ? String(body.queryIdentifier).trim() : '';
    const isImpressionShareFacets = isImpressionShareQueryId(queryId);
    try {
        let u = loginPage.url();
        if (hasFacetsQuery) {
            if (isImpressionShareFacets) {
                if (!isTargetImpressionShareUrl(u)) {
                    try {
                        await gotoImpressionSharePage(loginPage);
                        await delay(300);
                    } catch (e) {
                        const msg = String(e?.message || e);
                        const curAfterErr = loginPage.url();
                        if (!/ERR_ABORTED/i.test(msg) || !isTargetImpressionShareUrl(curAfterErr)) {
                            throw e;
                        }
                    }
                }
                u = loginPage.url();
            } else {
                // 取数模式：避免每次强制 goto 触发 net::ERR_ABORTED；仅在不在 creative-gallery 时才跳转一次
                if (!isTargetCreativeGalleryUrl(u)) {
                    try {
                        await gotoSensorTowerPage(loginPage, target);
                        await delay(500);
                    } catch (e) {
                        const msg = String(e?.message || e);
                        const curAfterErr = loginPage.url();
                        // Sensor Tower 页面内切换/重定向期间偶发 net::ERR_ABORTED，若当前已在目标页则可继续取数
                        if (!/ERR_ABORTED/i.test(msg) || !isTargetCreativeGalleryUrl(curAfterErr)) {
                            throw e;
                        }
                    }
                    u = loginPage.url();
                }
                await ensureCsrfTokenReady(loginPage);
            }
        } else {
            await gotoSensorTowerPage(loginPage, target, {
                waitUntil: 'networkidle2',
                fallbackWaitUntil: 'domcontentloaded',
            }).catch(async () => {
                await gotoSensorTowerPage(loginPage, target);
            });
            await delay(800);
            u = loginPage.url();
        }

        if (isSignInUrl(u)) {
            status.update(LoginStatus.LOGGED_OUT);
            return {
                success: false,
                code: 'SESSION_EXPIRED',
                message: '会话已失效，请重新登录',
                data: { url: u },
            };
        }

        // 可选：在已登录会话中直接请求 creatives/facets
        if (body && body.queryIdentifier) {
            const payload = body.payload || {};
            const filters = payload.filters || {};
            if (Array.isArray(filters.unified_app_ids)) {
                filters.unified_app_ids = filters.unified_app_ids.filter((id) =>
                    UNIFIED_APP_ID_RE.test(String(id || '').trim())
                );
                payload.filters = filters;
            }
            if (!filters.unified_app_ids?.length) {
                return {
                    success: false,
                    code: 'INVALID_ARGUMENT',
                    message: '请至少添加一个有效应用（unified_app_id 须为 24 位十六进制）',
                    data: null,
                };
            }
            if (isImpressionShareFacets) {
                return await requestAppsFacets(loginPage, queryId, payload);
            }
            return await requestCreativeFacets(loginPage, queryId, payload);
        }

        const title = await loginPage.title().catch(() => '');
        return {
            success: true,
            code: 200,
            message: 'ok',
            data: { currentUrl: u, title },
        };
    } catch (e) {
        logger.error('[Sensor Tower] search/goto:', e);
        return {
            success: false,
            code: 'NAV_ERROR',
            message: e.message || String(e),
            data: null,
        };
    }
};

export { DEFAULT_GALLERY_URL, LOGIN_URL, withSensorTowerLocale };
