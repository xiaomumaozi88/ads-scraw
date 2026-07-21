import { auditMaterialBatchSubmit } from '../services/auditLogService.js';

/**
 * POST /api/material-processing/batch-audit
 * 记录用户素材下载/批量转码提交事件。操作人以后端 IAM 会话为准。
 */
export async function postMaterialBatchAudit(req, res) {
  try {
    const body = req.body || {};
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    if (!body.batchId || tasks.length === 0) {
      res.status(400).json({ success: false, message: '缺少批次 ID 或任务列表' });
      return;
    }

    auditMaterialBatchSubmit({
      operatorProfile: req.iamProfile,
      batchId: body.batchId,
      source: body.source,
      sourceLabel: body.sourceLabel,
      folderName: body.folderName,
      tasks,
    });

    res.json({ success: true, code: 200, message: '操作日志已记录' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error?.message || '记录操作日志失败',
    });
  }
}
