import * as puppeteerService from '../services/puppeteerService.js';
import { auditPlatformLogin } from '../services/auditLogService.js';
import { clearGuangdadaQuotaCache } from '../services/guangdadaQuotaService.js';
import {
  getPlatformAutoLoginInfo,
  triggerPlatformLogin,
} from '../services/platformAutoLoginService.js';
import { logger } from '../utils/logger.js';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const data = await puppeteerService.login(email, password);
        clearGuangdadaQuotaCache();
        auditPlatformLogin({
          platform: 'guangdada',
          operatorProfile: req.iamProfile,
          targetAccount: email || data?.data?.email || null,
          success: data.success === true,
          message: data.message,
        });
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.error(`请求登录失败: ${error}`);
        res.status(200).json({
            data: null, 
            success: false, 
            code: 500, 
            message: `请求登录失败: ${error.message}`
        });
    }
};

/** GET /api/catalog/g1/auto-login-info */
export const getAutoLoginInfo = async (req, res) => {
  try {
    res.json({ success: true, data: getPlatformAutoLoginInfo('guangdada') });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取失败' });
  }
};

/** POST /api/catalog/g1/trigger-login */
export const postTriggerLogin = async (req, res) => {
  try {
    const result = await triggerPlatformLogin('guangdada', { operatorProfile: req.iamProfile });
    res.json({
      success: result.success,
      code: result.code,
      message: result.message,
      data: result.data ?? null,
      alreadyOnline: result.alreadyOnline === true,
    });
  } catch (error) {
    logger.error('触发广大大登录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '登录请求失败',
    });
  }
};
