import { DATE_PRESETS } from '../constants/galleryConstants.js';
import { formatDateRangeLabel } from './formatGallery.js';

export const CUSTOM_DATE_PRESET_ID = 'custom';

export function startOfDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return new Date();
  x.setHours(12, 0, 0, 0);
  return x;
}

/** 根据预设 id 计算起止日期（结束日默认为今天；endOffsetDays 从结束日再往前推） */
export function resolveDatePresetRange(presetId, endDate = new Date(), options = {}) {
  let end = startOfDay(endDate);
  const endOffset = options.endOffsetDays ?? (options.excludeToday ? 1 : 0);
  if (endOffset > 0) {
    end = new Date(end);
    end.setDate(end.getDate() - endOffset);
    end = startOfDay(end);
  }
  switch (presetId) {
    case 'last7': {
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { startDate: start, endDate: end };
    }
    case 'last14': {
      const start = new Date(end);
      start.setDate(start.getDate() - 13);
      return { startDate: start, endDate: end };
    }
    case 'last30': {
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      return { startDate: start, endDate: end };
    }
    case 'monthToDate':
      return {
        startDate: startOfDay(new Date(end.getFullYear(), end.getMonth(), 1)),
        endDate: end,
      };
    case 'quarterToDate': {
      const qMonth = Math.floor(end.getMonth() / 3) * 3;
      return {
        startDate: startOfDay(new Date(end.getFullYear(), qMonth, 1)),
        endDate: end,
      };
    }
    case 'yearToDate':
      return {
        startDate: startOfDay(new Date(end.getFullYear(), 0, 1)),
        endDate: end,
      };
    default:
      return resolveDatePresetRange('last30', endDate, options);
  }
}

export function getPresetRangeSubtitle(presetId, endDate = new Date(), options = {}) {
  const { startDate, endDate: end } = resolveDatePresetRange(presetId, endDate, options);
  return formatDateRangeLabel(startDate, end);
}

export function getDatePresetLabel(presetId) {
  if (presetId === CUSTOM_DATE_PRESET_ID) return '自定义';
  return DATE_PRESETS.find((p) => p.id === presetId)?.label || '最近 30 天';
}

export function formatSlashDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function parseSlashDate(str) {
  const m = String(str || '').trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateKey(d) {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function compareDateKeys(a, b) {
  return toDateKey(a).localeCompare(toDateKey(b));
}

export function isDateInRange(day, start, end) {
  if (!start || !end) return false;
  const k = toDateKey(day);
  return k >= toDateKey(start) && k <= toDateKey(end);
}

export function getCalendarWeeks(year, month) {
  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const start = new Date(first);
  const dow = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - dow);
  const weeks = [];
  let cursor = new Date(start);
  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const GALLERY_DATE_GRANULARITIES = [
  { id: 'daily', label: '日' },
  { id: 'weekly', label: '周' },
  { id: 'monthly', label: '月' },
];
