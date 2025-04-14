import puppeteer from 'puppeteer';
import {puppeteerOptionsA3} from '../config.js';
import {curDate} from '../utils/utils.js';
import {rm} from 'fs/promises';
import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {LoginStatus} from '../constants/index.js';

const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 指定要删除的文件夹路径
const folderToDeleteA3 = join(__dirname, '../../tmp/gpc_order_spider_usr_a3');

let a3_browser;
let a3_loginPage; // 登录页面
let a3_imgPage;
let a3_lastSendTime = 0; // 上次发送验证码的时间
let a3_timeoutId = null; // 存储定时器 ID

// 状态管理
const status_A3 = {
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
        errorSelector: 'span[jsslot]', // 更新为新的错误提示选择器
        totpNext: '#totpNext'
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
    console.log('准备启动a3浏览器');
    try{
        a3_browser = await puppeteer.launch(puppeteerOptionsA3);
        console.log('a3浏览器已启动');
    }catch (e){
        console.log('e', e);
    }
};

export const closeBrowser = async () => {
    if (a3_browser) {
        await a3_browser.close();
    }
};

export const scrapeData = async (orderId, accountId) => {
    try {
        logger.info(`接收到订单号: ${orderId}, accountId:${accountId}`);
        const page = await a3_browser.newPage();
        const orderUrl = `https://play.google.com/console/u/0/developers/${accountId}/orders?search=${orderId}&from=2008-01-01&to=${curDate()}`;
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
    await checkLoginStatus();
    console.log('获取a3状态', status_A3);
    if(status_A3.current === LoginStatus.AWAITING_IMG_CODE){
        const captchaImgSrc = a3_imgPage? await a3_imgPage.$eval('#captchaimg', (el) => el.src): '';
        return {
            status: status_A3.current,
            captchaImgSrc
        };
    }
    return {
        status: status_A3.current,
    };
};


const timerIdManage = () =>{
    // 清除之前的定时器
    if (a3_timeoutId) {
        clearTimeout(a3_timeoutId);
    }
    // 设置一个定时器，十分钟后检查一下：距离上次发送验证码的时间是否"超过10分钟且status状态未改变"，如果是，则清空loginPage 且重置status
    a3_timeoutId = setTimeout(async () => {
        if (status_A3.current !== LoginStatus.ONLINE && new Date().valueOf() - a3_lastSendTime > 10 * 60 * 1000) {
            logger.info('验证码超过十分钟未填写，重置登录流程');
            if(a3_loginPage){
                await a3_loginPage.close();
                a3_loginPage = null;
            }
            if(a3_imgPage){
                await a3_imgPage.close();
                a3_imgPage = null;
            }
            status_A3.update(LoginStatus.LOGGED_OUT);
        }
    }, 10 * 60 * 1000);
}

// 发起登录，发验证码给管理员
export const login = async () => {
    console.log('a3登录');
    await checkLoginStatus();
    if (status_A3.current !== LoginStatus.LOGGED_OUT) {
        return {
            data: null,
            success: false,
            code: 'NOT_IN_LOGGED_OUT',
            message: '当前不是未登录状态'
        };
    }
    const page = await a3_browser.newPage();
    await page.goto(loginPageUrl, {timeout: 120 * 1000});

    await page.waitForSelector(currentSelectors.usernameInput);
    await page.type(currentSelectors.usernameInput, process.env.USER_NAME_A3);
    logger.info('已输入用户名', process.env.USER_NAME_A3);

    await page.waitForSelector(currentSelectors.usernameSubmitButton);
    await page.click(currentSelectors.usernameSubmitButton);
    logger.info('点击用户名提交', process.env.USER_NAME_A3);
    // await page.waitForNavigation({ timeout: 120 * 1000 }); // stable版本的chrome展示不需要，注释
    try {
        await page.waitForSelector(currentSelectors.passwordInput);
        await page.type(currentSelectors.passwordInput, process.env.USER_PASSWORD_A3);
        logger.info('已输入用户密码', process.env.USER_PASSWORD_A3);
    }
    catch (e){
        logger.info('查找密码输入框超时了', await page.content());
        // logger.info('未找到密码输入框，此刻页面打印', await page.content());
        const playCaptchaButton = await page.waitForSelector('#playCaptchaButton');
        if (playCaptchaButton) {
            logger.info('出现了图形验证码');

            //获取 id为 captchaimg 的图片的src属性
            const captchaImgSrc = await page.$eval('#captchaimg', (el) => el.src);
            logger.info('captchaSrc', captchaImgSrc);

            logger.info('此时url', await page.url());
            a3_imgPage = page;

            // 更新状态为等待图形验证码提交
            status_A3.update(LoginStatus.AWAITING_IMG_CODE);

            timerIdManage();

            return {
                data: {
                    captchaImgSrc,
                },
                success: true,
                code: 'NEED_IMG_CODE',
                message: '需要校验图形验证码'
            }
        }
        // logger.info('未出现图形验证码');
    }
    await page.waitForSelector(currentSelectors.passwordSubmitButton);
    await page.click(currentSelectors.passwordSubmitButton);
    // await page.waitForNavigation({ timeout: 120 * 1000, waitUntil: 'domcontentloaded' }); // stable版本的chrome不需要，注释

    status_A3.update(LoginStatus.AWAITING_VERIFICATION);
    a3_loginPage = page;
    a3_lastSendTime = new Date().valueOf();
    logger.info('已进入登录流程');

    timerIdManage();
    return {
        data: null,
        success: true,
        code: 200,
        message: '已进入登录流程'
    }
}

export const refreshImgCode = async () =>{
    if(!a3_imgPage) return {
        data: null,
        success: false,
        code: 500,
        message: '未找到图形验证码页面'
    }

    await a3_imgPage.goto(loginPageUrl, {timeout: 120 * 1000});

    await a3_imgPage.waitForSelector(currentSelectors.usernameInput);
    await a3_imgPage.type(currentSelectors.usernameInput, process.env.USER_NAME_A3);
    logger.info('刷新图形验证码-重新载入页面后输入了用户名');

    await a3_imgPage.waitForSelector(currentSelectors.usernameSubmitButton);
    await a3_imgPage.click(currentSelectors.usernameSubmitButton);
    logger.info('刷新图形验证码-点击了用户名提交按钮');
    try{
        const playCaptchaButton = await a3_imgPage.waitForSelector('#playCaptchaButton');
        if (playCaptchaButton) {
            //获取 id为 captchaimg 的图片的src属性
            const captchaImgSrc = await a3_imgPage.$eval('#captchaimg', (el) => el.src);
            logger.info('刷新出了新的图形验证码', captchaImgSrc);
            // 更新状态为等待图形验证码提交
            status_A3.update(LoginStatus.AWAITING_IMG_CODE);

            timerIdManage();

            return {
                data: {
                    captchaImgSrc,
                },
                success: true,
                code: '',
                message: '刷新验证码成功'
            }
        }
    } catch (e){
        console.log('刷新验证码失败', e);
        console.log('刷新验证码失败时的页面', await a3_imgPage.content());
        return {
            data: {
                captchaImgSrc: '',
            },
            success: false,
            code: '',
            message: '刷新验证码失败'
        }
    }
}

export const verifyImgCode = async (imgCode) =>{

    if(!a3_imgPage){
        return {
            data: null,
            success: false,
            code: 500,
            message: '未找到图形验证码页面'
        }
    }
    if(status_A3.current !== LoginStatus.AWAITING_IMG_CODE){
        return {
            data: null,
            success: false,
            code: 500,
            message: '当前不是等待图形验证码状态'
        }
    }
    await a3_imgPage.waitForSelector('input[type="text"]');
    await a3_imgPage.type('input[type="text"]', imgCode);

    await a3_imgPage.waitForSelector(currentSelectors.usernameSubmitButton);
    await a3_imgPage.click(currentSelectors.usernameSubmitButton);
    logger.info('验证图形验证码-点击了用户了提交按钮');
    const result = await Promise.race([
        // 设置4s等待时间，如果4s后仍然没有检查到密码输入框，则认为图形验证码验证失败;否则成功
        new Promise(resolve => setTimeout(() => resolve('timeout'), 4 * 1000)).then(async()=>{
            const messageInput = await a3_imgPage.waitForSelector(currentSelectors.passwordInput).catch(() => null);
            if(!messageInput){
                return 'failed';
            }
            return 'success';
        }),
        a3_imgPage.waitForSelector(currentSelectors.passwordInput, {timeout: 120 * 1000}).then(async () => {
            return 'success';
        })
    ]);
    if (result === 'success') {

        await a3_imgPage.waitForSelector(currentSelectors.passwordInput);
        await a3_imgPage.type(currentSelectors.passwordInput, process.env.USER_PASSWORD_A3);
        logger.info('图形验证码验证成功，已输入用户密码', process.env.USER_PASSWORD_A3);
        await a3_imgPage.waitForSelector(currentSelectors.passwordSubmitButton);
        await a3_imgPage.click(currentSelectors.passwordSubmitButton);
        // await page.waitForNavigation({ timeout: 120 * 1000, waitUntil: 'domcontentloaded' }); // stable版本的chrome不需要，注释

        status_A3.update(LoginStatus.AWAITING_VERIFICATION);
        a3_loginPage = a3_imgPage;
        a3_imgPage = null;
        a3_lastSendTime = new Date().valueOf();
        logger.info('图形验证码通过，已进入登录流程');
        timerIdManage();
        return {
            data: null,
            success: true,
            code: 200,
            message: '已进入登录流程'
        }
    }
    else {
        // 验证码错误重置为等待验证码状态，提示重试
        status_A3.update(LoginStatus.AWAITING_IMG_CODE);
        logger.info('图形验证码错误', await a3_imgPage.content());
        return {
            code: 'CODE_ERROR',
            data: null,
            success: false,
            message: `填写图形验证码：${imgCode}不正确`
        };
    }

}

// 验证码校验
export const verifyCode = async (verificationCode) => {

    if (!a3_loginPage) {
        logger.info('登陆页面不存在');
        status_A3.update(LoginStatus.LOGGED_OUT);
        return {
            data: null,
            code: 'NO_LOGIN_PAGE',
            success: false,
            message: '登录页面不存在，请重新登录'
        };
    }
    // 如果当前状态不是验证码验证
    if (status_A3.current !== LoginStatus.AWAITING_VERIFICATION) {
        logger.info('当前状态不是验证码验证状态，无法进行验证码校验');
        return {
            data: null,
            code: 'NOT_IN_STEP',
            success: false,
            message: '当前状态不是验证码验证，无法进行验证码校验'
        };
    }
    status_A3.update(LoginStatus.VERIFYING_CODE);

    // 移除上次报错元素，方便下次输入判断
    await a3_loginPage.$eval(currentSelectors.errorSelector, el => el.remove()).catch(() => null);
    try {
        await a3_loginPage.waitForSelector(currentSelectors.verificationCodeInput);
        await a3_loginPage.$eval(currentSelectors.verificationCodeInput, el => el.value = '');
        await a3_loginPage.type(currentSelectors.verificationCodeInput, verificationCode);

        await a3_loginPage.waitForSelector(currentSelectors.totpNext);
        await a3_loginPage.click(currentSelectors.totpNext);

        const result = await Promise.race([
            // 设置4s等待时间，如果4s后仍然没有检查到验证码错误提示，则认为验证成功
            new Promise(resolve => setTimeout(() => resolve('timeout'), 4 * 1000)).then(async()=>{
                const errorMessage = await a3_loginPage.$eval(currentSelectors.errorSelector, el => el.innerText).catch(() => null);
                if(!errorMessage){
                    return 'success';
                }
                else {
                    return errorMessage;
                }
            }),
            a3_loginPage.waitForSelector(currentSelectors.errorSelector, {timeout: 120 * 1000}).then(async () => {
                const errorMessage = await a3_loginPage.$eval(currentSelectors.errorSelector, el => el.innerText).catch(() => null);
                return errorMessage;
            })
        ]);
        if (result === 'success') {
            // 睡眠3s
            await new Promise(resolve => setTimeout(resolve, 3000));
            await a3_loginPage.goto(checkLoginUrl, {
                timeout: 120 * 1000,
                waitUntil: 'domcontentloaded',
            });
            const curPageUrl = a3_loginPage.url();
            const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
            if (isLoggedIn) {
                if(a3_timeoutId){
                    clearTimeout(a3_timeoutId);
                }
                status_A3.update(LoginStatus.ONLINE);
                a3_loginPage.close();
                a3_loginPage = null;
                return {
                    data: null,
                    success: true,
                    code: 'VERIFY_SUCCESS',
                    message: '验证成功'
                };
            } else {
                if(a3_timeoutId){
                    clearTimeout(a3_timeoutId);
                }
                // 验证码登录成功了，但是没有权限访问订单
                status_A3.update(LoginStatus.NO_AUTH_ONLINE);
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
            status_A3.update(LoginStatus.AWAITING_VERIFICATION);
            return {
                code: 'CODE_ERROR',
                data: null,
                success: false,
                message: result || '验证码不正确'
            };
        }
    } catch (e){
        status_A3.update(LoginStatus.AWAITING_VERIFICATION);
        logger.error(`验证码校验失败: ${e}`, a3_loginPage.url(), await a3_loginPage.content());
    }
}

const fetchData = async (page) => {
    console.log('爬取A3订单数据');
    if (status_A3.current !== LoginStatus.ONLINE) {
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
        const str = await page.content();
        logger.error(`发生错误：${error}`, str);
        if(str.includes('Signed out')){
            logger.info('infocenter@a3games.com：页面包含了 Signed out ，登录已过期');
            status_A3.update(LoginStatus.LOGGED_OUT);
            clearLogin();
            logger.info('登陆信息已清除');
            return {
                data: null,
                message: '登录过期',
                code: 'NOT_LOGGED_IN',
                success: false,
            };
        }
        return {
            data: null,
            message: '数据查询发生错误',
            code: 'DATA_SEARCH_ERROR',
            success: false,
        };
    }
};

export const checkLoginStatus = async () => {
    const page = await a3_browser.newPage();
    await page.goto(checkLoginUrl, {
        timeout: 120 * 1000,
        waitUntil: 'domcontentloaded',
    });
    const curPageUrl = page.url();
    if (curPageUrl === 'https://play.google.com/console/signup') {
        status_A3.update(LoginStatus.NO_AUTH_ONLINE);
        await page.close();
        return true;
    }
    const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
    if (isLoggedIn) {
        status_A3.update(LoginStatus.ONLINE);
    }
    // 查看页面有没有出现 id为 'signin_status'且包含文本内容为'Signed out'的span元素
    // 有则认为登录过期
    const isSignedOut = await page.evaluate(() => {
        return document.querySelector('#signin_status')?.textContent.includes('Signed out')
    });
    if(isSignedOut){
        status_A3.update(LoginStatus.LOGGED_OUT);
    }

    await page.close();
    return isLoggedIn;
};
// 删除 tmp 文件夹的函数
export const clearLogin = async () => {
    try {
        // 递归删除文件夹其内容
        await rm(folderToDeleteA3, {recursive: true, force: true});
        status_A3.update(LoginStatus.LOGGED_OUT);
        a3_browser.close();
        initializeBrowser();
        logger.info(`文件夹 ${folderToDeleteA3} 已成功删除`);
    } catch (error) {
        logger.error(`删除文件夹时发生错误: ${error}`);
    }
};
