import puppeteer from 'puppeteer';
import { puppeteerOptions } from '../config.js';
import { curDate } from '../utils/utils.js';
import readline from 'readline';

let browser;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

export const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

export const closeAskQuestion = () => {
    rl.close();
};

const usrName = 'googleplay_web@nibirutech.com';
const usrPwd = 'GPweb2024';
const accountId = '5185069862310717718';

export const initializeBrowser = async () => {
    browser = await puppeteer.launch(puppeteerOptions);
    // context = await browser.createIncognitoBrowserContext();
};

// export const clearAllCookies = async () => {
//     await context.clearCookies(); // 清除所有 cookies
// };

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
    }
};

export const scrapeData = async (orderId) => {
    const page = await browser.newPage();
    // 订单查询页面地址
    const orderUrl = `https://play.google.com/console/u/0/developers/${accountId}/orders?search=${orderId}&from=2008-01-01&to=${curDate()}`
    // 登录地址
    const loginPageUrl = 'https://accounts.google.com/ServiceLogin?service=androiddeveloper&passive=true&continue=https%3A%2F%2Fplay.google.com%2Fconsole%2Fdeveloper%2F';
    // 先尝试直接跳转订单查询页面地址
    await page.goto(orderUrl, {
        timeout: 120 * 1000,
        waitUntil: 'domcontentloaded',
    });
    // 获取当前页面地址
    let curPageUrl = page.url();
    // login required
    // if (!curPageUrl.includes('https://play.google.com/console/developers')) {
    // 如果页面并没有跳转到订单查询页面，则说明没有登录
    if (!curPageUrl.includes(`https://play.google.com/console/u/0/developers/${accountId}/orders`)) {
        await page.goto(loginPageUrl, {
            timeout: 120 * 1000,
            waitUntil: 'domcontentloaded',
        });
        await page.waitForSelector("#identifierId");
        await page.type('#identifierId', usrName);
        await page.waitForSelector('#identifierNext > div > button');
        await Promise.all([
            page.waitForNavigation({ timeout: 120 * 1000 }),
            page.click('#identifierNext > div > button'),
        ]);

        await page.waitForSelector('#password input[type="password"]');
        await page.click('#password input[type="password"]');
        await page.type('#password input[type="password"]', usrPwd, {
            delay: 100,
        });

        await page.waitForSelector('#passwordNext > div > button');
        await Promise.all([
            page.waitForNavigation({ timeout: 120 * 1000 }),
            page.click('#passwordNext > div > button'),
        ]);

        await page.waitForSelector("#idvPin");
        const verificationCode = await askQuestion("input 2-Step verification code: ");
        await page.type('#idvPin', verificationCode);

        await page.waitForSelector('#idvPreregisteredPhoneNext > div > button');
        await Promise.all([
            page.waitForNavigation({ timeout: 120 * 1000 }),
            page.click('#idvPreregisteredPhoneNext > div > button'),
        ]);
    }
    // curPageUrl = page.url();

    // if(!curPageUrl.includes(accountId)){
    //     await page.waitForSelector('material-list .item');
    //     const accountItem = await page.$('material-list .item');
    //     await Promise.all([
    //         page.waitForSelector('.desktop-navigation-drawer', { timeout: 120 * 1000 }),
    //         accountItem.click()
    //     ]);
    //
    //     let curUrl = page.url();
    //     const orderUrl = `${curUrl.split('/5185069862310717718')[0]}/5185069862310717718/orders?search=${orderId}&from=2008-01-01&to=${curDate()}`;
    //     await page.goto(orderUrl, {
    //         timeout: 120 * 1000,
    //         waitUntil: 'domcontentloaded',
    //     });
    // }

    try {
        const result = await Promise.race([
            page.waitForSelector('.particle-table-placeholder', { timeout: 10000 }).then(() => {
                // 数据获取失败的逻辑
                console.log('数据获取失败');
                return 'failure';
            }),
            page.waitForSelector('.particle-table-row', { timeout: 10000 }).then(() => {
                // 数据获取成功的逻辑
                console.log('数据获取成功');
                return 'success';
            })
        ]);

        // 如果获取失败，则关闭页面并返回null；数据获取成功则不处理，继续执行后续代码
       if (result === 'failure') {
            await page.close();
            return null;
        }
    } catch (error) {
        console.log(`发生错误：${error}`);
    }

    //particle-table-placeholder

    const rowData = await page.evaluate(() => {
        const row = document.querySelector('.particle-table-row');
        const cells = row.querySelectorAll('ess-cell');
        const data = {};

        cells.forEach(cell => {
            const columnName = cell.getAttribute('essfield');
            let value = '';

            if (columnName === 'date_column') {
                value = cell.querySelector('.main-text').innerText + '\n' + cell.querySelector('.secondary-line span').innerText;
            } else if (columnName === 'app_column') {
                value = cell.querySelector('img').src;
            } else if (columnName === 'product_column') {
                value = cell.querySelector('.main-text').innerText;
            } else if (columnName === 'order_id_column') {
                value = cell.querySelector('text-field').innerText.trim();
            } else if (columnName === 'order_status_column') {
                value = cell.querySelector('.main-text').innerText;
            } else if (columnName === 'total_column') {
                value = cell.querySelector('.main-text').innerText;
            } else if (columnName === 'main_action_column') {
                value = cell.querySelector('a').href;
            }
            data[columnName] = value;
        });
        return data;
    });

    await page.close();
    // clearAllCookies();
    closeAskQuestion();
    return rowData;
};

export const checkLoginStatus = async () => {
    const page = await browser.newPage();
    const loginPageUrl = 'https://accounts.google.com/ServiceLogin?service=androiddeveloper&passive=true&continue=https%3A%2F%2Fplay.google.com%2Fconsole%2Fdeveloper%2F';
    await page.goto(loginPageUrl, {
        timeout: 120 * 1000,
        waitUntil: 'domcontentloaded',
    });
    const curPageUrl = page.url();
    await page.close();
    return curPageUrl.includes('https://play.google.com/console/developers');
};
