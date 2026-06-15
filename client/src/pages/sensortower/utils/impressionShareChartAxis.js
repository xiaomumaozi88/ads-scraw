import { startOfDay } from './galleryDatePresets.js';
import { alignImpressionShareDateRange } from './buildImpressionShareRequest.js';

function addDays(date, days) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daySpan(startDate, endDate) {
  const a = startOfDay(startDate).getTime();
  const b = startOfDay(endDate).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/**
 * 与官方 impression-share 图表 X 轴一致：
 * - 自动(日)/日：区间内每一天一个刻度
 * - 周/月/季度：按颗粒度步进
 */
export function resolveChartAxisStepDaySpan(dayCount, granularityId) {
  if (granularityId === 'week') return 7;
  if (granularityId === 'month') return 30;
  if (granularityId === 'quarter') return 90;
  if (granularityId === 'auto' || granularityId === 'day') return 1;
  if (dayCount <= 10) return 1;
  return 1;
}

export function formatChartXLabel(date, { showYear = false } = {}) {
  if (showYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** 横轴仅偶数日期（2/4/6…日）展示文案，奇数日期只绘制刻度点 */
export function shouldShowChartXLabelDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDate() % 2 === 0;
}

/** 生成图表 X 轴刻度（日期 + 展示文案） */
export function buildChartDateAxis(startDate, endDate, granularityId) {
  const { startDate: alignedStart, endDate: alignedEnd } = alignImpressionShareDateRange(
    startDate,
    endDate,
    granularityId
  );
  const span = daySpan(alignedStart, alignedEnd);
  const step = resolveChartAxisStepDaySpan(span, granularityId);

  const dates = [];
  let cursor = startOfDay(alignedStart);
  const end = startOfDay(alignedEnd);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, step);
  }

  const last = dates[dates.length - 1];
  if (!last || last.getTime() !== end.getTime()) {
    dates.push(end);
  }

  const labels = dates.map((d, i) => {
    if (!shouldShowChartXLabelDate(d)) return '';
    const isFirstLabel = !dates.slice(0, i).some((prev) => shouldShowChartXLabelDate(prev));
    return formatChartXLabel(d, { showYear: isFirstLabel });
  });

  return { dates, labels, pointCount: dates.length };
}

/** 各系列在每个时间点归一化为 100% 堆叠（市场份额 / 堆叠栏） */
export function normalizeSeriesToFullStack(series) {
  if (!series?.length) return [];
  const n = series[0].values?.length ?? 0;
  const out = series.map((s) => ({ ...s, values: new Array(n).fill(0) }));

  for (let i = 0; i < n; i++) {
    const sum = series.reduce((acc, s) => acc + (Number(s.values[i]) || 0), 0);
    for (let j = 0; j < series.length; j++) {
      const raw = Number(series[j].values[i]) || 0;
      out[j].values[i] = sum > 0 ? raw / sum : 0;
    }
  }
  return out;
}

/** 将种子序列插值/采样到目标点数 */
export function resampleSeriesValues(seedValues, targetCount) {
  if (targetCount <= 0) return [];
  if (targetCount === 1) return [seedValues[0] ?? 0];
  if (!seedValues?.length) return new Array(targetCount).fill(0);

  const result = [];
  for (let i = 0; i < targetCount; i++) {
    const t = i / (targetCount - 1);
    const pos = t * (seedValues.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, seedValues.length - 1);
    const frac = pos - lo;
    result.push(seedValues[lo] * (1 - frac) + seedValues[hi] * frac);
  }
  return result;
}

export function resampleChartSeries(series, targetCount) {
  return series.map((s) => ({
    ...s,
    values: resampleSeriesValues(s.values, targetCount),
  }));
}

/** 100% 堆叠 Y 轴刻度（0/20/40/60/80/100%） */
export const PERCENT100_Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

function chooseShareDisplayStep(displayMaxPct) {
  if (displayMaxPct <= 0.8) return 0.1;
  if (displayMaxPct <= 2) return 0.2;
  if (displayMaxPct <= 5) return 0.5;
  if (displayMaxPct <= 15) return 1;
  if (displayMaxPct <= 40) return 5;
  if (displayMaxPct <= 100) return 10;
  return 20;
}

/**
 * 绝对份额折线/柱状图 Y 轴：按数据最大值取整，步长与官方一致（如 0.1%）
 * @param {number[]} allValues API 比例小数
 */
export function computeAbsoluteShareYAxis(allValues) {
  const finite = (allValues || [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  const dataMax = finite.length ? Math.max(...finite) : 0;

  if (dataMax <= 0) {
    return { maxY: 0.001, yTicks: [0, 0.001] };
  }

  const displayStep = chooseShareDisplayStep(dataMax * 100);
  const stepRatio = displayStep / 100;
  const maxY = Math.max(stepRatio, Math.ceil(dataMax / stepRatio - 1e-9) * stepRatio);
  const yTicks = [];

  for (let t = 0; t <= maxY + 1e-9; t += stepRatio) {
    yTicks.push(Math.round(t * 1e6) / 1e6);
    if (yTicks.length > 12) break;
  }

  if (yTicks.length === 0 || yTicks[yTicks.length - 1] < maxY) {
    yTicks.push(maxY);
  }

  return { maxY, yTicks };
}
