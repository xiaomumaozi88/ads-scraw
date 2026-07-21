import { isDbEnabled, getPool } from '../db/pool.js';

const MAX_MEMORY = 100;
const memoryEntries = [];

function rowToEntry(row) {
  return {
    time: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    level: row.level,
    message: row.message,
  };
}

export function pushSystemLog(levelStr, message) {
  const time = new Date().toISOString();
  const level = String(levelStr).toUpperCase();
  const msg = String(message).trim();
  memoryEntries.push({ time, level, message: msg });
  if (memoryEntries.length > MAX_MEMORY) memoryEntries.shift();

  if (isDbEnabled()) {
    getPool()
      .query('INSERT INTO system_logs (level, message) VALUES (?, ?)', [level, msg])
      .catch(() => {});
  }
}

export async function getRecentSystemLogs(n = 50, levelFilter = null) {
  if (isDbEnabled()) {
    try {
      let sql = 'SELECT level, message, created_at FROM system_logs';
      const params = [];
      if (levelFilter === 'error') {
        sql += ' WHERE level = ?';
        params.push('ERROR');
      } else if (levelFilter === 'warn') {
        sql += ' WHERE level IN (?, ?)';
        params.push('ERROR', 'WARN');
      }
      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(n);
      const [rows] = await getPool().query(sql, params);
      return rows.reverse().map(rowToEntry);
    } catch {
      /* fallback memory */
    }
  }

  const list = memoryEntries.slice(-n);
  if (levelFilter === 'error') {
    return list.filter((e) => e.level === 'ERROR');
  }
  if (levelFilter === 'warn') {
    return list.filter((e) => ['ERROR', 'WARN'].includes(e.level));
  }
  return list;
}

/** 同步包装，供 health 控制器使用 */
export function getRecentLogsSync(n = 50, levelFilter = null) {
  if (!isDbEnabled()) {
    const list = memoryEntries.slice(-n);
    if (levelFilter === 'error') return list.filter((e) => e.level === 'ERROR');
    if (levelFilter === 'warn') return list.filter((e) => ['ERROR', 'WARN'].includes(e.level));
    return list;
  }
  return memoryEntries.slice(-n);
}

export async function refreshLogsCacheFromDb(n = 80) {
  if (!isDbEnabled()) return;
  try {
    const logs = await getRecentSystemLogs(n);
    memoryEntries.length = 0;
    memoryEntries.push(...logs.slice(-MAX_MEMORY));
  } catch {
    /* ignore */
  }
}

export async function clearSystemLogs() {
  memoryEntries.length = 0;
  if (isDbEnabled()) {
    await getPool().query('DELETE FROM system_logs');
  }
}
