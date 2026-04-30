import { randomUUID } from 'node:crypto';

const MAX_ENTRIES = 40;
const entries = [];

/**
 * 临时调试：记录外部素材查询相关的上游请求体与结果摘要。
 * - 显式 EXTERNAL_SEARCH_DEBUG=1 开启；=0 强制关闭。
 * - 未设置时：非 production 默认开启，production 默认关闭。
 */
export function isExternalSearchDebugEnabled() {
  if (process.env.EXTERNAL_SEARCH_DEBUG === '1') return true;
  if (process.env.EXTERNAL_SEARCH_DEBUG === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export function pushExternalSearchDebugEntry(record) {
  if (!isExternalSearchDebugEnabled()) return;
  entries.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    ...record,
  });
  while (entries.length > MAX_ENTRIES) entries.pop();
}

export function getExternalSearchDebugEntries() {
  return entries.map((e) => ({ ...e }));
}

export function clearExternalSearchDebugEntries() {
  entries.length = 0;
}
