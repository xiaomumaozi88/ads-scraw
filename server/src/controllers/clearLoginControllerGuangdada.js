import * as puppeteerService from '../services/puppeteerService.js';
import { auditPlatformClearLogin } from '../services/auditLogService.js';
import { clearGuangdadaQuotaCache } from '../services/guangdadaQuotaService.js';
import { logger } from '../utils/logger.js';

export const clearLogin = async (req, res) => {
    try {
        let targetAccount = null;
        try {
          const status = await puppeteerService.getStatus();
          targetAccount = status?.email || null;
        } catch {
          // ignore
        }
        const data = await puppeteerService.clearLogin();
        clearGuangdadaQuotaCache();
        auditPlatformClearLogin({
          platform: 'guangdada',
          operatorProfile: req.iamProfile,
          targetAccount,
          success: data?.success !== false,
          message: data?.message,
        });
        res.json({...data});
    } catch (error) {
        console.error(error);
        logger.error(`清除登录状态失败: ${error}`);
        res.status(200).json({
            data: null,
            success: false,
            code: 500,
            message: `清除登录状态失败: ${error.message}`
        });
    }
};
