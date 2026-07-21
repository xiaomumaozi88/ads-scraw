const STORAGE_KEY = 'ads-scraw:material-processing-history';
const MAX_BATCHES = 80;

export function createTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createBatchId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** @typedef {'pending'|'processing'|'done'|'error'} TaskStatus */
/** @typedef {'running'|'completed'|'partial'|'failed'} BatchStatus */

/**
 * @typedef {Object} ProcessingTask
 * @property {string} id
 * @property {string} filename
 * @property {string} [finalFilename]
 * @property {TaskStatus} status
 * @property {number} progress
 * @property {string} [errorMessage]
 * @property {string} sizeLabel
 * @property {string} [sourceUrl]
 * @property {string} [sourceLabel]
 * @property {number|null} [originalWidth]
 * @property {number|null} [originalHeight]
 * @property {number|null} [targetWidth]
 * @property {number|null} [targetHeight]
 * @property {boolean} isVideo
 * @property {boolean} isHtml
 * @property {'remote'|'local'} sourceType
 * @property {Object} processPayload
 */

/**
 * @typedef {Object} ProcessingBatch
 * @property {string} id
 * @property {number} createdAt
 * @property {string} source
 * @property {string} sourceLabel
 * @property {string|null} folderName
 * @property {BatchStatus} status
 * @property {ProcessingTask[]} tasks
 */

export function loadHistoryBatches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryBatches(batches) {
  try {
    const trimmed = batches.slice(0, MAX_BATCHES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[materialProcessingStorage] 保存历史失败:', e?.message);
  }
}

export function computeBatchStatus(tasks) {
  if (!tasks.length) return 'completed';
  const hasRunning = tasks.some((t) => t.status === 'pending' || t.status === 'processing');
  if (hasRunning) return 'running';
  const errors = tasks.filter((t) => t.status === 'error').length;
  if (errors === tasks.length) return 'failed';
  if (errors > 0) return 'partial';
  return 'completed';
}

export function formatBatchTime(ts) {
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(ts);
  }
}
