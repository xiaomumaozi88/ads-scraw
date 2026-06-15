import {
  getBreakdownById,
  IS_GRANULARITIES,
  IS_PLATFORMS,
} from '../constants/impressionShareConstants.js';
import { formatDateRangeLabel } from './formatGallery.js';
import { getRegionByCode } from '../constants/galleryRegionCodes.js';

/** API 返回比例为小数（0.002945 表示 0.2945%），展示时 ×100 */
export function shareRatioToPercent(ratio) {
  const n = Number(ratio);
  return Number.isFinite(n) ? n * 100 : NaN;
}

export function formatSharePercent(value, digits) {
  const pct = shareRatioToPercent(value);
  if (!Number.isFinite(pct)) return '—';
  if (digits != null) return `${pct.toFixed(digits)}%`;
  if (pct === 0) return '0%';
  if (pct >= 10) return `${pct.toFixed(2)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  const text = pct.toFixed(3).replace(/\.?0+$/, '');
  return `${text}%`;
}

/** 图表 hover tooltip（与官方一致，如 0.3746%） */
export function formatShareTooltipPercent(value) {
  const pct = shareRatioToPercent(value);
  if (!Number.isFinite(pct)) return '—';
  return `${pct.toFixed(4)}%`;
}

/** 图表 tooltip 日期标题（如 Wednesday, Apr 29, 2026） */
export function formatChartTooltipDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 图表 Y 轴刻度（与官方 0%、0.1%、0.2%… 一致） */
export function formatShareAxisTick(ratio) {
  const pct = shareRatioToPercent(ratio);
  if (!Number.isFinite(pct)) return '—';
  if (Math.abs(pct) < 1e-9) return '0%';
  if (Math.abs(pct - Math.round(pct)) < 0.05) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

export function formatGrowthPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function buildImpressionShareTitle(breakdownId) {
  const breakdown = getBreakdownById(breakdownId);
  return `按${breakdown.titleSuffix || breakdown.label}的展示份额`;
}

export function buildImpressionShareSubtitle({
  platformId,
  startDate,
  endDate,
  allRegions,
  selectedRegions = [],
  granularityId,
}) {
  const platformLabel = IS_PLATFORMS.find((p) => p.id === platformId)?.label || '双平台';
  let regionLabel = '所有国家/地区';
  if (!allRegions) {
    const picked = (selectedRegions || []).filter(Boolean);
    if (picked.length === 1) {
      regionLabel = getRegionByCode(picked[0])?.nameZh || picked[0];
    } else if (picked.length > 1) {
      regionLabel = `${picked.length} 个国家/地区`;
    }
  }
  const gran =
    IS_GRANULARITIES.find((g) => g.id === granularityId)?.label?.replace(/\s*\(.*\)/, '') || '每日';
  const granShort = gran.includes('自动') ? '每日' : gran === '日' ? '每日' : gran === '周' ? '每周' : gran === '月' ? '每月' : gran === '季度' ? '每季度' : gran;
  return `${platformLabel} · ${formatDateRangeLabel(startDate, endDate)} · ${regionLabel} · ${granShort}`;
}
