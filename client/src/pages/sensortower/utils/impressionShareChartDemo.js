import { resampleChartSeries } from './impressionShareChartAxis.js';

/** 按国家细分 — 绝对份额（约 0–35%），堆叠前由图表归一化到 100% */
export const DEMO_COUNTRY_CHART_SERIES = [
  { id: 'US', name: 'USA', color: '#5e35b1', values: [0.32, 0.298, 0.285, 0.276, 0.283] },
  { id: 'IN', name: 'India', color: '#4fc3f7', values: [0.145, 0.158, 0.172, 0.184, 0.194] },
  { id: 'ID', name: 'Indonesia', color: '#00897b', values: [0.053, 0.062, 0.071, 0.082, 0.091] },
  { id: 'CA', name: 'Canada', color: '#8d2848', values: [0.048, 0.049, 0.05, 0.051, 0.052] },
  { id: 'BR', name: 'Brazil', color: '#f9a825', values: [0.038, 0.039, 0.04, 0.041, 0.042] },
];

/** 统一应用 — 与官方 tooltip 量级接近（Facebook ~0.61%, Instagram ~0.30%） */
const DEMO_APP_VALUES = {
  '55c527c302ac64f9c0002b18': [0.0063, 0.0062, 0.00618, 0.00612, 0.006137],
  '55c530a702ac64f9c0002dff': [0.0029, 0.003, 0.00302, 0.00304, 0.003053],
};

function baseSeriesForBreakdown(breakdownId, tableRows) {
  if (breakdownId === 'country') {
    return DEMO_COUNTRY_CHART_SERIES;
  }
  return (tableRows || []).map((row) => ({
    id: row.unifiedAppId,
    name: row.name,
    color: row.accent || '#5c6bc0',
    values: DEMO_APP_VALUES[row.unifiedAppId] || [0.001, 0.0011, 0.0012, 0.0011, 0.001],
  }));
}

/** @param {number} pointCount 与 buildChartDateAxis 的 pointCount 一致 */
export function buildChartSeriesForBreakdown(breakdownId, tableRows, pointCount = 5) {
  const base = baseSeriesForBreakdown(breakdownId, tableRows);
  return resampleChartSeries(base, Math.max(2, pointCount));
}
