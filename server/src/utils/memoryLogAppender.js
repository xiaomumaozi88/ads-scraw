/**
 * 系统日志：内存缓冲 + MySQL（若已配置）
 */
export {
  pushSystemLog as pushMemoryLog,
  getRecentSystemLogs as getRecentLogs,
  getRecentLogsSync,
  refreshLogsCacheFromDb,
  clearSystemLogs as clearLogs,
} from '../repositories/systemLogRepository.js';
