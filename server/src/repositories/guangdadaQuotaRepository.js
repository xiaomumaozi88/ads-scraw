import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPool, isDbEnabled } from '../db/pool.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../data');
const QUOTA_USAGE_FILE = join(DATA_DIR, 'guangdada-quota-usage.json');

let localLoaded = false;
let localStore = { version: 1, usages: {} };

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function usageId(accountKey, quotaKey, periodKey) {
  return `${accountKey}::${quotaKey}::${periodKey}`;
}

function normalizeUsage(row = {}) {
  return {
    accountKey: row.account_key ?? row.accountKey ?? '',
    quotaKey: row.quota_key ?? row.quotaKey ?? '',
    periodKey: row.period_key ?? row.periodKey ?? '',
    periodStartMs: Number(row.period_start_ms ?? row.periodStartMs) || 0,
    periodEndMs: Number(row.period_end_ms ?? row.periodEndMs) || 0,
    usedCount: Number(row.used_count ?? row.usedCount) || 0,
    lastLimitCount: row.last_limit_count ?? row.lastLimitCount ?? null,
    cycle: row.cycle ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function loadLocalStore() {
  if (localLoaded) return;
  localLoaded = true;
  ensureDataDir();
  if (!existsSync(QUOTA_USAGE_FILE)) {
    localStore = { version: 1, usages: {} };
    return;
  }
  try {
    const parsed = JSON.parse(readFileSync(QUOTA_USAGE_FILE, 'utf8'));
    localStore = {
      version: 1,
      usages: parsed && typeof parsed.usages === 'object' && parsed.usages ? parsed.usages : {},
    };
  } catch {
    localStore = { version: 1, usages: {} };
  }
}

function persistLocalStore() {
  ensureDataDir();
  writeFileSync(QUOTA_USAGE_FILE, JSON.stringify(localStore, null, 2), 'utf8');
}

function getLocalUsage(accountKey, quotaKey, periodKey) {
  loadLocalStore();
  const row = localStore.usages[usageId(accountKey, quotaKey, periodKey)];
  return row ? normalizeUsage(row) : null;
}

function incrementLocalUsage(entry) {
  loadLocalStore();
  const id = usageId(entry.accountKey, entry.quotaKey, entry.periodKey);
  const prev = localStore.usages[id] || {};
  const next = {
    accountKey: entry.accountKey,
    quotaKey: entry.quotaKey,
    periodKey: entry.periodKey,
    periodStartMs: entry.periodStartMs,
    periodEndMs: entry.periodEndMs,
    usedCount: (Number(prev.usedCount) || 0) + entry.amount,
    lastLimitCount: entry.limitCount,
    cycle: entry.cycle,
    updatedAt: new Date().toISOString(),
  };
  localStore.usages[id] = next;
  persistLocalStore();
  return normalizeUsage(next);
}

export async function getQuotaUsage(accountKey, quotaKey, periodKey) {
  if (!isDbEnabled()) {
    return getLocalUsage(accountKey, quotaKey, periodKey);
  }

  try {
    const [rows] = await getPool().query(
      `SELECT account_key, quota_key, period_key, period_start_ms, period_end_ms,
              used_count, last_limit_count, cycle, updated_at
       FROM guangdada_quota_usage
       WHERE account_key = ? AND quota_key = ? AND period_key = ?
       LIMIT 1`,
      [accountKey, quotaKey, periodKey]
    );
    return rows[0] ? normalizeUsage(rows[0]) : null;
  } catch (err) {
    console.warn('[GuangdadaQuota] MySQL 读取失败，回退本地文件:', err.message);
    return getLocalUsage(accountKey, quotaKey, periodKey);
  }
}

export async function incrementQuotaUsage(entry) {
  if (!isDbEnabled()) {
    return incrementLocalUsage(entry);
  }

  try {
    await getPool().query(
      `INSERT INTO guangdada_quota_usage (
        account_key, quota_key, period_key, period_start_ms, period_end_ms,
        used_count, last_limit_count, cycle, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        period_start_ms = VALUES(period_start_ms),
        period_end_ms = VALUES(period_end_ms),
        used_count = used_count + VALUES(used_count),
        last_limit_count = VALUES(last_limit_count),
        cycle = VALUES(cycle),
        updated_at = UTC_TIMESTAMP(3)`,
      [
        entry.accountKey,
        entry.quotaKey,
        entry.periodKey,
        entry.periodStartMs,
        entry.periodEndMs,
        entry.amount,
        entry.limitCount,
        entry.cycle,
      ]
    );
    return getQuotaUsage(entry.accountKey, entry.quotaKey, entry.periodKey);
  } catch (err) {
    console.warn('[GuangdadaQuota] MySQL 写入失败，回退本地文件:', err.message);
    return incrementLocalUsage(entry);
  }
}
