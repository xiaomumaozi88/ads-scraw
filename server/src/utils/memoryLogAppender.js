/**
 * 内存日志：将最近 N 条日志写入内存，供 /health 等诊断页展示（不再依赖 log4js）
 */
const MAX_ENTRIES = 100;
const entries = [];

/**
 * @param {string} levelStr - INFO | WARN | ERROR
 * @param {string} message
 */
export function pushMemoryLog(levelStr, message) {
  const time = new Date().toISOString();
  const level = String(levelStr).toUpperCase();
  entries.push({ time, level, message: String(message).trim() });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

/** 获取最近 N 条日志，默认 50；可只取 error/warn */
export function getRecentLogs(n = 50, levelFilter = null) {
  const list = entries.slice(-n);
  if (levelFilter === 'error' || levelFilter === 'warn') {
    const allow = levelFilter === 'error' ? ['ERROR'] : ['ERROR', 'WARN'];
    return list.filter((e) => allow.includes(e.level));
  }
  return list;
}

/** 清除内存中的日志，供 /health 页「清除日志」使用 */
export function clearLogs() {
  entries.length = 0;
}
