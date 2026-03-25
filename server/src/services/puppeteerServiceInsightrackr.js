import puppeteerBase, {TimeoutError} from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {puppeteerOptionsInsightrackr} from '../config.js';
import {rm} from 'fs/promises';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import {LoginStatus} from '../constants/index.js';
import log4js from 'log4js';

// 获取 logger 实例
const logger = global.logger || log4js.getLogger('insightrackr-service');

const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 使用 Stealth 插件来避免反爬虫检测
puppeteer.use(StealthPlugin());

let browser;
let loginPage; // 登录页面

// 存储登录信息
let loginInfo = {
    cookies: null,
    authorization: null,
    email: null,
    deviceId: null // ECF07FD99F7847C0 header 的值
};

// 状态管理
const status = {
    current: LoginStatus.LOGGED_OUT, // 初始状态为未登录
    update(newStatus) {
        this.current = newStatus;
        logger.info(`当前状态: ${this.current}`);
    }
};

// Insightrackr 网站登录选择器
const selectors = {
    // 邮箱输入框：在第一个 cas-md-input 中的 input[type="text"]
    emailInput: '.cas-md-input:first-of-type input[type="text"]',
    // 密码输入框：在第二个 cas-md-input 中的 input[type="password"]
    passwordInput: '.cas-md-input:last-of-type input[type="password"], input[type="password"]',
    // 协议复选框 - 使用多种选择器确保能找到
    agreementCheckbox: 'input.el-checkbox__original[type="checkbox"], input[type="checkbox"].el-checkbox__original, label.el-checkbox input[type="checkbox"], .el-checkbox input[type="checkbox"]',
    // 登录按钮
    submitButton: 'button.el-button--primary.submit, button.submit',
    // 登录表单容器
    loginForm: '.cas-md-input',
    // 错误提示选择器
    errorSelector: '.error, .el-message--error, [class*="error"]',
    // 协议弹窗相关选择器
    agreementModal: '.el-dialog, [class*="modal"], [class*="dialog"]',
    agreementModalAgreeButton: 'button:has-text("Agree"), button:contains("Agree"), .el-button--primary:has-text("Agree")',
    agreementModalCloseButton: '.el-dialog__close, .el-dialog__headerbtn, [class*="close"]'
};

// Insightrackr 网站登录地址
const loginPageUrl = 'https://data.insightrackr.com/login';
const checkLoginUrl = 'https://data.insightrackr.com/login';

// 配置页面的反检测措施
async function setupAntiDetection(page) {
    // 1. 覆盖 WebDriver 属性
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // 覆盖 chrome 属性
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
        
        // 覆盖 plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        
        // 覆盖 languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['zh-CN', 'zh', 'en']
        });
    });
    
    // 2. 设置更真实的 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 3. 设置视口
    await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
    });
    
    // 4. 添加额外的头部信息
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
    });
    
    // 5. 模拟人类行为：随机延迟和鼠标移动
    page.on('load', async () => {
        // 随机延迟
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
        // 随机鼠标移动
        try {
            await page.mouse.move(
                Math.random() * 800 + 100,
                Math.random() * 600 + 100,
                { steps: 10 }
            );
        } catch (e) {
            // 忽略鼠标移动错误
        }
    });
}

export const initializeBrowser = async () => {
    console.log('准备启动 Insightrackr 浏览器（使用反检测模式）');
    
    // 如果已有浏览器实例，先关闭它
    if (browser) {
        try {
            await browser.close();
            logger.info('已关闭旧的浏览器实例');
        } catch (e) {
            logger.warn('关闭旧浏览器实例失败:', e.message);
        }
        browser = null;
    }
    
    try {
        const launchOpts = { ...puppeteerOptionsInsightrackr };
        const debugPort = process.env.CHROME_REMOTE_DEBUGGING_PORT_INSIGHTRACKR;
        if (debugPort) {
            launchOpts.args = [...(launchOpts.args || []), `--remote-debugging-port=${debugPort}`];
            logger.info('已启用 Chrome 远程调试端口（Insightrackr）:', debugPort);
        }
        logger.info('尝试启动浏览器，配置:', JSON.stringify(launchOpts, null, 2));
        browser = await puppeteer.launch(launchOpts);
        
        // 验证浏览器连接是否正常
        try {
            await browser.version();
            logger.info('浏览器连接验证成功');
        } catch (e) {
            logger.error('浏览器连接验证失败:', e.message);
            throw new Error('浏览器连接验证失败');
        }
        
        await browser.defaultBrowserContext().overridePermissions('https://data.insightrackr.com/', ['clipboard-read', 'clipboard-write']);
        console.log('Insightrackr 浏览器已启动（反检测模式）');
        logger.info('浏览器启动成功（反检测模式）');
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
            browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ]
            });
            
            // 验证浏览器连接
            try {
                await browser.version();
                logger.info('使用默认配置启动浏览器成功，连接验证通过');
            } catch (e3) {
                logger.error('默认配置浏览器连接验证失败:', e3.message);
                if (browser) {
                    await browser.close().catch(() => {});
                }
                browser = null;
            }
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
        logger.info('获取 Insightrackr 浏览器 WebSocket 端点:', wsEndpoint);
        return wsEndpoint;
    } catch (error) {
        logger.error('获取浏览器 WebSocket 端点失败:', error.message);
        return null;
    }
};

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
};

// 获取状态 - 仅在有登录页时做校验，避免用新页面（无会话）误判为未登录
export const getStatus = async () => {
    try {
        if (!browser) {
            try {
                await initializeBrowser();
            } catch (error) {
                logger.error('初始化浏览器失败:', error);
                return { status: LoginStatus.LOGGED_OUT, email: null };
            }
        }
        // 仅当存在已登录的页面时，用该页面做一次校验；否则直接返回当前内存状态（避免 newPage 无会话导致误判 LOGGED_OUT）
        if (loginPage && !loginPage.isClosed()) {
            try {
                await checkLoginStatus();
            } catch (error) {
                logger.error('检查登录状态失败:', error);
                // 校验失败不强制改为 LOGGED_OUT，保持当前状态
            }
        }
        return {
            status: status.current,
            email: status.current === LoginStatus.ONLINE ? loginInfo.email : null
        };
    } catch (error) {
        logger.error('getStatus 发生未预期的错误:', error);
        return { status: LoginStatus.LOGGED_OUT, email: null };
    }
};

/** 健康检查：浏览器是否存在、页面数、登录状态与账号，供 /health 排查用 */
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
            isLoggedIn: info.isLoggedIn
        };
    } catch (e) {
        logger.warn('getHealthInfo Insightrackr:', e.message);
        const info = getLoginInfo();
        return {
            browserExists: true,
            pageCount: 0,
            status: status.current,
            email: info.email ?? null,
            isLoggedIn: info.isLoggedIn,
            error: e.message
        };
    }
};

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

// 检查浏览器连接状态
const checkBrowserConnection = async () => {
    if (!browser) {
        logger.warn('浏览器实例不存在');
        return false;
    }
    
    try {
        // 尝试获取浏览器版本，如果连接正常会成功
        const version = await browser.version();
        logger.info(`浏览器连接正常，版本: ${version}`);
        return true;
    } catch (error) {
        logger.error('浏览器连接已断开，错误详情:', error.message);
        logger.error('错误堆栈:', error.stack);
        // 尝试关闭浏览器实例
        try {
            await browser.close();
        } catch (closeError) {
            logger.warn('关闭断开的浏览器实例失败:', closeError.message);
        }
        browser = null;
        return false;
    }
};

// 发起登录
export const login = async (email, password) => {
    console.log('Insightrackr 登录');
    logger.info('========== 开始登录流程 ==========');
    
    // 检查浏览器连接状态，如果未初始化或连接已断开，则重新初始化
    logger.info('检查浏览器连接状态...');
    const isConnected = await checkBrowserConnection();
    logger.info(`浏览器连接状态: ${isConnected ? '已连接' : '未连接'}`);
    
    if (!browser || !isConnected) {
        logger.warn('浏览器未初始化或连接已断开，尝试重新初始化...');
        await initializeBrowser();
        if (!browser) {
            logger.error('浏览器重新初始化失败');
            return {
                data: null,
                success: false,
                code: 'BROWSER_NOT_INITIALIZED',
                message: '浏览器未初始化，请检查 Chrome/Chromium 是否正确安装。错误：浏览器启动失败'
            };
        }
        logger.info('浏览器重新初始化成功');
    } else {
        logger.info('浏览器连接正常，无需重新初始化');
    }
    
    // 先检查是否已经登录：访问 creative/material 页面
    logger.info('登录前检查：访问 creative/material 页面检查登录状态');
    let page;
    try {
        page = await browser.newPage();
        await setupAntiDetection(page);
        
        // 访问 creative/material 页面
        await page.goto('https://data.insightrackr.com/creative/material', {
            timeout: 120 * 1000,
            waitUntil: 'domcontentloaded',
        });
        
        // 短暂等待重定向完成
        await page.waitForTimeout(800);
        
        const checkUrl = page.url();
        logger.info('登录前检查 - 当前页面URL:', checkUrl);
        
        // 如果未跳转到登录页，说明已经登录
        if (!checkUrl.includes('/login')) {
            logger.info('检测到已经登录，无需再次登录');
            status.update(LoginStatus.ONLINE);
            loginPage = page; // 保存页面
            loginInfo.email = loginEmail;
            
            // 保存 cookies
            try {
                const cookies = await page.cookies();
                loginInfo.cookies = cookies;
                logger.info('已保存 cookies，数量:', cookies.length);
            } catch (e) {
                logger.error('保存 cookies 失败:', e.message);
            }

            await closeOtherPages(page);
            return {
                data: {
                    url: checkUrl,
                    message: '已经登录',
                    cookiesSaved: !!loginInfo.cookies
                },
                success: true,
                code: 200,
                message: '已经登录，无需再次登录'
            };
        }

        // 如果跳转到登录页，说明未登录，继续登录流程
        logger.info('检测到未登录（已跳转到登录页），继续登录流程');
        // 不关闭页面，继续使用这个页面进行登录（此时 page 已经在登录页）
    } catch (error) {
        logger.error('登录前检查失败:', error);
        // 如果检查失败，关闭页面并继续登录流程
        if (page && !page.isClosed()) {
            try {
                await page.close();
            } catch (closeError) {
                logger.warn('关闭检查页面失败:', closeError.message);
            }
        }
        page = null;
        // 继续登录流程，创建新页面
    }

    // 使用环境变量或传入的参数
    const loginEmail = email || process.env.INSIGHTRACKR_EMAIL || '';
    const loginPassword = password || process.env.INSIGHTRACKR_PASSWORD || '';

    if (!loginEmail || !loginPassword) {
        return {
            data: null,
            success: false,
            code: 'MISSING_CREDENTIALS',
            message: '缺少登录凭据，请提供邮箱和密码'
        };
    }

    // 在创建页面前再次检查浏览器连接，最多重试3次
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
        try {
            // 检查浏览器是否存在且连接正常
            if (!browser) {
                throw new Error('浏览器实例不存在');
            }
            
            // 尝试获取浏览器版本验证连接
            await browser.version();
            logger.info('创建页面前浏览器连接检查通过');
            break; // 连接正常，跳出循环
        } catch (error) {
            retryCount++;
            logger.error(`创建页面前浏览器连接检查失败 (尝试 ${retryCount}/${maxRetries}):`, error.message);
            
            if (retryCount >= maxRetries) {
                logger.error('浏览器连接检查失败，已达到最大重试次数');
                return {
                    data: null,
                    success: false,
                    code: 'BROWSER_CONNECTION_ERROR',
                    message: `浏览器连接已断开，重新初始化失败: ${error.message}`
                };
            }
            
            // 重新初始化浏览器
            logger.info('尝试重新初始化浏览器...');
            await initializeBrowser();
            if (!browser) {
                return {
                    data: null,
                    success: false,
                    code: 'BROWSER_CONNECTION_ERROR',
                    message: `浏览器重新初始化失败: ${error.message}`
                };
            }
            // 继续下一次循环重试
        }
    }
    
    // 如果检查时已经创建了页面且跳转到登录页，直接使用；否则创建新页面
    if (!page || page.isClosed()) {
        try {
            logger.info('开始创建新页面...');
            page = await browser.newPage();
            logger.info('页面创建成功');
        } catch (error) {
            // 如果创建页面失败，可能是浏览器连接问题
            logger.error('创建页面失败，错误详情:', error.message);
            logger.error('错误类型:', error.constructor.name);
            logger.error('错误堆栈:', error.stack);
            
            // 尝试重新初始化浏览器并重试
            logger.info('尝试重新初始化浏览器并重试创建页面...');
            await initializeBrowser();
            if (!browser) {
                return {
                    data: null,
                    success: false,
                    code: 'BROWSER_CONNECTION_ERROR',
                    message: `浏览器连接错误，重新初始化失败: ${error.message}`
                };
            }
            // 重试创建页面
            try {
                logger.info('重试创建页面...');
                page = await browser.newPage();
                logger.info('重试创建页面成功');
            } catch (retryError) {
                logger.error('重试创建页面也失败:', retryError.message);
                logger.error('重试错误堆栈:', retryError.stack);
                return {
                    data: null,
                    success: false,
                    code: 'BROWSER_CONNECTION_ERROR',
                    message: `创建页面失败: ${retryError.message}。请检查浏览器是否正确安装和启动。`
                };
            }
        }
        // 设置反检测措施（仅对新创建的页面）
        await setupAntiDetection(page);
    } else {
        // 如果检查时已经创建了页面且跳转到登录页，直接使用
        logger.info('使用检查时已创建的页面（已在登录页）');
    }
    
    // 如果页面不在登录页，导航到登录页
    try {
        const pageUrl = page.url();
        if (!pageUrl.includes('/login')) {
            logger.info('页面不在登录页，导航到登录页');
            await page.goto(loginPageUrl, { timeout: 120 * 1000, waitUntil: 'domcontentloaded' });
        } else {
            logger.info('页面已在登录页，无需导航');
        }
        
        // 等待表单加载
        await page.waitForSelector(selectors.loginForm, { timeout: 30000 });
        logger.info('登录表单已加载');

        // 等待邮箱输入框加载
        await page.waitForSelector(selectors.emailInput, { timeout: 10000 });
        // 清空输入框并输入邮箱
        await page.click(selectors.emailInput);
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type(selectors.emailInput, loginEmail, { delay: 100 });
        logger.info('已输入邮箱:', loginEmail);

        // 等待密码输入框加载
        await page.waitForSelector(selectors.passwordInput, { timeout: 10000 });
        // 清空输入框并输入密码
        await page.click(selectors.passwordInput);
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type(selectors.passwordInput, loginPassword, { delay: 100 });
        logger.info('已输入密码');

        // 输入完账号密码后立即点击登录按钮（不等待 checkbox）
        logger.info('输入完成，立即点击登录按钮');
        
        // 提交表单
        await page.waitForSelector(selectors.submitButton, { timeout: 10000 });
        await page.click(selectors.submitButton);
        logger.info('已点击登录按钮');

        // 短暂等待，检查是否弹出协议弹窗
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 检查并处理协议弹窗
        try {
            const hasModal = await page.evaluate(() => {
                // 查找包含 "Agree" 或 "User Service Agreement" 的弹窗
                const modals = document.querySelectorAll('.el-dialog, [class*="modal"], [class*="dialog"]');
                for (const modal of modals) {
                    const text = modal.textContent || '';
                    if (text.includes('Agree') || text.includes('User Service Agreement') || text.includes('服务协议')) {
                        return true;
                    }
                }
                return false;
            });

            if (hasModal) {
                logger.info('检测到协议弹窗，正在处理...');
                
                // 尝试点击 "Agree" 按钮
                const agreeClicked = await page.evaluate(() => {
                    // 查找包含 "Agree" 文本的按钮
                    const buttons = document.querySelectorAll('button, .el-button');
                    for (const button of buttons) {
                        const text = button.textContent || '';
                        if (text.includes('Agree') || text.includes('同意') || text.trim() === 'Agree') {
                            button.click();
                            return true;
                        }
                    }
                    return false;
                });

                if (agreeClicked) {
                    logger.info('已点击协议弹窗的"Agree"按钮');
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    // 如果找不到 Agree 按钮，尝试查找其他确认按钮
                    logger.warn('未找到"Agree"按钮，尝试查找其他确认按钮');
                    const otherButtonClicked = await page.evaluate(() => {
                        const buttons = document.querySelectorAll('button.el-button--primary, button[type="button"], button[type="submit"]');
                        for (const button of buttons) {
                            const text = button.textContent || '';
                            // 查找确认、确定、OK 等按钮
                            if (text.includes('确认') || text.includes('确定') || text.includes('OK') || text.trim() === '') {
                                button.click();
                                return true;
                            }
                        }
                        return false;
                    });
                    
                    if (otherButtonClicked) {
                        logger.info('已点击弹窗中的确认按钮');
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        logger.warn('未找到确认按钮，继续等待页面跳转');
                    }
                }
            }
        } catch (e) {
            logger.warn('处理协议弹窗时出错，继续执行:', e.message);
        }

        // 等待页面跳转或响应
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 检查是否登录成功（通过URL变化或页面元素判断）
        let loginResultUrl = page.url();
        logger.info('登录后当前URL:', loginResultUrl);

        // 等待可能的导航（缩短超时，避免长时间阻塞）
        try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {
                logger.info('等待导航超时，继续检查当前URL');
            });
            loginResultUrl = page.url();
            logger.info('导航后当前URL:', loginResultUrl);
        } catch (e) {
            logger.info('等待导航时出错，继续检查:', e.message);
        }

        await new Promise(resolve => setTimeout(resolve, 800));
        loginResultUrl = page.url();
        logger.info('最终检查URL:', loginResultUrl);

        // 检查是否有错误提示
        const errorMessage = await page.evaluate(() => {
            const errorEl = document.querySelector('.error, .el-message--error, [class*="error"]');
            return errorEl ? errorEl.textContent : null;
        }).catch(() => null);

        if (errorMessage && errorMessage.trim() !== '') {
            logger.error('登录失败，错误信息:', errorMessage);
            // 不关闭页面，保留页面以便查看错误
            loginPage = page; // 保存页面，不关闭
            status.update(LoginStatus.LOGGED_OUT);
            return {
                data: null,
                success: false,
                code: 'LOGIN_FAILED',
                message: `登录失败: ${errorMessage}`
            };
        }

        // 如果URL不再是登录页面（包括根域名），认为登录成功
        // 或者如果页面已经加载了非登录页的内容，也认为登录成功
        const isLoginPage = loginResultUrl.includes('/login') || loginResultUrl === 'https://data.insightrackr.com/login';
        
        // 额外检查：即使 URL 还是登录页，也检查页面内容是否已经跳转
        let isActuallyLoggedIn = !isLoginPage;
        if (isLoginPage) {
            // 检查页面内容，看是否已经登录（比如是否有搜索框、数据展示等元素）
            try {
                const pageContent = await page.evaluate(() => {
                    // 检查是否有登录表单（如果还有登录表单，说明未登录）
                    const hasLoginForm = document.querySelector('input[type="password"]') !== null;
                    // 检查是否有搜索相关元素（如果有，说明已登录）
                    const hasSearchElements = document.querySelector('input[type="text"][placeholder*="search"], input[type="text"][placeholder*="搜索"], .search, [class*="search"]') !== null;
                    // 检查是否有数据展示相关元素
                    const hasDataElements = document.querySelector('[class*="material"], [class*="creative"], [class*="data"]') !== null;
                    
                    return {
                        hasLoginForm,
                        hasSearchElements,
                        hasDataElements,
                        url: window.location.href,
                        title: document.title
                    };
                });
                
                logger.info('页面内容检查:', JSON.stringify(pageContent, null, 2));
                
                // 如果没有登录表单，或者有搜索/数据元素，认为已登录
                if (!pageContent.hasLoginForm || pageContent.hasSearchElements || pageContent.hasDataElements) {
                    isActuallyLoggedIn = true;
                    logger.info('通过页面内容检查，判断为已登录');
                }
            } catch (e) {
                logger.warn('页面内容检查失败:', e.message);
            }
        }
        
        if (isActuallyLoggedIn) {
            logger.info('✅ 登录成功，URL已跳转:', loginResultUrl);
            
            // 登录成功后，仅在不已是搜索/创意页时跳转到搜索页（无预设关键词），以触发请求并捕获 authorization token
            const tokenPageUrl = 'https://data.insightrackr.com/search/material';
            if (!loginResultUrl.includes('/search') && !loginResultUrl.includes('/creative')) {
                logger.info(`正在跳转到搜索页以获取 token: ${tokenPageUrl}`);
                try {
                    // 设置请求拦截器来获取 authorization token
                    let capturedToken = null;
                    const requestHandler = (request) => {
                        const headers = request.headers();
                        const authHeader = headers['authorization'] || headers['Authorization'];
                        if (authHeader && !capturedToken) {
                            capturedToken = authHeader;
                            loginInfo.authorization = authHeader;
                            logger.info('✅ 从网络请求中捕获到 authorization token');
                            page.off('request', requestHandler);
                        }
                    };
                    page.on('request', requestHandler);

                    await page.goto(tokenPageUrl, {
                        timeout: 120 * 1000,
                        waitUntil: 'domcontentloaded'
                    });
                    loginResultUrl = page.url();
                    logger.info('已跳转到搜索页:', loginResultUrl);

                    await new Promise(resolve => setTimeout(resolve, 1200));
                    if (!capturedToken) {
                        logger.warn('首次未获取到 token，等待更多请求...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                    // 移除监听器
                    page.off('request', requestHandler);
                    
                    // 在跳转到搜索页面后，尝试监听所有请求以获取设备标识符
                    if (!loginInfo.deviceId) {
                        const deviceIdHandler = (request) => {
                            const headers = request.headers();
                            const deviceId = headers['ECF07FD99F7847C0'] || headers['ecf07fd99f7847c0'];
                            if (deviceId) {
                                loginInfo.deviceId = deviceId;
                                logger.info('✅ 从网络请求中获取到设备标识符:', deviceId);
                                page.off('request', deviceIdHandler);
                            }
                        };
                        page.on('request', deviceIdHandler);
                        // 10秒后移除监听器
                        setTimeout(() => {
                            page.off('request', deviceIdHandler);
                        }, 10000);
                    }
                } catch (e) {
                    logger.warn('跳转到搜索页面失败，继续使用当前页面:', e.message);
                }
            }
            
            // 保存 cookies
            try {
                const cookies = await page.cookies();
                loginInfo.cookies = cookies;
                logger.info('已保存 cookies，数量:', cookies.length);
            } catch (e) {
                logger.error('保存 cookies 失败:', e.message);
            }
            
            // 尝试从 localStorage 或 sessionStorage 获取 token 和设备标识符
            try {
                const storageData = await page.evaluate(() => {
                    const result = {
                        authorization: null,
                        deviceId: null
                    };
                    
                    // 尝试获取 authorization token
                    const authKeys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of authKeys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) {
                            result.authorization = value;
                            break;
                        }
                    }
                    
                    // 尝试获取设备标识符 ECF07FD99F7847C0
                    // 可能的存储 key
                    const deviceKeys = [
                        'ECF07FD99F7847C0', 'ecf07fd99f7847c0', 'deviceId', 'device-id', 
                        'deviceId', 'clientId', 'client-id', 'fingerprint', 'deviceFingerprint'
                    ];
                    for (const key of deviceKeys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) {
                            result.deviceId = value;
                            break;
                        }
                    }
                    
                    // 尝试从 window 对象获取
                    if (!result.deviceId) {
                        // 检查 window 对象中是否有相关属性
                        const windowKeys = ['deviceId', 'device_id', 'ECF07FD99F7847C0', 'clientId'];
                        for (const key of windowKeys) {
                            if (window[key]) {
                                result.deviceId = window[key];
                                break;
                            }
                        }
                    }
                    
                    return result;
                });
                
                if (storageData.authorization && !loginInfo.authorization) {
                    loginInfo.authorization = storageData.authorization;
                    logger.info('✅ 已从存储中获取 authorization token');
                }
                
                if (storageData.deviceId && !loginInfo.deviceId) {
                    loginInfo.deviceId = storageData.deviceId;
                    logger.info('✅ 已从存储中获取设备标识符:', storageData.deviceId);
                } else if (!storageData.authorization && !loginInfo.authorization) {
                    logger.warn('⚠️ 未在存储中找到 token，将在后续请求中尝试获取');
                }
            } catch (e) {
                logger.warn('获取存储数据失败:', e.message);
            }
            
            // 保存邮箱
            loginInfo.email = loginEmail;
            
            loginPage = page; // 保存登录页面，不关闭
            status.update(LoginStatus.ONLINE);
            await closeOtherPages(page);
            return {
                data: {
                    url: loginResultUrl,
                    message: '登录成功',
                    cookiesSaved: !!loginInfo.cookies
                },
                success: true,
                code: 200,
                message: '登录成功'
            };
        } else {
            // 如果判断为未登录，再次尝试访问 creative/material 页面确认
            logger.warn('初步判断为未登录，再次访问 creative/material 页面确认登录状态');
            try {
                await page.goto('https://data.insightrackr.com/creative/material', {
                    timeout: 120 * 1000,
                    waitUntil: 'domcontentloaded',
                });
                await page.waitForTimeout(1500);

                const finalUrl = page.url();
                logger.info('最终确认URL:', finalUrl);
                
                // 如果未跳转到登录页，说明已登录
                if (!finalUrl.includes('/login')) {
                    logger.info('✅ 最终确认：已登录');
                    status.update(LoginStatus.ONLINE);
                    loginPage = page;
                    loginInfo.email = loginEmail;

                    // 保存 cookies
                    try {
                        const cookies = await page.cookies();
                        loginInfo.cookies = cookies;
                        logger.info('已保存 cookies，数量:', cookies.length);
                    } catch (e) {
                        logger.error('保存 cookies 失败:', e.message);
                    }

                    await closeOtherPages(page);
                    return {
                        data: {
                            url: finalUrl,
                            message: '登录成功',
                            cookiesSaved: !!loginInfo.cookies
                        },
                        success: true,
                        code: 200,
                        message: '登录成功'
                    };
                } else {
                    logger.warn('最终确认：确实未登录（已跳转到登录页）');
                }
            } catch (e) {
                logger.error('最终确认登录状态失败:', e.message);
            }
            
            // 如果最终确认还是未登录，返回失败
            logger.warn('登录后仍在登录页面，可能登录失败');
            // 不关闭页面，保留页面以便查看
            loginPage = page; // 保存页面，不关闭
            status.update(LoginStatus.LOGGED_OUT);
            return {
                data: null,
                success: false,
                code: 'LOGIN_FAILED',
                message: '登录失败，请检查账号密码'
            };
        }
    } catch (error) {
        logger.error('登录过程发生错误:', error);
        // 关闭页面，避免资源泄漏
        if (page && !page.isClosed()) {
            try {
                await page.close();
            } catch (closeError) {
                logger.warn('关闭页面失败:', closeError.message);
            }
        }
        status.update(LoginStatus.LOGGED_OUT);
        return {
            data: null,
            success: false,
            code: 'LOGIN_ERROR',
            message: `登录失败: ${error.message}`
        };
    }
};

// 检查登录状态 - 必须使用已有登录会话的 loginPage，不能用 newPage（新页面无 cookie 会误判为未登录）
export const checkLoginStatus = async () => {
    if (!browser) {
        status.update(LoginStatus.LOGGED_OUT);
        return;
    }
    if (!loginPage || loginPage.isClosed()) {
        // 无可用登录页时不做校验，不覆盖当前 status（避免误判）
        return;
    }
    const page = loginPage;
    try {
        const targetUrl = 'https://data.insightrackr.com/creative/material';
        logger.info('检查登录状态：使用登录页访问', targetUrl);
        await page.goto(targetUrl, {
            timeout: 120 * 1000,
            waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(2000);
        const curPageUrl = page.url();
        logger.info('当前页面URL:', curPageUrl);
        if (curPageUrl.includes('/login')) {
            logger.info('检测到跳转到登录页，状态：未登录');
            status.update(LoginStatus.LOGGED_OUT);
        } else {
            logger.info('未跳转到登录页，状态：已登录');
            status.update(LoginStatus.ONLINE);
        }
    } catch (error) {
        logger.error('检查登录状态失败:', error);
        // 校验异常时不强制改为 LOGGED_OUT，保持当前状态
    }
};

// 获取登录信息（cookies 和 authorization）
export const getLoginInfo = () => {
    return {
        cookies: loginInfo.cookies,
        authorization: loginInfo.authorization,
        email: loginInfo.email,
        isLoggedIn: status.current === LoginStatus.ONLINE
    };
};

// 清除登录状态
export const clearLogin = async () => {
    if (loginPage && !loginPage.isClosed()) {
        await loginPage.close();
        loginPage = null;
    }
    // 清除登录信息
    loginInfo = {
        cookies: null,
        authorization: null,
        email: null,
        deviceId: null
    };
    status.update(LoginStatus.LOGGED_OUT);
    
    // 注意：不清除 userDataDir 文件夹，因为用户可能希望保留浏览器数据
    // 如果需要完全清除，可以删除 tmp/guangdada_spider_usr_dir 文件夹
    
    return {
        success: true,
        code: 200,
        message: '已清除登录状态'
    };
};

// 构建基础请求参数模板（所有字段都必须存在）
const buildBaseSearchParams = () => {
    return {
        keyWord: "",
        keyWordType: "0,1,2,3,4,6,8",
        keyWordList: [],
        keyWordListType: true,
        isNew: false,
        creativeList: [],
        appealTypeList: [],
        interactionList: [],
        languages: [],
        productIds: [],
        productOption: {
            productType: [],
            selling: [],
            monetization: [],
            payType: [],
            companyLocation: [],
            campaignList: []
        },
        baseOption: {
            permission: false,
            putOverseaInland: null,
            tradeLevel1: [],
            tradeLevel2: [],
            tradeLevel3: [],
            subjectType: [],
            countryLevel2: [],
            adfactionIds: [],
            mediaIds: [],
            device: [],
            topicType: [],
            productModel: [],
            dayMode: "DY",
            startTime: "2025-01-28",
            endTime: "2026-01-27",
            compareEndDate: "",
            compareStartDate: "",
            pageIndex: 1,
            pageSize: 60,
            sortField: "15",
            sortRule: "desc",
            gptSearch: false,
            materialTopLimit: "",
            szfxList: []
        },
        classIds: [],
        seelTargets: [],
        webTools: [],
        demoadFormats: [],
        adMediaType: [],
        materialRemovalRepeat: false,
        materialType: '',
        materialTag: [],
        creativeTeam: [],
        szfxList: []
    };
};

// 构建默认的初始化请求参数
const buildInitSearchParams = () => {
    return buildBaseSearchParams();
};

// 深度合并对象，确保所有字段都存在
const deepMerge = (base, override) => {
    const result = { ...base };
    
    for (const key in override) {
        // 允许覆盖，即使值为 null、空数组或空字符串
        if (override[key] !== undefined) {
            if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
                // 如果是对象，递归合并
                result[key] = deepMerge(base[key] || {}, override[key]);
            } else {
                // 数组、null、字符串等直接覆盖
                result[key] = override[key];
            }
        }
    }
    
    return result;
};

// 按官方 API 请求体键顺序排列（与官方抓包一致）
const OFFICIAL_BODY_KEY_ORDER = [
    'keyWord', 'keyWordType', 'keyWordList', 'keyWordListType', 'isNew',
    'creativeList', 'appealTypeList', 'interactionList', 'languages', 'productIds',
    'productOption', 'baseOption',
    'materialType', 'classIds', 'seelTargets', 'webTools', 'demoadFormats', 'adMediaType',
    'materialTag', 'creativeTeam', 'szfxList',
    'materialRemovalRepeat'
];
const buildOrderedRequestBody = (body) => {
    const ordered = {};
    for (const key of OFFICIAL_BODY_KEY_ORDER) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            ordered[key] = body[key];
        }
    }
    // 未在顺序表中的键也保留在末尾
    for (const key of Object.keys(body)) {
        if (!OFFICIAL_BODY_KEY_ORDER.includes(key)) ordered[key] = body[key];
    }
    return ordered;
};

// 请求数据接口
export const fetchSearchData = async (searchParams = {}, isInit = false) => {
    // 如果没有登录页面，尝试获取或创建页面
    if (!loginPage || loginPage.isClosed()) {
        logger.info('登录页面不存在或已关闭，尝试创建新页面');
        if (!browser) {
            logger.warn('浏览器未初始化，无法创建页面');
            return {
                data: null,
                success: false,
                code: 'NO_LOGIN_PAGE',
                message: '浏览器未初始化，请重新登录'
            };
        }
        
        try {
            loginPage = await browser.newPage();
            await setupAntiDetection(loginPage);
            // 访问 creative/material 页面
            await loginPage.goto('https://data.insightrackr.com/creative/material', {
                timeout: 120 * 1000,
                waitUntil: 'domcontentloaded',
            });
            await loginPage.waitForTimeout(2000);
            logger.info('已创建新页面并访问 creative/material');
        } catch (error) {
            logger.error('创建登录页面失败:', error);
            return {
                data: null,
                success: false,
                code: 'NO_LOGIN_PAGE',
                message: `登录页面创建失败: ${error.message}`
            };
        }
    }
    
    // 构建请求体 - 基于基础模板，只更新传入的参数值
    const baseParams = buildBaseSearchParams();
    
    // 过滤掉不属于 API 请求的字段（如 dateRange, countryLevel2 等顶层字段）
    const apiFields = [
        'keyWord', 'keyWordType', 'keyWordList', 'keyWordListType', 'isNew',
        'creativeList', 'appealTypeList', 'interactionList', 'languages',
        'productIds', 'productOption', 'baseOption', 'classIds', 'seelTargets',
        'webTools', 'demoadFormats', 'adMediaType', 'materialRemovalRepeat',
        'materialType', 'materialTag', 'creativeTeam', 'szfxList'
    ];
    
    // 只保留 API 需要的字段
    const filteredParams = {};
    for (const key of apiFields) {
        if (searchParams.hasOwnProperty(key)) {
            filteredParams[key] = searchParams[key];
        }
    }
    
    const requestBody = deepMerge(baseParams, filteredParams);
    
    // 确保 baseOption 中的所有字段都存在
    if (filteredParams.baseOption) {
        requestBody.baseOption = deepMerge(baseParams.baseOption, filteredParams.baseOption);
    }
    
    // 确保 productOption 中的所有字段都存在
    if (filteredParams.productOption) {
        requestBody.productOption = deepMerge(baseParams.productOption, filteredParams.productOption);
    }
    
    // 试玩广告：使用 preplay 接口，请求体与官方示例一致
    const isPlayable = searchParams.insightrackrSearchTab === 'playable';
    if (isPlayable) {
        requestBody.materialType = '';
        requestBody.demoadFormats = [];
        if (requestBody.baseOption) {
            requestBody.baseOption.dayMode = 'DD';
            requestBody.baseOption.gptSearch = true;
        }
    }
    // 与官方一致：行业筛选只放在 baseOption.tradeLevel3，productOption.productType 传空数组
    if (requestBody.productOption) requestBody.productOption.productType = [];
    if (requestBody.baseOption && requestBody.baseOption.globalSearch !== undefined) {
        delete requestBody.baseOption.globalSearch;
    }
    // baseOption 键顺序与官方一致（topicType -> productModel -> dayMode -> ...）
    if (requestBody.baseOption) {
        const baseOrder = ['permission', 'putOverseaInland', 'tradeLevel1', 'tradeLevel2', 'tradeLevel3', 'subjectType', 'countryLevel2', 'adfactionIds', 'mediaIds', 'device', 'topicType', 'productModel', 'dayMode', 'startTime', 'endTime', 'compareEndDate', 'compareStartDate', 'pageIndex', 'pageSize', 'sortField', 'sortRule', 'gptSearch', 'materialTopLimit', 'szfxList'];
        const ordered = {};
        for (const k of baseOrder) {
            if (Object.prototype.hasOwnProperty.call(requestBody.baseOption, k)) ordered[k] = requestBody.baseOption[k];
        }
        for (const k of Object.keys(requestBody.baseOption)) {
            if (!baseOrder.includes(k)) ordered[k] = requestBody.baseOption[k];
        }
        requestBody.baseOption = ordered;
    }
    
    try {
        // 首先尝试获取 authorization token
        let authorizationToken = loginInfo.authorization;
        
        // 如果还没有 token，尝试从页面获取
        if (!authorizationToken) {
            try {
                // 方法1: 从 localStorage/sessionStorage 获取
                const storageToken = await loginPage.evaluate(() => {
                    // 尝试多种可能的 key
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) return value;
                    }
                    return null;
                });
                
                if (storageToken) {
                    authorizationToken = storageToken;
                    loginInfo.authorization = storageToken;
                    logger.info('从页面存储中获取到 authorization token');
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        
        // 如果还是没有 token，通过导航到搜索页面并监听网络请求获取
        if (!authorizationToken) {
            try {
                logger.info('尝试通过导航到搜索页面获取 authorization token');
                const token = await new Promise((resolve) => {
                    let resolved = false;
                    const timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            resolve(null);
                        }
                    }, 10000);
                    
                    const requestHandler = (request) => {
                        if (!resolved) {
                            const url = request.url();
                            const headers = request.headers();
                            const authHeader = headers['authorization'] || headers['Authorization'];
                            
                            // 只关注搜索 API 的请求
                            if (url.includes('/cas/api/v2/imagevideo/search') && authHeader) {
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('request', requestHandler);
                                
                                // 同时获取 ECF07FD99F7847C0 header（设备标识符）
                                const deviceId = headers['ECF07FD99F7847C0'] || headers['ecf07fd99f7847c0'];
                                if (deviceId) {
                                    loginInfo.deviceId = deviceId;
                                    logger.info('✅ 从网络请求中获取到设备标识符:', deviceId);
                                }
                                
                                resolve(authHeader);
                            }
                        }
                    };
                    
                    loginPage.on('request', requestHandler);
                    
                    // 导航到搜索页面，这会触发实际的 API 请求
                    const keyword = requestBody.keyWord;
                    loginPage.goto(`https://data.insightrackr.com/search/material?keyWord=${encodeURIComponent(keyword)}&gpt=1`, {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    }).catch(() => {
                        // 即使导航失败，也继续等待请求
                    });
                });
                
                if (token) {
                    authorizationToken = token;
                    loginInfo.authorization = token;
                    logger.info('✅ 从网络请求中获取到 authorization token');
                } else {
                    logger.warn('⚠️ 未能从网络请求中获取到 authorization token');
                }
            } catch (e) {
                logger.warn('从网络请求获取 token 失败:', e.message);
            }
        }
        
        // 打印实际请求信息到控制台
        const searchPath = isPlayable ? '/cas/api/v2/preplay/search' : '/cas/api/v2/imagevideo/search';
        const searchUrl = isInit ? `${searchPath}?init` : searchPath;
        const fullUrl = `https://data.insightrackr.com${searchUrl}`;
        const refererBase = isPlayable ? 'https://data.insightrackr.com/creative/preplay' : (isInit ? 'https://data.insightrackr.com/creative/material' : 'https://data.insightrackr.com/search/material?keyWord=' + encodeURIComponent(requestBody.keyWord || '') + '&gpt=1');
        const requestHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Content-Type': 'application/json;charset=UTF-8',
            'presentationSortType': '1',
            'showTrendType': '1',
            'Language': 'en', // 使用 'en' 而不是 'cn'
            'ECF07FD99F7847C0': loginInfo.deviceId || 'a54ebcd25f886dac0d630e00cc831337', // 从实际请求中获取，如果没有则使用默认值
            'Email': loginInfo.email || '',
            'Origin': 'https://data.insightrackr.com',
            'Referer': refererBase,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1'
        };
        
        if (authorizationToken) {
            requestHeaders['Authorization'] = authorizationToken;
        }
        
        // 按官方请求体键顺序排列后再发送，与官方行为一致
        const bodyToSend = buildOrderedRequestBody(requestBody);
        // 打印完整请求信息
        console.log('\n========== Insightrackr 实际请求信息 ==========');
        console.log('URL:', fullUrl);
        console.log('Method: POST');
        console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
        console.log('Body:', JSON.stringify(bodyToSend, null, 2));
        console.log('===============================================\n');
        logger.info('实际请求 URL:', fullUrl);
        logger.info('实际请求 Headers:', JSON.stringify(requestHeaders, null, 2));
        logger.info('实际请求 Body:', JSON.stringify(bodyToSend, null, 2));
        
        // 使用 Puppeteer 页面发送请求，手动添加 authorization header
        const response = await loginPage.evaluate(async (body, authToken, isInitRequest, headers, url) => {
            try {
                // 如果有 authorization token，添加到请求头
                if (authToken) {
                    headers['Authorization'] = authToken;
                }
                
                const response = await fetch(url, {
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
        }, bodyToSend, authorizationToken, isInit, requestHeaders, searchUrl);
        
        // 更新 cookies（从页面获取最新的）
        try {
            const cookies = await loginPage.cookies();
            loginInfo.cookies = cookies;
        } catch (e) {
            logger.warn('更新 cookies 失败:', e.message);
        }
        
        // 如果返回 token 为空错误，尝试重新获取 token
        if (response.data && response.data.code === -3108) {
            logger.warn('服务器返回 token 为空错误，尝试重新获取 token');
            
            // 尝试从页面的实际请求中拦截获取
            try {
                const newToken = await new Promise((resolve) => {
                    let resolved = false;
                    const timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            resolve(null);
                        }
                    }, 10000);
                    
                    const responseHandler = async (response) => {
                        if (!resolved) {
                            const request = response.request();
                            const headers = request.headers();
                            const authHeader = headers['authorization'] || headers['Authorization'];
                            if (authHeader) {
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('response', responseHandler);
                                resolve(authHeader);
                            }
                        }
                    };
                    
                    loginPage.on('response', responseHandler);
                    
                    // 导航到搜索页面，触发实际的 API 请求
                    loginPage.goto('https://data.insightrackr.com/search/material?keyWord=' + encodeURIComponent(requestBody.keyWord) + '&gpt=1', {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    }).catch(() => {});
                });
                
                if (newToken) {
                    authorizationToken = newToken;
                    loginInfo.authorization = newToken;
                    logger.info('重新获取到 authorization token，准备重试请求');
                    
                    // 重试请求 - 使用相同的 headers 和 url
                    console.log('\n========== Insightrackr 重试请求信息 ==========');
                    console.log('URL:', fullUrl);
                    console.log('Method: POST');
                    console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
                    console.log('Body:', JSON.stringify(bodyToSend, null, 2));
                    console.log('===============================================\n');
                    
                    const retryResponse = await loginPage.evaluate(async (body, authToken, isInitRequest, headers, url) => {
                        try {
                            // 如果有 authorization token，添加到请求头
                            if (authToken) {
                                headers['Authorization'] = authToken;
                            }
                            
                            const response = await fetch(url, {
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
                    }, bodyToSend, authorizationToken, isInit, requestHeaders, searchUrl);
                    
                    return {
                        data: retryResponse.data,
                        success: retryResponse.ok,
                        code: retryResponse.status,
                        message: retryResponse.ok ? '请求成功' : `请求失败: ${retryResponse.statusText}`
                    };
                }
            } catch (e) {
                logger.error('重新获取 token 失败:', e.message);
            }
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

// 获取数据总数（count 接口）
export const fetchCountData = async (searchParams = {}) => {
    // 如果没有登录页面，尝试获取或创建页面
    if (!loginPage || loginPage.isClosed()) {
        logger.info('登录页面不存在或已关闭，尝试创建新页面');
        if (!browser) {
            logger.warn('浏览器未初始化，无法创建页面');
            return {
                data: null,
                success: false,
                code: 'NO_LOGIN_PAGE',
                message: '浏览器未初始化，请重新登录'
            };
        }
        
        try {
            loginPage = await browser.newPage();
            await setupAntiDetection(loginPage);
            // 访问 creative/material 页面
            await loginPage.goto('https://data.insightrackr.com/creative/material', {
                timeout: 120 * 1000,
                waitUntil: 'domcontentloaded',
            });
            await loginPage.waitForTimeout(2000);
            logger.info('已创建新页面并访问 creative/material');
        } catch (error) {
            logger.error('创建登录页面失败:', error);
            return {
                data: null,
                success: false,
                code: 'NO_LOGIN_PAGE',
                message: `登录页面创建失败: ${error.message}`
            };
        }
    }
    
    // 构建请求体 - 基于基础模板，只更新传入的参数值
    const baseParams = buildBaseSearchParams();
    
    // 过滤掉不属于 API 请求的字段
    const apiFields = [
        'keyWord', 'keyWordType', 'keyWordList', 'keyWordListType', 'isNew',
        'creativeList', 'appealTypeList', 'interactionList', 'languages',
        'productIds', 'productOption', 'baseOption', 'classIds', 'seelTargets',
        'webTools', 'demoadFormats', 'adMediaType', 'materialRemovalRepeat',
        'materialType', 'materialTag', 'creativeTeam', 'szfxList'
    ];
    
    // 只保留 API 需要的字段
    const filteredParams = {};
    for (const key of apiFields) {
        if (searchParams.hasOwnProperty(key)) {
            filteredParams[key] = searchParams[key];
        }
    }
    
    const requestBody = deepMerge(baseParams, filteredParams);
    
    // 确保 baseOption 中的所有字段都存在
    if (filteredParams.baseOption) {
        requestBody.baseOption = deepMerge(baseParams.baseOption, filteredParams.baseOption);
    }
    
    // 确保 productOption 中的所有字段都存在
    if (filteredParams.productOption) {
        requestBody.productOption = deepMerge(baseParams.productOption, filteredParams.productOption);
    }
    
    // 试玩广告：使用 preplay count 接口，请求体与官方示例一致
    const isPlayableCount = searchParams.insightrackrSearchTab === 'playable';
    if (isPlayableCount) {
        requestBody.materialType = '';
        requestBody.demoadFormats = [];
        if (requestBody.baseOption) {
            requestBody.baseOption.dayMode = 'DD';
            requestBody.baseOption.gptSearch = true;
        }
    }
    // 与官方一致：行业只放在 baseOption.tradeLevel3，productOption.productType 传空
    if (requestBody.productOption) requestBody.productOption.productType = [];
    if (requestBody.baseOption && requestBody.baseOption.globalSearch !== undefined) delete requestBody.baseOption.globalSearch;
    if (requestBody.baseOption) {
        const baseOrder = ['permission', 'putOverseaInland', 'tradeLevel1', 'tradeLevel2', 'tradeLevel3', 'subjectType', 'countryLevel2', 'adfactionIds', 'mediaIds', 'device', 'topicType', 'productModel', 'dayMode', 'startTime', 'endTime', 'compareEndDate', 'compareStartDate', 'pageIndex', 'pageSize', 'sortField', 'sortRule', 'gptSearch', 'materialTopLimit', 'szfxList'];
        const ordered = {};
        for (const k of baseOrder) {
            if (Object.prototype.hasOwnProperty.call(requestBody.baseOption, k)) ordered[k] = requestBody.baseOption[k];
        }
        for (const k of Object.keys(requestBody.baseOption)) {
            if (!baseOrder.includes(k)) ordered[k] = requestBody.baseOption[k];
        }
        requestBody.baseOption = ordered;
    }
    const countBodyToSend = buildOrderedRequestBody(requestBody);
    
    try {
        // 首先尝试获取 authorization token
        let authorizationToken = loginInfo.authorization;
        
        // 如果还没有 token，尝试从页面获取
        if (!authorizationToken) {
            try {
                const storageToken = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) return value;
                    }
                    return null;
                });
                
                if (storageToken) {
                    authorizationToken = storageToken;
                    loginInfo.authorization = storageToken;
                    logger.info('从页面存储中获取到 authorization token');
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        
        // 打印实际请求信息到控制台
        const countPath = isPlayableCount ? '/cas/api/v3/preplay/count' : '/cas/api/v3/imagevideo/count';
        const countUrl = countPath;
        const fullUrl = `https://data.insightrackr.com${countUrl}`;
        const countReferer = isPlayableCount ? 'https://data.insightrackr.com/creative/preplay' : 'https://data.insightrackr.com/creative/material';
        const requestHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Content-Type': 'application/json;charset=UTF-8',
            'presentationSortType': '1',
            'showTrendType': '1',
            'Language': 'en',
            'ECF07FD99F7847C0': loginInfo.deviceId || 'a54ebcd25f886dac0d630e00cc831337',
            'Email': loginInfo.email || '',
            'Origin': 'https://data.insightrackr.com',
            'Referer': countReferer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1'
        };
        
        if (authorizationToken) {
            requestHeaders['Authorization'] = authorizationToken;
        }
        
        // 打印完整请求信息
        console.log('\n========== Insightrackr Count 实际请求信息 ==========');
        console.log('URL:', fullUrl);
        console.log('Method: POST');
        console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
        console.log('Body:', JSON.stringify(countBodyToSend, null, 2));
        console.log('===============================================\n');
        logger.info('Count 实际请求 URL:', fullUrl);
        logger.info('Count 实际请求 Headers:', JSON.stringify(requestHeaders, null, 2));
        logger.info('Count 实际请求 Body:', JSON.stringify(countBodyToSend, null, 2));
        
        // 使用 Puppeteer 页面发送请求
        const response = await loginPage.evaluate(async (body, authToken, headers, url) => {
            try {
                if (authToken) {
                    headers['Authorization'] = authToken;
                }
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    credentials: 'include',
                    body: JSON.stringify(body)
                });
                
                const text = await response.text();
                let data = null;
                
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
        }, countBodyToSend, authorizationToken, requestHeaders, countUrl);
        
        // 更新 cookies
        try {
            const cookies = await loginPage.cookies();
            loginInfo.cookies = cookies;
        } catch (e) {
            logger.warn('更新 cookies 失败:', e.message);
        }
        
        return {
            data: response.data,
            success: response.ok,
            code: response.status,
            message: response.ok ? '请求成功' : `请求失败: ${response.statusText}`
        };
    } catch (error) {
        logger.error('请求 count 数据失败:', error);
        return {
            data: null,
            success: false,
            code: 500,
            message: `请求失败: ${error.message}`
        };
    }
};

// 构建 distribute 请求体（与 search/count 相同，并加上 ids）
function buildDistributeRequestBody(searchParams = {}, ids = []) {
    const baseParams = buildBaseSearchParams();
    const apiFields = [
        'keyWord', 'keyWordType', 'keyWordList', 'keyWordListType', 'isNew',
        'creativeList', 'appealTypeList', 'interactionList', 'languages',
        'productIds', 'productOption', 'baseOption', 'classIds', 'seelTargets',
        'webTools', 'demoadFormats', 'adMediaType', 'materialRemovalRepeat',
        'materialType', 'materialTag', 'creativeTeam', 'szfxList'
    ];
    const filteredParams = {};
    for (const key of apiFields) {
        if (searchParams.hasOwnProperty(key)) {
            filteredParams[key] = searchParams[key];
        }
    }
    const requestBody = deepMerge(baseParams, filteredParams);
    if (filteredParams.baseOption) {
        requestBody.baseOption = deepMerge(baseParams.baseOption, filteredParams.baseOption);
    }
    if (filteredParams.productOption) {
        requestBody.productOption = deepMerge(baseParams.productOption, filteredParams.productOption);
    }
    requestBody.ids = Array.isArray(ids) ? ids : [];
    return requestBody;
}

// 请求流量分布渠道（distribute/media）
export const fetchDistributeMedia = async (searchParams = {}, ids = []) => {
    if (!loginPage || loginPage.isClosed()) {
        logger.info('登录页面不存在或已关闭，无法请求 distribute/media');
        return {
            data: null,
            success: false,
            code: 'NO_LOGIN_PAGE',
            message: '请先登录'
        };
    }
    const requestBody = buildDistributeRequestBody(searchParams, ids);
    if (requestBody.ids.length === 0) {
        return { data: {}, success: true, code: 200, message: '无创意 id' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        if (!authorizationToken) {
            try {
                const storageToken = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) return value;
                    }
                    return null;
                });
                if (storageToken) {
                    authorizationToken = storageToken;
                    loginInfo.authorization = storageToken;
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        const { path, referer } = getDistributePathAndReferer(searchParams, 'media');
        const fullUrl = `https://data.insightrackr.com${path}`;
        const requestHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Content-Type': 'application/json;charset=UTF-8',
            'presentationSortType': '1',
            'showTrendType': '1',
            'Language': 'en',
            'ECF07FD99F7847C0': loginInfo.deviceId || 'a54ebcd25f886dac0d630e00cc831337',
            'Email': loginInfo.email || '',
            'Origin': 'https://data.insightrackr.com',
            'Referer': referer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1'
        };
        if (authorizationToken) {
            requestHeaders['Authorization'] = authorizationToken;
        }
        const response = await loginPage.evaluate(async (body, authToken, headers, url) => {
            try {
                if (authToken) headers['Authorization'] = authToken;
                const res = await fetch(url, {
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
                    } catch (e) {
                        return { ok: false, status: res.status, statusText: res.statusText, data: { code: -1, message: 'JSON 解析失败' } };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (err) {
                return { ok: false, status: 500, statusText: err.message, data: { code: -1, message: err.message } };
            }
        }, requestBody, authorizationToken, requestHeaders, path);
        const inner = response.data && response.data.data !== undefined ? response.data.data : (response.data || {});
        return {
            data: inner,
            success: response.ok,
            code: response.status,
            message: response.ok ? '请求成功' : (response.data?.message || response.statusText)
        };
    } catch (error) {
        logger.error('请求 distribute/media 失败:', error);
        return { data: null, success: false, code: 500, message: error.message };
    }
};

// 试玩广告用 preplay 路径，图片和视频用 imagevideo 路径
function getDistributePathAndReferer(searchParams, resource) {
    const isPlayable = searchParams.insightrackrSearchTab === 'playable';
    const base = isPlayable ? '/cas/api/v3/preplay' : '/cas/api/v3/imagevideo';
    const referer = isPlayable ? 'https://data.insightrackr.com/creative/preplay' : 'https://data.insightrackr.com/creative/material';
    return { path: `${base}/distribute/${resource}`, referer };
}

// 请求广告发行商/App 信息（distribute/app）
export const fetchDistributeApp = async (searchParams = {}, ids = []) => {
    if (!loginPage || loginPage.isClosed()) {
        logger.info('登录页面不存在或已关闭，无法请求 distribute/app');
        return {
            data: null,
            success: false,
            code: 'NO_LOGIN_PAGE',
            message: '请先登录'
        };
    }
    const requestBody = buildDistributeRequestBody(searchParams, ids);
    if (requestBody.ids.length === 0) {
        return { data: {}, success: true, code: 200, message: '无创意 id' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        if (!authorizationToken) {
            try {
                const storageToken = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) return value;
                    }
                    return null;
                });
                if (storageToken) {
                    authorizationToken = storageToken;
                    loginInfo.authorization = storageToken;
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        const { path, referer } = getDistributePathAndReferer(searchParams, 'app');
        const fullUrl = `https://data.insightrackr.com${path}`;
        const requestHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Content-Type': 'application/json;charset=UTF-8',
            'presentationSortType': '1',
            'showTrendType': '1',
            'Language': 'en',
            'ECF07FD99F7847C0': loginInfo.deviceId || 'a54ebcd25f886dac0d630e00cc831337',
            'Email': loginInfo.email || '',
            'Origin': 'https://data.insightrackr.com',
            'Referer': referer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1'
        };
        if (authorizationToken) {
            requestHeaders['Authorization'] = authorizationToken;
        }
        const response = await loginPage.evaluate(async (body, authToken, headers, url) => {
            try {
                if (authToken) headers['Authorization'] = authToken;
                const res = await fetch(url, {
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
                    } catch (e) {
                        return { ok: false, status: res.status, statusText: res.statusText, data: { code: -1, message: 'JSON 解析失败' } };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (err) {
                return { ok: false, status: 500, statusText: err.message, data: { code: -1, message: err.message } };
            }
        }, requestBody, authorizationToken, requestHeaders, path);
        const inner = response.data && response.data.data !== undefined ? response.data.data : (response.data || {});
        return {
            data: inner,
            success: response.ok,
            code: response.status,
            message: response.ok ? '请求成功' : (response.data?.message || response.statusText)
        };
    } catch (error) {
        logger.error('请求 distribute/app 失败:', error);
        return { data: null, success: false, code: 500, message: error.message };
    }
};

// 请求行动号召分布（distribute/adfaction）- 试玩广告用 preplay，图片和视频用 imagevideo
export const fetchDistributeAdfaction = async (searchParams = {}, ids = []) => {
    if (!loginPage || loginPage.isClosed()) {
        logger.info('登录页面不存在或已关闭，无法请求 distribute/adfaction');
        return {
            data: null,
            success: false,
            code: 'NO_LOGIN_PAGE',
            message: '请先登录'
        };
    }
    const requestBody = buildDistributeRequestBody(searchParams, ids);
    if (requestBody.ids.length === 0) {
        return { data: {}, success: true, code: 200, message: '无创意 id' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        if (!authorizationToken) {
            try {
                const storageToken = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) return value;
                    }
                    return null;
                });
                if (storageToken) {
                    authorizationToken = storageToken;
                    loginInfo.authorization = storageToken;
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        const { path, referer } = getDistributePathAndReferer(searchParams, 'adfaction');
        const requestHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Content-Type': 'application/json;charset=UTF-8',
            'presentationSortType': '1',
            'showTrendType': '1',
            'Language': 'en',
            'ECF07FD99F7847C0': loginInfo.deviceId || 'a54ebcd25f886dac0d630e00cc831337',
            'Email': loginInfo.email || '',
            'Origin': 'https://data.insightrackr.com',
            'Referer': referer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1'
        };
        if (authorizationToken) {
            requestHeaders['Authorization'] = authorizationToken;
        }
        const response = await loginPage.evaluate(async (body, authToken, headers, url) => {
            try {
                if (authToken) headers['Authorization'] = authToken;
                const res = await fetch(url, {
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
                    } catch (e) {
                        return { ok: false, status: res.status, statusText: res.statusText, data: { code: -1, message: 'JSON 解析失败' } };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (err) {
                return { ok: false, status: 500, statusText: err.message, data: { code: -1, message: err.message } };
            }
        }, requestBody, authorizationToken, requestHeaders, path);
        const inner = response.data && response.data.data !== undefined ? response.data.data : (response.data || {});
        return {
            data: inner,
            success: response.ok,
            code: response.status,
            message: response.ok ? '请求成功' : (response.data?.message || response.statusText)
        };
    } catch (error) {
        logger.error('请求 distribute/adfaction 失败:', error);
        return { data: null, success: false, code: 500, message: error.message };
    }
};

// 全局搜索（search-global）：应用/产品、开发者；两请求 searchType "1"（左侧Apps）与 "2"（右侧开发者旗下APP）均需带 baseOption
const DEFAULT_SEARCH_GLOBAL_BASE_OPTION = { sortField: '3', sortRule: 'desc', dayMode: 'ALL', gptSearch: false };

export const fetchSearchGlobal = async (keyWord = '', searchType = '1', baseOption) => {
    if (!loginPage || loginPage.isClosed()) {
        return {
            data: null,
            success: false,
            code: 'NO_LOGIN_PAGE',
            message: '请先登录'
        };
    }
    const kw = String(keyWord || '').trim();
    if (!kw) {
        return { data: { productList: [], companyList: [] }, success: true, code: 200, message: '关键词为空' };
    }
    try {
        let authorizationToken = loginInfo.authorization;
        if (!authorizationToken) {
            try {
                const storageToken = await loginPage.evaluate(() => {
                    const keys = ['authorization', 'token', 'authToken', 'accessToken', 'bearerToken', 'Authorization'];
                    for (const key of keys) {
                        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (value) return value;
                    }
                    return null;
                });
                if (storageToken) {
                    authorizationToken = storageToken;
                    loginInfo.authorization = storageToken;
                }
            } catch (e) {
                logger.warn('从存储获取 token 失败:', e.message);
            }
        }
        const path = '/cas/api/app/search-global';
        const requestBody = {
            keyWord: kw,
            searchType: String(searchType),
            baseOption: baseOption && typeof baseOption === 'object' ? baseOption : DEFAULT_SEARCH_GLOBAL_BASE_OPTION
        };
        const requestHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Content-Type': 'application/json;charset=UTF-8',
            'presentationSortType': '1',
            'showTrendType': '1',
            'Language': 'cn',
            'ECF07FD99F7847C0': loginInfo.deviceId || 'a54ebcd25f886dac0d630e00cc831337',
            'Email': loginInfo.email || '',
            'Origin': 'https://data.insightrackr.com',
            'Referer': 'https://data.insightrackr.com/creative/material',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'cache-control': 'max-age=0',
            'upgrade-insecure-requests': '1'
        };
        if (authorizationToken) {
            requestHeaders['Authorization'] = authorizationToken;
        }
        const response = await loginPage.evaluate(async (body, authToken, headers, url) => {
            try {
                if (authToken) headers['Authorization'] = authToken;
                const res = await fetch(url, {
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
                    } catch (e) {
                        return { ok: false, status: res.status, statusText: res.statusText, data: { code: -1, message: 'JSON 解析失败' } };
                    }
                }
                return { ok: res.ok, status: res.status, statusText: res.statusText, data };
            } catch (err) {
                return { ok: false, status: 500, statusText: err.message, data: { code: -1, message: err.message } };
            }
        }, requestBody, authorizationToken, requestHeaders, path);
        const payload = response.data && response.data.data !== undefined ? response.data.data : (response.data || {});
        return {
            data: payload,
            success: response.ok,
            code: response.status,
            message: response.ok ? '请求成功' : (response.data?.message || response.statusText)
        };
    } catch (error) {
        logger.error('请求 search-global 失败:', error);
        return { data: null, success: false, code: 500, message: error.message };
    }
};

// 爬取当前页面数据
export const scrapePage = async () => {
    if (!browser) {
        return {
            data: null,
            success: false,
            code: 'BROWSER_NOT_INITIALIZED',
            message: '浏览器未初始化'
        };
    }

    // 移除登录检查，直接使用 loginPage 或创建新页面
    // 如果 loginPage 存在且未关闭，使用它
    if (loginPage && !loginPage.isClosed()) {
        // 如果状态不是 ONLINE，更新状态
        if (status.current !== LoginStatus.ONLINE) {
            logger.info('检测到登录页面存在，更新状态为 ONLINE');
            status.update(LoginStatus.ONLINE);
        }
    }

    // 使用已登录的页面或创建新页面
    let page;
    if (loginPage && !loginPage.isClosed()) {
        page = loginPage;
        logger.info('使用已登录的页面进行数据爬取，当前URL:', page.url());
    } else {
        // 如果登录页面已关闭或不存在，创建新页面
        logger.info('创建新页面进行数据爬取');
        page = await browser.newPage();
        await setupAntiDetection(page);
        try {
            await page.goto('https://data.insightrackr.com/creative/material', { 
                timeout: 120 * 1000, 
                waitUntil: 'networkidle2' 
            });
        } catch (e) {
            logger.warn('新页面加载失败，继续尝试爬取:', e.message);
            // 即使加载失败，也继续尝试爬取
        }
    }

    try {
        // 确保在目标页面
        const currentUrl = page.url();
        if (!currentUrl.includes('/creative/material')) {
            logger.info('当前不在目标页面，正在跳转...');
            await page.goto('https://data.insightrackr.com/creative/material', { 
                timeout: 120 * 1000, 
                waitUntil: 'networkidle2' 
            });
        }

        // 减少等待时间，只等待 500ms
        const waitStartTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 500));
        const waitTime = Date.now() - waitStartTime;
        logger.info(`等待页面加载耗时: ${waitTime}ms`);

        // 提取页面数据
        const extractStartTime = Date.now();
        const pageData = await page.evaluate(() => {
            const data = {
                title: document.title,
                url: window.location.href,
                pageHtml: '', // 整个页面的 HTML
                cssLinks: [], // CSS 样式表链接
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

            // 提取整个页面的 HTML（body 部分）
            const body = document.body;
            if (body) {
                // 克隆 body 以获取完整的 HTML 结构
                const cloned = body.cloneNode(true);
                // 移除可能影响显示的隐藏元素
                cloned.querySelectorAll('[style*="display: none"], .hidden').forEach(el => {
                    el.remove();
                });
                data.pageHtml = cloned.outerHTML;
            }

            return data;
        });
        const extractTime = Date.now() - extractStartTime;
        logger.info(`页面数据提取耗时: ${extractTime}ms，HTML长度: ${pageData.pageHtml?.length || 0} 字符，CSS链接数: ${pageData.cssLinks.length}`);
        
        return {
            data: pageData,
            success: true,
            code: 200,
            message: '数据爬取成功'
        };
    } catch (error) {
        logger.error(`爬取页面失败: ${error.message}`);
        return {
            data: null,
            success: false,
            code: 500,
            message: `爬取失败: ${error.message}`
        };
    }
};

// 获取浏览器页面 URL（用于 iframe）
export const getBrowserPageUrl = async () => {
    if (!browser) {
        logger.error('浏览器未初始化');
        return {
            data: null,
            success: false,
            code: 'BROWSER_NOT_INITIALIZED',
            message: '浏览器未初始化'
        };
    }

    // 移除登录检查，直接使用 loginPage 或创建新页面
    // 如果 loginPage 存在且未关闭，使用它
    if (loginPage && !loginPage.isClosed()) {
        logger.info('检测到登录页面存在，使用登录页面获取URL');
        // 如果状态不是 ONLINE，更新状态
        if (status.current !== LoginStatus.ONLINE) {
            logger.info('状态不一致，更新状态为 ONLINE');
            status.update(LoginStatus.ONLINE);
        }
    }

    // 确保在目标页面
    let page;
    let isNewPage = false;
    
    if (loginPage && !loginPage.isClosed()) {
        page = loginPage;
        logger.info('使用已登录的页面，当前URL:', page.url());
        const currentUrl = page.url();
        
        // 移除登录页面检查，即使仍在登录页面也继续执行
        if (currentUrl.includes('/login')) {
            logger.warn('当前仍在登录页面，但继续执行操作');
        }
        
        if (!currentUrl.includes('/creative/material')) {
            logger.info('当前不在目标页面，正在跳转到 /creative/material...');
            try {
                await page.goto('https://data.insightrackr.com/creative/material', { 
                    timeout: 120 * 1000, 
                    waitUntil: 'networkidle2' 
                });
                logger.info('已跳转到目标页面:', page.url());
            } catch (error) {
                logger.error('跳转失败:', error.message);
                // 即使跳转失败，也返回当前 URL
            }
        }
    } else {
        logger.warn('登录页面已关闭或不存在，创建新页面');
        page = await browser.newPage();
        await setupAntiDetection(page);
        isNewPage = true;
        try {
            await page.goto('https://data.insightrackr.com/creative/material', { 
                timeout: 120 * 1000, 
                waitUntil: 'networkidle2' 
            });
            logger.info('新页面已加载:', page.url());
        } catch (error) {
            logger.error('新页面加载失败:', error.message);
            // 如果加载失败，关闭新页面
            if (isNewPage) {
                await page.close().catch(() => {});
            }
            return {
                data: null,
                success: false,
                code: 500,
                message: `页面加载失败: ${error.message}`
            };
        }
    }

    const url = page.url();
    logger.info('返回页面URL:', url);
    
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

    // 移除登录检查，直接使用 loginPage 或创建新页面
    // 如果 loginPage 存在且未关闭，使用它
    if (loginPage && !loginPage.isClosed()) {
        // 如果状态不是 ONLINE，更新状态
        if (status.current !== LoginStatus.ONLINE) {
            logger.info('检测到登录页面存在，更新状态为 ONLINE');
            status.update(LoginStatus.ONLINE);
        }
    }

    // 使用已登录的页面，确保在目标页面
    let page;
    if (loginPage && !loginPage.isClosed()) {
        page = loginPage;
        logger.info('使用已登录的页面执行操作，当前URL:', page.url());
        const currentUrl = page.url();
        // 如果不在目标页面，尝试跳转（但不强制）
        if (!currentUrl.includes('/creative/material') && !currentUrl.includes('/login')) {
            try {
                await page.goto('https://data.insightrackr.com/creative/material', { 
                    timeout: 120 * 1000, 
                    waitUntil: 'networkidle2' 
                });
                logger.info('已跳转到目标页面');
            } catch (e) {
                logger.warn('跳转失败，继续使用当前页面:', e.message);
            }
        }
    } else {
        // 如果没有登录页面，创建新页面
        logger.info('创建新页面执行操作');
        page = await browser.newPage();
        await setupAntiDetection(page);
        try {
            await page.goto('https://data.insightrackr.com/creative/material', { 
                timeout: 120 * 1000, 
                waitUntil: 'networkidle2' 
            });
        } catch (e) {
            logger.warn('新页面加载失败:', e.message);
            // 即使加载失败，也继续执行操作
        }
    }

    try {
        const actionStartTime = Date.now();
        const { type, selector, value, actionType } = action;

        // 等待元素加载
        const waitElementStartTime = Date.now();
        await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {
            logger.warn(`元素 ${selector} 未找到，继续执行...`);
        });
        const waitElementTime = Date.now() - waitElementStartTime;
        logger.info(`等待元素加载耗时: ${waitElementTime}ms`);

        const executeStartTime = Date.now();
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
                        // 尝试通过包含特定文本查找
                        const allElements = document.querySelectorAll('*');
                        for (const el of allElements) {
                            if (el.textContent && el.textContent.includes(sel)) {
                                element = el;
                                break;
                            }
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
                // 输入操作
                const inputStartTime = Date.now();
                logger.info(`尝试输入到元素: ${selector}, 值: ${value}`);
                const inputted = await page.evaluate((sel, val) => {
                    console.log('浏览器端查找元素:', sel);
                    let element = null;
                    
                    // 方法1: 直接查询
                    element = document.querySelector(sel);
                    console.log('方法1结果:', element ? '找到' : '未找到');
                    
                    // 方法2: 如果选择器是ID，尝试多种方式
                    if (!element && sel.startsWith('#')) {
                        const id = sel.substring(1);
                        // 尝试精确匹配
                        element = document.getElementById(id);
                        if (!element) {
                            // 尝试部分匹配
                            element = document.querySelector(`[id*="${id}"]`);
                        }
                        if (!element) {
                            // 尝试包含该ID的所有元素
                            const allElements = document.querySelectorAll('*');
                            for (const el of allElements) {
                                if (el.id && el.id.includes(id)) {
                                    element = el;
                                    break;
                                }
                            }
                        }
                        console.log('方法2结果:', element ? '找到' : '未找到');
                    }
                    
                    // 方法3: 如果还是找不到，尝试查找所有输入框
                    if (!element) {
                        const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input[type="email"], input:not([type])');
                        // 如果只有一个输入框，就使用它
                        if (inputs.length === 1) {
                            element = inputs[0];
                        } else if (inputs.length > 1) {
                            // 如果有多个，尝试找到可见的、未禁用的
                            for (const input of inputs) {
                                if (input.offsetParent !== null && !input.disabled) {
                                    element = input;
                                    break;
                                }
                            }
                        }
                        console.log('方法3结果:', element ? '找到' : '未找到', '输入框数量:', inputs.length);
                    }
                    
                    if (element) {
                        // 如果是 Ant Design 或 Element UI 的输入框，可能需要找到实际的 input 元素
                        let actualInput = element;
                        if (element.tagName !== 'INPUT') {
                            // 查找内部的 input 元素
                            actualInput = element.querySelector('input[type="text"], input[type="search"], input[type="email"], input:not([type])');
                            if (!actualInput) {
                                // 如果找不到，尝试查找任何 input
                                actualInput = element.querySelector('input');
                            }
                            if (!actualInput) {
                                actualInput = element;
                            }
                        }
                        
                        console.log('实际输入元素:', actualInput.tagName, actualInput.type, actualInput.id);
                        
                        // 设置值
                        actualInput.value = val;
                        actualInput.focus();
                        
                        // 触发输入事件（使用更完整的事件）
                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                        
                        // 对于 Vue/React 等框架，可能需要触发更完整的事件
                        Object.defineProperty(actualInput, 'value', {
                            get: function() { return val; },
                            set: function(newVal) { val = newVal; },
                            configurable: true
                        });
                        
                        actualInput.dispatchEvent(inputEvent);
                        actualInput.dispatchEvent(changeEvent);
                        
                        // 触发键盘事件（某些框架需要）
                        actualInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                        actualInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                        
                        actualInput.blur();
                        
                        console.log('输入完成，当前值:', actualInput.value);
                        return true;
                    }
                    
                    console.log('所有方法都未找到元素');
                    return false;
                }, selector, value);
                const inputTime = Date.now() - inputStartTime;
                
                if (!inputted) {
                    logger.warn(`未能找到要输入的元素: ${selector}，耗时: ${inputTime}ms`);
                    // 即使找不到，也继续执行，返回当前页面
                } else {
                    logger.info(`已输入值到元素: ${selector}, 值: ${value}，耗时: ${inputTime}ms`);
                }
                break;

            case 'select':
                // 选择操作（下拉框）
                const selected = await page.evaluate((sel, val) => {
                    let element = document.querySelector(sel);
                    if (!element) {
                        element = document.querySelector('select');
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
                // 复选框操作
                const checked = await page.evaluate((sel, checkedValue) => {
                    let element = document.querySelector(sel);
                    if (!element) {
                        element = document.querySelector('input[type="checkbox"]');
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
        const executeTime = Date.now() - executeStartTime;
        logger.info(`执行操作耗时: ${executeTime}ms`);
        
        // 检查是否需要更新页面（skipUpdate 为 true 时跳过）
        const skipUpdate = action.skipUpdate === true;
        
        if (skipUpdate) {
            // 对于输入操作，只执行操作，不更新页面
            logger.info('输入操作完成，跳过页面更新');
            return {
                data: null,
                success: true,
                code: 200,
                message: '操作执行成功（已跳过页面更新）'
            };
        }
        
        // 如果是搜索或提交操作，等待数据加载
        const waitDataStartTime = Date.now();
        if (type === 'click' && (selector.includes('search') || selector.includes('submit') || actionType === 'search')) {
            logger.info('等待数据加载...');
            await new Promise(resolve => setTimeout(resolve, 1500)); // 减少等待时间
            try {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {
                    logger.warn('等待导航超时，继续执行...');
                });
            } catch (e) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 减少等待时间
            }
        } else {
            // 其他操作等待较短时间
            await new Promise(resolve => setTimeout(resolve, 300)); // 减少等待时间
        }
        const waitDataTime = Date.now() - waitDataStartTime;
        logger.info(`等待数据加载耗时: ${waitDataTime}ms`);

        // 操作完成后，等待一下让页面更新
        const waitUpdateStartTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 300)); // 减少等待时间
        const waitUpdateTime = Date.now() - waitUpdateStartTime;
        logger.info(`等待页面更新耗时: ${waitUpdateTime}ms`);
        
        // 重新爬取数据
        const scrapeStartTime = Date.now();
        logger.info('操作完成，开始重新爬取页面数据...');
        const result = await scrapePage();
        const scrapeTime = Date.now() - scrapeStartTime;
        logger.info(`页面爬取耗时: ${scrapeTime}ms`);
        
        if (result.success) {
            logger.info(`页面数据爬取成功，HTML长度: ${result.data?.pageHtml?.length || 0}`);
        } else {
            logger.warn(`页面数据爬取失败: ${result.message}`);
        }
        
        const totalTime = Date.now() - actionStartTime;
        logger.info(`=== 操作总耗时: ${totalTime}ms === (执行: ${executeTime}ms, 等待数据: ${waitDataTime}ms, 等待更新: ${waitUpdateTime}ms, 爬取: ${scrapeTime}ms)`);
        
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

