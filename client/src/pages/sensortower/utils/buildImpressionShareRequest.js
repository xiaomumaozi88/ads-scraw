import { getAllGalleryRegionCodes } from '../constants/galleryRegionCodes.js';
import {
  getAdSourceById,
  getGranularityById,
  getMetricOptionById,
  IS_DEFAULT_AD_PLATFORM_VALUES,
  IS_NETWORKS,
  IS_PLATFORM_DEVICES,
  IS_PLATFORM_OS,
  IS_QUERY_IDS,
  resolveBreakdownSpec,
} from '../constants/impressionShareConstants.js';
import { isValidUnifiedAppId } from './galleryAppSearch.js';
import { toIsoDate } from './buildGalleryFilters.js';
import { startOfDay } from './galleryDatePresets.js';

function addDays(date, days) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 周一起始（与官方周颗粒度对齐示例一致） */
function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function startOfMonth(date) {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonth(date) {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
}

/**
 * 按颗粒度对齐日期（周/月/季度）；自动(日) 不改动用户选择的日期
 */
export function alignImpressionShareDateRange(startDate, endDate, granularityId) {
  const gran = getGranularityById(granularityId);
  if (!gran.alignRange) {
    return { startDate: startOfDay(startDate), endDate: startOfDay(endDate) };
  }
  if (gran.alignRange === 'week') {
    return {
      startDate: startOfWeekMonday(startDate),
      endDate: endOfWeekSunday(endDate),
    };
  }
  if (gran.alignRange === 'month') {
    return { startDate: startOfMonth(startDate), endDate: endOfMonth(endDate) };
  }
  if (gran.alignRange === 'quarter') {
    const d = startOfDay(startDate);
    const qMonth = Math.floor(d.getMonth() / 3) * 3;
    const qStart = new Date(d.getFullYear(), qMonth, 1, 12, 0, 0, 0);
    const qEndMonth = qMonth + 2;
    const qEnd = new Date(d.getFullYear(), qEndMonth + 1, 0, 12, 0, 0, 0);
    const endAligned = startOfDay(endDate);
    const endQMonth = Math.floor(endAligned.getMonth() / 3) * 3;
    const rangeEnd = new Date(endAligned.getFullYear(), endQMonth + 3, 0, 12, 0, 0, 0);
    return { startDate: qStart, endDate: rangeEnd > qEnd ? rangeEnd : qEnd };
  }
  return { startDate: startOfDay(startDate), endDate: startOfDay(endDate) };
}

/** 表格对比期：紧挨主区间之前的等长区间 */
export function computeComparisonDateRange(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const dayMs = 86400000;
  const days = Math.max(1, Math.round((end - start) / dayMs) + 1);
  const comparisonEnd = addDays(start, -1);
  const comparisonStart = addDays(comparisonEnd, -(days - 1));
  return { comparisonStart, comparisonEnd };
}

function buildRegions(allRegions, selectedRegions) {
  const picked = (selectedRegions || []).filter(Boolean);
  if (allRegions || picked.length === 0) return getAllGalleryRegionCodes();
  return picked;
}

function buildImpressionShareFilters({
  startDate,
  endDate,
  granularityId,
  selectedAppIds,
  allRegions,
  selectedRegions,
  adSourceId,
  allNetworks,
  selectedNetworks,
  allAdPlatforms,
  selectedAdPlatforms,
  includeComparison = false,
}) {
  const { startDate: s, endDate: e } = alignImpressionShareDateRange(
    startDate,
    endDate,
    granularityId
  );

  const unified_app_ids = (selectedAppIds || []).filter((id) => isValidUnifiedAppId(id));
  const regions = buildRegions(allRegions, selectedRegions);
  const source = getAdSourceById(adSourceId);

  const filters = {
    start_date: toIsoDate(s),
    end_date: toIsoDate(e),
    regions,
    unified_app_ids,
  };

  if (source.filterKey === 'networks') {
    filters.networks = allNetworks
      ? [...IS_NETWORKS]
      : (selectedNetworks || []).filter(Boolean);
  } else {
    filters.ad_platforms = allAdPlatforms
      ? [...IS_DEFAULT_AD_PLATFORM_VALUES]
      : (selectedAdPlatforms || []).filter(Boolean);
  }

  if (includeComparison) {
    const { comparisonStart, comparisonEnd } = computeComparisonDateRange(s, e);
    filters.comparison_start_date = toIsoDate(comparisonStart);
    filters.comparison_end_date = toIsoDate(comparisonEnd);
  }

  return filters;
}

function buildChartFacets(relativeTo, dimensionFacet, { includeDate = false, dateGranularity = 'day' } = {}) {
  const facets = [
    dimensionFacet,
    {
      facet: 'impression_share',
      measure: 'absolute',
      alias: 'impressionShareAbsolute',
      relative_to: relativeTo,
    },
  ];
  if (includeDate) {
    facets.push({ facet: 'date', granularity: dateGranularity, alias: 'date' });
  }
  return facets;
}

function buildTableFacets(relativeTo, dimensionFacet) {
  return [
    dimensionFacet,
    {
      facet: 'impression_share',
      measure: 'absolute',
      alias: 'impressionShareAbsolute',
      relative_to: relativeTo,
    },
    {
      facet: 'impression_share',
      measure: 'comparison',
      alias: 'impressionShareComparison',
      relative_to: relativeTo,
    },
  ];
}

/**
 * 由 UI 状态生成 facets 请求体（chart + table）
 */
export function buildImpressionShareRequest(ui) {
  const breakdownId = ui.breakdownId ?? 'unifiedApp';
  const adSourceId = ui.adSourceId ?? 'networks';
  const metricOptionId = ui.metricOptionId ?? 'marketShare';
  const granularityId = ui.granularityId ?? 'auto';

  const metric = getMetricOptionById(metricOptionId);
  const gran = getGranularityById(granularityId);
  const { breakdownAlias, dimensionFacet } = resolveBreakdownSpec(breakdownId, adSourceId);

  const { startDate, endDate } = alignImpressionShareDateRange(
    ui.startDate,
    ui.endDate,
    granularityId
  );

  const selectedAppIds = ui.selectedAppIds ?? [];
  const baseFilterInput = {
    startDate,
    endDate,
    granularityId,
    selectedAppIds,
    allRegions: ui.allRegions,
    selectedRegions: ui.selectedRegions,
    adSourceId,
    allNetworks: ui.allNetworks,
    selectedNetworks: ui.selectedNetworks,
    allAdPlatforms: ui.allAdPlatforms,
    selectedAdPlatforms: ui.selectedAdPlatforms,
  };

  const chartFilters = buildImpressionShareFilters({ ...baseFilterInput, includeComparison: false });
  const tableFilters = buildImpressionShareFilters({ ...baseFilterInput, includeComparison: true });

  const relativeTo = metric.relativeTo;

  const chartBody = {
    breakdowns: [[breakdownAlias, 'date']],
    facets: buildChartFacets(relativeTo, dimensionFacet, {
      includeDate: true,
      dateGranularity: gran.apiGranularity,
    }),
    filters: chartFilters,
    aggregate_tail: {
      breakdown: breakdownAlias,
      value: 'other',
      sort: 'impressionShareAbsolute',
      limit: 10,
    },
  };

  const tableBody = {
    breakdowns: [[breakdownAlias]],
    facets: buildTableFacets(relativeTo, dimensionFacet),
    filters: tableFilters,
    order_by: [{ impressionShareAbsolute: 'desc' }],
  };

  return {
    breakdownAlias,
    dimensionFacet,
    relativeTo,
    alignedStartDate: startDate,
    alignedEndDate: endDate,
    chart: {
      queryIdentifier: IS_QUERY_IDS.chart,
      body: chartBody,
    },
    table: {
      queryIdentifier: IS_QUERY_IDS.table,
      body: tableBody,
    },
  };
}

function appendRepeated(params, key, values) {
  for (const v of values || []) {
    if (v != null && v !== '') params.append(key, String(v));
  }
}

export function buildImpressionShareUrlParams({
  platformId,
  startDate,
  endDate,
  regions,
  unifiedAppIds,
  adSource,
  metric,
  gran,
  breakdownMeta,
  chartType,
  networks,
  adPlatforms,
}) {
  const params = new URLSearchParams();
  params.set('os', IS_PLATFORM_OS[platformId] || 'unified');
  params.set('edit', '1');
  params.set('granularity', gran.urlGranularity);
  params.set('start_date', toIsoDate(startDate));
  params.set('end_date', toIsoDate(endDate));
  params.set('duration', 'P30D');
  params.set('chart_plotting_type', chartType.urlChartPlottingType || 'line');
  appendRepeated(params, 'country', regions);
  params.set('breakdown_attribute', breakdownMeta.urlBreakdownAttribute);
  appendRepeated(params, 'device', IS_PLATFORM_DEVICES[platformId] || IS_PLATFORM_DEVICES.unified);
  params.set('metricType', 'absolute');
  params.set('time_period', gran.apiGranularity === 'week' ? 'week' : 'day');
  params.set('impression_share_metric_option', metric.urlImpressionShareMetricOption);
  params.set('platform_type', adSource.platformType);
  appendRepeated(params, 'uai', unifiedAppIds);
  if (adSource.filterKey === 'networks') {
    appendRepeated(params, 'network', networks);
  }
  return params;
}
