import {
  AUDIT_ACTION,
  getOperationAuditById,
  getAuditStorageMode,
  listOperationAudits,
  summarizeOperationAudits,
} from '../repositories/operationAuditRepository.js';
import { isDbEnabled } from '../db/pool.js';

/** GET /api/health/operation-audits — 操作审计记录（分页） */
export const getOperationAudits = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const platform = req.query.platform?.trim() || null;
    const action = req.query.action?.trim() || null;
    const result = await listOperationAudits({ page, pageSize, platform, action });
    res.json({
      success: true,
      data: {
        ...result,
        dbEnabled: isDbEnabled(),
        storageMode: getAuditStorageMode(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取操作审计失败' });
  }
};

/** GET /api/health/operation-audits/:id — 操作审计详情 */
export const getOperationAuditDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ success: false, message: '无效的审计记录 ID' });
      return;
    }
    const item = await getOperationAuditById(id);
    if (!item) {
      res.status(404).json({ success: false, message: '审计记录不存在' });
      return;
    }
    res.json({
      success: true,
      data: {
        item,
        dbEnabled: isDbEnabled(),
        storageMode: getAuditStorageMode(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取操作审计详情失败' });
  }
};

/** GET /api/health/operation-audits/summary — 操作审计聚合榜单 */
export const getOperationAuditSummary = async (req, res) => {
  try {
    const platform = req.query.platform?.trim() || null;
    const action = req.query.action?.trim() || AUDIT_ACTION.PLATFORM_REQUEST;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await summarizeOperationAudits({ platform, action, days, limit });
    res.json({
      success: true,
      data: {
        ...result,
        action,
        platform,
        dbEnabled: isDbEnabled(),
        storageMode: getAuditStorageMode(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '读取操作审计汇总失败' });
  }
};
