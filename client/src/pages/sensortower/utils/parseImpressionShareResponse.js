import { getRegionByCode } from '../constants/galleryRegionCodes.js';
import { resolveBreakdownSpec } from '../constants/impressionShareConstants.js';
import { getNetworkColor } from './formatGallery.js';
import { toIsoDate } from './buildGalleryFilters.js';
import { startOfDay } from './galleryDatePresets.js';

const COUNTRY_COLORS = ['#5e35b1', '#4fc3f7', '#00897b', '#8d2848', '#f9a825', '#3949ab', '#ef5350', '#66bb6a'];

function normalizeDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return toIsoDate(startOfDay(d));
}

function computeGrowthPercent(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return 0;
  return ((c - p) / p) * 100;
}

function resolveRowId(row, breakdownAlias) {
  return String(
    row[breakdownAlias] ??
      row.country ??
      row.unifiedAppId ??
      row.unified_app_id ??
      row.network ??
      row.adPlatform ??
      row.ad_platform ??
      ''
  ).trim();
}

function resolveRowName(id, breakdownId, row, appsById) {
  if (breakdownId === 'country') {
    return getRegionByCode(id)?.nameEn || getRegionByCode(id)?.nameZh || id;
  }
  if (breakdownId === 'unifiedApp') {
    const app = appsById.get(id);
    return app?.name || row.unified_app_name || row.app_name || row.name || id;
  }
  if (breakdownId === 'adSource') {
    return row.network || row.ad_platform || row.name || id;
  }
  return row.name || id;
}

function resolveRowPublisher(id, breakdownId, row, appsById) {
  if (breakdownId === 'unifiedApp') {
    return appsById.get(id)?.publisher || row.publisher_name || row.publisher || '';
  }
  if (breakdownId === 'country') {
    return getRegionByCode(id)?.nameZh || '';
  }
  return row.publisher || '';
}

function resolveRowColor(id, breakdownId, appsById, index) {
  if (breakdownId === 'unifiedApp') {
    return appsById.get(id)?.accent || COUNTRY_COLORS[index % COUNTRY_COLORS.length];
  }
  if (breakdownId === 'adSource') {
    return getNetworkColor(id);
  }
  return COUNTRY_COLORS[index % COUNTRY_COLORS.length];
}

/**
 * @param {object[]} rows API facet rows
 * @param {{ breakdownId: string, adSourceId: string, apps: object[] }} ctx
 */
export function parseImpressionShareTableRows(rows, ctx) {
  const { breakdownAlias } = resolveBreakdownSpec(ctx.breakdownId, ctx.adSourceId);
  const appsById = new Map((ctx.apps || []).map((a) => [a.unifiedAppId, a]));

  return (rows || [])
    .map((row, index) => {
      const id = resolveRowId(row, breakdownAlias);
      if (!id) return null;
      const share = Number(row.impressionShareAbsolute);
      const comparison = Number(row.impressionShareComparison);
      return {
        unifiedAppId: id,
        name: resolveRowName(id, ctx.breakdownId, row, appsById),
        publisher: resolveRowPublisher(id, ctx.breakdownId, row, appsById),
        accent: resolveRowColor(id, ctx.breakdownId, appsById, index),
        sharePercent: Number.isFinite(share) ? share : 0,
        growthPercent: computeGrowthPercent(share, comparison),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.sharePercent - a.sharePercent);
}

export function computeImpressionShareTotal(tableRows) {
  return (tableRows || []).reduce((sum, row) => sum + (Number(row.sharePercent) || 0), 0);
}

/**
 * @param {object[]} rows chart facet rows（含 date + breakdown 维度）
 * @param {{ breakdownId: string, adSourceId: string, apps: object[], axisDates: Date[] }} ctx
 */
export function parseImpressionShareChartSeries(rows, ctx) {
  const { breakdownAlias } = resolveBreakdownSpec(ctx.breakdownId, ctx.adSourceId);
  const appsById = new Map((ctx.apps || []).map((a) => [a.unifiedAppId, a]));
  const dateKeys = (ctx.axisDates || []).map((d) => normalizeDateKey(d));

  const groups = new Map();
  for (const row of rows || []) {
    const id = resolveRowId(row, breakdownAlias);
    if (!id) continue;
    const dateKey = normalizeDateKey(row.date);
    const value = Number(row.impressionShareAbsolute);
    if (!groups.has(id)) groups.set(id, new Map());
    groups.get(id).set(dateKey, Number.isFinite(value) ? value : 0);
  }

  const series = [];
  let index = 0;
  for (const [id, dateMap] of groups) {
    const values = dateKeys.map((dk) => dateMap.get(dk) ?? 0);
    series.push({
      id,
      name: resolveRowName(id, ctx.breakdownId, { [breakdownAlias]: id }, appsById),
      color: resolveRowColor(id, ctx.breakdownId, appsById, index),
      values,
    });
    index += 1;
  }

  return series.sort((a, b) => {
    const sumA = a.values.reduce((s, v) => s + v, 0);
    const sumB = b.values.reduce((s, v) => s + v, 0);
    return sumB - sumA;
  });
}

export function buildSummaryCardsFromTableRows(tableRows) {
  return (tableRows || []).map((row) => ({
    unifiedAppId: row.unifiedAppId,
    name: row.name,
    accent: row.accent,
    growthPercent: row.growthPercent,
  }));
}
