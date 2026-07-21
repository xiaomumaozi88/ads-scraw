import * as puppeteerService from '../services/puppeteerServiceInsightrackr.js';
import {
  getInsightrackrAutoLoginInfo,
  triggerInsightrackrLogin,
} from '../services/insightrackrAutoLogin.js';
import { auditPlatformLogin } from '../services/auditLogService.js';
import { logger } from '../utils/logger.js';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('收到登录请求，邮箱:', email ? email.substring(0, 3) + '***' : '未提供');
        const data = await puppeteerService.login(email, password);
        console.log('登录结果:', data.success ? '成功' : '失败', data.message);
        auditPlatformLogin({
          platform: 'insightrackr',
          operatorProfile: req.iamProfile,
          targetAccount: email || data?.data?.email || null,
          success: data.success === true,
          message: data.message,
        });
        res.json({...data});
    } catch (error) {
        console.error('登录控制器捕获到错误:', error);
        console.error('错误堆栈:', error.stack);
        logger.error(`请求登录失败: ${error}`);
        logger.error('错误堆栈:', error.stack);
        res.status(200).json({
            data: null, 
            success: false, 
            code: 500, 
            message: `请求登录失败: ${error.message}`
        });
    }
};

/** GET /api/insightrackr/auto-login-info */
export const getAutoLoginInfo = async (req, res) => {
  try {
    res.json({ success: true, data: getInsightrackrAutoLoginInfo() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取失败' });
  }
};

/** POST /api/insightrackr/trigger-login — 使用服务端凭据一键登录（带互斥锁） */
export const postTriggerLogin = async (req, res) => {
  try {
    const result = await triggerInsightrackrLogin({ operatorProfile: req.iamProfile });
    res.json({
      success: result.success,
      code: result.code,
      message: result.message,
      data: result.data ?? null,
      alreadyOnline: result.alreadyOnline === true,
    });
  } catch (error) {
    logger.error('触发 Insightrackr 登录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '登录请求失败',
    });
  }
};
