import { recordOperationAudit, AUDIT_ACTION } from '../repositories/operationAuditRepository.js';

export { AUDIT_ACTION };

const PLATFORM_AUDIT_KEYS = new Set(['insightrackr', 'guangdada', 'sensortower']);
const MATERIAL_PLATFORM = 'material_tools';
const MAX_AUDIT_TASK_SUMMARIES = 100;
const MAX_AUDIT_URLS = 80;
const MAX_AUDIT_TEXT_LENGTH = 1000;

function asString(value, maxLength = MAX_AUDIT_TEXT_LENGTH) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeMaterialPlatform(source) {
  const key = asString(source, 64);
  return PLATFORM_AUDIT_KEYS.has(key) ? key : MATERIAL_PLATFORM;
}

function uniqueStrings(values, limit = MAX_AUDIT_URLS) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = asString(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function taskSourceUrl(task) {
  return task?.sourceUrl || task?.processPayload?.url || '';
}

function summarizeMaterialTasks(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const totalCount = list.length;
  const videoCount = list.filter((task) => task?.isVideo).length;
  const imageCount = list.filter((task) => !task?.isVideo && !task?.isHtml).length;
  const htmlCount = list.filter((task) => task?.isHtml).length;
  const localCount = list.filter((task) => task?.sourceType === 'local').length;
  const remoteCount = totalCount - localCount;
  const originalUrls = uniqueStrings(list.map(taskSourceUrl));
  const originalVideoUrls = uniqueStrings(
    list.filter((task) => task?.isVideo).map(taskSourceUrl)
  );
  const targetSizes = uniqueStrings(
    list.map((task) => {
      const w = task?.targetWidth ?? task?.processPayload?.targetW;
      const h = task?.targetHeight ?? task?.processPayload?.targetH;
      if (w && h) return `${w}x${h}`;
      return task?.sizeLabel || 'original';
    }),
    50
  );
  const taskSummaries = list.slice(0, MAX_AUDIT_TASK_SUMMARIES).map((task) => ({
    taskId: asString(task?.id, 128),
    filename: asString(task?.filename, 255),
    sourceLabel: asString(task?.sourceLabel, 255),
    sourceUrl: asString(taskSourceUrl(task)),
    isVideo: !!task?.isVideo,
    isHtml: !!task?.isHtml,
    sourceType: asString(task?.sourceType, 32),
    sizeLabel: asString(task?.sizeLabel, 64),
    targetWidth: task?.targetWidth ?? task?.processPayload?.targetW ?? null,
    targetHeight: task?.targetHeight ?? task?.processPayload?.targetH ?? null,
  }));

  return {
    totalCount,
    videoCount,
    imageCount,
    htmlCount,
    localCount,
    remoteCount,
    originalUrls,
    originalVideoUrls,
    targetSizes,
    taskSummaries,
    truncatedTaskCount: Math.max(0, totalCount - taskSummaries.length),
  };
}

export function auditPlatformLogin({
  platform,
  operatorProfile,
  targetAccount,
  success,
  alreadyOnline = false,
  message,
  metadata,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.PLATFORM_LOGIN,
    platform,
    operatorProfile,
    targetAccount,
    status: alreadyOnline ? 'skipped' : (success ? 'success' : 'failed'),
    message: message || (alreadyOnline ? '已在线，未重复登录' : (success ? '登录成功' : '登录失败')),
    metadata,
  });
}

export function auditPlatformLoginTrigger({
  platform,
  operatorProfile,
  targetAccount,
  success,
  alreadyOnline = false,
  message,
  metadata,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.PLATFORM_LOGIN_TRIGGER,
    platform,
    operatorProfile,
    targetAccount,
    status: alreadyOnline ? 'skipped' : (success ? 'success' : 'failed'),
    message,
    metadata,
  });
}

export function auditPlatformClearLogin({
  platform,
  operatorProfile,
  targetAccount,
  success,
  message,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.PLATFORM_CLEAR_LOGIN,
    platform,
    operatorProfile,
    targetAccount,
    status: success ? 'success' : 'failed',
    message,
  });
}

export function auditPlatformVisibilityUpdate({
  platform,
  operatorProfile,
  enabled,
  metadata,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.PLATFORM_VISIBILITY_UPDATE,
    platform,
    operatorProfile,
    status: 'success',
    message: enabled ? '平台入口已显示' : '平台入口已隐藏',
    metadata,
  });
}

export function auditPlatformCredentialUpdate({
  platform,
  operatorProfile,
  targetAccount,
  success,
  message,
  metadata,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.PLATFORM_CREDENTIAL_UPDATE,
    platform,
    operatorProfile,
    targetAccount,
    status: success ? 'success' : 'failed',
    message,
    metadata,
  });
}

export function auditPlatformRequest({
  platform,
  operatorProfile,
  targetAccount,
  endpoint,
  requestAction,
  quotaKey,
  quotaAmount = 1,
  success,
  blocked = false,
  message,
  metadata,
}) {
  const status = blocked ? 'blocked' : (success ? 'success' : 'failed');
  const amount = Math.max(0, Number(quotaAmount) || 0);
  recordOperationAudit({
    action: AUDIT_ACTION.PLATFORM_REQUEST,
    platform,
    operatorProfile,
    targetAccount,
    status,
    message: message || `${requestAction || endpoint || '平台请求'}${amount ? `，消耗 ${amount}` : ''}`,
    metadata: {
      endpoint: asString(endpoint, 255),
      requestAction: asString(requestAction, 64),
      quotaKey: asString(quotaKey, 64),
      quotaAmount: amount,
      ...metadata,
    },
  });
}

export function auditMaterialBatchSubmit({
  operatorProfile,
  batchId,
  source,
  sourceLabel,
  folderName,
  tasks,
}) {
  const summary = summarizeMaterialTasks(tasks);
  const hasVideo = summary.videoCount > 0;
  const actionText = hasVideo ? '下载/转码批次已提交' : '素材下载批次已提交';
  recordOperationAudit({
    action: AUDIT_ACTION.MATERIAL_BATCH_SUBMIT,
    platform: normalizeMaterialPlatform(source),
    operatorProfile,
    status: 'success',
    message: `${actionText}：共 ${summary.totalCount} 个任务，视频 ${summary.videoCount} 个，图片 ${summary.imageCount} 个，HTML ${summary.htmlCount} 个`,
    metadata: {
      batchId: asString(batchId, 128),
      source: asString(source, 64),
      sourceLabel: asString(sourceLabel, 255),
      folderName: asString(folderName, 255),
      ...summary,
    },
  });
}

export function auditMaterialIngestionSync({
  operatorProfile,
  platform,
  success,
  status,
  message,
  metadata,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.MATERIAL_INGESTION_SYNC,
    platform: normalizeMaterialPlatform(platform),
    operatorProfile,
    status: status || (success ? 'success' : 'failed'),
    message: message || (success ? '素材同步已提交' : '素材同步失败'),
    metadata,
  });
}

export function auditTranscodeJobSubmit({
  operatorProfile,
  videoUrl,
  targetW,
  targetH,
  jobId,
  clientBatchId,
  clientTaskId,
  sourceLabel,
  success = true,
  message,
}) {
  recordOperationAudit({
    action: AUDIT_ACTION.TRANSCODE_JOB_SUBMIT,
    platform: MATERIAL_PLATFORM,
    operatorProfile,
    status: success ? 'success' : 'failed',
    message: message || (success ? '转码任务已提交' : '转码任务提交失败'),
    metadata: {
      jobId: asString(jobId, 128),
      clientBatchId: asString(clientBatchId, 128),
      clientTaskId: asString(clientTaskId, 128),
      sourceLabel: asString(sourceLabel, 255),
      originalVideoUrl: asString(videoUrl),
      count: 1,
      targetWidth: targetW ?? null,
      targetHeight: targetH ?? null,
    },
  });
}
