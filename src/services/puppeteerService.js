import puppeteer from 'puppeteer';
import { puppeteerOptions } from '../config.js';
import { curDate } from '../utils/utils.js';
import { rm } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 指定要删除的文件夹路径
const folderToDelete = join(__dirname, '../../tmp');

// import readline from 'readline';

let browser;
let loginPage;

// 状态枚举
const Status = Object.freeze({
    LOGGED_OUT: 'LOGGED_OUT', // 未登录
    LOGGING_IN: 'LOGGING_IN', // 发起登录中
    AWAITING_VERIFICATION: 'AWAITING_VERIFICATION', // 验证码已发送等待填写中
    VERIFYING_CODE: 'VERIFYING_CODE', // 验证码验证中
    LOGIN_FAILED: 'LOGIN_FAILED', // 登录失败
    ONLINE: 'ONLINE', // 已登录,
    NO_AUTH_ONLINE: 'NO_AUTH_ONLINE', // 已登录但无查看订单权限
});

// 状态管理
const status = {
    current: Status.LOGGED_OUT, // 初始状态为未登录
    update(newStatus) {
        this.current = newStatus;
        logger.info(`当前状态: ${this.current}`);
    }
};


const loginPageUrl = 'https://accounts.google.com/ServiceLogin?service=androiddeveloper&passive=true&continue=https%3A%2F%2Fplay.google.com%2Fconsole%2Fdeveloper%2F';

// const usrName = 'googleplay_web@nibirutech.com';
// const usrPwd = 'GPweb2024';
// const usrName = 'huangyouchuan@nibirutech.com';
// const usrPwd = 'Vdyulm0zo2';
// const usrName = process.env.USER_NAME;
// const usrPwd = process.env.USER_PASSWORD;
// const accountId = process.env.ACCOUNT_ID;

export const initializeBrowser = async () => {
    console.log('初始化浏览器', process.env.NODE_ENV, puppeteerOptions);
    logger.info('初始化浏览器', process.env.NODE_ENV, puppeteerOptions);
    browser = await puppeteer.launch(puppeteerOptions);
};

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
    }
};

export const scrapeData = async (orderId) => {
    try {
        const page = await browser.newPage();
        const orderUrl = `https://play.google.com/console/u/0/developers/${process.env.ACCOUNT_ID}/orders?search=${orderId}&from=2008-01-01&to=${curDate()}`;
        await page.goto(orderUrl, { timeout: 120 * 1000, waitUntil: 'domcontentloaded' });

        // 检查登录状态
        if (!await isLoggedIn(page)) {
            status.update(Status.LOGGING_IN);
            await login(page);
        }

        const result = await fetchData(page);
        await page.close();
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

const isLoggedIn = async (page) => {
    const curPageUrl = page.url();
    return curPageUrl.includes(`https://play.google.com/console/u/0/developers/${process.env.ACCOUNT_ID}/orders`);
};

// 发起登录，发验证码给管理员
export const login = async () => {
    if(status.current !== Status.LOGGED_OUT){
        return;
    }
    const page = await browser.newPage();
    await page.goto(loginPageUrl, { timeout: 120 * 1000});


    await page.waitForSelector("#identifierId");
    await page.type('#identifierId', process.env.USER_NAME);
    logger.info('已输入用户名', process.env.USER_NAME);
    await page.waitForSelector('#identifierNext > div > button');
    await page.click('#identifierNext > div > button');
    await page.waitForNavigation({ timeout: 120 * 1000}); // 等待导航完成
    // 睡眠1s
    await new Promise(resolve => setTimeout(resolve, 1000));

    await page.waitForSelector('#password input[type="password"]');
    await page.type('#password input[type="password"]', process.env.USER_PASSWORD);
    logger.info('已输入用户名', process.env.USER_PASSWORD);
    await page.waitForSelector('#passwordNext > div > button');
    await page.click('#passwordNext > div > button');
    await page.waitForNavigation({ timeout: 120 * 1000, waitUntil: 'domcontentloaded' }); // 等待导航完成

    status.update(Status.AWAITING_VERIFICATION);
    loginPage = page;
    logger.info('验证码已发送');
}

// 验证码校验
export const verifyCode = async (verificationCode) => {
    if(!loginPage) {
        logger.info('登陆页面不存在');
        return {
            data: null,
            code: 404,
            message: '登录页面不存在'
        };
    }
    // 如果当前状态不是验证码验证
    if (status.current !== Status.AWAITING_VERIFICATION) {
        logger.info('当前状态不是验证码验证状态，无法进行验证码校验');
        return {
            data: null,
            code: 'NOT_IN_STEP',
            message: '当前状态不是验证码验证，无法进行验证码校验'
        };
    }
    status.update(Status.VERIFYING_CODE);
    await loginPage.waitForSelector('#idvPin');
    await loginPage.$eval('#idvPin', el => el.value = '');
    await loginPage.type('#idvPin', verificationCode);
    await loginPage.waitForSelector('#idvPreregisteredPhoneNext > div > button');
    loginPage.click('#idvPreregisteredPhoneNext > div > button');

    const errorSelector = '.Ekjuhf'; // 假设这是错误提示的类名
    const result = await Promise.race([
            loginPage.waitForNavigation({ timeout: 120 * 1000 }).then(() => {
            return 'success';
        }),
        loginPage.waitForSelector(errorSelector, { timeout: 120 * 1000 }).then(async () => {
            const errorMessage = await loginPage.$eval(errorSelector, el => el.innerText).catch(() => null);
            return errorMessage;
        })
    ]);

    if(result === 'success'){
        await loginPage.goto(loginPageUrl, {
            timeout: 120 * 1000,
            waitUntil: 'domcontentloaded',
        });
        const curPageUrl = loginPage.url();
        const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
        if (isLoggedIn) {
            status.update(Status.ONLINE);
            loginPage.close();
            loginPage = null;
            return {
                data: null,
                code: 'VERIFY_SUCCESS',
                message: '验证成功'
            };
        }
        else {
            status.update(Status.NO_AUTH_ONLINE);
            return {
                data: null,
                code: 'NO_ORDER_AUTH',
                message: '没有访问权限'
            };
        }
    } else {
        // 验证码错误重置为等待验证码状态，提示重试
        status.update(Status.AWAITING_VERIFICATION);
        // 移除报错元素，方便下次输入判断
        await loginPage.$eval('.Ekjuhf', el => el.remove());
        return {
            code: 'CODE_ERROR',
            data: null,
            message: result
        };
    }
}

const fetchData = async (page) => {
    if(status.current !== Status.ONLINE){
        return {
            data: {
                error: 'Not logged in'
            },
            code: 'NOT_LOGGED_IN',
            message: '当前未登录，无法获取数据'
        }
    }
    try {
        const result = await Promise.race([
            page.waitForSelector('.particle-table-placeholder', { timeout: 10000 }).then(() => {
                logger.info('数据获取失败');
                return 'failure';
            }),
            page.waitForSelector('.particle-table-row', { timeout: 10000 }).then(() => {
                logger.info('数据获取成功');
                return 'success';
            })
        ]);

        if (result === 'failure') {
            await page.close();
            return {
                data: null,
                message: '暂无数据'
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
        return {
            data: rowData,
            message: '数据查询成功'
        };

    } catch (error) {
        logger.error(`发生错误：${error}`);
        return null;
    }
};

export const checkLoginStatus = async () => {
    const page = await browser.newPage();
    await page.goto(loginPageUrl, {
        timeout: 120 * 1000,
        waitUntil: 'domcontentloaded',
    });
    const curPageUrl = page.url();
    await page.close();
    if(curPageUrl === 'https://play.google.com/console/signup'){
        status.update(Status.NO_AUTH_ONLINE);
        return true;
    }
    const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
    if (isLoggedIn) {
        status.update(Status.ONLINE);
    }
    return isLoggedIn;
};
// 删除 tmp 文件夹的函数
export const clearLogin = async () => {
    try {
        // 递归删除文件夹其内容
        await rm(folderToDelete, { recursive: true, force: true });
        status.update(Status.LOGGED_OUT);
        browser.close();
        initializeBrowser();
        logger.info(`文件夹 ${folderToDelete} 已成功删除`);
    } catch (error) {
        logger.error(`删除文件夹时发生错误: ${error}`);
    }
};
