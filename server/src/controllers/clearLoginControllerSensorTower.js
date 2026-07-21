import * as puppeteerService from '../services/puppeteerServiceSensorTower.js';
import { auditPlatformClearLogin } from '../services/auditLogService.js';

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
        auditPlatformClearLogin({
          platform: 'sensortower',
          operatorProfile: req.iamProfile,
          targetAccount,
          success: data?.success !== false,
          message: data?.message,
        });
        res.json({ ...data });
    } catch (error) {
        console.error('Sensor Tower 清除登录失败:', error);
        res.status(200).json({
            success: false,
            code: 500,
            message: `清除失败: ${error.message}`,
        });
    }
};
