import { toIsoDate } from './buildGalleryFilters.js';
import {
  getGalleryAdTypeOptionGroups,
  GALLERY_PLATFORMS,
} from '../constants/galleryConstants.js';
import { getRegionByCode } from '../constants/galleryRegionCodes.js';

const NETWORK_COLORS = {
  Admob: '#f4b400',
  Youtube: '#ff0000',
  Facebook: '#1877f2',
  Instagram: '#e1306c',
  Unity: '#1a1a1a',
  Vungle: '#00c389',
  Applovin: '#5ac8fa',
};

export function getNetworkColor(network) {
  if (!network) return '#607d8b';
  return NETWORK_COLORS[network] || '#546e7a';
}

/** 创意库行唯一键：同一 grouped_creative_id 可能对应不同 network */
export function getCreativeGalleryRowKey(row) {
  if (!row) return '';
  return `${row.unified_app_id}|${row.grouped_creative_id}|${row.network}`;
}

export function dedupeCreativeGalleryRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const seen = new Set();
  return rows.filter((row) => {
    const key = getCreativeGalleryRowKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatGalleryDate(dateStr) {
  if (!dateStr) return '—';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** 「仅显示新创意」说明文案（日期随筛选开始日变化） */
export function getNewCreativesOnlyTooltip(startDate) {
  const dateLabel = formatGalleryDate(startDate);
  return `开启此功能后仅显示 ${dateLabel} 之后的创意`;
}

/** 「仅限有曝光份额的创意」说明文案 */
export function getCreativesWithImpressionsOnlyTooltip() {
  return '开启后仅显示有展示记录的创意';
}

export function formatDurationLabel(creative) {
  const raw = creative?.grouped_creative_duration;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Number.isFinite(Number(raw)) && Number(raw) > 0) {
    return formatDurationBetweenMs(Number(raw) * 1000);
  }
  return formatDurationBetween(
    creative?.grouped_creative_first_seen_at,
    creative?.grouped_creative_last_seen_at
  );
}

export function formatDurationBetween(first, last) {
  const a = new Date(first).getTime();
  const b = new Date(last).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return '—';
  if (b < a) return '—';
  return formatDurationBetweenMs(b - a);
}

/** 创意投放持续时间：最后看到 − 首次看到 */
export function formatCreativeActiveDuration(firstSeen, lastSeen) {
  return formatDurationBetween(firstSeen, lastSeen);
}

export function normalizeSharePercentValue(share) {
  const n = Number(share);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

export function formatVideoDurationSeconds(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const total = Math.round(n);
  if (total < 60) return `${total}秒`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
}

export function formatCreativeDimensions(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '—';
  return `${Math.round(w)}x${Math.round(h)}`;
}

/** 网格卡片封面比例（优先使用 metadata 返回的宽高） */
export function getCreativeThumbAspectRatio(creative) {
  const w = Number(creative?.creative_width);
  const h = Number(creative?.creative_height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { width: w, height: h };
  }
  return { width: 16, height: 9 };
}

export function formatCreativeRegionsZh(regions) {
  if (!Array.isArray(regions) || !regions.length) return '—';
  const labels = regions
    .map((code) => getRegionByCode(String(code))?.nameZh || String(code))
    .filter(Boolean);
  return labels.length ? labels.join(', ') : '—';
}

function formatDurationBetweenMs(ms) {
  let days = Math.max(0, Math.floor(ms / 86400000));
  const years = Math.floor(days / 365);
  days %= 365;
  const months = Math.floor(days / 30);
  days %= 30;
  const parts = [];
  if (years > 0) parts.push(`${years}年`);
  if (months > 0) parts.push(`${months}个月`);
  if (days > 0) parts.push(`${days}天`);
  return parts.length ? parts.join(', ') : '0天';
}

function normalizeSharePoint(p) {
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  if (p && typeof p === 'object') {
    const v = p.value ?? p.share ?? p.y ?? p.count;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 从创意行解析展示份额时序（支持 API 多种结构；无序列时按首末日期合成） */
export function extractShareSeries(creative) {
  const share = creative?.grouped_creative_share;
  if (Array.isArray(share)) {
    const nums = share.map(normalizeSharePoint).filter((n) => n != null);
    if (nums.length) return nums;
  }
  if (share && typeof share === 'object' && !Array.isArray(share)) {
    if (Array.isArray(share.values)) {
      const nums = share.values.map(Number).filter(Number.isFinite);
      if (nums.length) return nums;
    }
    if (Array.isArray(share.data)) {
      const nums = share.data.map(normalizeSharePoint).filter((n) => n != null);
      if (nums.length) return nums;
    }
    const dateKeys = Object.keys(share).filter((k) => !Number.isNaN(Date.parse(k)));
    if (dateKeys.length) {
      return dateKeys
        .sort((a, b) => new Date(a) - new Date(b))
        .map((k) => Number(share[k]))
        .filter(Number.isFinite);
    }
  }
  for (const key of [
    'grouped_creative_share_history',
    'grouped_creative_share_timeseries',
    'share_history',
    'share_timeseries',
  ]) {
    const hist = creative?.[key];
    if (Array.isArray(hist) && hist.length) {
      const nums = hist.map(normalizeSharePoint).filter((n) => n != null);
      if (nums.length) return nums;
    }
  }

  const scalar = typeof share === 'number' ? share : Number(share);
  if (Number.isFinite(scalar)) {
    return buildSyntheticShareSeries(
      scalar,
      creative?.grouped_creative_first_seen_at,
      creative?.grouped_creative_last_seen_at
    );
  }
  return [];
}

/** 无官方时序数据时，按份额与投放周期生成近似折线 */
export function buildSyntheticShareSeries(share, firstSeen, lastSeen, pointCount = 24) {
  const endShare = Math.max(0, Number(share) || 0);
  const start = new Date(firstSeen).getTime();
  const end = new Date(lastSeen).getTime();
  const t0 = Number.isNaN(start) ? Date.now() - 30 * 86400000 : start;
  const t1 = Number.isNaN(end) || end <= t0 ? t0 + 30 * 86400000 : end;
  const n = Math.max(8, Math.min(pointCount, 32));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const ease = t * t * (3 - 2 * t);
    const base = endShare * (0.25 + 0.75 * ease);
    const wobble = endShare * 0.12 * Math.sin(i * 1.35) * (1 - t * 0.5);
    out.push(Math.max(0, base + wobble));
  }
  out[out.length - 1] = endShare;
  return out;
}

export function getShareSparklineColor(series) {
  if (!series?.length || series.length < 2) return '#00897b';
  const first = series[0];
  const last = series[series.length - 1];
  return last >= first ? '#00897b' : '#e53935';
}

export function formatSharePercent(share) {
  const n = Number(typeof share === 'object' ? share?.value ?? share?.share : share);
  if (!Number.isFinite(n)) return '--';
  const pct = n <= 1 ? n * 100 : n;
  if (pct > 0 && pct < 0.1) return '< 0.1%';
  return `${pct.toFixed(1)}%`;
}

export function isNewCreative(firstSeenAt) {
  if (!firstSeenAt) return false;
  const t = new Date(firstSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

export function getCreativeThumbUrl(groupedCreativeId) {
  if (!groupedCreativeId) return '';
  return `https://x-ad-assets.s3.amazonaws.com/media_asset/${groupedCreativeId}/thumb`;
}

/** 优先使用 metadata 返回的缩略图 URL */
export function resolveCreativeThumbUrl(creativeOrId) {
  if (creativeOrId && typeof creativeOrId === 'object') {
    if (creativeOrId.thumbnail_media_url) return creativeOrId.thumbnail_media_url;
    return getCreativeThumbUrl(creativeOrId.grouped_creative_id);
  }
  return getCreativeThumbUrl(creativeOrId);
}

export function getCreativeVideoUrl(groupedCreativeId) {
  if (!groupedCreativeId) return '';
  return `https://x-ad-assets.s3.amazonaws.com/media_asset/${groupedCreativeId}/media`;
}

export function getCreativeImageUrl(groupedCreativeId) {
  if (!groupedCreativeId) return '';
  return `https://x-ad-assets.s3.amazonaws.com/media_asset/${groupedCreativeId}/media`;
}

export function formatGalleryDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function lookupFacetLabel(value, options) {
  if (value == null || value === '') return null;
  const key = String(value);
  const hit = options?.find((o) => o.value === key);
  return hit?.label || key;
}

export function formatCreativeFacetValues(values, options) {
  if (!Array.isArray(values) || !values.length) return '—';
  const labels = values
    .map((v) => lookupFacetLabel(v, options))
    .filter((v) => v != null && String(v).trim() !== '');
  return labels.length ? labels.join(', ') : '—';
}

export function isVideoCreative(creative) {
  const primaryType = String(creative?.primary_ad_type || '').toLowerCase();
  if (primaryType === 'video') return true;
  if (primaryType === 'image') return false;

  const tokens = normalizeCreativeFormatTokens(creative?.grouped_creative_ad_formats);
  if (tokens.some(isVideoFormatToken)) return true;

  for (const key of ['filter_ad_type', 'ad_type', 'grouped_creative_ad_type']) {
    const value = creative?.[key];
    if (value != null && isVideoFormatToken(value)) return true;
  }

  return false;
}

function normalizeCreativeFormatTokens(formats) {
  if (formats == null) return [];
  if (Array.isArray(formats)) return formats.flatMap(normalizeCreativeFormatTokens);
  if (typeof formats === 'object') {
    const value = formats.value ?? formats.label ?? formats.name ?? formats.id;
    return value != null ? [value] : [];
  }
  return [formats];
}

function isVideoFormatToken(token) {
  const text = String(token).toLowerCase();
  return (
    text.includes('video') ||
    text.includes('视频') ||
    text.includes('reels') ||
    text.includes('short-video') ||
    text.includes('in-stream')
  );
}

export function getCreativePrimaryAdTypeLabel(creative, adTypeOptions) {
  const primaryType = String(creative?.primary_ad_type || '').toLowerCase();
  if (primaryType === 'video') return '视频';
  if (primaryType === 'image') return '图片';
  if (primaryType.includes('playable') || primaryType === 'interactive') return '试玩';

  const formats = creative?.grouped_creative_ad_formats;
  if (!Array.isArray(formats) || !formats.length) return '—';
  const first = String(formats[0]).toLowerCase();
  if (first.includes('video')) return '视频';
  if (first.includes('image')) return '图片';
  if (first.includes('playable') || first.includes('interactive')) return '试玩';
  return lookupFacetLabel(formats[0], adTypeOptions) || formats[0];
}

export function formatDateRangeLabel(startDate, endDate) {
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const en = (d) => d.toLocaleDateString('en-US', opts);
  return `${en(startDate)} - ${en(endDate)}`;
}

export function buildSummarySubtitle({
  platformId,
  startDate,
  endDate,
  allRegions,
  allNetworks,
  selectedRegions = [],
}) {
  const platformLabel = GALLERY_PLATFORMS.find((p) => p.id === platformId)?.label || '双平台';
  let regionLabel = '所有国家/地区';
  if (!allRegions) {
    const picked = (selectedRegions || []).filter(Boolean);
    if (picked.length === 1) {
      regionLabel = getRegionByCode(picked[0])?.nameZh || picked[0];
    } else if (picked.length > 1) {
      regionLabel = `${picked.length} 个国家/地区`;
    }
  }
  const networkLabel = allNetworks ? '所有网络' : '已选网络';
  return `${platformLabel} · ${formatDateRangeLabel(startDate, endDate)} · ${regionLabel} · ${networkLabel}`;
}

function facetCountFromRow(row) {
  return row?.grouped_creative_count ?? 0;
}

export function buildFilterFacetCountMaps(rows) {
  const placements = new Map();
  const adTypes = new Map();
  const adObjectives = new Map();
  const aspectRatios = new Map();
  const videoDurations = new Map();
  const bannerDimensions = new Map();
  if (!Array.isArray(rows)) {
    return { placements, adTypes, adObjectives, aspectRatios, videoDurations, bannerDimensions };
  }
  for (const row of rows) {
    const count = facetCountFromRow(row);
    if (row?.filter_placement != null) {
      placements.set(String(row.filter_placement), count);
    }
    if (row?.filter_ad_type != null) {
      adTypes.set(String(row.filter_ad_type), count);
    }
    if (row?.filter_ad_objective != null) {
      adObjectives.set(String(row.filter_ad_objective), count);
    }
    if (row?.filter_aspect_ratio != null) {
      aspectRatios.set(String(row.filter_aspect_ratio), count);
    }
    if (row?.filter_video_duration != null) {
      videoDurations.set(String(row.filter_video_duration), count);
    }
    if (row?.filter_banner_dimensions != null) {
      bannerDimensions.set(String(row.filter_banner_dimensions), count);
    }
  }
  return { placements, adTypes, adObjectives, aspectRatios, videoDurations, bannerDimensions };
}

function getCountMapKeys(countMap) {
  if (!countMap) return [];
  return countMap instanceof Map ? [...countMap.keys()] : Object.keys(countMap);
}

function inferAdTypeGroupId(value) {
  const key = String(value);
  if (key.startsWith('video-')) return 'video';
  if (key.startsWith('interactive-playable-')) return 'playable';
  if (key.startsWith('image-')) return 'image';
  return null;
}

function formatUnknownAdTypeLabel(value, groupLabel) {
  const key = String(value);
  const suffix = key.replace(/^(video-|image-|interactive-playable-)/, '');
  const subtypeLabels = {
    interstitial: '插页广告',
    rewarded: '奖励',
    other: '其他',
    banner: '横幅',
  };
  const subtype = subtypeLabels[suffix] || suffix;
  return groupLabel ? `${subtype} ${groupLabel}` : key;
}

/**
 * 按平台与 filter_counts 构建广告类型分组（与 Sensor Tower 官方一致）
 * @param {Map|object} countMap filter_ad_type 计数
 * @param {string} platformId ios | android | unified
 */
export function buildAdTypeFacetOptionGroups(countMap, platformId = 'ios') {
  const staticGroups = getGalleryAdTypeOptionGroups(platformId);
  const groupOrder = staticGroups.map((g) => g.id);
  const apiKeys = new Set(getCountMapKeys(countMap).map(String));
  const hasApiData = apiKeys.size > 0;

  const labelByValue = new Map();
  const groupByValue = new Map();
  const staticGroupsById = new Map(staticGroups.map((g) => [g.id, g]));

  for (const group of staticGroups) {
    for (const opt of group.options || []) {
      labelByValue.set(opt.value, opt.label);
      groupByValue.set(opt.value, group.id);
    }
  }

  if (hasApiData) {
    for (const key of apiKeys) {
      if (groupByValue.has(key)) continue;
      const groupId = inferAdTypeGroupId(key);
      if (!groupId || !staticGroupsById.has(groupId)) continue;
      groupByValue.set(key, groupId);
      const groupLabel = staticGroupsById.get(groupId)?.label || '';
      labelByValue.set(key, formatUnknownAdTypeLabel(key, groupLabel));
    }
  }

  return groupOrder
    .map((groupId) => {
      const staticGroup = staticGroupsById.get(groupId);
      if (!staticGroup) return null;

      const staticOrder = (staticGroup.options || []).map((o) => o.value);
      const valuesInGroup = hasApiData
        ? staticOrder.filter((value) => apiKeys.has(value))
        : [...staticOrder];

      if (hasApiData) {
        for (const key of apiKeys) {
          if (groupByValue.get(key) === groupId && !valuesInGroup.includes(key)) {
            valuesInGroup.push(key);
          }
        }
      }

      if (!valuesInGroup.length) return null;

      return {
        id: groupId,
        label: staticGroup.label,
        options: valuesInGroup.map((value) => ({
          value,
          label: labelByValue.get(value) || value,
        })),
      };
    })
    .filter(Boolean);
}

/** 合并分组下拉的选项与 filter_counts（不向每个分组注入其它组的枚举） */
export function mergeFacetOptionGroups(staticGroups, countMap) {
  if (!staticGroups?.length) return [];
  return staticGroups.map((group) => ({
    ...group,
    options: mergeFacetOptions(group.options, countMap, { allowNewFromCountMap: false }),
  }));
}

/** 将静态选项与 filter_counts 返回值合并，保证 API 新枚举也能出现在下拉中 */
export function mergeFacetOptions(staticOptions, countMap, { allowNewFromCountMap = true } = {}) {
  const byValue = new Map();
  for (const opt of staticOptions || []) {
    byValue.set(opt.value, opt);
  }
  if (countMap && allowNewFromCountMap) {
    const entries = countMap instanceof Map ? countMap.entries() : Object.entries(countMap);
    for (const [value] of entries) {
      const key = String(value);
      if (!byValue.has(key)) {
        byValue.set(key, { value: key, label: key });
      }
    }
  }
  return [...byValue.values()];
}

export function buildKpiCountMap(kpisRows) {
  const map = new Map();
  if (!Array.isArray(kpisRows)) return map;
  for (const row of kpisRows) {
    if (row?.unified_app_id != null) {
      map.set(String(row.unified_app_id), row.grouped_creative_count ?? 0);
    }
  }
  return map;
}

export function exportCreativesCsv(rows, filename = 'sensortower-creatives.csv') {
  if (!rows?.length) return;
  const headers = [
    'rank',
    'unified_app_id',
    'grouped_creative_id',
    'network',
    'grouped_creative_share',
    'grouped_creative_first_seen_at',
    'grouped_creative_last_seen_at',
  ];
  const lines = [headers.join(',')];
  rows.forEach((row, idx) => {
    lines.push(
      headers
        .map((h) => {
          if (h === 'rank') return String(idx + 1);
          const v = row[h];
          const s = v == null ? '' : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { toIsoDate };
