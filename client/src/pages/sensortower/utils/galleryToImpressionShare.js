import { getAllGalleryRegionCodes } from '../constants/galleryRegionCodes.js';
import {
  getAdSourceById,
  getChartTypeById,
  getGranularityById,
  getMetricOptionById,
  IS_AD_SOURCES,
  IS_CHART_TYPES,
  IS_GRANULARITIES,
  IS_METRIC_OPTIONS,
  IS_NETWORKS,
  IS_PLATFORM_DEVICES,
  IS_PLATFORM_OS,
} from '../constants/impressionShareConstants.js';
import { CUSTOM_DATE_PRESET_ID, startOfDay } from './galleryDatePresets.js';
import { toIsoDate } from './buildGalleryFilters.js';
import { saveImpressionShareAppsToStorage } from './impressionShareAppsStorage.js';

function appendRepeated(params, key, values) {
  for (const v of values || []) {
    if (v != null && v !== '') params.append(key, String(v));
  }
}

function buildRegions(allRegions, selectedRegions) {
  const picked = (selectedRegions || []).filter(Boolean);
  if (allRegions || picked.length === 0) return getAllGalleryRegionCodes();
  return picked;
}

function computeDurationParam(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return `P${days}D`;
}

function collectStoreAppIds(apps, platformId) {
  const sia = [];
  const saa = [];
  for (const app of apps || []) {
    if (!app?.selected) continue;
    if (platformId === 'ios' || platformId === 'unified') {
      for (const v of app.iosApps || []) {
        if (v.selected !== false && v.id) sia.push(String(v.id));
      }
    }
    if (platformId === 'android' || platformId === 'unified') {
      for (const v of app.androidApps || []) {
        if (v.selected !== false && v.id) saa.push(String(v.id));
      }
    }
  }
  return { sia: [...new Set(sia)], saa: [...new Set(saa)] };
}

/** 将创意库已选应用同步到曝光份额 localStorage */
export function syncGalleryAppsToImpressionShare(apps) {
  const selected = (apps || [])
    .filter((a) => a.selected)
    .map((app) => ({
      unifiedAppId: app.unifiedAppId,
      name: app.name,
      publisher: app.publisher,
      iconUrl: app.iconUrl,
      accent: app.accent,
      iosCount: app.iosCount ?? app.iosApps?.length ?? 0,
      androidCount: app.androidCount ?? app.androidApps?.length ?? 0,
      selected: true,
      iosApps: app.iosApps ?? [],
      androidApps: app.androidApps ?? [],
      downloads: app.downloads,
      revenue: app.revenue,
    }));
  saveImpressionShareAppsToStorage(selected);
  return selected;
}

/**
 * 从创意库状态构建曝光份额页 URL 参数（对齐官方 impression-share 链接格式）
 */
export function buildGalleryToImpressionShareSearchParams({
  platformId,
  startDate,
  endDate,
  allRegions,
  selectedRegions,
  allNetworks,
  selectedNetworks,
  apps,
}) {
  syncGalleryAppsToImpressionShare(apps);

  const selectedApps = (apps || []).filter((a) => a.selected);
  const unifiedAppIds = selectedApps.map((a) => a.unifiedAppId).filter(Boolean);
  const { sia, saa } = collectStoreAppIds(apps, platformId);
  const regions = buildRegions(allRegions, selectedRegions);
  const networks = allNetworks
    ? [...IS_NETWORKS]
    : (selectedNetworks || []).filter(Boolean);

  const gran = getGranularityById('week');
  const metric = getMetricOptionById('marketShare');
  const chartType = getChartTypeById('line');
  const adSource = getAdSourceById('networks');

  const params = new URLSearchParams();
  params.set('page', 'impression-share');
  params.set('os', IS_PLATFORM_OS[platformId] || 'unified');
  params.set('edit', '1');
  params.set('granularity', gran.urlGranularity);
  params.set('start_date', toIsoDate(startDate));
  params.set('end_date', toIsoDate(endDate));
  params.set('duration', computeDurationParam(startDate, endDate));
  appendRepeated(params, 'saa', saa);
  appendRepeated(params, 'sia', sia);
  params.set('chart_plotting_type', chartType.urlChartPlottingType);
  appendRepeated(params, 'country', regions);
  params.set('breakdown_attribute', 'appId');
  appendRepeated(params, 'device', IS_PLATFORM_DEVICES[platformId] || IS_PLATFORM_DEVICES.unified);
  params.set('metricType', 'absolute');
  params.set('time_period', 'day');
  params.set('retention_period', 'day');
  params.set('measure', 'revenue');
  params.set('rolling_days', '0');
  params.set('selected_tab', '0');
  params.set('session_count', 'sessionCount');
  params.set('time_spent', 'timeSpent');
  params.set('install_base_measure', 'installBase');
  params.set('active_user_measure', 'DAU');
  params.set('ad_monetization_measure', 'adImpressions');
  params.set('retention_measure', 'retentionD1');
  params.set('retention_chart_type', 'curve');
  params.set('demographics_measure', 'percentageOfUsers');
  params.set('impression_share_metric_option', metric.urlImpressionShareMetricOption);
  appendRepeated(params, 'network', networks);
  params.set('platform_type', adSource.platformType);
  params.set('ad_monetization_metric', 'adImpressions');
  appendRepeated(params, 'uai', unifiedAppIds);

  return params;
}

function parseIsoDate(value) {
  if (!value) return null;
  const d = startOfDay(new Date(`${value}T12:00:00`));
  return Number.isNaN(d.getTime()) ? null : d;
}

function platformIdFromOs(os) {
  if (os === 'ios') return 'ios';
  if (os === 'android') return 'android';
  return 'unified';
}

function granularityIdFromUrl(urlGranularity) {
  const match = IS_GRANULARITIES.find((g) => g.urlGranularity === urlGranularity);
  return match?.id ?? 'auto';
}

function chartTypeIdFromUrl(urlType) {
  const match = IS_CHART_TYPES.find((c) => c.urlChartPlottingType === urlType);
  return match?.id ?? 'line';
}

function metricOptionIdFromUrl(urlOption) {
  const match = IS_METRIC_OPTIONS.find((m) => m.urlImpressionShareMetricOption === urlOption);
  return match?.id ?? 'marketShare';
}

function adSourceIdFromPlatformType(platformType) {
  const match = IS_AD_SOURCES.find((s) => s.platformType === platformType);
  return match?.id ?? 'networks';
}

function breakdownIdFromUrlAttribute(attr) {
  if (attr === 'country') return 'country';
  if (attr === 'network' || attr === 'adPlatform') return 'adSource';
  return 'unifiedApp';
}

function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}

/**
 * 从 URL 解析曝光份额页初始状态（创意库「分析广告」跳转或带参直达）
 */
export function parseImpressionShareUrlParams(searchParams) {
  if (!searchParams) return null;

  const unifiedAppIds = searchParams.getAll('uai').filter(Boolean);
  const startDateRaw = searchParams.get('start_date');
  const endDateRaw = searchParams.get('end_date');
  if (!unifiedAppIds.length && !(startDateRaw && endDateRaw)) return null;

  const startDate = parseIsoDate(startDateRaw);
  const endDate = parseIsoDate(endDateRaw);
  if (!startDate || !endDate) return null;

  const os = searchParams.get('os') || 'unified';
  const platformId = platformIdFromOs(os);

  const countries = searchParams.getAll('country').filter(Boolean);
  const allRegionCodes = getAllGalleryRegionCodes();
  const allRegions =
    countries.length === 0 || setsEqual([...countries].sort(), [...allRegionCodes].sort());
  const selectedRegions = allRegions ? [] : countries;

  const networks = searchParams.getAll('network').filter(Boolean);
  const allNetworks =
    networks.length === 0 || networks.length >= IS_NETWORKS.length;
  const selectedNetworks = allNetworks ? [] : networks;

  const urlKey = [
    unifiedAppIds.join(','),
    startDateRaw,
    endDateRaw,
    platformId,
    countries.join(','),
    networks.join(','),
  ].join('|');

  return {
    fromGalleryNavigation: true,
    urlKey,
    platformId,
    startDate,
    endDate,
    datePresetId: CUSTOM_DATE_PRESET_ID,
    allRegions,
    selectedRegions,
    allNetworks,
    selectedNetworks,
    granularityId: granularityIdFromUrl(searchParams.get('granularity') || 'auto'),
    chartTypeId: chartTypeIdFromUrl(searchParams.get('chart_plotting_type') || 'line'),
    metricOptionId: metricOptionIdFromUrl(
      searchParams.get('impression_share_metric_option') || 'all'
    ),
    adSourceId: adSourceIdFromPlatformType(searchParams.get('platform_type') || 'networks'),
    breakdownId: breakdownIdFromUrlAttribute(searchParams.get('breakdown_attribute') || 'appId'),
    unifiedAppIds,
  };
}
