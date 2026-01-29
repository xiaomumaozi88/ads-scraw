import * as puppeteerService from '../services/puppeteerServiceInsightrackr.js';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('收到登录请求，邮箱:', email ? email.substring(0, 3) + '***' : '未提供');
        // 如果请求中没有提供账号密码，将使用环境变量或默认值
        const data = await puppeteerService.login(email, password);
        console.log('登录结果:', data.success ? '成功' : '失败', data.message);
        res.json({...data});
    } catch (error) {
        console.error('登录控制器捕获到错误:', error);
        console.error('错误堆栈:', error.stack);
        if (typeof logger !== 'undefined') {
            logger.error(`请求登录失败: ${error}`);
            logger.error('错误堆栈:', error.stack);
        }
        res.status(200).json({
            data: null, 
            success: false, 
            code: 500, 
            message: `请求登录失败: ${error.message}`
        });
    }
};

