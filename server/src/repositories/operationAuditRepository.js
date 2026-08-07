import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isDbEnabled, getPool } from '../db/pool.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../data');
const AUDIT_FILE = join(DATA_DIR, 'operation-audits.json');
const MAX_LOCAL_AUDITS = 2000;

export const AUDIT_ACTION = {
  PLATFORM_LOGIN: 'platform_login',
  PLATFORM_LOGIN_TRIGGER: 'platform_login_trigger',
  PLATFORM_CLEAR_LOGIN: 'platform_clear_login',
  PLATFORM_STATUS_REFRESH: 'platform_status_refresh',
  PLATFORM_VISIBILITY_UPDATE: 'platform_visibility_update',
  PLATFORM_CREDENTIAL_UPDATE: 'platform_credential_update',
  PLATFORM_REQUEST: 'platform_request',
  MATERIAL_INGESTION_SYNC: 'material_ingestion_sync',
  MATERIAL_BATCH_SUBMIT: 'material_batch_submit',
  TRANSCODE_JOB_SUBMIT: 'transcode_job_submit',
};

/** @type {object[]} */
let localAudits = [];
let localNextId = 1;
let localLoaded = false;

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function loadLocalAuditsFromFile() {
  if (localLoaded) return;
  localLoaded = true;
  ensureDataDir();
  if (!existsSync(AUDIT_FILE)) {
    localAudits = [];
    localNextId = 1;
    return;
  }
  try {
    const arr = JSON.parse(readFileSync(AUDIT_FILE, 'utf8'));
    if (!Array.isArray(arr)) {
      localAudits = [];
      localNextId = 1;
      return;
    }
    localAudits = arr;
    const maxId = arr.reduce((m, row) => Math.max(m, Number(row.id) || 0), 0);
    localNextId = maxId + 1;
  } catch {
    localAudits = [];
    localNextId = 1;
  }
}

function persistLocalAuditsToFile() {
  ensureDataDir();
  writeFileSync(AUDIT_FILE, JSON.stringify(localAudits.slice(0, MAX_LOCAL_AUDITS), null, 2), 'utf8');
}

function normalizeCreatedAtValue(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str)) {
    return `${str.replace(' ', 'T')}Z`;
  }
  return str;
}

function formatBeijingCreatedAt(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
  } catch {
    return String(value);
  }
}

function compactAuditMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const hasIngestionDebugDetails = Boolean(metadata.ingestionRequest || metadata.ingestionResponse);
  if (!hasIngestionDebugDetails) return metadata;
  const {
    ingestionRequest,
    ingestionResponse,
    upstreamResponse,
    ...rest
  } = metadata;
  return {
    ...rest,
    upstreamResponse: upstreamResponse ? {
      status: upstreamResponse.status ?? upstreamResponse.data?.status ?? null,
      receipt_id: upstreamResponse.data?.receipt_id ?? null,
      accepted_count: upstreamResponse.data?.accepted_count ?? null,
    } : undefined,
    hasIngestionDebugDetails,
  };
}

function rowToAudit(row, { compactMetadata = false } = {}) {
  let metadata = null;
  if (row.metadata) {
    try {
      metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    } catch {
      metadata = null;
    }
  }
  if (compactMetadata) metadata = compactAuditMetadata(metadata);
  const createdAt = normalizeCreatedAtValue(row.created_at ?? row.createdAt);
  return {
    id: row.id,
    action: row.action,
    platform: row.platform,
    operatorFeishuUserId: row.operator_feishu_user_id ?? row.operatorFeishuUserId ?? null,
    operatorName: row.operator_name ?? row.operatorName ?? null,
    operatorEmail: row.operator_email ?? row.operatorEmail ?? null,
    targetAccount: row.target_account ?? row.targetAccount ?? null,
    status: row.status,
    message: row.message,
    metadata,
    createdAt,
    createdAtFormatted: createdAt ? formatBeijingCreatedAt(createdAt) : (row.createdAtFormatted || '-'),
  };
}

function insertLocalAudit(row) {
  loadLocalAuditsFromFile();
  const entry = {
    id: localNextId++,
    action: row.action,
    platform: row.platform,
    operator_feishu_user_id: row.operator_feishu_user_id,
    operator_name: row.operator_name,
    operator_email: row.operator_email,
    target_account: row.target_account,
    status: row.status,
    message: row.message,
    metadata: row.metadata,
    created_at: new Date().toISOString(),
  };
  localAudits.unshift(entry);
  if (localAudits.length > MAX_LOCAL_AUDITS) {
    localAudits.length = MAX_LOCAL_AUDITS;
  }
  persistLocalAuditsToFile();
  return entry.id;
}

function listLocalAudits({ page = 1, pageSize = 20, platform = null, action = null } = {}) {
  loadLocalAuditsFromFile();
  let items = [...localAudits];
  if (platform) items = items.filter((r) => r.platform === platform);
  if (action) items = items.filter((r) => r.action === action);
  const total = items.length;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const slice = items.slice(offset, offset + pageSize);
  return {
    items: slice.map((row) => rowToAudit(row, { compactMetadata: true })),
    total,
    page: Math.max(1, page),
    pageSize,
  };
}

function getLocalAuditById(id) {
  loadLocalAuditsFromFile();
  const numericId = Number(id);
  const row = localAudits.find((item) => Number(item.id) === numericId);
  return row ? rowToAudit(row) : null;
}

function getOperatorKey(row) {
  return row.operator_feishu_user_id
    || row.operatorFeishuUserId
    || row.operator_email
    || row.operatorEmail
    || row.operator_name
    || row.operatorName
    || 'unknown';
}

function getMetadataObject(row) {
  if (!row?.metadata) return {};
  if (typeof row.metadata === 'object') return row.metadata;
  try {
    return JSON.parse(row.metadata);
  } catch {
    return {};
  }
}

function aggregateAuditSummary(rows, { limit = 20 } = {}) {
  const map = new Map();
  for (const row of rows) {
    const item = rowToAudit(row);
    const meta = getMetadataObject(row);
    const key = getOperatorKey(row);
    const entry = map.get(key) || {
      operatorKey: key,
      operatorFeishuUserId: item.operatorFeishuUserId,
      operatorName: item.operatorName || '未知用户',
      operatorEmail: item.operatorEmail,
      totalRequests: 0,
      successCount: 0,
      blockedCount: 0,
      failedCount: 0,
      quotaAmount: 0,
      quotaByKey: {},
      lastAt: null,
      lastAtFormatted: '-',
    };

    entry.totalRequests += 1;
    if (item.status === 'success') entry.successCount += 1;
    else if (item.status === 'blocked' || item.status === 'skipped') entry.blockedCount += 1;
    else if (item.status === 'failed') entry.failedCount += 1;

    const quotaKey = meta.quotaKey || 'unknown';
    const amount = Math.max(0, Number(meta.quotaAmount ?? meta.amount) || 0);
    entry.quotaAmount += amount;
    entry.quotaByKey[quotaKey] = (entry.quotaByKey[quotaKey] || 0) + amount;

    const createdAt = item.createdAt || null;
    if (createdAt && (!entry.lastAt || new Date(createdAt).getTime() > new Date(entry.lastAt).getTime())) {
      entry.lastAt = createdAt;
      entry.lastAtFormatted = item.createdAtFormatted;
    }
    map.set(key, entry);
  }

  return [...map.values()]
    .sort((a, b) => (b.quotaAmount - a.quotaAmount) || (b.totalRequests - a.totalRequests))
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

/**
 * @param {object} entry
 */
export async function insertOperationAudit(entry) {
  const profile = entry.operatorProfile ?? null;
  const row = {
    action: entry.action,
    platform: entry.platform ?? null,
    operator_feishu_user_id: profile?.feishu_user_id ?? null,
    operator_name: profile?.user_name ?? null,
    operator_email: profile?.email ?? null,
    target_account: entry.targetAccount ?? null,
    status: entry.status,
    message: entry.message ?? null,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
  };

  if (!isDbEnabled()) {
    return insertLocalAudit(row);
  }

  try {
    const [result] = await getPool().query(
      `INSERT INTO operation_audits (
        action, platform, operator_feishu_user_id, operator_name, operator_email,
        target_account, status, message, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [
        row.action,
        row.platform,
        row.operator_feishu_user_id,
        row.operator_name,
        row.operator_email,
        row.target_account,
        row.status,
        row.message,
        row.metadata,
      ]
    );
    return result.insertId;
  } catch (err) {
    console.warn('[Audit] MySQL 写入失败，回退本地文件:', err.message);
    return insertLocalAudit(row);
  }
}

/** fire-and-forget */
export function recordOperationAudit(entry) {
  insertOperationAudit(entry).catch((err) => {
    console.warn('[Audit] 写入失败:', err.message);
  });
}

export async function listOperationAudits({
  page = 1,
  pageSize = 20,
  platform = null,
  action = null,
} = {}) {
  if (!isDbEnabled()) {
    return listLocalAudits({ page, pageSize, platform, action });
  }

  try {
    const conditions = [];
    const params = [];
    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await getPool().query(
      `SELECT COUNT(*) AS total FROM operation_audits ${where}`,
      params
    );

    const offset = (Math.max(1, page) - 1) * pageSize;
    const [rows] = await getPool().query(
      `SELECT * FROM operation_audits ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return {
      items: rows.map((row) => rowToAudit(row, { compactMetadata: true })),
      total: Number(total) || 0,
      page: Math.max(1, page),
      pageSize,
    };
  } catch (err) {
    console.warn('[Audit] MySQL 读取失败，回退本地文件:', err.message);
    return listLocalAudits({ page, pageSize, platform, action });
  }
}

export async function getOperationAuditById(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  if (!isDbEnabled()) {
    return getLocalAuditById(numericId);
  }

  try {
    const [rows] = await getPool().query(
      'SELECT * FROM operation_audits WHERE id = ? LIMIT 1',
      [numericId]
    );
    return rows[0] ? rowToAudit(rows[0]) : null;
  } catch (err) {
    console.warn('[Audit] MySQL 读取详情失败，回退本地文件:', err.message);
    return getLocalAuditById(numericId);
  }
}

export async function summarizeOperationAudits({
  platform = null,
  action = AUDIT_ACTION.PLATFORM_REQUEST,
  days = 7,
  limit = 20,
  maxRows = 5000,
} = {}) {
  const safeDays = Math.min(365, Math.max(1, parseInt(days, 10) || 7));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safeMaxRows = Math.min(20000, Math.max(100, parseInt(maxRows, 10) || 5000));
  const sinceMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;

  if (!isDbEnabled()) {
    loadLocalAuditsFromFile();
    const rows = localAudits.filter((row) => {
      if (platform && row.platform !== platform) return false;
      if (action && row.action !== action) return false;
      const createdAt = normalizeCreatedAtValue(row.created_at ?? row.createdAt);
      if (!createdAt) return true;
      return new Date(createdAt).getTime() >= sinceMs;
    });
    return {
      items: aggregateAuditSummary(rows, { limit: safeLimit }),
      days: safeDays,
      scanned: rows.length,
    };
  }

  try {
    const conditions = ['created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)'];
    const params = [safeDays];
    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    const [rows] = await getPool().query(
      `SELECT * FROM operation_audits
       WHERE ${conditions.join(' AND ')}
       ORDER BY id DESC
       LIMIT ?`,
      [...params, safeMaxRows]
    );
    return {
      items: aggregateAuditSummary(rows, { limit: safeLimit }),
      days: safeDays,
      scanned: rows.length,
    };
  } catch (err) {
    console.warn('[Audit] MySQL 聚合失败，回退本地文件:', err.message);
    loadLocalAuditsFromFile();
    const rows = localAudits.filter((row) => {
      if (platform && row.platform !== platform) return false;
      if (action && row.action !== action) return false;
      const createdAt = normalizeCreatedAtValue(row.created_at ?? row.createdAt);
      if (!createdAt) return true;
      return new Date(createdAt).getTime() >= sinceMs;
    });
    return {
      items: aggregateAuditSummary(rows, { limit: safeLimit }),
      days: safeDays,
      scanned: rows.length,
    };
  }
}

export function getAuditStorageMode() {
  return isDbEnabled() ? 'mysql' : 'file';
}
