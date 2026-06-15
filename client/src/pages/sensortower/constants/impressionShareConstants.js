/** 曝光份额页 — UI 选项与官方 API / URL 字段对应 */
export { GALLERY_PLATFORMS as IS_PLATFORMS } from './galleryConstants.js';
export { DATE_PRESETS as IS_DATE_PRESETS } from './galleryConstants.js';

/**
 * 曝光份额页「网络」下拉 — 与官方 SelectHierarchical 一致
 * `value` 为 API filters.networks / URL network= 参数
 */
export const IS_IMPRESSION_SHARE_MOBILE_NETWORKS = [
  { value: 'Admob', label: 'AdMob' },
  { value: 'Applovin', label: 'AppLovin' },
  { value: 'BidMachine', label: 'BidMachine' },
  { value: 'Chartboost', label: 'Chartboost' },
  { value: 'Digital Turbine', label: 'Digital Turbine' },
  { value: 'InMobi', label: 'InMobi' },
  { value: 'Supersonic', label: 'ironSource' },
  { value: 'Vungle', label: 'Liftoff' },
  { value: 'Meta Audience Network', label: 'Meta Audience Network' },
  { value: 'Mintegral', label: 'Mintegral' },
  { value: 'Moloco', label: 'Moloco' },
  { value: 'Pangle', label: 'Pangle' },
  { value: 'Smaato', label: 'Smaato' },
  { value: 'Unity', label: 'Unity' },
  { value: 'Verve', label: 'Verve' },
];

export const IS_IMPRESSION_SHARE_SOCIAL_NETWORKS = [
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Line', label: 'LINE' },
  { value: 'Pinterest', label: 'Pinterest' },
  { value: 'Snapchat', label: 'Snapchat' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Twitter', label: 'X (formerly Twitter)' },
  { value: 'Youtube', label: 'YouTube' },
];

export const IS_NETWORK_OPTION_GROUPS = [
  {
    id: 'mobile',
    label: '移动应用广告网络',
    options: IS_IMPRESSION_SHARE_MOBILE_NETWORKS,
  },
  {
    id: 'social',
    label: '社交网络',
    options: IS_IMPRESSION_SHARE_SOCIAL_NETWORKS,
  },
];

/** 全部网络 API 值（移动应用广告网络 + 社交网络） */
export const IS_NETWORKS = [
  ...IS_IMPRESSION_SHARE_MOBILE_NETWORKS.map((n) => n.value),
  ...IS_IMPRESSION_SHARE_SOCIAL_NETWORKS.map((n) => n.value),
];

export const IS_QUERY_IDS = {
  chart: 'impression_share_chart',
  table: 'impression_share_table',
};

/** 侧栏指标（当前仅展示份额） */
export const IS_METRICS = [{ id: 'impressionShare', label: '展示份额' }];

/**
 * 报告选项 · 图表类型（与官方侧栏四图标一致）
 * URL chart_plotting_type：line | area(市场份额) | bar(分组栏) | stacked(堆叠栏)
 */
export const IS_CHART_TYPES = [
  {
    id: 'line',
    label: '线',
    title: '折线图',
    icon: 'line',
    urlChartPlottingType: 'line',
    yScale: 'absolute',
    chartHeading: null,
  },
  {
    id: 'marketShare',
    label: '市场份额',
    title: '市场份额',
    icon: 'marketShare',
    urlChartPlottingType: 'area',
    yScale: 'percent100',
    chartHeading: '市场份额 (展示份额)',
  },
  {
    id: 'groupedBar',
    label: '分组栏',
    title: '分组柱状图',
    icon: 'groupedBar',
    urlChartPlottingType: 'bar',
    yScale: 'absolute',
    chartHeading: null,
  },
  {
    id: 'stackedBar',
    label: '堆叠栏',
    title: '堆叠柱状图',
    icon: 'stackedBar',
    urlChartPlottingType: 'stacked',
    yScale: 'percent100',
    chartHeading: null,
  },
];

/** 旧版 id 迁移 */
export const IS_CHART_TYPE_LEGACY_MAP = {
  area: 'marketShare',
  bar: 'groupedBar',
};

/** 广告来源 → filters 用 networks 或 ad_platforms；URL platform_type */
export const IS_AD_SOURCES = [
  {
    id: 'networks',
    label: '网络',
    platformType: 'networks',
    filterKey: 'networks',
    toolbarLabel: '所有网络',
    toolbarColumnTitle: '网络',
  },
  {
    id: 'buyingPlatform',
    label: '购买平台',
    platformType: 'adPlatforms',
    filterKey: 'ad_platforms',
    toolbarLabel: '所有购买平台',
    toolbarColumnTitle: '购买平台',
  },
];

/**
 * 细分 → breakdowns 使用 alias；dimensionFacet 须出现在 facets 中
 */
export const IS_BREAKDOWNS = [
  {
    id: 'unifiedApp',
    label: '统一应用',
    breakdownAlias: 'unifiedAppId',
    dimensionFacet: { facet: 'unified_app_id', alias: 'unifiedAppId' },
    urlBreakdownAttribute: 'unifiedAppId',
    titleSuffix: '统一应用',
  },
  {
    id: 'adSource',
    label: '广告来源',
    breakdownAliasNetworks: 'network',
    dimensionFacetNetworks: { facet: 'network', alias: 'network' },
    breakdownAliasAdPlatforms: 'adPlatform',
    dimensionFacetAdPlatforms: { facet: 'ad_platform', alias: 'adPlatform' },
    urlBreakdownAttribute: 'network',
    titleSuffix: '广告来源',
  },
  {
    id: 'country',
    label: '国家',
    breakdownAlias: 'country',
    dimensionFacet: { facet: 'region', alias: 'country' },
    urlBreakdownAttribute: 'country',
    titleSuffix: '国家',
  },
];

/**
 * 展示份额指标选项 → impression_share.relative_to；URL impression_share_metric_option
 */
export const IS_METRIC_OPTIONS = [
  {
    id: 'marketShare',
    label: '市场占比 (%)',
    relativeTo: 'all',
    urlImpressionShareMetricOption: 'all',
  },
  {
    id: 'selectedAppShare',
    label: '所选应用占比 (%)',
    relativeTo: 'selected',
    urlImpressionShareMetricOption: 'selected',
  },
];

/**
 * 日期颗粒度 → date facet granularity；URL granularity；是否对齐周/月边界
 */
export const IS_GRANULARITIES = [
  { id: 'auto', label: '自动 (日)', apiGranularity: 'day', urlGranularity: 'auto', alignRange: false },
  { id: 'day', label: '日', apiGranularity: 'day', urlGranularity: 'daily', alignRange: false },
  { id: 'week', label: '周', apiGranularity: 'week', urlGranularity: 'weekly', alignRange: 'week' },
  { id: 'month', label: '月', apiGranularity: 'month', urlGranularity: 'monthly', alignRange: 'month' },
  { id: 'quarter', label: '季度', apiGranularity: 'quarter', urlGranularity: 'quarterly', alignRange: 'quarter' },
];

/** 平台 → URL os + device */
export const IS_PLATFORM_DEVICES = {
  ios: ['iphone', 'ipad'],
  android: ['android'],
  unified: ['iphone', 'ipad', 'android'],
};

export const IS_PLATFORM_OS = {
  ios: 'ios',
  android: 'android',
  unified: 'unified',
};

/** 购买平台 filters.ad_platforms（来自官方抓包） */
export const IS_AD_PLATFORMS = [
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_ads', label: 'Instagram Ads' },
  { value: 'meta_audience_network_ads', label: 'Meta Audience Network' },
  { value: 'pinterest_ads', label: 'Pinterest Ads' },
  { value: 'tiktok_ads', label: 'TikTok Ads' },
  { value: 'snap_ads', label: 'Snapchat Ads' },
  { value: 'line_ads', label: 'LINE Ads' },
  { value: 'admob_ads', label: 'AdMob Ads' },
  { value: 'youtube_ads', label: 'YouTube Ads' },
  { value: 'applovin_ads', label: 'AppLovin Ads' },
  { value: 'appodeal', label: 'Appodeal' },
  { value: 'chartboost_ads', label: 'Chartboost Ads' },
  { value: 'digital_turbine_ads', label: 'Digital Turbine Ads' },
  { value: 'inmobi_ads', label: 'InMobi Ads' },
  { value: 'mintegral_ads', label: 'Mintegral Ads' },
  { value: 'moloco_ads', label: 'Moloco Ads' },
  { value: 'naver_ads', label: 'Naver Ads' },
  { value: 'verve_ads', label: 'Verve Ads' },
  { value: 'unity_ads', label: 'Unity Ads' },
  { value: 'liftoff_ads', label: 'Liftoff Ads' },
  { value: 'appier', label: 'Appier' },
  { value: 'bidease', label: 'BidMachine / Bidease' },
  { value: 'bigo', label: 'Bigo' },
  { value: 'criteo', label: 'Criteo' },
  { value: 'equativ', label: 'Equativ' },
  { value: 'jampp', label: 'Jampp' },
  { value: 'opera', label: 'Opera' },
  { value: 'personaly', label: 'Persona.ly' },
  { value: 'smadex', label: 'Smadex' },
  { value: 'yandex', label: 'Yandex' },
  { value: 'other', label: '其他' },
];

export const IS_DEFAULT_AD_PLATFORM_VALUES = IS_AD_PLATFORMS.map((p) => p.value);

/** UI 框架演示用默认应用 */
export const DEFAULT_IMPRESSION_SHARE_APPS = [
  {
    unifiedAppId: '55c527c302ac64f9c0002b18',
    name: 'Facebook',
    publisher: 'Meta Platforms, Inc.',
    accent: '#673ab7',
    iosCount: 2,
    androidCount: 2,
    selected: true,
  },
  {
    unifiedAppId: '55c530a702ac64f9c0002dff',
    name: 'Instagram',
    publisher: 'Instagram, Inc.',
    accent: '#29b6f6',
    iosCount: 1,
    androidCount: 3,
    selected: true,
  },
];

export const DEMO_IMPRESSION_SHARE_ROWS = [
  {
    unifiedAppId: '55c527c302ac64f9c0002b18',
    name: 'Facebook',
    publisher: 'Meta Platforms, Inc.',
    accent: '#673ab7',
    sharePercent: 0.4209,
    growthPercent: -0.87,
  },
  {
    unifiedAppId: '55c530a702ac64f9c0002dff',
    name: 'Instagram',
    publisher: 'Instagram, Inc.',
    accent: '#29b6f6',
    sharePercent: 0.3,
    growthPercent: 10.97,
  },
];

export const DEMO_IMPRESSION_SHARE_TOTAL = 0.721;

export function getBreakdownById(id) {
  return IS_BREAKDOWNS.find((b) => b.id === id) ?? IS_BREAKDOWNS[0];
}

export function getMetricOptionById(id) {
  return IS_METRIC_OPTIONS.find((m) => m.id === id) ?? IS_METRIC_OPTIONS[0];
}

export function getGranularityById(id) {
  return IS_GRANULARITIES.find((g) => g.id === id) ?? IS_GRANULARITIES[0];
}

export function getAdSourceById(id) {
  return IS_AD_SOURCES.find((s) => s.id === id) ?? IS_AD_SOURCES[0];
}

export function getChartTypeById(id) {
  const resolved = IS_CHART_TYPE_LEGACY_MAP[id] || id;
  return IS_CHART_TYPES.find((c) => c.id === resolved) ?? IS_CHART_TYPES[0];
}

/** 解析细分对应的 breakdown alias 与 dimension facet（breakdowns 须用 alias） */
export function resolveBreakdownSpec(breakdownId, adSourceId) {
  const b = getBreakdownById(breakdownId);
  if (breakdownId === 'adSource') {
    if (adSourceId === 'buyingPlatform') {
      return {
        breakdownAlias: b.breakdownAliasAdPlatforms,
        dimensionFacet: b.dimensionFacetAdPlatforms,
      };
    }
    return {
      breakdownAlias: b.breakdownAliasNetworks,
      dimensionFacet: b.dimensionFacetNetworks,
    };
  }
  return {
    breakdownAlias: b.breakdownAlias,
    dimensionFacet: b.dimensionFacet,
  };
}

/** @deprecated 使用 resolveBreakdownSpec().breakdownAlias */
export function resolveBreakdownKey(breakdownId, adSourceId) {
  return resolveBreakdownSpec(breakdownId, adSourceId).breakdownAlias;
}
