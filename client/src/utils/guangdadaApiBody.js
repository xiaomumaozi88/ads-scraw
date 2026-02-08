/**
 * 广大大 API 请求体构建（与 server/src/services/guangdadaApiService.js 逻辑一致）
 * 用于前端直接发送与 guangdada.net 标准请求一致的 body，便于在 Network 中核对参数
 */
import { GUANGDADA_GAME_CATEGORIES_TREE, GAME_FIRST_LEVEL_API_TAG_ID } from '../data/guangdadaGameCategoriesTree.js';
import { GUANGDADA_WEBSITE_TYPE_TREE } from '../data/guangdadaWebsiteTypeTree.js';

/** API sort_field 有效取值（文档约定，默认 -first_seen）；素材内容多模态用 -multimodal_similarity */
const SORT_FIELD_ALLOWED = new Set([
  '-correlation', '-impression', '-first_seen', '-last_seen', '-days',
  '-related_ads_count', '-heat_degree', '-like_count', '-comment_count', '-share_count',
  '-multimodal_similarity'
]);

const ADS_TYPE_MAP = { 图片: 1, 视频: 2, 轮播: 3, HTML: 4, 试玩广告: 7 };
const POPULARITY_TAG_MAP = { '人气值Top1%': 1, '人气值Top10%': 10 };

function landingPageTypeToApi(arr) {
  if (!arr || arr.length === 0) return '0';
  if (arr[0] === '1') return '1';
  if (arr[0] === '3') return '3';
  if (arr[0] === '2' && arr[1] === '2-1') return '2-1';
  if (arr[0] === '2' && arr[1] === '2-2') return '2-2';
  if (arr[0] === '2') return '2';
  return '0';
}

function preorderToApi(arr) {
  if (!arr || arr.length === 0) return 0;
  if (arr[0] === '2') return 2;
  if (arr[0] === '1') return 1;
  return 0;
}

function linkTypeToApi(arr) {
  if (!arr || arr.length === 0) return 0;
  if (arr[0] === '1') return 1;
  if (arr[0] === '2') return 2;
  return 0;
}

function retargetingToApi(v) {
  if (!v) return 0;
  if (v === 'first' || v === '初次投放') return 1;
  if (v === 'repeat' || v === '重复投放') return 2;
  return 0;
}

function monetizationToApi(v) {
  if (!v) return 0;
  if (v === '内购') return 1;
  if (v === '非内购') return 2;
  return 0;
}

const TOOL_CATEGORY_TAG_IDS = {
  金融理财: ['2002', '2010', '2008', '2004', '2005', '2011', '2000', '2009', '2003', '2006', '2007'],
  餐饮美食: ['2017', '2014', '2012', '30233311', '2018', '2019', '2016'],
  购物: ['30130001', '2028', '30233312', '30233313', '2029', '2030', '2031', '2087', '2092', '2149', '2026'],
  实用工具: ['2123', '30170027', '2121', '2113', '30233275', '2116', '2090', '30170030', '2112', '30170026', '30233276', '30233277', '30170018', '30170031', '30233278', '30233279', '2119', '2120', '2118', '2122', '30233280', '30233281', '30233282', '30233283', '30233284', '30170002', '2111', '2153', '30233285', '30233286', '30233287', '30233288', '30233289', '30233290', '30170015', '2146', '2155'],
  商务和工作: ['30233293', '30233294', '30233296', '30233297', '2124', '2074', '2072', '30233298', '2075', '2156', '30233295'],
  娱乐: ['30050010', '2157', '2129', '2136', '30050007', '2135', '30233291', '2095', '2128', '30233292', '30050011', '2133', '2130', '2127', '2132'],
  家庭关系: ['2032', '2147', '2033'],
  汽车车辆: ['2069', '2065', '2063', '2068', '2067', '2066', '2064'],
  图形与设计: ['2103', '2105', '2102', '2104'],
  图书: ['2106', '2150', '2109', '2154', '2108'],
  '新闻阅读/杂志': ['2152', '2126', '2001'],
  生成式AI: ['30233299', '30233300', '30233301', '30233302', '30233303', '30233304', '30233305', '30233306', '30233307', '30233308', '30233309', '30233310'],
  社交: ['2078', '2079', '2080', '2083', '2144', '30233314', '2082', '30233315', '2084', '2077'],
  体育: ['2099', '30150002', '2101', '2097', '30233319', '2100'],
  健康与健身: ['30233320', '2125', '2036', '2035', '30233321', '30233322', '30233323', '30233324', '2041', '2037', '2142', '30180009', '2042', '2040'],
  个性化: ['30233325', '30233326', '30233327', '30233328', '30233329', '30233330', '30233331', '30233332', '30233333', '30233334'],
  教育: ['2043', '30233335', '30233336', '30233337', '2049', '2046', '2047', '2045', '2044', '30040011', '2048'],
  生活方式: ['2110', '2093', '2096', '30233338', '2094', '2085', '2088', '2089', '2151'],
  '旅行&出行': ['2055', '30233339', '30233340', '2058', '2061', '2054', '2052', '2057', '2053', '2060'],
  照片和视频: ['30233316', '30233317', '2141', '30110004', '30233318', '2137', '2138'],
  工具网赚: ['30233341', '5005', '5006', '30233342', '30233343', '30233344', '30233345'],
};

function splitCoreTrack(values) {
  const tagIds = [];
  const gamePlay = [];
  const gameTheme = [];
  const gameIp = [];
  if (!Array.isArray(values)) return { tag_ids: [], game_play: [], game_theme: [], game_ip: [] };
  for (const v of values) {
    const code = parseInt(String(v), 10);
    if (Number.isNaN(code)) continue;
    if (code >= 90000001 && code <= 90000004) tagIds.push(code);
    else if (code >= 50000001 && code <= 50000169) gamePlay.push(code);
    else if (code >= 30000001 && code <= 30000356) gameTheme.push(code);
    else if (code >= 100000002 && code <= 100000150) gameIp.push(code);
  }
  return { tag_ids: tagIds, game_play: gamePlay, game_theme: gameTheme, game_ip: gameIp };
}

function buildAiTagObject(selectedCodes, parentMap) {
  if (!Array.isArray(selectedCodes) || selectedCodes.length === 0) return undefined;
  const byParent = {};
  for (const codeStr of selectedCodes) {
    const code = parseInt(String(codeStr), 10);
    if (Number.isNaN(code)) continue;
    const parent = parentMap[code];
    if (parent != null) {
      if (!byParent[parent]) byParent[parent] = [];
      byParent[parent].push(code);
    }
  }
  if (Object.keys(byParent).length === 0) return undefined;
  return byParent;
}

/** 广大大官方使用北京时间(UTC+8)：YYYY-MM-DD 转为 seen_begin/seen_end 时按北京 00:00:00 / 23:59:59 */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
function dateStrToSeenBegin(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - BEIJING_OFFSET_MS;
  return Math.floor(ms / 1000);
}
function dateStrToSeenEnd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - BEIJING_OFFSET_MS;
  return Math.floor(ms / 1000);
}
function defaultSeenRangeBeijing() {
  const now = new Date();
  const beijingNow = new Date(now.getTime() + BEIJING_OFFSET_MS);
  const y = beijingNow.getUTCFullYear();
  const mo = beijingNow.getUTCMonth();
  const d = beijingNow.getUTCDate();
  const beginMs = Date.UTC(y - 1, mo, d, 0, 0, 0, 0) - BEIJING_OFFSET_MS;
  const endMs = Date.UTC(y, mo, d, 23, 59, 59, 999) - BEIJING_OFFSET_MS;
  return { seenBegin: Math.floor(beginMs / 1000), seenEnd: Math.floor(endMs / 1000) };
}

/** 供 DataCard 时间范围切换使用：将 startTime/endTime 转为 seen_begin/seen_end，保持 API 格式以便筛选条件不丢失 */
export function dateRangeToSeenParams(startTime, endTime) {
  if (!startTime || !endTime) return {};
  return {
    seen_begin: dateStrToSeenBegin(String(startTime)),
    seen_end: dateStrToSeenEnd(String(endTime))
  };
}

const IMAGE_AI_PARENT = {
  97: 96, 98: 96, 99: 96, 100: 96, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 12: 1, 13: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1, 49: 1,
  14: 2, 15: 2, 16: 2, 17: 2, 51: 2, 52: 2, 53: 2, 54: 2, 55: 2, 56: 2, 57: 2, 58: 2, 61: 2, 63: 2, 64: 2, 65: 2, 66: 2,
  18: 3, 19: 3, 20: 3, 21: 3, 22: 3, 101: 3, 102: 3, 103: 3, 104: 3, 105: 3, 106: 3, 111: 3,
};
const VIDEO_AI_PARENT = {
  142: 140, 144: 140, 145: 140, 146: 140, 147: 140, 148: 140, 149: 140, 150: 140, 151: 140,
  204: 200, 205: 200, 206: 200, 207: 200, 208: 200, 209: 200, 210: 200, 211: 200, 212: 200,
  134: 130, 135: 130, 136: 130, 137: 130, 138: 130, 139: 130, 140: 130, 141: 130,
};

/**
 * 将表单/搜索参数转为广大大 API 的 body（与 guangdada.net 标准请求一致）
 * @param {Object} params - 含 keyWord, startTime, endTime, page, pageSize, sort_field, duplicate_removal 及 guangdada* 等
 */
export function buildGuangdadaApiBody(params = {}) {
  const {
    page = 1,
    pageSize = 60,
    page_size,
    keyWord,
    startTime,
    endTime,
    seen_begin: paramSeenBegin,
    seen_end: paramSeenEnd,
    sort_field = '-first_seen',
    duplicate_removal = 0,
    guangdadaPrimaryTab,
    guangdadaSearchType,
    guangdadaExactSearch,
    guangdadaNewAds,
    guangdadaIsTheater,
    guangdadaIsAiApp,
    guangdadaMediaType,
    guangdadaTopCreative,
    guangdadaGameCategories,
    guangdadaGameCategoryCodes,
    guangdadaToolCategories,
    guangdadaToolCategoryCodes,
    guangdadaChannels,
    guangdadaCountry,
    guangdadaOnlyInSelectedRegion,
    guangdadaCopyLangs,
    guangdadaCreativeAttr,
    guangdadaImageAnalysis,
    guangdadaVideoAnalysis,
    guangdadaCoreTrack,
    guangdadaPreorderAd,
    guangdadaMonetizationType,
    guangdadaFbAudience,
    guangdadaCta,
    guangdadaFbSpend,
    guangdadaSocialEngagement,
    guangdadaCpi,
    guangdadaLandingPageType,
    guangdadaCreativeForm,
    guangdadaPlacement,
    guangdadaLinkType,
    guangdadaRetargeting,
    guangdadaIncludePageInfo,
    guangdadaViolationAd,
    guangdadaEndCard,
    guangdadaCodFlag,
    guangdadaSearchArbitrageFlag,
    guangdadaWebsiteTypeCodes,
    guangdadaSearchCategory,
    exclude_keyword,
    advertiser_key,
  } = params;

  let seenBegin = paramSeenBegin;
  let seenEnd = paramSeenEnd;
  if (seenBegin == null || seenEnd == null) {
    if (startTime && endTime && /^\d{4}-\d{2}-\d{2}$/.test(String(startTime)) && /^\d{4}-\d{2}-\d{2}$/.test(String(endTime))) {
      seenBegin = dateStrToSeenBegin(String(startTime));
      seenEnd = dateStrToSeenEnd(String(endTime));
    } else {
      const def = defaultSeenRangeBeijing();
      seenBegin = def.seenBegin;
      seenEnd = def.seenEnd;
    }
  }

  const pageSizeNum = Math.min(60, parseInt(page_size ?? pageSize, 10) || 60);
  const isMaterialContent = guangdadaSearchCategory === '素材内容';
  const defaultSort = isMaterialContent ? '-multimodal_similarity' : '-first_seen';
  const sortFieldApi = (sort_field && SORT_FIELD_ALLOWED.has(String(sort_field))) ? String(sort_field) : defaultSort;

  // search_type: 广告信息传 "1"（字符串），素材内容传 0（数字）
  const searchType = guangdadaSearchCategory === '素材内容' ? 0 : '1';
  const body = {
    page: Math.max(1, Math.min(500, parseInt(page, 10) || 1)),
    page_size: pageSizeNum,
    seen_begin: seenBegin,
    seen_end: seenEnd,
    sort_field: sortFieldApi,
    duplicate_removal: parseInt(duplicate_removal, 10) || 0,
    search_type: searchType,
    complete_country_match: !!guangdadaOnlyInSelectedRegion,
    fb_merge: Array.isArray(guangdadaChannels) && guangdadaChannels.includes('merge_facebook'),
    new_ads_flag: guangdadaNewAds ? 1 : 0,
    original_flag: (guangdadaCreativeForm === '广告原帖') ? 1 : 0,
    is_dynamic: (guangdadaCreativeForm === '动态广告') ? 1 : 0,
    landing_page: 0,
  };

  /** app_type 为必传：1-游戏 2-工具 3-电商/品牌 */
  body.app_type = (guangdadaPrimaryTab === '工具') ? 2 : 1;
  if (guangdadaPrimaryTab === '电商/品牌') body.app_type = 3;
  if (body.app_type === 2) {
    body.is_theater = guangdadaIsTheater ? 1 : 0;
    body.is_ai_app = guangdadaIsAiApp ? 1 : 0;
  }
  // position：电商/品牌时 guangdadaSearchType 为 '0'/'4'/'6'/'1'，列表及 count 等接口均需传；游戏/工具时为文案/广告主等中文映射
  const isEcom = guangdadaPrimaryTab === '电商/品牌';
  if (isEcom && guangdadaSearchType != null && guangdadaSearchType !== '') {
    const pos = parseInt(guangdadaSearchType, 10);
    if (!Number.isNaN(pos)) body.position = pos;
  } else {
    const positionMap = { 综合: 0, 广告文案: 1, 广告主: 2, 投放主页: 4, 落地页域名: 6 };
    if (guangdadaSearchType && positionMap[guangdadaSearchType] != null && positionMap[guangdadaSearchType] !== 0) {
      body.position = positionMap[guangdadaSearchType];
    }
  }

  // 已选广告主时只传 advertiser_key，不传 keyword；否则按关键词逻辑传 keyword
  // 素材内容模式下即使用户选了广告主，也需传 keyword 供后端 multi-modal-search 使用
  const hasAdvertiserKey = Array.isArray(advertiser_key) && advertiser_key.length > 0;
  const setKeywordFromKeyWord = () => {
    if (Array.isArray(keyWord) && keyWord.length > 0) {
      body.keyword = keyWord.map((k) => String(k).trim()).filter(Boolean).slice(0, 7);
    } else if (keyWord != null && String(keyWord).trim() !== '') {
      const raw = String(keyWord).trim();
      const parts = raw.split('\\;').map((s) => s.trim()).filter(Boolean).slice(0, 7);
      if (parts.length > 1) {
        body.keyword = parts;
      } else if (parts.length === 1) {
        body.keyword = parts[0];
      } else {
        body.keyword = raw;
      }
    }
  };
  if (hasAdvertiserKey) {
    body.advertiser_key = advertiser_key.map((k) => String(k).trim()).filter(Boolean);
    // 素材内容需 keyword 供 multi-modal-search；电商/品牌下 searchKeyword 输入始终作为 keyword
    if (isMaterialContent || isEcom) setKeywordFromKeyWord();
  } else {
    setKeywordFromKeyWord();
  }
  if (Array.isArray(exclude_keyword) && exclude_keyword.length > 0) {
    body.exclude_keyword = exclude_keyword.slice(0, 7);
  }
  if (guangdadaSearchCategory) {
    body.guangdada_search_category = guangdadaSearchCategory;
  }

  if (Array.isArray(guangdadaChannels) && guangdadaChannels.length > 0) {
    body.platform = guangdadaChannels.filter((c) => c !== 'merge_facebook').slice(0, 20);
  }
  if (Array.isArray(guangdadaCountry) && guangdadaCountry.length > 0) {
    body.geo = guangdadaCountry;
  }
  if (Array.isArray(guangdadaCopyLangs) && guangdadaCopyLangs.length > 0) {
    body.language = guangdadaCopyLangs;
  }

  /** 将 tag_ids 转为 API 要求的 List[int] */
  const toTagIdsInts = (arr) => (Array.isArray(arr) ? arr : []).map((c) => parseInt(String(c), 10)).filter((n) => !Number.isNaN(n));
  if (body.app_type === 1) {
    const gameCodes = Array.isArray(guangdadaGameCategoryCodes) && guangdadaGameCategoryCodes.length > 0
      ? (guangdadaGameCategoryCodes || []).map((c) => String(c)).filter(Boolean)
      : [];
    if (gameCodes.length > 0) {
      const selectedSet = new Set(gameCodes.sort());
      let useApiTagId = null;
      for (const node of GUANGDADA_GAME_CATEGORIES_TREE) {
        const apiTagId = GAME_FIRST_LEVEL_API_TAG_ID[node.name];
        if (!apiTagId || !node.children) continue;
        const childrenValues = node.children.map((c) => String(c.value)).sort();
        if (childrenValues.length !== selectedSet.size) continue;
        if (childrenValues.every((v) => selectedSet.has(v))) {
          useApiTagId = apiTagId;
          break;
        }
      }
      body.tag_ids = useApiTagId != null ? [parseInt(useApiTagId, 10)] : toTagIdsInts(gameCodes);
    }
  }
  if (body.app_type === 2) {
    const explicitCodes = Array.isArray(guangdadaToolCategoryCodes) && guangdadaToolCategoryCodes.length > 0
      ? (guangdadaToolCategoryCodes || []).map((c) => String(c)).filter(Boolean)
      : [];
    if (explicitCodes.length > 0) {
      body.tag_ids = toTagIdsInts(explicitCodes);
    } else if (Array.isArray(guangdadaToolCategories) && guangdadaToolCategories.length > 0) {
      const toolTagIds = (guangdadaToolCategories || [])
        .flatMap((name) => TOOL_CATEGORY_TAG_IDS[name] || [])
        .map((c) => String(c))
        .filter(Boolean);
      if (toolTagIds.length > 0) body.tag_ids = toTagIdsInts(toolTagIds);
    }
  }
  if (body.app_type === 3 && Array.isArray(guangdadaWebsiteTypeCodes) && guangdadaWebsiteTypeCodes.length > 0) {
    const independentWebsiteValues = (GUANGDADA_WEBSITE_TYPE_TREE[0]?.children || []).map((ch) => ch.value);
    const independentSelected = guangdadaWebsiteTypeCodes
      .map((c) => String(c).trim())
      .filter((c) => c && independentWebsiteValues.includes(c));
    if (independentSelected.length > 0) {
      body.independent_website = independentSelected;
    }
  }
  if (body.app_type !== 2) {
    const core = splitCoreTrack(guangdadaCoreTrack);
    if (core.tag_ids.length > 0 && !(Array.isArray(body.tag_ids) && body.tag_ids.length > 0)) {
      body.tag_ids = core.tag_ids;
    }
    if (core.game_play.length > 0) body.game_play = core.game_play;
    if (core.game_theme.length > 0) body.game_theme = core.game_theme;
    if (core.game_ip.length > 0) body.game_ip = core.game_ip;
  }

  if (guangdadaMediaType && ADS_TYPE_MAP[guangdadaMediaType] != null) {
    body.ads_type = [ADS_TYPE_MAP[guangdadaMediaType]];
  }
  if (guangdadaCreativeForm === '试玩广告') {
    body.ads_type = body.ads_type || [];
    if (!body.ads_type.includes(7)) body.ads_type.push(7);
  }

  if (guangdadaTopCreative && POPULARITY_TAG_MAP[guangdadaTopCreative] != null) {
    body.popularity_tag = [POPULARITY_TAG_MAP[guangdadaTopCreative]];
  }

  const adsPromote = landingPageTypeToApi(guangdadaLandingPageType);
  if (adsPromote !== '0') body.ads_promote_type = adsPromote;
  const isPreorder = preorderToApi(guangdadaPreorderAd);
  if (isPreorder !== 0) body.is_preorder = isPreorder;
  const redirectType = linkTypeToApi(guangdadaLinkType);
  if (redirectType !== 0) body.redirect_filter_type = redirectType;
  const resumeNew = retargetingToApi(guangdadaRetargeting);
  if (resumeNew !== 0) body.resume_or_new_ads = resumeNew;
  const monetModel = monetizationToApi(guangdadaMonetizationType);
  if (monetModel !== 0) body.monetization_model = monetModel;

  if (guangdadaCta) body.cta_type = guangdadaCta;
  // 广告版位：多选时为 value 字符串数组（一项可能为 "104,124,..."），展开为整数数组
  if (Array.isArray(guangdadaPlacement) && guangdadaPlacement.length > 0) {
    body.ad_positions = guangdadaPlacement.flatMap((v) =>
      String(v)
        .split(',')
        .map((n) => parseInt(n, 10))
        .filter((n) => !Number.isNaN(n))
    );
  } else if (guangdadaPlacement && typeof guangdadaPlacement === 'string') {
    body.ad_positions = [parseInt(guangdadaPlacement, 10)].filter((n) => !Number.isNaN(n));
  }
  if (guangdadaIncludePageInfo) body.account_flag = true;
  if (guangdadaViolationAd) body.view_illegal = true;
  if (guangdadaEndCard) body.end_card = 1;
  body.cod_flag = (guangdadaCodFlag != null && Number(guangdadaCodFlag) === 1) ? 1 : 0;
  body.search_arbitrage_flag = (guangdadaSearchArbitrageFlag != null && Number(guangdadaSearchArbitrageFlag) === 1) ? 1 : 0;

  const fbAudience = guangdadaFbAudience || {};
  if (Array.isArray(fbAudience.gender) && fbAudience.gender.length > 0) {
    body.audience_sex = fbAudience.gender.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n));
  }
  if (Array.isArray(fbAudience.age) && fbAudience.age.length > 0) {
    body.audience_age = fbAudience.age.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n));
  }

  const cpi = guangdadaCpi || {};
  if (Array.isArray(cpi.cpiRange) && cpi.cpiRange.length > 0) {
    body.cpi_price_amount = cpi.cpiRange.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n));
  }
  if (Array.isArray(cpi.currency) && cpi.currency.length > 0) {
    body.cpi_price_currency = cpi.currency;
  }

  const spend = guangdadaFbSpend || {};
  if (spend.min != null && spend.min !== '') {
    const n = parseInt(spend.min, 10);
    if (!Number.isNaN(n)) body.cost_begin = n;
  }
  if (spend.max != null && spend.max !== '') {
    const n = parseInt(spend.max, 10);
    if (!Number.isNaN(n)) body.cost_end = n;
  }
  if (spend.value && typeof spend.value === 'string' && spend.value.includes('~')) {
    const parts = spend.value.split('~').map((s) => parseInt(s.trim(), 10));
    if (parts.length >= 2 && !Number.isNaN(parts[0])) body.cost_begin = parts[0];
    if (parts.length >= 2 && !Number.isNaN(parts[1])) body.cost_end = parts[1];
  }

  const engagement = guangdadaSocialEngagement || {};
  for (const key of ['like', 'comment', 'share']) {
    const item = engagement[key] || {};
    if (item.min != null && item.min !== '') {
      const n = parseInt(item.min, 10);
      if (!Number.isNaN(n)) body[`${key}_begin`] = n;
    }
    if (item.max != null && item.max !== '') {
      const n = parseInt(item.max, 10);
      if (!Number.isNaN(n)) body[`${key}_end`] = n;
    }
    if (item.value && typeof item.value === 'string' && item.value.includes('~')) {
      const parts = item.value.split('~').map((s) => parseInt(s.trim(), 10));
      if (parts.length >= 2 && !Number.isNaN(parts[0])) body[`${key}_begin`] = parts[0];
      if (parts.length >= 2 && !Number.isNaN(parts[1])) body[`${key}_end`] = parts[1];
    }
  }

  const attr = guangdadaCreativeAttr || {};
  if (attr.videoDuration === '-' && (attr.videoDurationMin != null || attr.videoDurationMax != null)) {
    if (attr.videoDurationMin != null) body.video_duration_begin = parseInt(attr.videoDurationMin, 10);
    if (attr.videoDurationMax != null) body.video_duration_end = parseInt(attr.videoDurationMax, 10);
  } else if (attr.videoDuration && attr.videoDuration !== '') {
    const parts = String(attr.videoDuration).split('-').map((s) => s.trim());
    if (parts[0] !== '') body.video_duration_begin = parseInt(parts[0], 10);
    if (parts.length > 1 && parts[1] !== '') body.video_duration_end = parseInt(parts[1], 10);
  }
  if (Array.isArray(attr.size) && attr.size.length > 0) body.ads_format = attr.size;
  if (Array.isArray(attr.quality) && attr.quality.length > 0) body.ads_size = attr.quality;
  // material_size: List[str]，格式 "320 x 480"（注意空格）
  const resolutionList = [...(attr.resolution || []), ...(attr.resolutionCustom || [])].filter(Boolean);
  if (resolutionList.length > 0) {
    body.material_size = resolutionList.map((s) => {
      const str = String(s).trim();
      const normalized = str.replace(/\s*\*\s*|\s*[xX]\s*/g, ' x ');
      return normalized || str;
    });
  }

  const aiImage = buildAiTagObject(guangdadaImageAnalysis, IMAGE_AI_PARENT);
  if (aiImage) body.ai_image_tag = aiImage;
  const aiVideo = buildAiTagObject(guangdadaVideoAnalysis, VIDEO_AI_PARENT);
  if (aiVideo) body.ai_video_tag = aiVideo;

  return body;
}
