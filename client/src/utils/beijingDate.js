import dayjs from 'dayjs';

/** 当前“北京日期”的 YYYY-MM-DD（广大大按北京时间） */
export function getTodayBeijingStr() {
  const d = new Date();
  const beijing = new Date(d.getTime() + 8 * 3600 * 1000);
  const y = beijing.getUTCFullYear();
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 返回表示“北京今天”的 dayjs 实例（仅用于 .format/.subtract，不依赖 utcOffset 插件） */
export function getTodayBeijingDayjs() {
  return dayjs(getTodayBeijingStr());
}
