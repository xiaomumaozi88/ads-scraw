import puppeteerBase, {TimeoutError} from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {puppeteerOptions} from '../config.js';
import {rm} from 'fs/promises';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import {LoginStatus} from '../constants/index.js';
import {upload} from '../utils/utils.js';

// 使用 Stealth 插件来避免反爬虫检测
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 指定要删除的文件夹路径
const folderToDelete = join(__dirname, '../../tmp/guangdada_spider_usr_dir');

let browser;
let loginPage; // 登录页面

// 存储登录信息
let loginInfo = {
    cookies: null,
    email: null,
    authorization: null, // JWT token
    deviceId: null,
    userToken: null
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
    console.log('准备启动广大大浏览器');
    try {
        logger.info('尝试启动浏览器，配置:', JSON.stringify(puppeteerOptions, null, 2));
        browser = await puppeteer.launch(puppeteerOptions);
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
            browser = await puppeteer.launch({
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
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
    if (browser) {
        await browser.close();
    }
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
    // 不再自动检查登录状态，只返回当前保存的状态
    // 如果需要检查，可以手动调用 checkLoginStatus
    return {
        status: status.current,
    };
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
            await page.goto('https://guangdada.net/modules/creative/display-ads', { 
                timeout: 120 * 1000, 
                waitUntil: 'networkidle2' 
            });
        }
    } else {
        page = await browser.newPage();
        await setupAntiDetection(page);
        await page.goto('https://guangdada.net/modules/creative/display-ads', { 
            timeout: 120 * 1000, 
            waitUntil: 'networkidle2' 
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
            await page.goto('https://guangdada.net/modules/creative/display-ads', { 
                timeout: 120 * 1000, 
                waitUntil: 'networkidle2' 
            });
        }
    } else {
        // 如果登录页面已关闭，创建新页面
        page = await browser.newPage();
        await setupAntiDetection(page);
        await page.goto('https://guangdada.net/modules/creative/display-ads', { 
            timeout: 120 * 1000, 
            waitUntil: 'networkidle2' 
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
        await page.goto(loginPageUrl, { timeout: 120 * 1000, waitUntil: 'networkidle2' });
        
        // 等待表单加载
        await page.waitForSelector(selectors.loginForm, { timeout: 30000 });
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
                    logger.info('尝试通过监听网络请求获取 authorization token');
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
                                
                                // 查找 API 请求
                                if (url.includes('/napi/') && authHeader) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    page.off('request', requestHandler);
                                    
                                    // 同时获取其他 headers
                                    loginInfo.deviceId = headers['x-device-id'] || null;
                                    loginInfo.userToken = headers['x-nbs-user-token'] || null;
                                    
                                    resolve(authHeader);
                                }
                            }
                        };
                        
                        page.on('request', requestHandler);
                        
                        // 导航到数据页面以触发 API 请求
                        page.goto('https://guangdada.net/modules/creative/display-ads', {
                            waitUntil: 'networkidle2',
                            timeout: 30000
                        }).catch(() => {});
                    });
                    
                    if (token) {
                        loginInfo.authorization = token;
                        logger.info('✅ 从网络请求中获取到 authorization token');
                    }
                } catch (e) {
                    logger.warn('从网络请求获取 token 失败:', e.message);
                }
            }
            
            // 保存登录页面，不要关闭它
            if (loginPage && loginPage !== page) {
                await loginPage.close().catch(() => {});
            }
            loginPage = page;
            logger.info('登录成功，当前URL:', currentUrl);
            logger.info('登录页面已保存，不会关闭');
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
                
                if (loginPage && loginPage !== page) {
                    await loginPage.close().catch(() => {});
                }
                loginPage = page;
                logger.info('登录成功（延迟跳转），当前URL:', finalUrl);
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
        
        // 如果还是没有 token，通过导航到数据页面并监听网络请求获取
        if (!authorizationToken) {
            try {
                logger.info('尝试通过导航到数据页面获取 authorization token');
                const tokenInfo = await new Promise((resolve) => {
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
                            
                            // 只关注 creative/list API 的请求
                            if (url.includes('/napi/v1/creative/list') && authHeader) {
                                resolved = true;
                                clearTimeout(timeout);
                                loginPage.off('request', requestHandler);
                                resolve({
                                    authorization: authHeader,
                                    deviceId: headers['x-device-id'] || null,
                                    userToken: headers['x-nbs-user-token'] || null
                                });
                            }
                        }
                    };
                    
                    loginPage.on('request', requestHandler);
                    
                    // 导航到数据页面，这会触发实际的 API 请求
                    loginPage.goto('https://guangdada.net/modules/creative/display-ads', {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    }).catch(() => {
                        // 即使导航失败，也继续等待请求
                    });
                });
                
                if (tokenInfo) {
                    authorizationToken = tokenInfo.authorization;
                    deviceId = tokenInfo.deviceId;
                    userToken = tokenInfo.userToken;
                    loginInfo.authorization = authorizationToken;
                    if (deviceId) loginInfo.deviceId = deviceId;
                    if (userToken) loginInfo.userToken = userToken;
                    logger.info('✅ 从网络请求中获取到 authorization token');
                } else {
                    logger.warn('⚠️ 未能从网络请求中获取到 authorization token');
                }
            } catch (e) {
                logger.warn('从网络请求获取 token 失败:', e.message);
            }
        }
        
        // 构建请求参数
        const {
            page = 1,
            pageSize = 60,
            keyWord,
            startTime,
            endTime,
            ...otherParams
        } = searchParams;
        
        // 转换时间格式（如果提供了 startTime 和 endTime）
        let seenBegin = null;
        let seenEnd = null;
        if (startTime) {
            seenBegin = Math.floor(new Date(startTime).getTime() / 1000);
        } else {
            // 默认：30天前
            seenBegin = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        }
        if (endTime) {
            seenEnd = Math.floor(new Date(endTime).getTime() / 1000);
        } else {
            // 默认：现在
            seenEnd = Math.floor(Date.now() / 1000);
        }
        
        // 构建请求体（根据提供的 curl 示例）
        const requestBody = {
            page: parseInt(page) || 1,
            complete_country_match: false,
            app_type: 1,
            new_ads_flag: 0,
            sort_field: '-first_seen',
            duplicate_removal: 0,
            search_type: '1',
            seen_begin: seenBegin,
            seen_end: seenEnd,
            fb_merge: false,
            original_flag: 0,
            is_dynamic: 0,
            page_size: parseInt(pageSize) || 60,
            landing_page: 0,
            ...otherParams
        };
        
        // 如果有关键词，添加到搜索条件中（需要根据实际 API 文档调整）
        if (keyWord) {
            // 广大大可能使用不同的字段名，这里先保留，可能需要调整
            requestBody.keyword = keyWord;
        }
        
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
            deviceId: null,
            userToken: null
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
