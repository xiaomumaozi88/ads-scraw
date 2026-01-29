import * as puppeteerService from '../services/puppeteerService.js';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // 如果请求中没有提供账号密码，将使用环境变量或默认值
        const data = await puppeteerService.login(email, password);
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.error(`请求登录失败: ${error}`);
        res.status(200).json({data: null, success: false, code: 500, message: `请求登录失败: ${error.message}`});
    }
};
