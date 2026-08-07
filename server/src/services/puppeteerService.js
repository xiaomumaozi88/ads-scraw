import { TimeoutError } from 'puppeteer';
import { spawn } from 'child_process';
import { puppeteerOptions } from '../config.js';
import { removeChromeUserDataSingletonLocks } from '../utils/removeChromeUserDataSingletonLocks.js';
import {
  applyPageAntiDetection,
  enhanceLaunchOptions,
  getStealthPuppeteer,
} from '../utils/browserAntiDetection.js';
import {rm} from 'fs/promises';
import {dirname} from 'path';
import {fileURLToPath} from 'url';
import {LoginStatus} from '../constants/index.js';
import {upload} from '../utils/utils.js';
import {buildGuangdadaRequestBody} from './guangdadaApiService.js';
import { logger } from '../utils/logger.js';

/** 判断前端是否已发来 guangdada.net 直连 JSON（须保留 multimodal_md5、sort_field 等）。search_type 官网为字符串；曾用数字 0 会导致误判并走 buildGuangdadaRequestBody 丢字段。 */
function isGuangdadaSearchParamsApiFormat(sp) {
    if (!sp || typeof sp !== 'object') return false;
    const st = sp.search_type;
    const searchTypeOk = st === '1' || st === '0' || st === 1 || st === 0;
    return typeof sp.seen_begin === 'number' && typeof sp.seen_end === 'number' && searchTypeOk;
}

// 使用 Stealth 插件来避免反爬虫检测
const puppeteer = getStealthPuppeteer();

const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 与 config 中广大大 userDataDir 一致（绝对路径，避免与 cwd 不一致）
const folderToDelete = puppeteerOptions.userDataDir;

let browser;
let loginPage; // 登录页面
let socatSpawnedForPort = null; // 已为某端口启动过 socat（Chrome 只监听 127.0.0.1，需 socat 转发以便外网/隧道访问）

// 存储登录信息
let loginInfo = {
    cookies: null,
    email: null,
    authorization: null, // JWT token（napi 等常用，多与 jwt.nbs 一致）
    /** 国内版 BBA（iframe-cn / bbaapi）须用 localStorage `jwt` 里的 cn，与 nbs 权限载荷不同 */
    authorizationCn: null,
    /** 国内 cn 令牌过期时间（毫秒），来自 jwt.cn 的 payload.exp 或 jwt 外层 JSON 常见字段 */
    cnJwtExpiresAtMs: null,
    deviceId: null,
    userToken: null,
};

// 状态管理
const status = {
    current: LoginStatus.LOGGED_OUT, // 初始状态为未登录
    update(newStatus) {
        this.current = newStatus;
        logger.info(`当前状态: ${this.current}`);
    }
};

// 广大大网站登录选择器
const selectors = {
    emailInput: '#login_form_email',
    passwordInput: '#login_form_password',
    submitButton: 'form#login_form button[type="submit"]',
    loginForm: '#login_form',
    errorSelector: '.ant-message-error, .ant-form-item-explain-error' // 错误提示选择器
};

// 广大大网站登录地址
const loginPageUrl = 'https://guangdada.net/modules/auth/login';
const checkLoginUrl = 'https://guangdada.net/modules/auth/login';

/** 国际版创意列表（napi Referer 基准） */
const DISPLAY_ADS_URL_GLOBAL = 'https://guangdada.net/modules/creative/display-ads';

async function gotoGuangdadaLoginPage(page) {
    try {
        await page.goto(loginPageUrl, { timeout: 60 * 1000, waitUntil: 'domcontentloaded' });
    } catch (error) {
        const hasLoginForm = await page.$(selectors.loginForm).then(Boolean).catch(() => false);
        if (!hasLoginForm) throw error;
        logger.warn('[广大大] 登录页导航等待超时，但登录表单已加载，继续登录流程');
    }
    await page.waitForSelector(selectors.loginForm, { timeout: 60 * 1000 });
}

/**
 * 国际版 napi 请求依赖国际版路径；若当前停在国内版 /modules/cn/... 则切回国际版 display-ads
 */
async function ensureGuangdadaGlobalDisplayAdsForInternationalApis(page) {
    if (!page || page.isClosed()) return;
    try {
        const cur = page.url();
        if (cur.includes('/modules/cn/creative/')) {
            logger.info('[广大大] 当前在国内版创意页，切回国际版 display-ads 以便 napi 请求');
            await page.goto(DISPLAY_ADS_URL_GLOBAL, { waitUntil: 'networkidle2', timeout: 120000 });
        }
    } catch (e) {
        logger.warn('[广大大] 切回国际版 display-ads 失败:', e.message);
    }
}

/** 从 JWT 字符串 payload 读取 exp（秒）→ 过期时刻毫秒 */
function guangdadaJwtPayloadExpMs(token) {
    if (typeof token !== 'string' || !token.trim()) return null;
    const parts = token.trim().split('.');
    if (parts.length < 2) return null;
    try {
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
        const exp = payload && payload.exp;
        if (exp == null || !Number.isFinite(Number(exp))) return null;
        return Math.round(Number(exp) * 1000);
    } catch {
        return null;
    }
}

/** localStorage `jwt` 外层 JSON 上常见的过期字段 → 毫秒（秒级时间戳会乘 1000） */
function guangdadaJwtWrapperExpiresMs(wrapper) {
    if (!wrapper || typeof wrapper !== 'object') return null;
    const nowMs = Date.now();
    const relativeKeys = ['expires_in', 'expiresIn'];
    for (const k of relativeKeys) {
        const v = wrapper[k];
        if (v == null) continue;
        const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : NaN);
        if (!Number.isFinite(n) || n <= 0) continue;
        // 兼容三种口径：
        // 1) 毫秒时间戳（13 位） 2) 秒时间戳（10 位） 3) 相对秒数（常见 expires_in）
        if (n >= 1e12) return Math.round(n); // epoch ms
        if (n >= 1e9) return Math.round(n * 1000); // epoch s
        return nowMs + Math.round(n * 1000); // ttl seconds
    }
    const keys = [
        'expires', 'expireTime', 'expire_time', 'expiresAt', 'expires_at',
        'expirationTime', 'expiration_time', 'expiredAt', 'expired_at',
        'tokenExpire', 'token_expire', 'expire', 'exp',
    ];
    for (const k of keys) {
        const v = wrapper[k];
        if (v == null) continue;
        if (typeof v === 'number' && Number.isFinite(v)) {
            return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
        }
        if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
            const n = parseInt(v.trim(), 10);
            if (!Number.isFinite(n)) continue;
            return n < 1e12 ? n * 1000 : n;
        }
    }
    return null;
}

function resolveGuangdadaCnJwtExpiresAtMs(cnToken, wrapper) {
    const fromCn = guangdadaJwtPayloadExpMs(cnToken);
    if (fromCn != null) return fromCn;
    return guangdadaJwtWrapperExpiresMs(wrapper);
}

/**
 * 从 guangdada.net 的 localStorage/sessionStorage 中 `jwt`（或 `JWT`）JSON 解析 `cn` 字段，
 * 供 bba.ttads.net iframe-cn / bbaapi 使用（与 napi 用的 nbs 不是同一枚 JWT）。
 */
async function syncAuthorizationCnFromJwtStorage(page) {
    if (!page || page.isClosed()) return;
    try {
        const result = await page.evaluate(() => {
            for (const jwtKey of ['jwt', 'JWT']) {
                const raw = localStorage.getItem(jwtKey) || sessionStorage.getItem(jwtKey);
                if (!raw || typeof raw !== 'string') continue;
                try {
                    const o = JSON.parse(raw);
                    if (!o || typeof o !== 'object') continue;
                    const cn = typeof o.cn === 'string' && o.cn.trim() ? o.cn.trim() : null;
                    return { cn, wrapper: o };
                } catch (_) {
                    /* ignore */
                }
            }
            return { cn: null, wrapper: null };
        });
        if (result.cn) {
            loginInfo.authorizationCn = result.cn;
            logger.info('✅ 已从 jwt 存储同步国内版(BBA) cn 令牌');
        }
        const expMs = resolveGuangdadaCnJwtExpiresAtMs(result.cn, result.wrapper);
        loginInfo.cnJwtExpiresAtMs = expMs != null ? expMs : null;
    } catch (e) {
        logger.warn('从 jwt 同步 cn 令牌失败:', e.message);
    }
}

// 配置页面的反检测措施（统一模块：stealth + 固定 UA/时区/语言）
async function setupAntiDetection(page) {
    await applyPageAntiDetection(page);

    page.on('load', async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));
        try {
            await page.mouse.move(
                Math.random() * 800 + 100,
                Math.random() * 600 + 100,
                { steps: 10 }
            );
        } catch {
            /* ignore */
        }
    });
}

export const initializeBrowser = async () => {
    console.log('准备启动广大大浏览器');
    if (browser) {
        try {
            await browser.close();
            logger.info('已关闭旧广大大浏览器实例');
        } catch (e) {
            logger.warn('关闭旧广大大浏览器失败:', e.message);
        }
        browser = null;
    }
    const profileCloseMs = Math.max(0, parseInt(process.env.BROWSER_PROFILE_CLOSE_DELAY_MS || '800', 10));
    if (profileCloseMs > 0) {
        await new Promise((r) => setTimeout(r, profileCloseMs));
    }
    removeChromeUserDataSingletonLocks(puppeteerOptions.userDataDir);
    try {
        const launchOpts = { ...puppeteerOptions };
        const debugPort = process.env.CHROME_REMOTE_DEBUGGING_PORT;
        if (debugPort) {
            const externalPort = parseInt(debugPort, 10);
            const internalPort = externalPort + 1; // Chrome 只绑定 127.0.0.1，用 socat 在 0.0.0.0:externalPort 转发到 127.0.0.1:internalPort
            launchOpts.args = [...(launchOpts.args || []), `--remote-debugging-port=${internalPort}`];
            if (!socatSpawnedForPort) {
                try {
                    const socat = spawn('socat', [`TCP-LISTEN:${externalPort},fork,bind=0.0.0.0`, `TCP:127.0.0.1:${internalPort}`], { stdio: 'ignore', detached: true });
                    socat.unref();
                    socat.on('error', (e) => logger.error('socat 错误:', e.message));
                    socatSpawnedForPort = externalPort;
                    logger.info('已启动 socat 转发 0.0.0.0:' + externalPort + ' -> 127.0.0.1:' + internalPort + '，Chrome 远程调试可从外网/隧道访问');
                } catch (e) {
                    logger.warn('启动 socat 失败，远程调试可能无法从外网访问:', e.message);
                }
            }
            logger.info('已启用 Chrome 远程调试端口(内部):', internalPort, '外部端口:', externalPort);
        }
        logger.info('尝试启动浏览器，配置:', JSON.stringify(launchOpts, null, 2));
        browser = await puppeteer.launch(enhanceLaunchOptions(launchOpts));
        await browser.defaultBrowserContext().overridePermissions('https://guangdada.net/', ['clipboard-read', 'clipboard-write']);
        console.log('广大大浏览器已启动');
        logger.info('浏览器启动成功');
    } catch (e) {
        logger.error('浏览器启动失败:', e.message);
        logger.error('错误详情:', e);
        console.error('浏览器启动失败，请检查 Chrome/Chromium 是否正确安装');
        console.error('错误信息:', e.message);
        console.error('完整错误:', e);
        browser = null;
        // 重新尝试使用默认配置
        try {
            logger.info('尝试使用默认配置启动浏览器');
            browser = await puppeteer.launch(enhanceLaunchOptions({
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            }));
            logger.info('使用默认配置启动浏览器成功');
        } catch (e2) {
            logger.error('使用默认配置也启动失败:', e2.message);
            browser = null;
        }
    }
};

// 获取浏览器的 WebSocket 端点（用于远程连接）
export const getBrowserWSEndpoint = () => {
    if (!browser) {
        return null;
    }
    try {
        const wsEndpoint = browser.wsEndpoint();
        return wsEndpoint;
    } catch (error) {
        logger.error('获取浏览器 WebSocket 端点失败:', error.message);
        return null;
    }
};

export const closeBrowser = async () => {
    loginPage = null;
    if (!browser) return;
    try {
        await browser.close();
    } catch (e) {
        logger.warn('关闭广大大浏览器失败:', e.message);
    }
    browser = null;
};

// 爬取 display-ads 页面数据
export const scrapeDisplayAds = async () => {
    if (!browser) {
        return {
            data: null,
            success: false,
            code: 'BROWSER_NOT_INITIALIZED',
            message: '浏览器未初始化'
        };
    }

    if (status.current !== LoginStatus.ONLINE) {
        return {
            data: null,
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '当前未登录，无法获取数据'
        };
    }

    // 如果有保存的登录页面且未关闭，使用它；否则创建新页面（同一浏览器上下文保持登录状态）
    let page;
    let isNewPage = false;
    if (loginPage && !loginPage.isClosed()) {
        // 使用已登录的页面，在同一浏览器上下文中
        page = loginPage;
        logger.info('使用已登录的页面进行数据爬取');
    } else {
        // 创建新页面，但使用同一个浏览器上下文（保持登录状态）
        page = await browser.newPage();
        isNewPage = true;
        logger.info('创建新页面进行数据爬取（使用同一浏览器上下文保持登录状态）');
        // 设置反检测措施
        await setupAntiDetection(page);
    }
    try {
        const targetUrl = 'https://guangdada.net/modules/creative/display-ads';
        logger.info(`开始爬取页面: ${targetUrl}`);
        
        await page.goto(targetUrl, { 
            timeout: 120 * 1000, 
            waitUntil: 'networkidle2' 
        });

        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 检查是否有弹窗，如果有则关闭
        try {
            // 等待弹窗可能出现
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 记录当前URL，确保我们在正确的页面上
            const currentUrl = page.url();
            logger.info('当前页面URL:', currentUrl);
            
            // 检查是否存在弹窗（通过检查 ant-modal-body 或 ant-modal-close）
            const modalInfo = await page.evaluate(() => {
                const modal = document.querySelector('.ant-modal-body');
                const closeBtn = document.querySelector('button.ant-modal-close, .ant-modal-close');
                if (modal) {
                    const style = window.getComputedStyle(modal);
                    return {
                        exists: true,
                        visible: style.display !== 'none' && style.visibility !== 'hidden',
                        hasCloseBtn: closeBtn !== null
                    };
                }
                return { exists: false, visible: false, hasCloseBtn: false };
            });
            
            if (modalInfo.exists && modalInfo.visible) {
                logger.info('检测到弹窗，正在关闭...');
                
                // 使用更精确的方式关闭弹窗
                if (modalInfo.hasCloseBtn) {
                    // 使用 evaluate 直接点击关闭按钮，避免触发其他事件
                    const closed = await page.evaluate(() => {
                        const closeBtn = document.querySelector('button.ant-modal-close, .ant-modal-close');
                        if (closeBtn) {
                            closeBtn.click();
                            return true;
                        }
                        return false;
                    });
                    
                    if (closed) {
                        logger.info('已通过点击关闭按钮关闭弹窗');
                    } else {
                        // 如果点击失败，尝试按 ESC 键
                        await page.keyboard.press('Escape');
                        logger.info('已按 ESC 键关闭弹窗');
                    }
                } else {
                    // 如果找不到按钮，尝试按 ESC 键
                    await page.keyboard.press('Escape');
                    logger.info('未找到关闭按钮，已按 ESC 键关闭弹窗');
                }
                
                // 等待弹窗关闭动画完成
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // 检查页面URL是否发生变化（不应该变化）
                const urlAfterClose = page.url();
                if (urlAfterClose !== currentUrl) {
                    logger.warn(`关闭弹窗后URL发生变化: ${currentUrl} -> ${urlAfterClose}`);
                }
                
                // 再次检查弹窗是否已关闭
                const modalStillExists = await page.evaluate(() => {
                    const modal = document.querySelector('.ant-modal-body');
                    if (!modal) return false;
                    const style = window.getComputedStyle(modal);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });
                
                if (!modalStillExists) {
                    logger.info('弹窗已成功关闭');
                } else {
                    logger.warn('弹窗可能未完全关闭，继续执行...');
                }
            } else {
                logger.info('未检测到弹窗或弹窗不可见');
            }
        } catch (error) {
            logger.warn('检查弹窗时出错（可能没有弹窗）:', error.message);
            // 即使出错也继续执行，不影响后续流程
        }

        // 提取页面数据
        const pageData = await page.evaluate(() => {
            const data = {
                title: document.title,
                url: window.location.href,
                filterHtml: '', // 整个筛选模块的 HTML
                cssLinks: [], // CSS 样式表链接
                tableData: [],
                rawHtml: ''
            };
            
            // 提取所有 CSS 样式表链接
            const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
            linkElements.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    // 如果是相对路径，转换为绝对路径
                    const absoluteUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
                    data.cssLinks.push(absoluteUrl);
                }
            });

            // 直接提取整个筛选模块的 HTML（包括样式）
            // 选择 class="min-h-[1200px]" 的元素的第一个子元素作为筛选模块
            const parentContainer = document.querySelector('.min-h-\\[1200px\\]');
            if (parentContainer && parentContainer.firstElementChild) {
                const filterContainer = parentContainer.firstElementChild;
                // 克隆元素以获取完整的 HTML 结构
                const cloned = filterContainer.cloneNode(true);
                // 移除可能影响显示的隐藏元素
                cloned.querySelectorAll('[style*="display: none"], .hidden').forEach(el => {
                    el.remove();
                });
                data.filterHtml = cloned.outerHTML;
            }

            // 不再提取单个筛选器，直接使用整个模块的 HTML

            // 提取表格数据
            const tables = document.querySelectorAll('table, .ant-table, [class*="table"]');
            tables.forEach((table, tableIndex) => {
                const rows = table.querySelectorAll('tr, .ant-table-row, [class*="row"]');
                const tableRows = [];
                
                rows.forEach((row, rowIndex) => {
                    const cells = row.querySelectorAll('td, th, .ant-table-cell, [class*="cell"]');
                    if (cells.length > 0) {
                        const rowData = {
                            rowIndex: rowIndex,
                            cells: Array.from(cells).map(cell => ({
                                text: cell.textContent.trim(),
                                html: cell.innerHTML
                            }))
                        };
                        tableRows.push(rowData);
                    }
                });

                if (tableRows.length > 0) {
                    data.tableData.push({
                        index: tableIndex,
                        rows: tableRows
                    });
                }
            });

            // 提取卡片或列表数据
            const cards = document.querySelectorAll('.ant-card, [class*="card"], [class*="item"]');
            if (cards.length > 0 && data.tableData.length === 0) {
                const cardData = Array.from(cards).slice(0, 100).map((card, index) => {
                    const title = card.querySelector('[class*="title"], h1, h2, h3, h4, h5, h6')?.textContent.trim() || '';
                    const content = card.textContent.trim();
                    return {
                        index: index,
                        title: title,
                        content: content.substring(0, 500), // 限制内容长度
                        html: card.innerHTML.substring(0, 1000) // 限制HTML长度
                    };
                });
                data.cards = cardData;
            }

            // 保存原始HTML（限制大小）
            data.rawHtml = document.documentElement.outerHTML.substring(0, 50000);

            return data;
        });

        // 如果是新创建的页面，关闭它；如果是复用的登录页面，不关闭
        if (isNewPage) {
            await page.close();
            logger.info('已关闭临时创建的页面');
        } else {
            logger.info('保留登录页面，不关闭');
        }
        
        logger.info(`页面爬取成功，提取到 ${pageData.tableData.length} 个表格，筛选模块HTML长度: ${pageData.filterHtml?.length || 0} 字符`);
        
        return {
            data: pageData,
            success: true,
            code: 200,
            message: '数据爬取成功'
        };
    } catch (error) {
        logger.error(`爬取页面失败: ${error.message}`);
        // 如果是新创建的页面，关闭它；如果是复用的登录页面，不关闭
        if (typeof isNewPage !== 'undefined' && isNewPage) {
            await page.close().catch(() => {});
        }
        return {
            data: null,
            success: false,
            code: 500,
            message: `爬取失败: ${error.message}`
        };
    }
};

// 查询当前状态（不自动检查，只返回当前状态）
export const getStatus = async () => {
    if (status.current === LoginStatus.ONLINE && loginPage && !loginPage.isClosed()) {
        await syncAuthorizationCnFromJwtStorage(loginPage).catch(() => {});
    }
    const online = status.current === LoginStatus.ONLINE;
    return {
        status: status.current,
        email: online ? loginInfo.email : null,
        cnJwtExpiresAt: online && loginInfo.cnJwtExpiresAtMs != null ? loginInfo.cnJwtExpiresAtMs : null,
    };
};

/**
 * 当前广大大登录会话中的 JWT（与 guangdada.net /napi/ 等请求 Authorization 一致，通常对应 localStorage jwt.nbs）。
 * 国内版 BBA 请用 {@link getStoredGuangdadaBbaAuthorization}（jwt.cn）。
 */
export function getStoredGuangdadaAuthorization() {
    if (status.current !== LoginStatus.ONLINE) return null;
    const t = loginInfo.authorization && String(loginInfo.authorization).trim();
    return t || null;
}

/**
 * 国内版 BBA 上游鉴权：优先 jwt.cn；缺失时退回 loginInfo.authorization（旧行为，可能与官网不一致）
 */
export function getStoredGuangdadaBbaAuthorization() {
    if (status.current !== LoginStatus.ONLINE) return null;
    const cn = loginInfo.authorizationCn && String(loginInfo.authorizationCn).trim();
    if (cn) return cn;
    return getStoredGuangdadaAuthorization();
}

/** 在发起国内版 ad-info 代理前从登录页刷新 jwt.cn（jwt 可能晚于首屏写入 localStorage） */
export async function refreshGuangdadaBbaAuthFromLoginPage() {
    if (status.current !== LoginStatus.ONLINE) return;
    if (!loginPage || loginPage.isClosed()) return;
    await syncAuthorizationCnFromJwtStorage(loginPage);
}

async function resolveGuangdadaNapiAuthFromLoginPage() {
    let authorizationToken = loginInfo.authorization;
    let deviceId = loginInfo.deviceId;
    let userToken = loginInfo.userToken;

    if (!loginPage || loginPage.isClosed()) {
        return { authorizationToken, deviceId, userToken };
    }

    if (authorizationToken && userToken && deviceId) {
        return { authorizationToken, deviceId, userToken };
    }

    try {
        const storageData = await loginPage.evaluate(() => {
            const result = {};
            const readStorage = (storage) => {
                try {
                    for (let i = 0; i < storage.length; i++) {
                        const key = storage.key(i);
                        const value = storage.getItem(key);
                        if (!key || !value) continue;
                        if (/auth|token|bearer|user|jwt|nbs|device/i.test(key)) {
                            result[key] = value;
                        }
                    }
                } catch (_) {}
            };
            readStorage(localStorage);
            readStorage(sessionStorage);
            for (const jwtKey of ['jwt', 'JWT']) {
                const raw = localStorage.getItem(jwtKey) || sessionStorage.getItem(jwtKey);
                if (!raw) continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed.nbs === 'string' && parsed.nbs.trim()) {
                        result.__jwt_nbs = parsed.nbs.trim();
                    }
                } catch (_) {}
            }
            return result;
        });

        authorizationToken =
            authorizationToken ||
            storageData.__jwt_nbs ||
            storageData.authorization ||
            storageData.Authorization ||
            storageData.token ||
            storageData.authToken ||
            storageData.accessToken ||
            null;

        if (!authorizationToken) {
            for (const value of Object.values(storageData)) {
                if (looksLikeJwt(value)) {
                    authorizationToken = String(value).trim();
                    break;
                }
            }
        }

        userToken = userToken || storageData['user-token'] || storageData.userToken || null;
        deviceId = deviceId || storageData['device-id'] || storageData.deviceId || null;

        if (authorizationToken) loginInfo.authorization = authorizationToken;
        if (userToken) loginInfo.userToken = userToken;
        if (deviceId) loginInfo.deviceId = deviceId;
    } catch (e) {
        logger.warn('从页面存储读取广大大 napi 鉴权失败:', e.message);
    }

    return { authorizationToken, deviceId, userToken };
}

/** 读取当前登录账号的 nbs-info：包含 user_count 的官方额度上限与周期。 */
export const fetchNbsInfo = async () => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }

    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);

    try {
        const { authorizationToken, deviceId, userToken } = await resolveGuangdadaNapiAuthFromLoginPage();
        const response = await loginPage.evaluate(async (authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';

                const res = await fetch('/napi/v1/user/nbs-info', {
                    method: 'GET',
                    headers,
                    credentials: 'include'
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        return { ok: false, status: res.status, statusText: parseError.message, data: null };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (error) {
                return { ok: false, status: 500, statusText: error.message, data: null };
            }
        }, authorizationToken, deviceId, userToken);

        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: success ? (apiData.data || null) : null,
            raw: apiData,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || response.statusText || '读取 nbs-info 失败')
        };
    } catch (error) {
        logger.error('广大大 nbs-info 请求失败:', error);
        return { data: null, success: false, code: 500, message: `读取 nbs-info 失败: ${error.message || '未知错误'}` };
    }
};

/** 健康检查：浏览器是否存在、页面数、登录状态与账号，供 /health 排查用 */
export const getHealthInfo = async () => {
    if (!browser) {
        return { browserExists: false, pageCount: 0, status: status.current, email: null, isLoggedIn: false, cnJwtExpiresAt: null };
    }
    try {
        if (status.current === LoginStatus.ONLINE && loginPage && !loginPage.isClosed()) {
            await syncAuthorizationCnFromJwtStorage(loginPage).catch(() => {});
        }
        const pages = await browser.pages();
        const isLoggedIn = status.current === LoginStatus.ONLINE;
        return {
            browserExists: true,
            pageCount: pages.length,
            status: status.current,
            email: isLoggedIn ? loginInfo.email : null,
            isLoggedIn,
            cnJwtExpiresAt: isLoggedIn && loginInfo.cnJwtExpiresAtMs != null ? loginInfo.cnJwtExpiresAtMs : null,
        };
    } catch (e) {
        logger.warn('getHealthInfo 广大大:', e.message);
        return {
            browserExists: true,
            pageCount: 0,
            status: status.current,
            email: status.current === LoginStatus.ONLINE ? loginInfo.email : null,
            isLoggedIn: status.current === LoginStatus.ONLINE,
            cnJwtExpiresAt: status.current === LoginStatus.ONLINE && loginInfo.cnJwtExpiresAtMs != null ? loginInfo.cnJwtExpiresAtMs : null,
            error: e.message
        };
    }
};

/** 从请求头中提取 authorization（广大大可能用不同 header 名或大小写） */
function getAuthFromRequestHeaders(headers) {
    if (!headers || typeof headers !== 'object') return null;
    const names = ['authorization', 'Authorization', 'x-authorization', 'x-auth-token', 'x-nbs-token'];
    for (const name of names) {
        const v = headers[name];
        if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    for (const [k, v] of Object.entries(headers)) {
        if (/authorization|auth-token|x-.*token/i.test(k) && v && typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
}

/** 判断字符串是否像 JWT（至少两段、较长） */
function looksLikeJwt(s) {
    if (typeof s !== 'string' || !s.trim()) return false;
    const t = s.trim();
    return t.length >= 50 && (t.split('.').length >= 2 || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]/.test(t));
}

/** 关闭同一浏览器下除 keepPage 外的所有页面，节省资源 */
const closeOtherPages = async (keepPage) => {
    if (!browser || !keepPage) return;
    try {
        const pages = await browser.pages();
        for (const p of pages) {
            if (p !== keepPage && !p.isClosed()) await p.close().catch(() => {});
        }
        if (pages.length > 1) logger.info(`已关闭其他 ${pages.length - 1} 个页面，仅保留登录页`);
    } catch (e) {
        logger.warn('关闭其他页面失败:', e.message);
    }
};

// 获取浏览器页面 URL（用于 iframe）
export const getBrowserPageUrl = async () => {
    if (!browser) {
        return {
            data: null,
            success: false,
            code: 'BROWSER_NOT_INITIALIZED',
            message: '浏览器未初始化'
        };
    }

    if (status.current !== LoginStatus.ONLINE) {
        return {
            data: null,
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '当前未登录'
        };
    }

    // 确保在 display-ads 页面
    let page;
    if (loginPage && !loginPage.isClosed()) {
        page = loginPage;
        const currentUrl = page.url();
        if (!currentUrl.includes('display-ads')) {
            await page.goto(DISPLAY_ADS_URL_GLOBAL, {
                timeout: 120 * 1000,
                waitUntil: 'networkidle2',
            });
        }
    } else {
        page = await browser.newPage();
        await setupAntiDetection(page);
        await page.goto(DISPLAY_ADS_URL_GLOBAL, {
            timeout: 120 * 1000,
            waitUntil: 'networkidle2',
        });
    }

    const url = page.url();
    
    return {
        data: { url },
        success: true,
        code: 200,
        message: '获取页面 URL 成功'
    };
};

// 执行浏览器操作（点击、输入、选择等）
export const executeBrowserAction = async (action) => {
    if (!browser) {
        return {
            data: null,
            success: false,
            code: 'BROWSER_NOT_INITIALIZED',
            message: '浏览器未初始化'
        };
    }

    if (status.current !== LoginStatus.ONLINE) {
        return {
            data: null,
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '当前未登录，无法执行操作'
        };
    }

    // 使用已登录的页面，确保在 display-ads 页面
    let page;
    if (loginPage && !loginPage.isClosed()) {
        page = loginPage;
        // 确保当前在 display-ads 页面
        const currentUrl = page.url();
        if (!currentUrl.includes('display-ads')) {
            await page.goto(DISPLAY_ADS_URL_GLOBAL, {
                timeout: 120 * 1000,
                waitUntil: 'networkidle2',
            });
        }
    } else {
        // 如果登录页面已关闭，创建新页面
        page = await browser.newPage();
        await setupAntiDetection(page);
        await page.goto(DISPLAY_ADS_URL_GLOBAL, {
            timeout: 120 * 1000,
            waitUntil: 'networkidle2',
        });
    }

    try {
        const { type, selector, value, actionType } = action;

        // 等待元素加载
        await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {
            logger.warn(`元素 ${selector} 未找到，继续执行...`);
        });

        switch (type) {
            case 'click':
                // 点击操作 - 支持多种选择器匹配方式
                const clicked = await page.evaluate((sel) => {
                    // 尝试多种方式查找元素
                    let element = document.querySelector(sel);
                    if (!element) {
                        // 如果直接选择器找不到，尝试通过 ID 查找
                        if (sel.startsWith('#')) {
                            const id = sel.substring(1);
                            element = document.getElementById(id) || 
                                     document.querySelector(`[id*="${id}"]`);
                        }
                    }
                    if (!element) {
                        // 尝试通过包含 filter_ 的 ID 查找
                        const filterMatch = sel.match(/filter_[^"'\s]+/);
                        if (filterMatch) {
                            element = document.getElementById(filterMatch[0]) ||
                                     document.querySelector(`[id*="${filterMatch[0]}"]`);
                        }
                    }
                    if (element) {
                        element.click();
                        return true;
                    }
                    return false;
                }, selector);
                if (!clicked) {
                    logger.warn(`未能找到要点击的元素: ${selector}`);
                } else {
                    logger.info(`已点击元素: ${selector}`);
                }
                break;

            case 'input':
                // 输入操作 - 支持 Ant Design 输入框
                const inputted = await page.evaluate((sel, val) => {
                    let element = document.querySelector(sel);
                    if (!element) {
                        // 尝试查找 input 元素
                        if (sel.includes('filter_')) {
                            const idMatch = sel.match(/filter_[^"'\s]+/);
                            if (idMatch) {
                                element = document.getElementById(idMatch[0]) ||
                                         document.querySelector(`input[id*="${idMatch[0]}"]`) ||
                                         document.querySelector(`#${idMatch[0]} input`);
                            }
                        }
                    }
                    if (element) {
                        // 如果是 Ant Design 的输入框，可能需要找到实际的 input 元素
                        const actualInput = element.tagName === 'INPUT' ? element : 
                                          element.querySelector('input') || element;
                        if (actualInput) {
                            actualInput.value = val;
                            actualInput.focus();
                            // 触发输入事件
                            actualInput.dispatchEvent(new Event('input', { bubbles: true }));
                            actualInput.dispatchEvent(new Event('change', { bubbles: true }));
                            actualInput.blur();
                            return true;
                        }
                    }
                    return false;
                }, selector, value);
                if (!inputted) {
                    logger.warn(`未能找到要输入的元素: ${selector}`);
                } else {
                    logger.info(`已输入值到元素: ${selector}, 值: ${value}`);
                }
                break;

            case 'select':
                // 选择操作（下拉框）- 支持 Ant Design Select
                const selected = await page.evaluate((sel, val) => {
                    let element = document.querySelector(sel);
                    if (!element) {
                        // 尝试查找 select 元素
                        if (sel.includes('filter_')) {
                            const idMatch = sel.match(/filter_[^"'\s]+/);
                            if (idMatch) {
                                element = document.getElementById(idMatch[0]) ||
                                         document.querySelector(`select[id*="${idMatch[0]}"]`) ||
                                         document.querySelector(`#${idMatch[0]} select`);
                            }
                        }
                    }
                    if (element) {
                        const actualSelect = element.tagName === 'SELECT' ? element : 
                                           element.querySelector('select') || element;
                        if (actualSelect) {
                            actualSelect.value = val;
                            actualSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    }
                    return false;
                }, selector, value);
                if (!selected) {
                    logger.warn(`未能找到要选择的元素: ${selector}`);
                } else {
                    logger.info(`已选择元素: ${selector}, 值: ${value}`);
                }
                break;

            case 'checkbox':
                // 复选框操作 - 支持 Ant Design Checkbox
                const checked = await page.evaluate((sel, checkedValue) => {
                    let element = document.querySelector(sel);
                    if (!element) {
                        // 尝试查找 checkbox 元素
                        if (sel.includes('filter_')) {
                            const idMatch = sel.match(/filter_[^"'\s]+/);
                            if (idMatch) {
                                element = document.getElementById(idMatch[0]) ||
                                         document.querySelector(`input[type="checkbox"][id*="${idMatch[0]}"]`) ||
                                         document.querySelector(`#${idMatch[0]} input[type="checkbox"]`);
                            }
                        }
                    }
                    if (element) {
                        const actualCheckbox = element.type === 'checkbox' ? element : 
                                             element.querySelector('input[type="checkbox"]') || element;
                        if (actualCheckbox && actualCheckbox.type === 'checkbox') {
                            actualCheckbox.checked = checkedValue;
                            actualCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    }
                    return false;
                }, selector, value);
                if (!checked) {
                    logger.warn(`未能找到要操作的复选框: ${selector}`);
                } else {
                    logger.info(`已${value ? '勾选' : '取消勾选'}元素: ${selector}`);
                }
                break;

            default:
                return {
                    data: null,
                    success: false,
                    code: 'INVALID_ACTION',
                    message: `不支持的操作类型: ${type}`
                };
        }

        // 如果是搜索按钮点击，等待数据加载
        if (type === 'click' && (selector.includes('search') || (selector.includes('button') && actionType === 'search'))) {
            logger.info('等待数据加载...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            // 等待网络请求完成（Puppeteer 使用 waitForNavigation 或等待特定元素）
            try {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {
                    // 如果导航超时，继续执行
                    logger.warn('等待导航超时，继续执行...');
                });
            } catch (e) {
                // 如果页面没有导航，等待一段时间让数据加载
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } else {
            // 其他操作等待较短时间
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 操作完成后，重新爬取数据
        const result = await scrapeDisplayAds();
        return result;

    } catch (error) {
        logger.error(`执行浏览器操作失败: ${error.message}`);
        return {
            data: null,
            success: false,
            code: 500,
            message: `执行操作失败: ${error.message}`
        };
    }
};



// 发起登录
export const login = async (email, password) => {
    console.log('广大大登录');
    
    // 如果浏览器未初始化，尝试重新初始化
    if (!browser) {
        logger.warn('浏览器未初始化，尝试重新初始化...');
        await initializeBrowser();
        if (!browser) {
            return {
                data: null,
                success: false,
                code: 'BROWSER_NOT_INITIALIZED',
                message: '浏览器未初始化，请检查 Chrome/Chromium 是否正确安装。错误：浏览器启动失败'
            };
        }
    }
    
    // 只检查当前状态，不主动打开页面检查
    if (status.current !== LoginStatus.LOGGED_OUT) {
        return {
            data: null,
            success: false,
            code: 'NOT_IN_LOGGED_OUT',
            message: '当前不是未登录状态'
        };
    }

    // 暂时使用硬编码的账号密码（后面可以配置）
    const loginEmail = email || process.env.GUANGDADA_EMAIL || 'test@example.com';
    const loginPassword = password || process.env.GUANGDADA_PASSWORD || 'test123456';

    const page = await browser.newPage();
    // 设置反检测措施
    await setupAntiDetection(page);
    try {
        // 等待表单加载
        await gotoGuangdadaLoginPage(page);
        logger.info('登录表单已加载');

        // 输入邮箱
        await page.waitForSelector(selectors.emailInput, { timeout: 10000 });
        // 清空输入框并输入邮箱
        await page.click(selectors.emailInput);
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type(selectors.emailInput, loginEmail, { delay: 100 });
        logger.info('已输入邮箱:', loginEmail);

        // 输入密码
        await page.waitForSelector(selectors.passwordInput, { timeout: 10000 });
        // 清空输入框并输入密码
        await page.click(selectors.passwordInput);
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type(selectors.passwordInput, loginPassword, { delay: 100 });
        logger.info('已输入密码');

        // 等待一下确保输入完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 提交表单
        await page.waitForSelector(selectors.submitButton);
        await page.click(selectors.submitButton);
        logger.info('已点击登录按钮');

        // 等待页面跳转或响应
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 检查是否登录成功（通过URL变化或页面元素判断）
        const currentUrl = page.url();
        logger.info('登录后当前URL:', currentUrl);

        // 检查是否有错误提示
        const errorMessage = await page.evaluate(() => {
            const errorEl = document.querySelector('.ant-message-error, .ant-form-item-explain-error');
            return errorEl ? errorEl.textContent : null;
        }).catch(() => null);

        if (errorMessage) {
            logger.error('登录失败，错误信息:', errorMessage);
            await page.close();
            status.update(LoginStatus.LOGGED_OUT);
            return {
        data: null,
        success: false,
                code: 'LOGIN_FAILED',
                message: `登录失败: ${errorMessage}`
            };
        }

        // 如果URL不再是登录页面，认为登录成功
        if (!currentUrl.includes('/modules/auth/login')) {
            status.update(LoginStatus.ONLINE);
            
            // 保存 cookies
            try {
                const cookies = await page.cookies();
                loginInfo.cookies = cookies;
                loginInfo.email = loginEmail;
                logger.info('已保存 cookies，数量:', cookies.length);
            } catch (e) {
                logger.error('保存 cookies 失败:', e.message);
            }
            
            // 尝试获取 Authorization token 和其他认证信息
            try {
                // 方法1: 从 localStorage/sessionStorage 获取
                const storageData = await page.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    loginInfo.authorization = storageData.authorization || storageData.Authorization || storageData.token;
                    logger.info('✅ 从存储中获取到 authorization token');
                }
                if (storageData['user-token']) {
                    loginInfo.userToken = storageData['user-token'];
                }
                if (storageData['device-id']) {
                    loginInfo.deviceId = storageData['device-id'];
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
            
            // 方法2: 通过监听网络请求获取 token
            if (!loginInfo.authorization) {
                try {
                    logger.info('尝试通过监听网络请求获取 authorization token（登录阶段，已挂载监听后 goto display-ads）');
                    const result = await new Promise((resolve) => {
                        let resolved = false;
                        const debug = { napiRequestTotal: 0, napiRequestWithAuth: 0, sampleNoAuthUrls: [] };
                        const timeout = setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                page.off('request', requestHandler);
                                resolve({ _timeout: true, _debug: debug });
                            }
                        }, 10000);
                        
                        const requestHandler = (request) => {
                            if (!resolved) {
                                const url = request.url();
                                if (!url.includes('/napi/')) return;
                                debug.napiRequestTotal += 1;
                                const headers = request.headers();
                                const authHeader = getAuthFromRequestHeaders(headers);
                                if (authHeader) {
                                    debug.napiRequestWithAuth += 1;
                                    resolved = true;
                                    clearTimeout(timeout);
                                    page.off('request', requestHandler);
                                    loginInfo.deviceId = headers['x-device-id'] || null;
                                    loginInfo.userToken = headers['x-nbs-user-token'] || null;
                                    resolve(authHeader);
                                } else {
                                    if (debug.sampleNoAuthUrls.length < 5) debug.sampleNoAuthUrls.push(url.replace(/^https?:\/\/[^/]+/, ''));
                                }
                            }
                        };
                        
                        page.on('request', requestHandler);
                        
                        // 导航到数据页面以触发 API 请求
                        page.goto('https://guangdada.net/modules/creative/display-ads', {
                            waitUntil: 'networkidle2',
                            timeout: 30000
                        }).then(() => {
                            if (!resolved) logger.info('登录阶段: 导航 display-ads 已完成，等待 /napi/ 请求带 Authorization…');
                        }).catch(() => {});
                    });
                    
                    if (typeof result === 'string') {
                        loginInfo.authorization = result;
                        logger.info('✅ 从网络请求中获取到 authorization token');
                    } else if (result && result._timeout && result._debug) {
                        const d = result._debug;
                        logger.warn('登录阶段未能从网络获取 token。详情: /napi/ 请求数=' + d.napiRequestTotal + '，带 Authorization 数=' + d.napiRequestWithAuth + (d.sampleNoAuthUrls.length ? '；无 Auth 示例: ' + d.sampleNoAuthUrls.slice(0, 3).join(', ') : ''));
                    }
                } catch (e) {
                    logger.warn('从网络请求获取 token 失败:', e.message);
                }
            }

            await syncAuthorizationCnFromJwtStorage(page);
            
            // 保存登录页面，不要关闭它
            if (loginPage && loginPage !== page) {
                await loginPage.close().catch(() => {});
            }
            loginPage = page;
            logger.info('登录成功，当前URL:', currentUrl);
            // 若尚未拿到 token，暂不关闭其他页面，避免 Execution context was destroyed，便于后续从存储/网络拿到 token
            if (loginInfo.authorization) {
                await closeOtherPages(page);
            } else {
                logger.info('登录成功但尚未拿到 authorization token，暂不关闭其他页面，保留数据页以便后续获取 token');
            }
            return {
                data: {
                    url: currentUrl,
                    cookiesSaved: !!loginInfo.cookies,
                    tokenSaved: !!loginInfo.authorization
                },
                success: true,
                code: 200,
                message: '登录成功'
            };
        } else {
            // 仍在登录页面，可能登录失败，但再等待一下看看是否有延迟跳转
            logger.warn('仍在登录页面，等待2秒检查是否有延迟跳转...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const finalUrl = page.url();
            if (!finalUrl.includes('/modules/auth/login')) {
                // 延迟跳转成功
                status.update(LoginStatus.ONLINE);
                
                // 保存 cookies
                try {
                    const cookies = await page.cookies();
                    loginInfo.cookies = cookies;
                    loginInfo.email = loginEmail;
                    logger.info('已保存 cookies，数量:', cookies.length);
                } catch (e) {
                    logger.error('保存 cookies 失败:', e.message);
                }
                
                // 尝试获取 Authorization token
                try {
                    const storageData = await page.evaluate(() => {
                        const keys = ['authorization', 'token', 'authToken', 'accessToken', 'Authorization', 'user-token', 'device-id'];
                        const result = {};
                        for (const key of keys) {
                            const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                            if (value) result[key] = value;
                        }
                        return result;
                    });
                    
                    if (storageData.authorization || storageData.Authorization || storageData.token) {
                        loginInfo.authorization = storageData.authorization || storageData.Authorization || storageData.token;
                    }
                    if (storageData['user-token']) {
                        loginInfo.userToken = storageData['user-token'];
                    }
                    if (storageData['device-id']) {
                        loginInfo.deviceId = storageData['device-id'];
                    }
                } catch (e) {
                    logger.warn('从存储获取 token 失败:', e.message);
                }

                await syncAuthorizationCnFromJwtStorage(page);
                
                if (loginPage && loginPage !== page) {
                    await loginPage.close().catch(() => {});
                }
                loginPage = page;
                logger.info('登录成功（延迟跳转），当前URL:', finalUrl);
                if (loginInfo.authorization) {
                    await closeOtherPages(page);
                } else {
                    logger.info('登录成功（延迟跳转）但尚未拿到 token，暂不关闭其他页面');
                }
        return {
            data: {
                        url: finalUrl,
                        cookiesSaved: !!loginInfo.cookies,
                        tokenSaved: !!loginInfo.authorization
                    },
                    success: true,
                    code: 200,
                    message: '登录成功'
                };
            } else {
                // 确实登录失败
                logger.warn('登录失败，仍在登录页面');
                await page.close();
                status.update(LoginStatus.LOGGED_OUT);
        return {
            data: null,
            success: false,
                    code: 'LOGIN_FAILED',
                    message: '登录失败，请检查账号密码'
                };
            }
        }
    } catch (error) {
        logger.error('登录过程发生错误:', error);
        await page.close().catch(() => {});
        status.update(LoginStatus.LOGGED_OUT);
        return {
            data: null,
            success: false,
            code: 'LOGIN_ERROR',
            message: `登录过程发生错误: ${error.message}`
        };
    }
}

export const refreshImgCode = async () => {
        return {
            data: null,
            success: false,
        code: 'NOT_IMPLEMENTED',
        message: '广大大网站暂不支持图形验证码刷新功能'
    };
}

export const verifyImgCode = async (imgCode) => {
                return {
                    data: null,
        success: false,
        code: 'NOT_IMPLEMENTED',
        message: '广大大网站暂不支持图形验证码验证功能'
    };
}

// 验证码校验（广大大网站暂不需要）
export const verifyCode = async (verificationCode) => {
            return {
                data: null,
                success: false,
        code: 'NOT_IMPLEMENTED',
        message: '广大大网站暂不支持验证码校验功能'
            };
}

// 获取登录信息
export const getLoginInfo = () => {
    return {
        cookies: loginInfo.cookies,
        email: loginInfo.email,
        authorization: loginInfo.authorization,
        deviceId: loginInfo.deviceId,
        userToken: loginInfo.userToken,
        isLoggedIn: status.current === LoginStatus.ONLINE
    };
};

/** 仅请求 multi-modal-search，返回 multimodal_md5。旧版：字符串 → type=1+content。对象：与官网 multipart 一致——图 type=2+file；视频文件 type=3+file+空 content；链接 type=3+content、无 file。 */
export const fetchMultiModalSearch = async (params = {}) => {
    const isLegacyString = typeof params === 'string';
    const isLegacyArray = !isLegacyString && Array.isArray(params) && params.length > 0;
    let type = '1';
    let content = '';
    let snapshot = 'false';
    let fileBase64 = '';
    let fileName = '';
    let fileMime = '';

    if (isLegacyString) {
        content = String(params).trim();
        type = '1';
    } else if (isLegacyArray) {
        content = String(params[0]).trim();
        type = '1';
    } else if (params && typeof params === 'object') {
        type = params.multimodal_search_type != null ? String(params.multimodal_search_type) : '1';
        content = params.multimodal_search_content != null ? String(params.multimodal_search_content).trim() : '';
        snapshot = params.snapshot_flag != null ? String(params.snapshot_flag) : 'false';
        const f = params.file;
        if (f && typeof f === 'object' && f.base64) {
            fileBase64 = String(f.base64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
            fileName = f.filename != null ? String(f.filename).slice(0, 512) : 'upload';
            fileMime = f.mimeType != null ? String(f.mimeType).slice(0, 128) : 'application/octet-stream';
        }
    }

    const hasFile = fileBase64.length > 0;
    if (type === '1' && !content) {
        return { success: false, data: { multimodal_md5: null }, code: 400, message: '关键词为空' };
    }
    if (type === '2' && !hasFile) {
        return { success: false, data: { multimodal_md5: null }, code: 400, message: '图片搜索需上传文件（multipart file）' };
    }
    if (type === '3' && !hasFile && !content) {
        return { success: false, data: { multimodal_md5: null }, code: 400, message: '请提供视频文件或素材链接' };
    }

    if (status.current !== LoginStatus.ONLINE) {
        return { success: false, data: { multimodal_md5: null }, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { success: false, data: { multimodal_md5: null }, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) {
                logger.warn('fetchMultiModalSearch 从存储获取 token 失败:', e.message);
            }
        }
        const multimodalResult = await loginPage.evaluate(async (opts, authToken, devId, uToken) => {
            const form = new FormData();
            if (opts.fileBase64) {
                let binary;
                try {
                    binary = atob(opts.fileBase64);
                } catch (e) {
                    return { ok: false, multimodal_md5: null, err: 'base64' };
                }
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: opts.fileMime || 'application/octet-stream' });
                form.append('file', blob, opts.fileName || 'upload');
            }
            form.append('multimodal_search_type', opts.type);
            form.append('multimodal_search_content', opts.content || '');
            form.append('snapshot_flag', opts.snapshot);
            const headers = {
                'Accept': 'application/json, text/plain, */*',
                'Authorization': authToken || '',
                'Origin': 'https://guangdada.net',
                'Referer': 'https://guangdada.net/modules/creative/display-ads',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };
            if (devId) headers['x-device-id'] = devId;
            if (uToken) headers['x-nbs-user-token'] = uToken;
            headers['x-product-id'] = '2';
            headers['x-timezone'] = '+0800';
            const res = await fetch('/napi/v1/creative/multi-modal-search', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: form
            });
            const text = await res.text();
            let data = null;
            if (text && text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    return { ok: false, multimodal_md5: null };
                }
            }
            const md5 = data && data.data && data.data.multimodal_md5 ? data.data.multimodal_md5 : null;
            const cdnUrl =
                data && data.data && data.data.multi_modal_file_cdn_url != null
                    ? String(data.data.multi_modal_file_cdn_url).trim()
                    : null;
            return { ok: res.ok, multimodal_md5: md5, multi_modal_file_cdn_url: cdnUrl || null };
        }, {
            type,
            content,
            snapshot,
            fileBase64: hasFile ? fileBase64 : '',
            fileName: hasFile ? fileName : '',
            fileMime: hasFile ? fileMime : '',
        }, authorizationToken, deviceId, userToken);
        const multimodal_md5 = multimodalResult && multimodalResult.multimodal_md5 ? multimodalResult.multimodal_md5 : null;
        const multi_modal_file_cdn_url =
            multimodalResult && multimodalResult.multi_modal_file_cdn_url
                ? String(multimodalResult.multi_modal_file_cdn_url).trim()
                : null;
        const dataPayload = { multimodal_md5 };
        if (multi_modal_file_cdn_url) dataPayload.multi_modal_file_cdn_url = multi_modal_file_cdn_url;
        return {
            success: !!multimodal_md5,
            data: dataPayload,
            code: multimodal_md5 ? 200 : 500,
            message: multimodal_md5 ? 'ok' : (multimodalResult && multimodalResult.err === 'base64' ? '文件 Base64 无效' : (multimodalResult && !multimodalResult.ok ? 'multi-modal-search 请求失败' : '未返回 multimodal_md5'))
        };
    } catch (error) {
        logger.error('fetchMultiModalSearch 失败:', error);
        return {
            success: false,
            data: { multimodal_md5: null },
            code: 500,
            message: `multi-modal-search 失败: ${error.message || '未知错误'}`
        };
    }
};

/**
 * 「素材内容」：有 multimodal_md5 时沿用多模态排序；纯文本关键词直连 list/count（keyword 数组 + search_type=1），跳过 multi-modal-search；
 * 关键词为 http(s) 链接时仍走 multi-modal-search(type=3)。
 */
async function resolveGuangdadaMaterialCategoryForNapi(requestBody, searchParams, opts = {}) {
    const { setDefaultMultimodalSort = true } = opts;
    const keywordRaw = requestBody.keyword ?? searchParams?.keyword ?? searchParams?.keyWord;
    const firstKw =
        Array.isArray(keywordRaw) && keywordRaw.length > 0
            ? String(keywordRaw[0]).trim()
            : typeof keywordRaw === 'string'
              ? keywordRaw.trim()
              : '';
    const hasMultimodalMd5 = requestBody.multimodal_md5 != null && String(requestBody.multimodal_md5).trim() !== '';
    if (hasMultimodalMd5) {
        if (setDefaultMultimodalSort) {
            requestBody.sort_field = requestBody.sort_field || '-multimodal_similarity';
        }
        logger.info('广大大素材内容：使用前端传入的 multimodal_md5');
        return;
    }
    if (!firstKw) {
        logger.warn('广大大素材内容模式下关键词为空');
        return;
    }
    if (/^https?:\/\//i.test(firstKw)) {
        const mmParams = {
            multimodal_search_type: '3',
            multimodal_search_content: firstKw,
            snapshot_flag: 'false',
        };
        logger.info('广大大素材内容：链接关键词走 multi-modal-search (type=3)');
        const mm = await fetchMultiModalSearch(mmParams);
        if (mm.success && mm.data && mm.data.multimodal_md5) {
            requestBody.multimodal_md5 = mm.data.multimodal_md5;
            if (setDefaultMultimodalSort) {
                requestBody.sort_field = requestBody.sort_field || '-multimodal_similarity';
            }
        } else {
            logger.warn('广大大 multi-modal-search 未返回 multimodal_md5:', mm);
        }
        return;
    }
    const kwList =
        Array.isArray(keywordRaw) && keywordRaw.length > 0
            ? keywordRaw.map((k) => String(k).trim()).filter(Boolean)
            : [firstKw];
    requestBody.keyword = kwList;
    requestBody.search_type = 1;
    if (requestBody.position === undefined || requestBody.position === null || requestBody.position === '') {
        requestBody.position = '0';
    }
    requestBody.new_advertiser_flag = requestBody.new_advertiser_flag ?? false;
    const sf = requestBody.sort_field;
    if (sf === '-multimodal_similarity' || sf === undefined || sf === null || sf === '') {
        requestBody.sort_field = '-correlation';
    }
    delete requestBody.multimodal_md5;
    logger.info('广大大素材内容：纯文本直连 napi（keyword[] + search_type=1），已跳过 multi-modal-search');
}

// 请求数据接口
export const fetchSearchData = async (searchParams = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return {
            data: null,
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '未登录，请先登录'
        };
    }
    
    // 如果没有登录页面，无法发送请求
    if (!loginPage || loginPage.isClosed()) {
        return {
            data: null,
            success: false,
            code: 'NO_LOGIN_PAGE',
            message: '登录页面已关闭，请重新登录'
        };
    }

    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);
    
    try {
        // 首先尝试获取 authorization token
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        
        // 如果还没有 token，尝试从页面获取
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) {
                    userToken = storageData['user-token'];
                    loginInfo.userToken = userToken;
                }
                if (storageData['device-id']) {
                    deviceId = storageData['device-id'];
                    loginInfo.deviceId = deviceId;
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        
        // 仍无 token 时先尝试从 storage 兜底读取（不依赖固定 key，与 curl 中 Authorization 对应）
        if (!authorizationToken) {
            try {
                const storageDump = await loginPage.evaluate(() => {
                    const out = {};
                    const tryKeys = (s) => {
                        try {
                            for (let i = 0; i < s.length; i++) {
                                const k = s.key(i);
                                const v = s.getItem(k);
                                if (k && v && /auth|token|bearer|user|jwt|nbs/i.test(k)) out[k] = v;
                            }
                        } catch (_) {}
                    };
                    tryKeys(localStorage);
                    tryKeys(sessionStorage);
                    return out;
                });
                for (const v of Object.values(storageDump)) {
                    if (looksLikeJwt(v)) {
                        authorizationToken = v.trim();
                        loginInfo.authorization = authorizationToken;
                        logger.info('✅ 从页面存储中获取到 authorization token（兜底）');
                        break;
                    }
                }
                const userTokenVal = storageDump['user-token'];
                if (userTokenVal && typeof userTokenVal === 'string') {
                    userToken = userTokenVal;
                    loginInfo.userToken = userToken;
                }
            } catch (e) {
                logger.warn('从存储兜底获取 token 失败:', e.message);
            }
        }
        
        // 如果还是没有 token，通过导航到数据页面并监听网络请求获取
        if (!authorizationToken) {
            try {
                logger.info('尝试通过导航到数据页面获取 authorization token（已挂载 request/response 监听，随后执行 goto）');
                const tokenInfo = await new Promise((resolve) => {
                    let resolved = false;
                    const debug = { napiRequestTotal: 0, napiRequestWithAuth: 0, sampleUrls: [], sampleNoAuthUrls: [] };
                    const timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            loginPage.off('request', requestHandler);
                            loginPage.off('response', responseHandler);
                            resolve({ _timeout: true, _debug: debug });
                        }
                    }, 25000);
                    
                    const requestHandler = (request) => {
                        if (!resolved) {
                            const url = request.url();
                            if (!url.includes('/napi/')) return;
                            debug.napiRequestTotal += 1;
                            const headers = request.headers();
                            const authHeader = getAuthFromRequestHeaders(headers);
                            if (authHeader) {
                                debug.napiRequestWithAuth += 1;
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('request', requestHandler);
                                loginPage.off('response', responseHandler);
                                resolve({
                                    authorization: authHeader,
                                    deviceId: headers['x-device-id'] || null,
                                    userToken: headers['x-nbs-user-token'] || null
                                });
                            } else {
                                if (debug.sampleNoAuthUrls.length < 5) debug.sampleNoAuthUrls.push(url.replace(/^https?:\/\/[^/]+/, ''));
                            }
                            if (debug.sampleUrls.length < 5) debug.sampleUrls.push(url.replace(/^https?:\/\/[^/]+/, ''));
                        }
                    };
                    const responseHandler = async (response) => {
                        if (resolved) return;
                        const url = response.url();
                        if (!url.includes('/napi/') || response.status() !== 200) return;
                        try {
                            const headers = response.headers();
                            const authFromHeader = getAuthFromRequestHeaders(headers) || headers['x-auth-token'] || headers['x-nbs-token'];
                            if (authFromHeader) {
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('request', requestHandler);
                                loginPage.off('response', responseHandler);
                                resolve({
                                    authorization: authFromHeader,
                                    deviceId: null,
                                    userToken: null
                                });
                                return;
                            }
                            const body = await response.json().catch(() => null);
                            if (body && typeof body === 'object') {
                                const t = body.token || body.authorization || body.accessToken || body.access_token || (body.data && (body.data.token || body.data.authorization));
                                if (t && typeof t === 'string' && t.trim()) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    loginPage.off('request', requestHandler);
                                    loginPage.off('response', responseHandler);
                                    resolve({ authorization: t.trim(), deviceId: null, userToken: null });
                                }
                            }
                        } catch (_) {}
                    };
                    
                    loginPage.on('request', requestHandler);
                    loginPage.on('response', responseHandler);
                    
                    // 导航到数据页面，触发 count/list 等 API 请求以捕获 token（不关闭当前页，仅 reload）
                    loginPage.goto('https://guangdada.net/modules/creative/display-ads', {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    }).then(() => {
                        if (!resolved) logger.info('导航 display-ads 已完成(networkidle2)，等待 /napi/ 请求带 Authorization…');
                    }).catch((e) => {
                        if (!resolved) logger.warn('导航 display-ads 失败或超时:', e.message);
                    });
                });
                
                if (tokenInfo && tokenInfo.authorization) {
                    authorizationToken = tokenInfo.authorization;
                    deviceId = tokenInfo.deviceId;
                    userToken = tokenInfo.userToken;
                    loginInfo.authorization = authorizationToken;
                    if (deviceId) loginInfo.deviceId = deviceId;
                    if (userToken) loginInfo.userToken = userToken;
                    logger.info('✅ 从网络请求中获取到 authorization token');
                } else if (tokenInfo && tokenInfo._timeout && tokenInfo._debug) {
                    const d = tokenInfo._debug;
                    logger.warn('⚠️ 未能从网络请求中获取到 authorization token。详情: 在 25s 内共观察到 /napi/ 请求数=' + d.napiRequestTotal + '，其中带 Authorization 的请求数=' + d.napiRequestWithAuth + (d.sampleUrls.length ? '；示例 URL: ' + d.sampleUrls.slice(0, 3).join(', ') : '') + (d.sampleNoAuthUrls.length ? '；无 Authorization 的示例: ' + d.sampleNoAuthUrls.slice(0, 3).join(', ') : ''));
                } else {
                    // 兜底：导航后从页面 storage 读取所有可能为 token 的键（不依赖固定 key 名）
                    try {
                        await new Promise(r => setTimeout(r, 2000));
                        const storageDump = await loginPage.evaluate(() => {
                            const out = {};
                            const tryKeys = (s) => {
                                try {
                                    for (let i = 0; i < s.length; i++) {
                                        const k = s.key(i);
                                        const v = s.getItem(k);
                                        if (k && v && /auth|token|bearer|user|jwt|nbs/i.test(k)) out[k] = v;
                                    }
                                } catch (_) {}
                            };
                            tryKeys(localStorage);
                            tryKeys(sessionStorage);
                            return out;
                        });
                        for (const v of Object.values(storageDump)) {
                            if (looksLikeJwt(v)) {
                                authorizationToken = v.trim();
                                loginInfo.authorization = authorizationToken;
                                logger.info('✅ 从页面存储中获取到 authorization token（兜底）');
                                break;
                            }
                        }
                        if (!authorizationToken) logger.warn('⚠️ 未能从网络请求中获取到 authorization token');
                    } catch (e) {
                        logger.warn('从网络请求获取 token 失败:', e.message);
                    }
                }
            } catch (e) {
                logger.warn('从网络请求获取 token 失败:', e.message);
            }
        }
        
        // 若前端已发送广大大 API 格式（含 seen_begin、search_type、tag_ids 等），直接使用；否则从表单参数构建
        let requestBody = isGuangdadaSearchParamsApiFormat(searchParams) ? { ...searchParams } : buildGuangdadaRequestBody(searchParams);
        // 素材内容：有 multimodal_md5 则沿用；纯文本关键词直连 list（keyword[] + search_type=1）
        const isMaterialCategory = (requestBody.guangdada_search_category || searchParams.guangdada_search_category || searchParams.guangdadaSearchCategory) === '素材内容';
        if (isMaterialCategory) {
            await resolveGuangdadaMaterialCategoryForNapi(requestBody, searchParams, { setDefaultMultimodalSort: true });
            delete requestBody.guangdada_search_category;
        }
        logger.info('广大大实际请求体 (guangdada.net/napi/v1/creative/list):', JSON.stringify(requestBody, null, 2));
        // 强诊断：核对前端期望排序与最终下发排序（特别是素材内容+multimodal）
        logger.info(
            '[强诊断][广大大 list 排序] expected=%s, actual=%s, hasMultimodal=%s, category=%s',
            searchParams?.sort_field ?? '(none)',
            requestBody?.sort_field ?? '(none)',
            !!(requestBody?.multimodal_md5 && String(requestBody.multimodal_md5).trim()),
            requestBody?.guangdada_search_category ?? searchParams?.guangdada_search_category ?? searchParams?.guangdadaSearchCategory ?? '(none)'
        );
        
        // 使用 Puppeteer 页面发送请求
        const response = await loginPage.evaluate(async (body, authToken, deviceId, userToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Content-Type': 'application/json',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                
                // 添加自定义 headers
                if (deviceId) {
                    headers['x-device-id'] = deviceId;
                }
                if (userToken) {
                    headers['x-nbs-user-token'] = userToken;
                }
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                
                const response = await fetch('/napi/v1/creative/list', {
                    method: 'POST',
                    headers: headers,
                    credentials: 'include',
                    body: JSON.stringify(body)
                });
                
                // 获取响应文本
                const text = await response.text();
                let data = null;
                
                // 尝试解析 JSON
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        console.error('JSON 解析失败:', parseError, '响应内容:', text.substring(0, 200));
                        return {
                            ok: false,
                            status: response.status,
                            statusText: `JSON 解析失败: ${parseError.message}`,
                            data: {
                                code: -1,
                                message: `响应解析失败: ${text.substring(0, 100)}`,
                                error: parseError.message
                            }
                        };
                    }
                }
                
                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                };
            } catch (error) {
                console.error('Fetch 请求失败:', error);
                return {
                    ok: false,
                    status: 500,
                    statusText: error.message,
                    data: {
                        code: -1,
                        message: `请求失败: ${error.message}`,
                        error: error.toString()
                    }
                };
            }
        }, requestBody, authorizationToken, deviceId, userToken);
        
        // 更新 cookies
        try {
            const cookies = await loginPage.cookies();
            loginInfo.cookies = cookies;
        } catch (e) {
            logger.warn('更新 cookies 失败:', e.message);
        }
        
        // 如果返回 token 相关错误，尝试重新获取 token
        if (response.data && (response.data.code === 401 || response.status === 401)) {
            logger.warn('服务器返回 401 错误，尝试重新获取 token');
            // 可以在这里实现重新获取 token 的逻辑
        }

        // 强诊断：抽样输出返回顺序，快速判断上游是否按 sort_field 生效
        try {
            const rows =
                (Array.isArray(response?.data?.data?.list) && response.data.data.list) ||
                (Array.isArray(response?.data?.list) && response.data.list) ||
                (Array.isArray(response?.data?.data?.rows) && response.data.data.rows) ||
                [];
            if (rows.length > 0) {
                const reqSort = String(requestBody?.sort_field || '').trim();
                const sortKey = reqSort.startsWith('-') ? reqSort.slice(1) : reqSort;
                const head = rows.slice(0, 10).map((it, idx) => ({
                    i: idx + 1,
                    ad_key: it?.ad_key ?? it?.creative_key ?? null,
                    heat_degree: it?.heat_degree ?? null,
                    heat: it?.heat ?? null,
                    first_seen: it?.first_seen ?? null,
                    last_seen: it?.last_seen ?? null,
                    sortValue: sortKey ? (it?.[sortKey] ?? null) : null,
                }));
                logger.info('[强诊断][广大大 list 返回前10条关键字段] %s', JSON.stringify(head));
            } else {
                logger.info('[强诊断][广大大 list 返回前10条关键字段] 无可用列表数据');
            }
        } catch (diagErr) {
            logger.warn('[强诊断][广大大 list] 返回数据抽样失败: %s', diagErr?.message || diagErr);
        }
        
        return {
            data: response.data,
            success: response.ok,
            code: response.status,
            message: response.ok ? '请求成功' : `请求失败: ${response.statusText}`
        };
    } catch (error) {
        logger.error('请求数据失败:', error);
        return {
            data: null,
            success: false,
            code: 500,
            message: `请求失败: ${error.message}`
        };
    }
};

/** 广大大 count 接口：参数与 search 一致，返回 all_total / default_total / result_total，用于分页 */
export const fetchCountData = async (searchParams = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return {
            data: null,
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '未登录，请先登录'
        };
    }
    if (!loginPage || loginPage.isClosed()) {
        return {
            data: null,
            success: false,
            code: 'NO_LOGIN_PAGE',
            message: '登录页面已关闭，请重新登录'
        };
    }
    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) {
                    userToken = storageData['user-token'];
                    loginInfo.userToken = userToken;
                }
                if (storageData['device-id']) {
                    deviceId = storageData['device-id'];
                    loginInfo.deviceId = deviceId;
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        if (!authorizationToken) {
            try {
                const storageDump = await loginPage.evaluate(() => {
                    const out = {};
                    const tryKeys = (s) => {
                        try {
                            for (let i = 0; i < s.length; i++) {
                                const k = s.key(i);
                                const v = s.getItem(k);
                                if (k && v && /auth|token|bearer|user|jwt|nbs/i.test(k)) out[k] = v;
                            }
                        } catch (_) {}
                    };
                    tryKeys(localStorage);
                    tryKeys(sessionStorage);
                    return out;
                });
                for (const v of Object.values(storageDump)) {
                    if (looksLikeJwt(v)) {
                        authorizationToken = v.trim();
                        loginInfo.authorization = authorizationToken;
                        logger.info('✅ 从页面存储中获取到 authorization token（兜底）');
                        break;
                    }
                }
                const userTokenVal = storageDump['user-token'];
                if (userTokenVal && typeof userTokenVal === 'string') {
                    userToken = userTokenVal;
                    loginInfo.userToken = userToken;
                }
            } catch (e) {
                logger.warn('从存储兜底获取 token 失败:', e.message);
            }
        }
        if (!authorizationToken) {
            try {
                logger.info('尝试通过导航到数据页面获取 authorization token（count 流程，已挂载监听）');
                const tokenInfo = await new Promise((resolve) => {
                    let resolved = false;
                    const debug = { napiRequestTotal: 0, napiRequestWithAuth: 0, sampleUrls: [], sampleNoAuthUrls: [] };
                    const timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            loginPage.off('request', requestHandler);
                            loginPage.off('response', responseHandler);
                            resolve({ _timeout: true, _debug: debug });
                        }
                    }, 25000);
                    const requestHandler = (request) => {
                        if (!resolved) {
                            const url = request.url();
                            if (!url.includes('/napi/')) return;
                            debug.napiRequestTotal += 1;
                            const headers = request.headers();
                            const authHeader = getAuthFromRequestHeaders(headers);
                            if (authHeader) {
                                debug.napiRequestWithAuth += 1;
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('request', requestHandler);
                                loginPage.off('response', responseHandler);
                                resolve({
                                    authorization: authHeader,
                                    deviceId: headers['x-device-id'] || null,
                                    userToken: headers['x-nbs-user-token'] || null
                                });
                            } else {
                                if (debug.sampleNoAuthUrls.length < 5) debug.sampleNoAuthUrls.push(url.replace(/^https?:\/\/[^/]+/, ''));
                            }
                            if (debug.sampleUrls.length < 5) debug.sampleUrls.push(url.replace(/^https?:\/\/[^/]+/, ''));
                        }
                    };
                    const responseHandler = async (response) => {
                        if (resolved) return;
                        const url = response.url();
                        if (!url.includes('/napi/') || response.status() !== 200) return;
                        try {
                            const headers = response.headers();
                            const authFromHeader = getAuthFromRequestHeaders(headers) || headers['x-auth-token'] || headers['x-nbs-token'];
                            if (authFromHeader) {
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('request', requestHandler);
                                loginPage.off('response', responseHandler);
                                resolve({ authorization: authFromHeader, deviceId: null, userToken: null });
                                return;
                            }
                            const body = await response.json().catch(() => null);
                            if (body && typeof body === 'object') {
                                const t = body.token || body.authorization || body.accessToken || body.access_token || (body.data && (body.data.token || body.data.authorization));
                                if (t && typeof t === 'string' && t.trim()) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    loginPage.off('request', requestHandler);
                                    loginPage.off('response', responseHandler);
                                    resolve({ authorization: t.trim(), deviceId: null, userToken: null });
                                }
                            }
                        } catch (_) {}
                    };
                    loginPage.on('request', requestHandler);
                    loginPage.on('response', responseHandler);
                    loginPage.goto('https://guangdada.net/modules/creative/display-ads', {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    }).catch(() => {});
                });
                if (tokenInfo && tokenInfo.authorization) {
                    authorizationToken = tokenInfo.authorization;
                    deviceId = tokenInfo.deviceId;
                    userToken = tokenInfo.userToken;
                    loginInfo.authorization = authorizationToken;
                    if (deviceId) loginInfo.deviceId = deviceId;
                    if (userToken) loginInfo.userToken = userToken;
                    logger.info('✅ 从网络请求中获取到 authorization token');
                } else if (tokenInfo && tokenInfo._timeout && tokenInfo._debug) {
                    const d = tokenInfo._debug;
                    logger.warn('⚠️ 未能从网络请求中获取到 authorization token(count)。详情: /napi/ 请求数=' + d.napiRequestTotal + '，带 Authorization 数=' + d.napiRequestWithAuth + (d.sampleNoAuthUrls.length ? '；无 Auth 示例: ' + d.sampleNoAuthUrls.slice(0, 3).join(', ') : ''));
                } else {
                    try {
                        await new Promise(r => setTimeout(r, 2000));
                        const storageDump = await loginPage.evaluate(() => {
                            const out = {};
                            const tryKeys = (s) => {
                                try {
                                    for (let i = 0; i < s.length; i++) {
                                        const k = s.key(i);
                                        const v = s.getItem(k);
                                        if (k && v && /auth|token|bearer|user|jwt|nbs/i.test(k)) out[k] = v;
                                    }
                                } catch (_) {}
                            };
                            tryKeys(localStorage);
                            tryKeys(sessionStorage);
                            return out;
                        });
                        for (const v of Object.values(storageDump)) {
                            if (looksLikeJwt(v)) {
                                authorizationToken = v.trim();
                                loginInfo.authorization = authorizationToken;
                                logger.info('✅ 从页面存储中获取到 authorization token（兜底）');
                                break;
                            }
                        }
                        if (!authorizationToken) logger.warn('⚠️ 未能从网络请求中获取到 authorization token');
                    } catch (e) {
                        logger.warn('从网络请求获取 token 失败:', e.message);
                    }
                }
            } catch (e) {
                logger.warn('从网络请求获取 token 失败:', e.message);
            }
        }
        let requestBody = isGuangdadaSearchParamsApiFormat(searchParams) ? { ...searchParams } : buildGuangdadaRequestBody(searchParams);
        const isMaterialCategoryCount = (requestBody.guangdada_search_category || searchParams.guangdada_search_category || searchParams.guangdadaSearchCategory) === '素材内容';
        if (isMaterialCategoryCount) {
            await resolveGuangdadaMaterialCategoryForNapi(requestBody, searchParams, { setDefaultMultimodalSort: false });
            delete requestBody.guangdada_search_category;
        }
        // 与 list 保持一致：count 不再覆盖 sort_field，直接沿用前端/构建后的排序参数
        logger.info('广大大 count 请求体 (guangdada.net/napi/v1/creative/count):', JSON.stringify(requestBody, null, 2));

        const response = await loginPage.evaluate(async (body, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Content-Type': 'application/json',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';

                const res = await fetch('/napi/v1/creative/count', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(body)
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        return {
                            ok: false,
                            status: res.status,
                            statusText: `JSON 解析失败: ${parseError.message}`,
                            data: { id: 'ERROR', message: parseError.message, data: null }
                        };
                    }
                }
                return {
                    ok: res.ok,
                    status: res.status,
                    statusText: res.statusText,
                    data
                };
            } catch (error) {
                return {
                    ok: false,
                    status: 500,
                    statusText: error.message,
                    data: { id: 'ERROR', message: error.message, data: null }
                };
            }
        }, requestBody, authorizationToken, deviceId, userToken);

        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: apiData,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || response.statusText || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 count 请求失败:', error);
        return {
            data: null,
            success: false,
            code: 500,
            message: `请求失败: ${error.message}`
        };
    }
};

/**
 * 广大大广告主联想：GET /napi/v1/advertiser/association?association_kwd=xxx&app_type=1&is_parse=1
 * 用于搜索框输入时下拉展示广告主列表（近90天创意、上月下载）
 */
export const fetchAdvertiserAssociation = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const associationKwd = params.association_kwd != null ? String(params.association_kwd).trim() : '';
    if (!associationKwd) {
        return { data: { advertiser_list: [] }, success: true, code: 200, message: 'success' };
    }
    const appType = params.app_type != null ? Number(params.app_type) : 1;
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const qs = new URLSearchParams({
            association_kwd: associationKwd,
            app_type: String(appType),
            is_parse: '1'
        });
        const requestUrl = `/napi/v1/advertiser/association?${qs.toString()}`;
        const response = await loginPage.evaluate(async (url, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        return { ok: false, status: res.status, statusText: parseError.message, data: null };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (error) {
                return { ok: false, status: 500, statusText: error.message, data: null };
            }
        }, requestUrl, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: apiData && apiData.data ? apiData.data : { advertiser_list: [] },
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || response.statusText || '请求失败')
        };
    } catch (error) {
        logger.error('广大大广告主联想请求失败:', error);
        return {
            data: { advertiser_list: [] },
            success: false,
            code: 500,
            message: `请求失败: ${error.message}`
        };
    }
};

/** 广大大素材内容属性：GET /napi/v1/creative/ai-tags-v2?app_type=1 */
export const fetchAiTagsV2 = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: [], success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: [], success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);
    const appTypeRaw = Number(params.app_type);
    const appType = [1, 2, 3].includes(appTypeRaw) ? appTypeRaw : 1;
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) {
                logger.warn('ai-tags-v2 从存储获取 token 失败:', e.message);
            }
        }

        const qs = new URLSearchParams({ app_type: String(appType) });
        const requestUrl = `/napi/v1/creative/ai-tags-v2?${qs.toString()}`;
        const response = await loginPage.evaluate(async (url, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        return { ok: false, status: res.status, statusText: parseError.message, data: null };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (error) {
                return { ok: false, status: 500, statusText: error.message, data: null };
            }
        }, requestUrl, authorizationToken, deviceId, userToken);

        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: Array.isArray(apiData?.data) ? apiData.data : [],
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || response.statusText || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 ai-tags-v2 请求失败:', error);
        return {
            data: [],
            success: false,
            code: 500,
            message: `请求失败: ${error.message}`
        };
    }
};

function getLastFullWeekMondayYmdBeijing() {
    const dayMs = 24 * 60 * 60 * 1000;
    const nowBeijing = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const todayUtcMidnight = Date.UTC(
        nowBeijing.getUTCFullYear(),
        nowBeijing.getUTCMonth(),
        nowBeijing.getUTCDate()
    );
    const daysSinceMonday = (nowBeijing.getUTCDay() + 6) % 7;
    const lastMonday = new Date(todayUtcMidnight - (daysSinceMonday + 7) * dayMs);
    const y = lastMonday.getUTCFullYear();
    const m = String(lastMonday.getUTCMonth() + 1).padStart(2, '0');
    const d = String(lastMonday.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

export function normalizeCreativeRankListBody(params = {}) {
    const chartTypeRaw = params.chart_type ?? params.chartType ?? 3;
    const chartType = ['1', '2', '3'].includes(String(chartTypeRaw)) ? String(chartTypeRaw) : '3';
    const appTypeRaw = Number(params.app_type ?? params.appType ?? 1);
    const appType = [1, 2, 3].includes(appTypeRaw) ? String(appTypeRaw) : '1';
    const dateRaw = params.date ?? params.rank_week;
    const date = dateRaw != null && /^\d{8}$/.test(String(dateRaw).trim())
        ? String(dateRaw).trim()
        : getLastFullWeekMondayYmdBeijing();
    const sortTypeRaw = params.sort_type ?? params.sortType ?? 1;
    const body = {
        app_type: appType,
        chart_type: chartType,
        date,
        sort_type: String(sortTypeRaw || 1),
    };

    const copyArray = (targetKey, sourceKey = targetKey, mapNumber = false) => {
        const value = params[sourceKey];
        if (!Array.isArray(value) || value.length === 0) return;
        const list = value
            .map((item) => (mapNumber ? parseInt(item, 10) : String(item).trim()))
            .filter((item) => (mapNumber ? !Number.isNaN(item) : item !== ''));
        if (list.length > 0) body[targetKey] = list;
    };
    copyArray('tag_ids', 'tag_ids', true);
    copyArray('platform', 'platform');
    copyArray('geo', 'geo');
    copyArray('language', 'language');

    const os = params.os != null && params.os !== '' ? parseInt(params.os, 10) : null;
    if (os != null && !Number.isNaN(os)) body.os = os;
    if (params.top_type != null && String(params.top_type).trim() !== '') body.top_type = String(params.top_type).trim();
    if (params.ads_type != null && String(params.ads_type).trim() !== '') {
        const adsType = parseInt(params.ads_type, 10);
        body.ads_type = Number.isNaN(adsType) ? String(params.ads_type).trim() : adsType;
    }
    if (params.is_new_ads === true || params.is_new_ads === 1 || params.is_new_ads === '1') body.is_new_ads = true;
    return body;
}

/** 广大大创意排行榜：POST /napi/v1/creative/creative-rank/list */
export const fetchCreativeRankList = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);

    try {
        const { authorizationToken, deviceId, userToken } = await resolveGuangdadaNapiAuthFromLoginPage();
        const requestBody = normalizeCreativeRankListBody(params);
        logger.info('广大大创意排行榜请求体:', JSON.stringify(requestBody, null, 2));

        const response = await loginPage.evaluate(async (body, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Content-Type': 'application/json',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/creative-charts',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';

                const res = await fetch('/napi/v1/creative/creative-rank/list', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        return { ok: false, status: res.status, statusText: parseError.message, data: null };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (error) {
                return { ok: false, status: 500, statusText: error.message, data: null };
            }
        }, requestBody, authorizationToken, deviceId, userToken);

        const apiData = response.data;
        const payload = apiData && apiData.data ? apiData.data : apiData;
        const success = response.ok && apiData && (
            apiData.id === 'SUCCESS' ||
            apiData.code === 0 ||
            Array.isArray(payload?.creatives) ||
            Array.isArray(payload?.list)
        );
        return {
            data: payload || null,
            raw: apiData || null,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || response.statusText || '请求失败')
        };
    } catch (error) {
        logger.error('广大大创意排行榜请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大创意详情 detail-v2（GET）
 * @param {{ ad_key: string, app_type: number, search_flag: number }} params
 */
export const fetchCreativeDetail = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { ad_key, app_type = 1, search_flag } = params;
    if (!ad_key) {
        return { data: null, success: false, code: 400, message: '缺少 ad_key' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const qs = new URLSearchParams({ ad_key, app_type: String(app_type) });
        if (search_flag != null) qs.set('search_flag', String(search_flag));
        const url = `/napi/v1/creative/detail-v2?${qs.toString()}`;
        const response = await loginPage.evaluate(async (requestUrl, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(requestUrl, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, url, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: apiData,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大创意详情请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

function appendDefinedQuery(qs, key, value) {
    if (value == null || value === '') return;
    qs.set(key, String(value));
}

async function fetchGuangdadaNapiGetJson(path, query = {}, options = {}) {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    await ensureGuangdadaGlobalDisplayAdsForInternationalApis(loginPage);

    try {
        const { authorizationToken, deviceId, userToken } = await resolveGuangdadaNapiAuthFromLoginPage();
        const qs = new URLSearchParams();
        Object.entries(query || {}).forEach(([key, value]) => appendDefinedQuery(qs, key, value));
        const requestUrl = `${path}${qs.toString() ? `?${qs.toString()}` : ''}`;
        const referer = options.referer || 'https://guangdada.net/modules/creative/charts/hot-charts';

        const response = await loginPage.evaluate(async (url, authToken, devId, uToken, refererUrl) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Authorization': authToken || '',
                    'Connection': 'keep-alive',
                    'Referer': refererUrl,
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        return { ok: false, status: res.status, statusText: parseError.message, data: null };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (error) {
                return { ok: false, status: 500, statusText: error.message, data: null };
            }
        }, requestUrl, authorizationToken, deviceId, userToken, referer);

        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: apiData?.data ?? null,
            raw: apiData || null,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || response.statusText || '请求失败'),
        };
    } catch (error) {
        logger.error(`广大大 ${path} 请求失败:`, error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
}

/** 广大大详情页关联版本：GET creative/related-dynamic */
export const fetchRelatedDynamic = async (params = {}) => {
    const { dynamic_number, app_type = 1, creative_key, platform, created_at } = params;
    if (!dynamic_number || !creative_key) {
        return { data: null, success: false, code: 400, message: '缺少 dynamic_number 或 creative_key' };
    }
    return fetchGuangdadaNapiGetJson('/napi/v1/creative/related-dynamic', {
        dynamic_number,
        app_type,
        creative_key,
        platform,
        created_at,
    });
};

/** 广大大详情页榜单状态：GET creative/rank-status */
export const fetchRankStatus = async (params = {}) => {
    const { ad_key, app_type = 1 } = params;
    if (!ad_key) {
        return { data: null, success: false, code: 400, message: '缺少 ad_key' };
    }
    return fetchGuangdadaNapiGetJson('/napi/v1/creative/rank-status', {
        ad_key,
        app_type,
    });
};

/** 广大大详情页素材脚本分析：GET creative/material-script-analysis */
export const fetchMaterialScriptAnalysis = async (params = {}) => {
    const { ad_key, app_type = 1, search_flag, ads_type } = params;
    if (!ad_key) {
        return { data: null, success: false, code: 400, message: '缺少 ad_key' };
    }
    return fetchGuangdadaNapiGetJson('/napi/v1/creative/material-script-analysis', {
        ad_key,
        app_type,
        search_flag,
        ads_type,
    });
};

/**
 * 广大大隐藏信息（GET hidden-info），用于「不看该广告主创意」获取 advertiser_id
 * @param {{ ad_key: string, app_type: number, created_at: number }} params
 */
export const fetchHiddenInfo = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { ad_key, app_type = 1, created_at } = params;
    if (!ad_key) {
        return { data: null, success: false, code: 400, message: '缺少 ad_key' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const qs = new URLSearchParams({ ad_key, app_type: String(app_type) });
        if (created_at != null) qs.set('created_at', String(created_at));
        const url = `/napi/v1/creative/hidden-info?${qs.toString()}`;
        const response = await loginPage.evaluate(async (requestUrl, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(requestUrl, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, url, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        const hiddenInfo = (apiData && apiData.data && apiData.data.hidden_info) ? apiData.data.hidden_info : null;
        return {
            data: hiddenInfo ? { hidden_info: hiddenInfo } : null,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 hidden-info 请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大文案翻译（POST translate-text）
 * @param {{ text: string | string[], target_lan: string }} params - text 单条或数组，target_lan 如 zh-CN / en
 */
export const fetchTranslateText = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { text, target_lan } = params;
    const textArr = Array.isArray(text) ? text : (text != null && String(text).trim() !== '' ? [String(text).trim()] : []);
    if (textArr.length === 0) {
        return { data: { result: [] }, success: true, code: 200, message: 'success' };
    }
    const targetLan = target_lan && String(target_lan).trim() ? String(target_lan).trim() : 'zh-CN';
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const requestUrl = '/napi/v1/creative/translate-text';
        const body = { text: textArr, target_lan: targetLan };
        const response = await loginPage.evaluate(async (url, bodyJson, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Content-Type': 'application/json',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(url, { method: 'POST', headers, credentials: 'include', body: bodyJson });
                const textRes = await res.text();
                let data = null;
                if (textRes && textRes.trim()) {
                    try { data = JSON.parse(textRes); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, requestUrl, JSON.stringify(body), authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        const resultList = (apiData && Array.isArray(apiData.data?.result)) ? apiData.data.result : [];
        return {
            data: { result: resultList },
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '翻译请求失败')
        };
    } catch (error) {
        logger.error('广大大翻译请求失败:', error);
        return { data: { result: [] }, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大创意每日人气趋势（GET daily-popularity）
 * @param {{ creative_key: string, first_seen: number, last_seen: number, app_type: number, platform: string, category?: string }} params
 */
export const fetchDailyPopularity = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { creative_key, first_seen, last_seen, app_type = 1, platform = 'admob', category } = params;
    if (!creative_key) {
        return { data: null, success: false, code: 400, message: '缺少 creative_key' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const qs = new URLSearchParams({
            creative_key,
            first_seen: String(first_seen ?? ''),
            last_seen: String(last_seen ?? ''),
            app_type: String(app_type),
            platform: String(platform)
        });
        if (category != null && category !== '') qs.set('category', String(category));
        const url = `/napi/v1/creative/daily-popularity?${qs.toString()}`;
        const response = await loginPage.evaluate(async (requestUrl, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(requestUrl, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, url, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: apiData,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大每日人气趋势请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大获取使用相同素材的其他广告主（POST related-advertisers）
 * @param {{ app_type: number, material_id: string, page?: number, created_at?: string, page_size?: number }} body
 */
export const fetchRelatedAdvertisers = async (body = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { app_type = 1, material_id, page = 1, created_at, page_size = 20 } = body;
    if (!material_id) {
        return { data: null, success: false, code: 400, message: '缺少 material_id' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const requestBody = { app_type, material_id, page, page_size };
        if (created_at != null) requestBody.created_at = created_at;
        const response = await loginPage.evaluate(async (reqBody, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch('/napi/v1/material-analysis/related-advertisers', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(reqBody)
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, requestBody, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        return {
            data: Array.isArray(apiData?.data) ? apiData.data : (apiData?.data ?? apiData),
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 related-advertisers 请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大相似广告主推荐（POST advertiser/adv-rec-list）
 * @param {{ domain: string, app_type?: number, country?: string, page?: number, page_size?: number }} body
 */
export const fetchAdvRecList = async (body = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { domain, app_type = 1, country = 'USA', page = 1, page_size = 8 } = body;
    if (!domain) {
        return { data: null, success: false, code: 400, message: '缺少 domain' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const requestBody = { domain, app_type, country, page, page_size };
        const response = await loginPage.evaluate(async (reqBody, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch('/napi/v1/advertiser/adv-rec-list', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(reqBody)
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, requestBody, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        const list = apiData?.data?.data ?? apiData?.data ?? [];
        return {
            data: Array.isArray(list) ? list : [],
            total: apiData?.data?.total ?? 0,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 adv-rec-list 请求失败:', error);
        return { data: null, total: 0, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大广告主概览（GET advertiser/agg-advertiser），用于右侧 Drawer 展示
 * @param {{ domain: string }} params
 */
export const fetchAdvertiserDetail = async (params = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { domain } = params;
    if (!domain) {
        return { data: null, success: false, code: 400, message: '缺少 domain' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const qs = new URLSearchParams({ domain });
        const url = `/napi/v1/advertiser/agg-advertiser?${qs.toString()}`;
        const response = await loginPage.evaluate(async (requestUrl, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch(requestUrl, { method: 'GET', headers, credentials: 'include' });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, url, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        const list = apiData?.data;
        return {
            data: list != null ? list : null,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 advertiser/agg-advertiser 请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大获取使用相同素材的其他广告（POST related-ads）
 * @param {{ app_type: number, material_id: string, page?: number, created_at?: string, page_size?: number }} body
 */
export const fetchRelatedAds = async (body = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { app_type = 1, material_id, page = 1, created_at, page_size = 5 } = body;
    if (!material_id) {
        return { data: null, success: false, code: 400, message: '缺少 material_id' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const requestBody = { app_type, material_id, page, page_size };
        if (created_at != null) requestBody.created_at = created_at;
        const response = await loginPage.evaluate(async (reqBody, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch('/napi/v1/material-analysis/related-ads', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(reqBody)
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, requestBody, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        const list = apiData?.data?.data ?? apiData?.data ?? [];
        return {
            data: Array.isArray(list) ? list : [],
            total: apiData?.data?.total ?? 0,
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 related-ads 请求失败:', error);
        return { data: null, total: 0, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

/**
 * 广大大相似素材推荐（POST similar-ads）
 * @param {{ resource_url: string, ad_key: string, app_type?: number, created_at?: number|string, similar_ads_count?: number }} body
 */
export const fetchSimilarAds = async (body = {}) => {
    if (status.current !== LoginStatus.ONLINE) {
        return { data: null, success: false, code: 'NOT_LOGGED_IN', message: '未登录，请先登录' };
    }
    if (!loginPage || loginPage.isClosed()) {
        return { data: null, success: false, code: 'NO_LOGIN_PAGE', message: '登录页面已关闭，请重新登录' };
    }
    const { resource_url, ad_key, app_type = 1, created_at, similar_ads_count = 8 } = body;
    if (!resource_url || !ad_key) {
        return { data: null, success: false, code: 400, message: '缺少 resource_url 或 ad_key' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        let deviceId = loginInfo.deviceId;
        let userToken = loginInfo.userToken;
        if (!authorizationToken) {
            try {
                const storageData = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'Authorization', 'user-token', 'device-id'];
                    const result = {};
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) result[key] = value;
                    }
                    return result;
                });
                if (storageData.authorization || storageData.Authorization || storageData.token) {
                    authorizationToken = storageData.authorization || storageData.Authorization || storageData.token;
                    loginInfo.authorization = authorizationToken;
                }
                if (storageData['user-token']) { userToken = storageData['user-token']; loginInfo.userToken = userToken; }
                if (storageData['device-id']) { deviceId = storageData['device-id']; loginInfo.deviceId = deviceId; }
            } catch (e) { logger.warn('从存储获取 token 失败:', e.message); }
        }
        const requestBody = { resource_url, ad_key, app_type, similar_ads_count };
        if (created_at != null) requestBody.created_at = created_at;
        const response = await loginPage.evaluate(async (reqBody, authToken, devId, uToken) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Authorization': authToken || '',
                    'Origin': 'https://guangdada.net',
                    'Referer': 'https://guangdada.net/modules/creative/display-ads',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
                };
                if (devId) headers['x-device-id'] = devId;
                if (uToken) headers['x-nbs-user-token'] = uToken;
                headers['x-product-id'] = '2';
                headers['x-timezone'] = '+0800';
                const res = await fetch('/napi/v1/material-analysis/similar-ads', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify(reqBody)
                });
                const text = await res.text();
                let data = null;
                if (text && text.trim()) {
                    try { data = JSON.parse(text); } catch (e) { return { ok: false, status: res.status, data: null }; }
                }
                return { ok: res.ok, status: res.status, data };
            } catch (err) {
                return { ok: false, status: 500, data: null };
            }
        }, requestBody, authorizationToken, deviceId, userToken);
        const apiData = response.data;
        const success = response.ok && apiData && (apiData.id === 'SUCCESS' || apiData.code === 0);
        const list = apiData?.data?.similar_ads ?? apiData?.similar_ads ?? [];
        return {
            data: Array.isArray(list) ? list : [],
            success: !!success,
            code: response.status,
            message: success ? 'success' : (apiData?.message || '请求失败')
        };
    } catch (error) {
        logger.error('广大大 similar-ads 请求失败:', error);
        return { data: null, success: false, code: 500, message: `请求失败: ${error.message}` };
    }
};

export const checkLoginStatus = async () => {
    if (!browser) {
        logger.warn('浏览器未初始化，无法检查登录状态');
        status.update(LoginStatus.LOGGED_OUT);
        return false;
    }
    
    const page = await browser.newPage();
    // 设置反检测措施
    await setupAntiDetection(page);
    try {
    await page.goto(checkLoginUrl, {
        timeout: 120 * 1000,
        waitUntil: 'domcontentloaded',
    });
    const curPageUrl = page.url();
        
        // 如果URL不是登录页面，认为已登录
        const isLoggedIn = !curPageUrl.includes('/modules/auth/login');
        
    if (isLoggedIn) {
        status.update(LoginStatus.ONLINE);
        } else {
        status.update(LoginStatus.LOGGED_OUT);
    }

    await page.close();
    return isLoggedIn;
    } catch (error) {
        logger.error('检查登录状态失败:', error);
        await page.close().catch(() => {});
        status.update(LoginStatus.LOGGED_OUT);
        return false;
    }
};
// 删除 tmp 文件夹的函数
export const clearLogin = async () => {
    try {
        if (loginPage && !loginPage.isClosed()) {
            await loginPage.close();
            loginPage = null;
        }
        // 清除登录信息
        loginInfo = {
            cookies: null,
            email: null,
            authorization: null,
            authorizationCn: null,
            cnJwtExpiresAtMs: null,
            deviceId: null,
            userToken: null,
        };
        // 递归删除文件夹其内容
        await rm(folderToDelete, {recursive: true, force: true}).catch(() => {});
        status.update(LoginStatus.LOGGED_OUT);
        if (browser) {
            await browser.close().catch(() => {});
        }
        await initializeBrowser();
        logger.info(`已清除登录状态`);
        return {
            success: true,
            code: 200,
            message: '已清除登录状态'
        };
    } catch (error) {
        logger.error(`清除登录状态时发生错误: ${error}`);
        status.update(LoginStatus.LOGGED_OUT);
        return {
            success: false,
            code: 500,
            message: `清除登录状态失败: ${error.message}`
        };
    }
};
