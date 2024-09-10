import puppeteer from 'puppeteer';
import {puppeteerOptions} from '../config.js';
import {curDate} from '../utils/utils.js';
import {rm} from 'fs/promises';
import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {LoginStatus} from '../constants/index.js'

const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 指定要删除的文件夹路径
const folderToDelete = join(__dirname, '../../tmp');


let browser;
let loginPage; // 登录页面
let lastSendTime = 0; // 上次发送验证码的时间
let timeoutId = null; // 存储定时器 ID


// 状态管理
const status = {
    current: LoginStatus.LOGGED_OUT, // 初始状态为未登录
    update(newStatus) {
        this.current = newStatus;
        logger.info(`当前状态: ${this.current}`);
    }
};

// 新版chrome 浏览器的选择器 & stable版本浏览器的选择器。由于服务容器用的是stable版本的chrome，因此暂时统一使用stableChrome
const selectors = {
    // new: {
    //     usernameInput: '#identifierId',
    //     usernameSubmitButton: '#identifierNext > div > button',
    //     passwordInput: '#password input[type="password"]',
    //     passwordSubmitButton: '#passwordNext > div > button',
    //     verificationCodeInput: '#idvPin',
    //     verificationCodeSubmitButton: '#idvPreregisteredPhoneNext > div > button',
    //     errorSelector: '.Ekjuhf' // 假设这是错误提示的类名
    // },
    stableChrome: {
        usernameInput: '#identifierId',
        usernameSubmitButton: '#identifierNext',
        passwordInput: '#password',
        passwordSubmitButton: '#passwordNext',
        verificationCodeInput: 'input[name="Pin"]',
        verificationCodeSubmitButton: '#idvPreregisteredPhoneNext',
        errorSelector: 'span[jsslot]' // 更新为新的错误提示选择器
    }
};

// 这里暂时用稳定版chrome的爬取方式
const currentSelectors = selectors.stableChrome;

// 新版本chrome登录地址
// const loginPageUrl = 'https://accounts.google.com/ServiceLogin?service=androiddeveloper&passive=true&continue=https%3A%2F%2Fplay.google.com%2Fconsole%2Fdeveloper%2F';

const checkLoginUrl = 'https://accounts.google.com/ServiceLogin?service=androiddeveloper&passive=true&continue=https%3A%2F%2Fplay.google.com%2Fconsole%2Fdeveloper%2F';
// stable版本登录地址
const loginPageUrl = 'https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fplay.google.com%2Fconsole%2Fdeveloper%2F&ifkv=Ab5oB3qTeGDQYdneEkqmRRoaaURP81UbymbIP8Cnc6-_PLkMWVgUt6XN0ADIdNYy2QoJI6vb6h7ALw&passive=true&service=androiddeveloper&flowName=WebLiteSignIn&flowEntry=ServiceLogin&dsh=S-2044384168%3A1725514098543264';

export const initializeBrowser = async () => {
    browser = await puppeteer.launch(puppeteerOptions);
};

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
    }
};

export const scrapeData = async (orderId) => {
    try {
        logger.info(`接收到订单号: ${orderId}`);
        const page = await browser.newPage();
        const orderUrl = `https://play.google.com/console/u/0/developers/${process.env.ACCOUNT_ID}/orders?search=${orderId}&from=2008-01-01&to=${curDate()}`;
        await page.goto(orderUrl, {timeout: 120 * 1000, waitUntil: 'domcontentloaded'});
        const result = await fetchData(page);
        page?.close && page.close();
        return result;

    } catch (error) {
        logger.error(`Error in scrapeData: ${error}`);
        return null;
    }
};

// 查询当前状态
export const getStatus = async () => {
    return {
        data: status.current,
        message: '当前状态'
    };
};

// 发起登录，发验证码给管理员
export const login = async () => {
    await checkLoginStatus();
    if (status.current !== LoginStatus.LOGGED_OUT) {
        return {
            data: null,
            success: false,
            code: 'NOT_IN_LOGGED_OUT',
            message: '当前不是未登录状态'
        };
    }
    const page = await browser.newPage();
    await page.goto(loginPageUrl, {timeout: 120 * 1000});

    await page.waitForSelector(currentSelectors.usernameInput);
    await page.type(currentSelectors.usernameInput, process.env.USER_NAME);
    logger.info('已输入用户名', process.env.USER_NAME);

    await page.waitForSelector(currentSelectors.usernameSubmitButton);
    await page.click(currentSelectors.usernameSubmitButton);
    logger.info('点击用户名提交', process.env.USER_NAME);
    // await page.waitForNavigation({ timeout: 120 * 1000 }); // stable版本的chrome展示不需要，注释
    try {
        await page.waitForSelector(currentSelectors.passwordInput);
        await page.type(currentSelectors.passwordInput, process.env.USER_PASSWORD);
        logger.info('已输入用户密码', process.env.USER_PASSWORD);
    }
    catch (e){
        logger.info('查找密码输入框超时了', await page.content());
        // logger.info('未找到密码输入框，此刻页面打印', await page.content());
        const playCaptchaButton = await page.waitForSelector('#playCaptchaButton');
        if (playCaptchaButton) {
            logger.info('出现了图形验证码');
            //获取 id为 captchaimg 的图片的src属性
            const captchaSrc = await page.$eval('#captchaimg', (el) => el.src);
            logger.info('captchaSrc', captchaSrc);
            // 获取 id 为 captchaAudio 的元素的src属性
            const captchaAudioSrc = await page.$eval('#captchaAudio', (el) => el.src);
            logger.info('captchaAudioSrc', captchaAudioSrc);

            logger.info('此时url', await page.url());
            loginPage = page;

            return {
                data: null,
                success: false,
                code: 'LOGIN_TOO_MANY',
                message: '登录过于频繁已被限制'
            }
        }
        // logger.info('未出现图形验证码');
    }
    await page.waitForSelector(currentSelectors.passwordSubmitButton);
    await page.click(currentSelectors.passwordSubmitButton);
    // await page.waitForNavigation({ timeout: 120 * 1000, waitUntil: 'domcontentloaded' }); // stable版本的chrome不需要，注释

    status.update(LoginStatus.AWAITING_VERIFICATION);
    loginPage = page;
    lastSendTime = new Date().valueOf();
    logger.info('验证码已发送');

    // 清除之前的定时器
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    // 设置一个定时器，十分钟后检查一下：距离上次发送验证码的时间是否"超过10分钟且status状态未改变"，如果是，则清空loginPage 且重置status
    timeoutId = setTimeout(async () => {
        if (status.current !== LoginStatus.ONLINE && new Date().valueOf() - lastSendTime > 10 * 60 * 1000) {
            logger.info('验证码超过十分钟未填写，重置登录流程');
            await loginPage.close();
            loginPage = null;
            status.update(LoginStatus.LOGGED_OUT);
        }
    }, 10 * 60 * 1000);
    return {
        data: null,
        success: true,
        code: 200,
        message: '验证码已发送'
    }
}


// 验证码校验
export const verifyCode = async (verificationCode) => {

    if (!loginPage) {
        logger.info('登陆页面不存在');
        status.update(LoginStatus.LOGGED_OUT);
        return {
            data: null,
            code: 'NO_LOGIN_PAGE',
            success: false,
            message: '登录页面不存在，请重新登录'
        };
    }
    // 如果当前状态不是验证码验证
    if (status.current !== LoginStatus.AWAITING_VERIFICATION) {
        logger.info('当前状态不是验证码验证状态，无法进行验证码校验');
        return {
            data: null,
            code: 'NOT_IN_STEP',
            success: false,
            message: '当前状态不是验证码验证，无法进行验证码校验'
        };
    }
    status.update(LoginStatus.VERIFYING_CODE);

    // 移除上次报错元素，方便下次输入判断
    await loginPage.$eval(currentSelectors.errorSelector, el => el.remove()).catch(() => null);
    try {
        await loginPage.waitForSelector(currentSelectors.verificationCodeInput);
        await loginPage.$eval(currentSelectors.verificationCodeInput, el => el.value = '');
        await loginPage.type(currentSelectors.verificationCodeInput, verificationCode);
        await loginPage.waitForSelector(currentSelectors.verificationCodeSubmitButton);
        await loginPage.click(currentSelectors.verificationCodeSubmitButton);

        const result = await Promise.race([
            // loginPage.waitForNavigation({timeout: 120 * 1000}).then(() => {
            //     return 'success';
            // }),
            // 睡眠4s
            new Promise(resolve => setTimeout(() => resolve('timeout'), 4 * 1000)).then(async()=>{
                const errorMessage = await loginPage.$eval(currentSelectors.errorSelector, el => el.innerText).catch(() => null);
                if(!errorMessage){
                    return 'success';
                }
                else {
                    return errorMessage;
                }
            }),
            loginPage.waitForSelector(currentSelectors.errorSelector, {timeout: 120 * 1000}).then(async () => {
                const errorMessage = await loginPage.$eval(currentSelectors.errorSelector, el => el.innerText).catch(() => null);
                return errorMessage;
            })
        ]);
        if (result === 'success') {
            logger.info('此时的页面内容', await loginPage.url());
            await loginPage.goto(checkLoginUrl, {
                timeout: 120 * 1000,
                waitUntil: 'domcontentloaded',
            });
            const curPageUrl = loginPage.url();
            const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
            if (isLoggedIn) {
                if(timeoutId){
                    clearTimeout(timeoutId);
                }
                status.update(LoginStatus.ONLINE);
                loginPage.close();
                loginPage = null;
                return {
                    data: null,
                    success: true,
                    code: 'VERIFY_SUCCESS',
                    message: '验证成功'
                };
            } else {
                if(timeoutId){
                    clearTimeout(timeoutId);
                }
                // 验证码登录成功了，但是没有权限访问订单
                status.update(LoginStatus.NO_AUTH_ONLINE);
                return {
                    success: true,
                    data: null,
                    code: 'NO_ORDER_AUTH',
                    message: '没有访问权限'
                };
            }
        }
        else {
            // 验证码错误重置为等待验证码状态，提示重试
            status.update(LoginStatus.AWAITING_VERIFICATION);
            return {
                code: 'CODE_ERROR',
                data: null,
                success: false,
                message: result || '验证码不正确'
            };
        }
    } catch (e){
        status.update(LoginStatus.AWAITING_VERIFICATION);
        logger.error(`验证码校验失败: ${e}`, loginPage.url(), await loginPage.content());
    }
}

const fetchData = async (page) => {
    if (status.current !== LoginStatus.ONLINE) {
        return {
            data: {
                error: 'Not logged in'
            },
            success: false,
            code: 'NOT_LOGGED_IN',
            message: '当前未登录，无法获取数据'
        }
    }
    try {
        const result = await Promise.race([
            page.waitForSelector('.particle-table-row', {timeout: 60 * 1000}).then(() => {
                logger.info('数据已获取');
                return 'success';
            }).catch((e)=>{
                logger.info('获取数据表格元素超时', e);
            }),
            page.waitForSelector('.particle-table-placeholder', {timeout: 60 * 1000}).then(() => {
                logger.info('暂无数据');
                return 'failure';
            }).catch((e) => {
                logger.info('获取空数据提示元素超时');
            }),
        ]);

        if (result === 'failure') {
            logger.info('该订单号未查询到数据');
            return {
                data: null,
                success: true,
                message: '暂无数据',
                code: ''
            };
        }
        const rowData = await page.evaluate(() => {
            const row = document.querySelector('.particle-table-row');
            const cells = row.querySelectorAll('ess-cell');
            const data = {};

            cells.forEach(cell => {
                const columnName = cell.getAttribute('essfield');
                let key = '';
                let value = '';

                if (columnName === 'date_column') {
                    key = 'date';
                    value = cell.querySelector('.main-text').innerText + '\n' + cell.querySelector('.secondary-line span').innerText;
                } else if (columnName === 'app_column') {
                    key = 'app';
                    value = cell.querySelector('img').src;
                } else if (columnName === 'product_column') {
                    key = 'product';
                    value = cell.querySelector('.main-text').innerText + '\n' + cell.querySelector('.secondary-line span').innerText;
                } else if (columnName === 'order_id_column') {
                    key = 'orderId';
                    value = cell.querySelector('text-field').innerText.trim();
                } else if (columnName === 'order_status_column') {
                    key = 'orderStatus';
                    value = cell.querySelector('.main-text').innerText;
                } else if (columnName === 'total_column') {
                    key = 'total';
                    value = cell.querySelector('.main-text').innerText;
                }
                data[key] = value;
            });
            return data;
        });
        logger.info('该订单号查询到了数据', rowData);
        return {
            data: rowData,
            message: '数据查询成功',
            code: '',
            success: true,
        };

    } catch (error) {
        logger.error(`发生错误：${error}`, await page.content());
        return {
            data: null,
            message: '数据查询发生错误',
            code: 'DATA_SEARCH_ERROR',
            success: false,
        };
    }
};

export const checkLoginStatus = async () => {
    const page = await browser.newPage();
    await page.goto(checkLoginUrl, {
        timeout: 120 * 1000,
        waitUntil: 'domcontentloaded',
    });
    const curPageUrl = page.url();
    if (curPageUrl === 'https://play.google.com/console/signup') {
        status.update(LoginStatus.NO_AUTH_ONLINE);
        await page.close();
        return true;
    }
    const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
    if (isLoggedIn) {
        status.update(LoginStatus.ONLINE);
    }
    await page.close();
    return isLoggedIn;
};
// 删除 tmp 文件夹的函数
export const clearLogin = async () => {
    try {
        // 递归删除文件夹其内容
        await rm(folderToDelete, {recursive: true, force: true});
        status.update(LoginStatus.LOGGED_OUT);
        browser.close();
        initializeBrowser();
        logger.info(`文件夹 ${folderToDelete} 已成功删除`);
    } catch (error) {
        logger.error(`删除文件夹时发生错误: ${error}`);
    }
};
