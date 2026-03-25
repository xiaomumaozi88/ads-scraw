/**
 * 国内版 BBA ad-info 查询参数（与 bba.ttads.net/bbaapi/ad/ad-info 对齐）
 * position: 0 广告信息、1 广告文案、2 广告主、3 落地页
 * accurate_search: 1 精确、0 模糊
 */

import { expandDomesticCategorySelectionToApiIds } from '../data/domesticCnGameClassifications';

/** 北京时间当日 00:00:00 与结束日 23:59:59 对应的 Unix 秒（与接口示例一致） */
export function beijingYmdRangeToUnixSeconds(startYmd, endYmd) {
  if (!startYmd || !endYmd) {
    const today = new Date();
    const cn = new Date(today.getTime() + 8 * 3600 * 1000);
    const y = cn.getUTCFullYear();
    const m = String(cn.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cn.getUTCDate()).padStart(2, '0');
    const fallback = `${y}-${m}-${d}`;
    return beijingYmdRangeToUnixSeconds(fallback, fallback);
  }
  const begin = Math.floor(new Date(`${startYmd}T00:00:00+08:00`).getTime() / 1000);
  const end = Math.floor(new Date(`${endYmd}T23:59:59+08:00`).getTime() / 1000);
  return { begin_time: begin, end_time: end };
}

function coerceApiInt(val, fallback = 0) {
  if (val == null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toPlatformParam(val) {
  if (val == null) return '0';
  const list = Array.isArray(val) ? val : [val];
  const dedup = new Set();
  list.forEach((entry) => {
    if (entry == null || entry === '') return;
    String(entry)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => dedup.add(x));
  });
  return dedup.size > 0 ? Array.from(dedup).join(',') : '0';
}

function toAdSizeParam(val) {
  if (val == null) return '0';
  const list = Array.isArray(val) ? val : [val];
  const dedup = new Set();
  list.forEach((entry) => {
    if (entry == null || entry === '') return;
    const normalized = String(entry).trim();
    if (normalized) dedup.add(normalized);
  });
  return dedup.size > 0 ? Array.from(dedup).join(',') : '0';
}

function toCtaParam(val) {
  if (val == null) return '0';
  const list = Array.isArray(val) ? val : [val];
  const dedup = new Set();
  list.forEach((entry) => {
    if (entry == null || entry === '') return;
    String(entry)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => dedup.add(x));
  });
  return dedup.size > 0 ? Array.from(dedup).join(',') : '0';
}

function toPlacementParam(val) {
  if (val == null) return '0';
  const list = Array.isArray(val) ? val : [val];
  const dedup = new Set();
  list.forEach((entry) => {
    if (entry == null || entry === '') return;
    String(entry)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => dedup.add(x));
  });
  return dedup.size > 0 ? Array.from(dedup).join(',') : '0';
}

function toTopicParam(val) {
  if (val == null) return '0';
  const list = Array.isArray(val) ? val : [val];
  const dedup = new Set();
  list.forEach((entry) => {
    if (entry == null || entry === '') return;
    const n = Number(entry);
    if (Number.isFinite(n)) dedup.add(String(n));
  });
  return dedup.size > 0 ? Array.from(dedup).join(',') : '0';
}

/** 行业 Tab → API industry（无文档时与 0 默认一致；非「全部」可按产品再调） */
export function domesticIndustryToApi(industry) {
  const map = { all: 0, game: 1, tool: 2, ecommerce: 3 };
  return map[industry] ?? 0;
}

/**
 * 由国内版表单 payload 生成 GET 查询串（参数名与线上 curl 一致，含 classfication 拼写）
 */
export function buildDomesticAdInfoQuery(payload) {
  const {
    position,
    keyword = '',
    /** 快捷「推荐」标签：有值时作为 search_content，否则用 keyword */
    recommendedSearch,
    sort: sortRaw,
    exactSearch = false,
    excludeKeyword = '',
    industry = 'all',
    timePreset,
    dateRange,
    basic = {},
    advanced = {},
    page = 1,
  } = payload;

  const startTime = dateRange?.startTime;
  const endTime = dateRange?.endTime;
  const { begin_time, end_time } =
    timePreset === 'all'
      ? { begin_time: '', end_time: '' }
      : beijingYmdRangeToUnixSeconds(startTime, endTime);

  const rawCat = basic.category;
  const categoryIds = Array.isArray(rawCat)
    ? expandDomesticCategorySelectionToApiIds(rawCat)
    : rawCat != null && rawCat !== ''
      ? expandDomesticCategorySelectionToApiIds([rawCat])
      : [];
  const classficationStr = categoryIds.length > 0 ? categoryIds.join(',') : '0';
  /** 选了分类时沿用当前行业（游戏=1，工具=2）；未选分类同样沿用 Tab 行业 */
  const industryApi = domesticIndustryToApi(industry);

  const p = new URLSearchParams();
  const set = (k, v) => p.set(k, v == null ? '' : String(v));

  set('advertiser_key', '');
  set('is_hide_advertiser', '0');
  /** 缺省与官网 DRF 示例一致：0=广告信息 */
  set('position', coerceApiInt(position, 0));
  set('exclude_keyword', excludeKeyword);
  set('platform', toPlatformParam(basic.channelMedia));
  set('industry', industryApi);
  set('classfication', classficationStr);
  set('topic', toTopicParam(advanced.topic));
  /** 缺省与官网常见首次请求一致：1=最后看见 */
  set('sort', coerceApiInt(sortRaw, 1));
  set('creative_type', coerceApiInt(basic.creativeType, 0));
  /** 与前端「所有系统」一致：未选具体系统时传 0 */
  const systemRaw = advanced.system;
  set(
    'system',
    systemRaw == null || systemRaw === '' ? '0' : String(coerceApiInt(systemRaw, 0))
  );
  set('cta', toCtaParam(advanced.cta));
  const rec =
    recommendedSearch != null && String(recommendedSearch).trim() !== ''
      ? String(recommendedSearch).trim()
      : '';
  set('search_content', rec || String(keyword || ''));
  set('begin_time', begin_time);
  set('end_time', end_time);
  set('page', coerceApiInt(page, 1));
  set('more_count', '2');
  set('ad_pos', toPlacementParam(basic.placement));
  set('store_id', '');
  set('ad_size', toAdSizeParam(advanced.size));
  set('timeType', '0');
  set('is_online_drama', '0');
  set('accurate_search', exactSearch ? '1' : '0');

  return p;
}

/** BBA ad-info 单页条数（与线上 data.data 长度一致；分页总页数 = ceil(total / 此值)） */
export const DOMESTIC_AD_INFO_PAGE_SIZE = 24;

export const DOMESTIC_POSITION_OPTIONS = [
  { value: 0, label: '广告信息', placeholder: '广告信息关键词' },
  { value: 1, label: '广告文案', placeholder: '广告文案关键词' },
  { value: 2, label: '广告主', placeholder: '广告主关键词' },
  { value: 3, label: '落地页', placeholder: '落地页关键词' },
];

export const DOMESTIC_EXACT_SEARCH_TOOLTIP =
  '精确搜索指关键词不被拆分且严格保留词顺序去进行查询，这种方式相关度较高但是结果匹配可能较少。不勾选则代表模糊搜索，指关键词会被拆分尽可能召回包含关键词的数据，这种方式结果数量较多但是匹配度可能较低。';

/** BBA ad-info sort 与线上下拉一致 */
export const DOMESTIC_SORT_OPTIONS = [
  { value: 1, label: '最后看见' },
  { value: 2, label: '首次看见' },
  { value: 3, label: '热度' },
  { value: 5, label: '关联产品数' },
  { value: 6, label: '创意组数' },
  { value: 7, label: '投放天数' },
  { value: 8, label: '展示估值' },
  { value: 4, label: '相关度' },
];

/** 快捷推荐标签：对应 search_content（选「全部」时用主搜索框 keyword） */
export const DOMESTIC_RECOMMENDED_TAGS = ['全部', '相机', '美女', '轻松', '美颜', '颜滤镜', 'AI美颜', '随手', '简直'];

/**
 * 从 ad-info 响应中尽量取出列表区展示用统计（字段名随上游变化，多 key 兜底）
 */
export function extractDomesticAdInfoSummary(res) {
  if (res == null || typeof res !== 'object') return { creativeGroupApprox: null, materialCount: null, updateTime: null };
  const d = res.data != null && typeof res.data === 'object' ? res.data : res;
  const pick = (...keys) => {
    for (const k of keys) {
      const v = d[k];
      if (v != null && v !== '') return v;
    }
    return null;
  };
  return {
    creativeGroupApprox: pick('creative_group_count', 'ad_group_count', 'group_total', 'creative_group_num', 'creative_group'),
    materialCount: pick('material_count', 'material_total', 'ad_count', 'material_num'),
    updateTime: pick('up_time', 'update_time', 'updated_at', 'utime', 'last_update_time'),
  };
}

/** BBA ad-info 列表：data.data 为创意数组 */
export function getDomesticAdInfoListItems(res) {
  if (res == null || typeof res !== 'object') return [];
  const d = res.data != null && typeof res.data === 'object' ? res.data : res;
  if (Array.isArray(d.data)) return d.data;
  const candidates = [d.list, d.records, d.items, d.rows, d.ad_list, d.adList];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/** 响应根级 meta（分页/统计） */
export function getDomesticAdInfoRootMeta(res) {
  const d = res?.data != null && typeof res.data === 'object' ? res.data : null;
  if (!d) return { total: null, materialCount: null, creativeGroupCount: null, upTime: null };
  return {
    total: typeof d.total === 'number' ? d.total : null,
    materialCount: d.material_count,
    creativeGroupCount: d.creative_group_count,
    upTime: d.up_time,
  };
}
