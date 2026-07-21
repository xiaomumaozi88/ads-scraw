import * as puppeteerService from '../services/puppeteerServiceSensorTower.js';
import { auditPlatformLogin } from '../services/auditLogService.js';
import {
  getPlatformAutoLoginInfo,
  triggerPlatformLogin,
} from '../services/platformAutoLoginService.js';
import { logger } from '../utils/logger.js';

export const login = async (req, res) => {
    try {
        const { email, password, otp, authLink } = req.body || {};
        const data = await puppeteerService.login(email, password, otp, authLink);
        auditPlatformLogin({
          platform: 'sensortower',
          operatorProfile: req.iamProfile,
          targetAccount: email || data?.data?.email || null,
          success: data.success === true,
          message: data.message,
        });
        res.json({ ...data });
    } catch (error) {
        console.error('Sensor Tower 登录失败:', error);
        logger.error(`Sensor Tower 登录: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: `请求登录失败: ${error.message}`,
        });
    }
};

/** GET /api/sensortower/auto-login-info */
export const getAutoLoginInfo = async (req, res) => {
  try {
    res.json({ success: true, data: getPlatformAutoLoginInfo('sensortower') });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取失败' });
  }
};

/** POST /api/sensortower/trigger-login */
export const postTriggerLogin = async (req, res) => {
  try {
    const result = await triggerPlatformLogin('sensortower', { operatorProfile: req.iamProfile });
    res.json({
      success: result.success,
      code: result.code,
      message: result.message,
      data: result.data ?? null,
      alreadyOnline: result.alreadyOnline === true,
    });
  } catch (error) {
    logger.error('触发 Sensor Tower 登录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '登录请求失败',
    });
  }
};
