/** Sensor Tower 创意库 — 网络、广告类型、默认应用等 */
export {
  getAllGalleryRegionCodes,
  getRegionByCode,
  getRegionFlagUrl,
  getRegionFlagIconClass,
  GALLERY_REGION_CODES,
  GALLERY_REGIONS,
} from './galleryRegionCodes.js';

export const GALLERY_MOBILE_AD_NETWORKS = [
  'Admob',
  'Applovin',
  'BidMachine',
  'Chartboost',
  'Digital Turbine',
  'Supersonic',
  'InMobi',
  'Meta Audience Network',
  'Mintegral',
  'Moloco',
  'Pangle',
  'Smaato',
  'Unity',
  'Verve',
  'Vungle',
];

/** 社交网络：Facebook、Instagram、LINE 等；其余见移动应用广告网络 */
export const GALLERY_SOCIAL_NETWORKS = [
  'Facebook',
  'Instagram',
  'Line',
  'Pinterest',
  'Snapchat',
  'TikTok',
  'Twitter',
  'Youtube',
];

export const GALLERY_NETWORKS = [
  ...GALLERY_MOBILE_AD_NETWORKS,
  ...GALLERY_SOCIAL_NETWORKS,
];

const GALLERY_NETWORK_DISPLAY_LABELS = {
  Admob: 'AdMob',
  Applovin: 'AppLovin',
  Supersonic: 'ironSource',
  Vungle: 'Liftoff',
  Line: 'LINE',
  Twitter: 'X (formerly Twitter)',
  Youtube: 'YouTube',
};

function toGalleryNetworkOption(value) {
  return { value, label: GALLERY_NETWORK_DISPLAY_LABELS[value] ?? value };
}

export const GALLERY_NETWORK_OPTION_GROUPS = [
  {
    id: 'mobile',
    label: '移动应用广告网络',
    options: GALLERY_MOBILE_AD_NETWORKS.map(toGalleryNetworkOption),
  },
  {
    id: 'social',
    label: '社交网络',
    options: GALLERY_SOCIAL_NETWORKS.map(toGalleryNetworkOption),
  },
];

/** 不含 Google Play（App Store / ios 平台） */
export const GALLERY_AD_TYPE_OPTION_GROUPS_APPLE = [
  {
    id: 'video',
    label: '视频',
    options: [
      { value: 'video-interstitial', label: '插页' },
      { value: 'video-rewarded', label: '奖励' },
      { value: 'video-other', label: '其他' },
    ],
  },
  {
    id: 'image',
    label: '图片',
    options: [
      { value: 'image-interstitial', label: '插页广告' },
      { value: 'image-banner', label: '横幅' },
      { value: 'image-other', label: '其他' },
    ],
  },
];

/** 含 Google Play（android / 双平台） */
export const GALLERY_AD_TYPE_OPTION_GROUPS_GOOGLE = [
  {
    id: 'video',
    label: '视频',
    options: [
      { value: 'video-interstitial', label: '插页广告' },
      { value: 'video-rewarded', label: '奖励' },
      { value: 'video-other', label: '其他' },
    ],
  },
  {
    id: 'playable',
    label: '试玩',
    options: [
      { value: 'interactive-playable-rewarded', label: '奖励' },
      { value: 'interactive-playable-other', label: '其他' },
    ],
  },
  {
    id: 'image',
    label: '图片',
    options: [
      { value: 'image-banner', label: '横幅' },
      { value: 'image-other', label: '其他' },
    ],
  },
];

/** @deprecated 请用 getGalleryAdTypeOptionGroups(platformId) */
export const GALLERY_AD_TYPE_OPTION_GROUPS = GALLERY_AD_TYPE_OPTION_GROUPS_GOOGLE;

export function galleryPlatformIncludesGoogle(platformId) {
  return platformId === 'android' || platformId === 'unified';
}

export function getGalleryAdTypeOptionGroups(platformId) {
  return galleryPlatformIncludesGoogle(platformId)
    ? GALLERY_AD_TYPE_OPTION_GROUPS_GOOGLE
    : GALLERY_AD_TYPE_OPTION_GROUPS_APPLE;
}

/** 扁平列表（标签查找；同 value 以含 Google 模板为准） */
export const GALLERY_AD_TYPES = (() => {
  const byValue = new Map();
  for (const group of [
    ...GALLERY_AD_TYPE_OPTION_GROUPS_APPLE,
    ...GALLERY_AD_TYPE_OPTION_GROUPS_GOOGLE,
  ]) {
    for (const opt of group.options) {
      byValue.set(opt.value, opt);
    }
  }
  return [...byValue.values()];
})();

/** ad_objectives */
export const GALLERY_AD_OBJECTIVES = [
  { value: 'other', label: '其他' },
  { value: 'app_install', label: '应用安装' },
  { value: 'app_engagement', label: '应用互动' },
];

/** aspect_ratios */
export const GALLERY_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
  { value: '1.91:1', label: '1.91:1' },
  { value: '16:9', label: '16:9' },
  { value: '2:3', label: '2:3' },
  { value: 'other', label: '其他' },
];

/**
 * video_durations（API filter_video_duration；若与线上一致以 filter_counts 返回为准）
 */
export const GALLERY_VIDEO_DURATIONS = [
  { value: '0-15', label: '0-15 秒' },
  { value: '15-30', label: '15-30 秒' },
  { value: '30-60', label: '30-60 秒' },
  { value: '60+', label: '60 秒以上' },
];

/**
 * banner_dimensions（API filter_banner_dimensions）
 */
export const GALLERY_BANNER_DIMENSIONS = [
  { value: '320x50', label: '320×50' },
  { value: '300x250', label: '300×250' },
  { value: '728x90', label: '728×90' },
  { value: '300x600', label: '300×600' },
  { value: '1080x1920', label: '1080×1920' },
  { value: 'other', label: '其他' },
];

/** 广告位（filter_placement，与官方创意库筛选一致） */
export const GALLERY_PLACEMENTS = [
  { value: 'short-video', label: '短视频' },
  { value: 'other', label: '其他' },
  { value: 'search', label: '搜索' },
  { value: 'feed', label: '信息流' },
  { value: 'in-stream', label: 'In-Stream (信息流)' },
  { value: 'player', label: 'In-Stream (信息流)' },
  { value: 'reels', label: 'Reels (短视频)' },
  { value: 'stories', label: 'Stories (故事)' },
];

export const GALLERY_PLATFORMS = [
  { id: 'ios', label: 'App Store', icon: '', title: 'App Store' },
  { id: 'android', label: 'Google Play', icon: '▶', title: 'Google Play' },
  { id: 'unified', label: '双平台', icon: '⊞', title: '双平台' },
];

/** 侧栏排序（对应官方 sort_by） */
export const GALLERY_SORT_OPTIONS = [
  { id: 'share', label: '展示份额', orderField: 'grouped_creative_share', orderDir: 'desc' },
  { id: 'firstSeen', label: '首次看到', orderField: 'grouped_creative_first_seen_at', orderDir: 'desc' },
  { id: 'lastSeen', label: '最后看到', orderField: 'grouped_creative_last_seen_at', orderDir: 'desc' },
  { id: 'duration', label: '持续时间', orderField: 'grouped_creative_duration', orderDir: 'desc' },
];

/** 默认不预置应用，须通过「添加应用」搜索后选择 */
export const DEFAULT_GALLERY_APPS = [];

/** 侧栏日期预设（与官方创意库一致） */
export const DATE_PRESETS = [
  { id: 'last7', label: '过去 7 天' },
  { id: 'last14', label: '过去 14 天' },
  { id: 'last30', label: '最近 30 天' },
  { id: 'monthToDate', label: '月初至今' },
  { id: 'quarterToDate', label: '季度至今' },
  { id: 'yearToDate', label: '今年迄今为止' },
];

export const CREATIVES_PAGE_SIZE = 100;

export const GALLERY_PAGE_SIZE_OPTIONS = [25, 50, 100];

export const GALLERY_DEFAULT_PAGE_SIZE = 25;

/** 列表 / 网格视图 */
export const GALLERY_VIEW_MODES = {
  grid: 'grid',
  list: 'list',
};
