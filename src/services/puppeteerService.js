import puppeteer from 'puppeteer';
import {puppeteerOptions} from '../config.js';
import {rm} from 'fs/promises';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import {LoginStatus} from '../constants/index.js';

const __filename = fileURLToPath(import.meta.url);
// 获取当前目录的绝对路径
const __dirname = dirname(__filename);

// 指定要删除的文件夹路径
const folderToDelete = join(__dirname, '../../tmp/gpc_order_spider_usr_dir3');

let browser;
let loginPage; // 登录页面
let imgPage;
let lastSendTime = 0; // 上次发送验证码的时间
let timeoutId = null; // 存储定时器 ID
let context;

let browser1;

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
    console.log('准备启动t4f浏览器');
    try {
        browser = await puppeteer.launch(puppeteerOptions);
        await browser.defaultBrowserContext().overridePermissions('https://play.google.com/', ['clipboard-read', 'clipboard-write']);
    } catch (e) {
        console.log('e', e);
    }
    console.log('t4f浏览器已启动');
};

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
    }
};

export const scrapeData = async (orderId, accountId) => {
    try {
        logger.info(`接收到订单号: ${orderId}, accountId:${accountId}`);
        const page = await browser.newPage();
        // const orderUrl = `https://play.google.com/console/u/0/developers/${accountId}/orders?search=${orderId}&from=2008-01-01&to=${curDate()}`;
        const orderUrl = `https://play.google.com/console/u/0/developers/${accountId}/orders/${orderId}`
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
    // logger.info(`当前${process.env.USER_NAME_NIBIRUTECH}登录状态: ${status.current}`)
    if (status.current === LoginStatus.AWAITING_IMG_CODE) {
        const captchaImgSrc = imgPage ? await imgPage.$eval('#captchaimg', (el) => el.src) : '';
        return {
            status: status.current,
            captchaImgSrc
        };
    }
    return {
        status: status.current,
    };
};


const timerIdManage = () => {
    // 清除之前的定时器
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    // 设置一个定时器，十分钟后检查一下：距离上次发送验证码的时间是否"超过10分钟且status状态未改变"，如果是，则清空loginPage 且重置status
    timeoutId = setTimeout(async () => {
        if (status.current !== LoginStatus.ONLINE && new Date().valueOf() - lastSendTime > 10 * 60 * 1000) {
            logger.info('验证码超过十分钟未填写，重置登录流程');
            if (loginPage) {
                await loginPage.close();
                loginPage = null;
            }
            if (imgPage) {
                await imgPage.close();
                imgPage = null;
            }
            status.update(LoginStatus.LOGGED_OUT);
        }
    }, 10 * 60 * 1000);
}

// 发起登录，发验证码给管理员
export const login = async () => {
    console.log('t4f登录');
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
    await page.type(currentSelectors.usernameInput, process.env.USER_NAME_NIBIRUTECH);
    logger.info('已输入用户名', process.env.USER_NAME_NIBIRUTECH);

    await page.waitForSelector(currentSelectors.usernameSubmitButton);
    await page.click(currentSelectors.usernameSubmitButton);
    logger.info('点击用户名提交', process.env.USER_NAME_NIBIRUTECH);
    // await page.waitForNavigation({ timeout: 120 * 1000 }); // stable版本的chrome展示不需要，注释
    try {
        await page.waitForSelector(currentSelectors.passwordInput);
        await page.type(currentSelectors.passwordInput, process.env.USER_PASSWORD_NIBIRUTECH);
        logger.info('已输入用户密码', process.env.USER_PASSWORD_NIBIRUTECH);
    } catch (e) {
        logger.info('查找密码输入框超时了', await page.content());
        // logger.info('未找到密码输入框，此刻页面打印', await page.content());
        const playCaptchaButton = await page.waitForSelector('#playCaptchaButton');
        if (playCaptchaButton) {
            logger.info('出现了图形验证码');

            //获取 id为 captchaimg 的图片的src属性
            const captchaImgSrc = await page.$eval('#captchaimg', (el) => el.src);
            logger.info('captchaSrc', captchaImgSrc);

            logger.info('此时url', await page.url());
            imgPage = page;

            // 更新状态为等待图形验证码提交
            status.update(LoginStatus.AWAITING_IMG_CODE);

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

    status.update(LoginStatus.AWAITING_VERIFICATION);
    loginPage = page;
    lastSendTime = new Date().valueOf();
    logger.info('已进入登录流程');

    timerIdManage();
    // // 清除之前的定时器
    // if (timeoutId) {
    //     clearTimeout(timeoutId);
    // }
    // // 设置一个定时器，十分钟后检查一下：距离上次发送验证码的时间是否"超过10分钟且status状态未改变"，如果是，则清空loginPage 且重置status
    // timeoutId = setTimeout(async () => {
    //     if (status.current !== LoginStatus.ONLINE && new Date().valueOf() - lastSendTime > 10 * 60 * 1000) {
    //         logger.info('验证码超过十分钟未填写，重置登录流程');
    //         await loginPage.close();
    //         loginPage = null;
    //         status.update(LoginStatus.LOGGED_OUT);
    //     }
    // }, 10 * 60 * 1000);
    return {
        data: null,
        success: true,
        code: 200,
        message: '已进入登录流程'
    }
}

export const refreshImgCode = async () => {
    if (!imgPage) return {
        data: null,
        success: false,
        code: 500,
        message: '未找到图形验证码页面'
    }

    await imgPage.goto(loginPageUrl, {timeout: 120 * 1000});

    await imgPage.waitForSelector(currentSelectors.usernameInput);
    await imgPage.type(currentSelectors.usernameInput, process.env.USER_NAME_NIBIRUTECH);
    logger.info('刷新图形验证码-重新载入页面后输入了用户名');

    await imgPage.waitForSelector(currentSelectors.usernameSubmitButton);
    await imgPage.click(currentSelectors.usernameSubmitButton);
    logger.info('刷新图形验证码-点击了用户名提交按钮');
    try {
        const playCaptchaButton = await imgPage.waitForSelector('#playCaptchaButton');
        if (playCaptchaButton) {
            //获取 id为 captchaimg 的图片的src属性
            const captchaImgSrc = await imgPage.$eval('#captchaimg', (el) => el.src);
            logger.info('刷新出了新的图形验证码', captchaImgSrc);
            // 更新状态为等待图形验证码提交
            status.update(LoginStatus.AWAITING_IMG_CODE);

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
    } catch (e) {
        console.log('刷新验证码失败', e);
        console.log('刷新验证码失败时的页面', await imgPage.content());
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

export const verifyImgCode = async (imgCode) => {

    if (!imgPage) {
        return {
            data: null,
            success: false,
            code: 500,
            message: '未找到图形验证码页面'
        }
    }
    if (status.current !== LoginStatus.AWAITING_IMG_CODE) {
        return {
            data: null,
            success: false,
            code: 500,
            message: '当前不是等待图形验证码状态'
        }
    }
    await imgPage.waitForSelector('input[type="text"]');
    await imgPage.type('input[type="text"]', imgCode);

    await imgPage.waitForSelector(currentSelectors.usernameSubmitButton);
    await imgPage.click(currentSelectors.usernameSubmitButton);
    logger.info('验证图形验证码-点击了用户了提交按钮');
    const result = await Promise.race([
        // 设置4s等待时间，如果4s后仍然没有检查到密码输入框，则认为图形验证码验证失败;否则成功
        new Promise(resolve => setTimeout(() => resolve('timeout'), 4 * 1000)).then(async () => {
            const messageInput = await imgPage.waitForSelector(currentSelectors.passwordInput).catch(() => null);
            if (!messageInput) {
                return 'failed';
            }
            return 'success';
        }),
        imgPage.waitForSelector(currentSelectors.passwordInput, {timeout: 120 * 1000}).then(async () => {
            return 'success';
        })
    ]);
    if (result === 'success') {

        await imgPage.waitForSelector(currentSelectors.passwordInput);
        await imgPage.type(currentSelectors.passwordInput, process.env.USER_PASSWORD_NIBIRUTECH);
        logger.info('图形验证码验证成功，已输入用户密码', process.env.USER_PASSWORD_NIBIRUTECH);
        await imgPage.waitForSelector(currentSelectors.passwordSubmitButton);
        await imgPage.click(currentSelectors.passwordSubmitButton);
        // await page.waitForNavigation({ timeout: 120 * 1000, waitUntil: 'domcontentloaded' }); // stable版本的chrome不需要，注释

        status.update(LoginStatus.AWAITING_VERIFICATION);
        loginPage = imgPage;
        imgPage = null;
        lastSendTime = new Date().valueOf();
        logger.info('图形验证码通过，已进入登录流程');
        timerIdManage();
        return {
            data: null,
            success: true,
            code: 200,
            message: '已进入登录流程'
        }
    } else {
        // 验证码错误重置为等待验证码状态，提示重试
        status.update(LoginStatus.AWAITING_IMG_CODE);
        logger.info('图形验证码错误', await imgPage.content());
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

        await loginPage.waitForSelector(currentSelectors.totpNext);
        await loginPage.click(currentSelectors.totpNext);

        const result = await Promise.race([
            // 设置4s等待时间，如果4s后仍然没有检查到验证码错误提示，则认为验证成功
            new Promise(resolve => setTimeout(() => resolve('timeout'), 4 * 1000)).then(async () => {
                const errorMessage = await loginPage.$eval(currentSelectors.errorSelector, el => el.innerText).catch(() => null);
                if (!errorMessage) {
                    return 'success';
                } else {
                    return errorMessage;
                }
            }),
            loginPage.waitForSelector(currentSelectors.errorSelector, {timeout: 120 * 1000}).then(async () => {
                const errorMessage = await loginPage.$eval(currentSelectors.errorSelector, el => el.innerText).catch(() => null);
                return errorMessage;
            })
        ]);
        if (result === 'success') {
            // 睡眠3s
            await new Promise(resolve => setTimeout(resolve, 3000));
            await loginPage.goto(checkLoginUrl, {
                timeout: 120 * 1000,
                waitUntil: 'domcontentloaded',
            });
            const curPageUrl = loginPage.url();
            const isLoggedIn = curPageUrl.includes('https://play.google.com/console/developers');
            if (isLoggedIn) {
                if (timeoutId) {
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
                if (timeoutId) {
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
        } else {
            // 验证码错误重置为等待验证码状态，提示重试
            status.update(LoginStatus.AWAITING_VERIFICATION);
            return {
                code: 'CODE_ERROR',
                data: null,
                success: false,
                message: result || '验证码不正确'
            };
        }
    } catch (e) {
        status.update(LoginStatus.AWAITING_VERIFICATION);
        logger.error(`验证码校验失败: ${e}`, loginPage.url(), await loginPage.content());
    }
}

const fetchData = async (page) => {
    console.log('爬取t4f订单数据');
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

        const inputSelector = 'input[aria-label="Search by order ID or email"]';
        let purchaseToken = '';
        const client = await page.target().createCDPSession();
        await client.send('Browser.grantPermissions', {
            origin: "https://play.google.com",
            permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        });

        const result = await Promise.race([
            page.waitForSelector('[debug-id="copy-purchase-token-button"]', {timeout: 60 * 1000}).then(async () => {
                logger.info('按钮已获取');
                await page.waitForSelector('[debug-id="copy-purchase-token-button"]');
                await page.click('[debug-id="copy-purchase-token-button"]')
                logger.info('Token 按钮已点击');
                return 'success';
            }).catch((e) => {
                logger.info('获取详情数据数据元素超时', e);
            }),
        page.waitForSelector(inputSelector, {timeout: 60 * 1000}).then(() => {
            logger.info('暂无数据');
            return 'failure';
        }).catch((e) => {
            logger.info('没有订单，已跳回列表页');
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


        // 等待1秒，等待复制到剪贴板
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.waitForSelector('order-details-page');
        logger.info('获取详情数据数据元素成功');
        const rowData = await page.evaluate(async () => {

            const data = {};
            const row = document.querySelector('.page-container');
            const cells = row.querySelectorAll('labelled-field');
            const orderItemsTable = document.querySelector('order-items').querySelector('.ess-table-canvas');
            const orderHistoryTable = document.querySelector('order-history').querySelector('.ess-table-canvas');
            const tables = [
                {
                    title: 'Products in this order',
                    table: orderItemsTable
                },
                {
                    title: 'History',
                    table: orderHistoryTable
                }
            ].filter(i => i.table);

            cells.forEach(cell => {
                const columnName = cell.getAttribute('label') || cell.querySelector('simple-html').innerText;
                const target = cell.querySelector('[field-value]')?.querySelector('[tooltiptarget]');
                data[columnName] = target ? target?.innerText : cell.querySelector('[field-value]').innerText;
            });


            const tableData = [];

            const columnKey = {
                'product_column': 'Product',
                'type_column': 'Type',
                'quantity_column': 'Quantity',
                'listed_price_column': 'List Price',
                'tax_column': 'Tax',
                'date_column': 'Date',
                'status_column': 'Status',
                'description_column': 'Event'
            };

            Array.from(tables).forEach((tableItem, tableIndex) => {
                const tableDataItem = {
                    data: []
                };
                const rows = tableItem.table.querySelectorAll('.particle-table-row');
                if (rows.length > 0) {
                    rows.forEach(row => {
                        const rowData = {};
                        const cells = row.querySelectorAll('ess-cell');

                        cells.forEach((cell, index) => {
                            const cellName = columnKey[cell.getAttribute('essfield')];
                            let cellValue = cell.innerText;
                            if(cellName === 'Status'){
                                cellValue = cellValue.split('\n')[1];
                            }
                            rowData[cellName] = cellValue;
                        })
                        tableDataItem.data.push(rowData);
                    })
                }
                tableData.push({
                    title: tableItem.title,
                    data: tableDataItem.data
                });
            });

            return {
                orderDetail:data,
                tableData: tableData,
            };
        });

        // 等待3秒
        const granted = await page.evaluate(async () => {
            return (await navigator.permissions.query({name: 'clipboard-read'})).state;
        });
        console.log('是否授权读取剪贴板:', granted);
        purchaseToken = await page.evaluate(() => {
            return navigator.clipboard.readText();
        })
        logger.info('该订单号查询到了数据', rowData, `purchaseToken:`, purchaseToken);
        return {
            data: {
                ...rowData,
                purchaseToken: purchaseToken || '-'
            },
            message: '数据查询成功',
            code: '',
            success: true,
        };

    } catch (error) {
        const str = await page.content();
        logger.error(`发生错误：${error}`);
        // logger.error(`发生错误：${error}`, str);
        if (str.includes('Signed out')) {
            logger.info('googleplay_web@nibirutech.com：页面包含了 Signed out ，登录已过期');
            status.update(LoginStatus.LOGGED_OUT);
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
    // 查看页面有没有出现 id为 'signin_status'且包含文本内容为'Signed out'的span元素
    // 有则认为登录过期
    const isSignedOut = await page.evaluate(() => {
        return document.querySelector('#signin_status')?.textContent.includes('Signed out')
    });
    if (isSignedOut) {
        status.update(LoginStatus.LOGGED_OUT);
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
