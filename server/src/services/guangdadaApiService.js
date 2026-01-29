/**
 * 广大大平台 - 直接请求 guangdada.net API（无需 Puppeteer 登录）
 * 需配置环境变量：GUANGDADA_AUTHORIZATION（JWT），可选：GUANGDADA_DEVICE_ID、GUANGDADA_USER_TOKEN
 * 请求体字段与 API 文档 2.1.1 对齐
 */
const GUANGDADA_API_BASE = 'https://guangdada.net';
const CREATIVE_LIST_URL = `${GUANGDADA_API_BASE}/napi/v1/creative/list`;

/** 前端 sort_field 与 API sort_field 映射 */
const SORT_FIELD_MAP = {
  'relevance': '-correlation',
  '-estimate_display': '-impression',
  '-days_active': '-days',
  '-ad_count': '-related_ads_count',
  '-heat': '-heat_degree',
  '-like': '-like_count',
  '-comment': '-comment_count',
  '-share': '-share_count',
};

/** 素材类型中文 -> API ads_type */
const ADS_TYPE_MAP = { '图片': 1, '视频': 2, '轮播': 3, 'HTML': 4, '试玩广告': 7 };

/** Top 创意中文 -> API popularity_tag */
const POPULARITY_TAG_MAP = { '人气值Top1%': 1, '人气值Top10%': 10 };

/** 落地页类型级联值 -> API ads_promote_type */
function landingPageTypeToApi(arr) {
  if (!arr || arr.length === 0) return '0';
  if (arr[0] === '1') return '1';
  if (arr[0] === '3') return '3';
  if (arr[0] === '2' && arr[1] === '2-1') return '2-1';
  if (arr[0] === '2' && arr[1] === '2-2') return '2-2';
  if (arr[0] === '2') return '2';
  return '0';
}

/** 预约广告级联值 -> API is_preorder: 0-全部 1-预约 2-非预约 */
function preorderToApi(arr) {
  if (!arr || arr.length === 0) return 0;
  if (arr[0] === '2') return 2;
  if (arr[0] === '1') return 1;
  return 0;
}

/** 链接类型级联值 -> API redirect_filter_type: 0-全部 1-重定向 2-DSP */
function linkTypeToApi(arr) {
  if (!arr || arr.length === 0) return 0;
  if (arr[0] === '1') return 1;
  if (arr[0] === '2') return 2;
  return 0;
}

/** 工具分类一级名称 -> 该分类下所有二级 code 数组（与前端 guangdadaToolCategoriesTree 一致，用于 API tag_ids） */
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

/** 重投广告前端值 -> API resume_or_new_ads: 0-全部 1-初次 2-重复 */
function retargetingToApi(v) {
  if (!v) return 0;
  if (v === 'first' || v === '初次投放') return 1;
  if (v === 'repeat' || v === '重复投放') return 2;
  return 0;
}

/** 内购/非内购 -> API monetization_model: 0-全部 1-内购 2-非内购 */
function monetizationToApi(v) {
  if (!v) return 0;
  if (v === '内购') return 1;
  if (v === '非内购') return 2;
  return 0;
}

/** 从核心赛道多选拆分为 tag_ids / game_play / game_theme / game_ip（value 为字符串，转 int） */
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

/** 将选中的图片/视频智能分析 code 列表转为 API 的 { parentCode: [childCodes] }（需已知 parent 映射） */
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

// 图片智能分析：子 code -> 父 code（根据文档示例与常见结构）
const IMAGE_AI_PARENT = {
  97: 96, 98: 96, 99: 96, 100: 96, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 12: 1, 13: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1, 49: 1,
  14: 2, 15: 2, 16: 2, 17: 2, 51: 2, 52: 2, 53: 2, 54: 2, 55: 2, 56: 2, 57: 2, 58: 2, 61: 2, 63: 2, 64: 2, 65: 2, 66: 2,
  18: 3, 19: 3, 20: 3, 21: 3, 22: 3, 101: 3, 102: 3, 103: 3, 104: 3, 105: 3, 106: 3, 111: 3,
};
// 视频智能分析：子 code -> 父 code（示例）
const VIDEO_AI_PARENT = {
  142: 140, 144: 140, 145: 140, 146: 140, 147: 140, 148: 140, 149: 140, 150: 140, 151: 140,
  204: 200, 205: 200, 206: 200, 207: 200, 208: 200, 209: 200, 210: 200, 211: 200, 212: 200,
  134: 130, 135: 130, 136: 130, 137: 130, 138: 130, 139: 130, 140: 130, 141: 130,
};

/**
 * 将前端/控制器传入的 searchParams 转为广大大 API 的 body
 * @param {Object} searchParams - 包含 keyWord, page, pageSize, startTime, endTime, sort_field, duplicate_removal 及 guangdada* 等
 */
export function buildGuangdadaRequestBody(searchParams = {}) {
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
    guangdadaAdvertiserSystem,
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
    exclude_keyword,
  } = searchParams;

  let seenBegin = paramSeenBegin;
  let seenEnd = paramSeenEnd;
  if (seenBegin == null || seenEnd == null) {
    if (startTime && endTime) {
      seenBegin = Math.floor(new Date(startTime).getTime() / 1000);
      seenEnd = Math.floor(new Date(endTime).getTime() / 1000);
    } else {
      seenBegin = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
      seenEnd = Math.floor(Date.now() / 1000);
    }
  }

  const pageSizeNum = Math.min(60, parseInt(page_size ?? pageSize, 10) || 60);
  const sortFieldApi = SORT_FIELD_MAP[sort_field] || sort_field || '-first_seen';

  const body = {
    page: Math.max(1, Math.min(500, parseInt(page, 10) || 1)),
    page_size: pageSizeNum,
    seen_begin: seenBegin,
    seen_end: seenEnd,
    sort_field: sortFieldApi,
    duplicate_removal: parseInt(duplicate_removal, 10) || 0,
    search_type: guangdadaExactSearch !== false ? 1 : 0,
    complete_country_match: !!guangdadaOnlyInSelectedRegion,
    fb_merge: Array.isArray(guangdadaChannels) && guangdadaChannels.includes('merge_facebook'),
    new_ads_flag: guangdadaNewAds ? 1 : 0,
    original_flag: (guangdadaCreativeForm === '广告原帖') ? 1 : 0,
    is_dynamic: (guangdadaCreativeForm === '动态广告') ? 1 : 0,
    landing_page: 0,
  };

  body.app_type = (guangdadaPrimaryTab === '工具') ? 2 : 1;
  if (guangdadaPrimaryTab === '电商') body.app_type = 3;
  if (body.app_type === 2) {
    body.is_theater = guangdadaIsTheater ? 1 : 0;
    body.is_ai_app = guangdadaIsAiApp ? 1 : 0;
  }
  const positionMap = { '综合': 0, '广告文案': 1, '广告主': 2, '投放主页': 4, '落地页域名': 6 };
  if (guangdadaSearchType && positionMap[guangdadaSearchType] != null) {
    body.position = positionMap[guangdadaSearchType];
  }

  if (keyWord != null && String(keyWord).trim() !== '') {
    body.keyword = String(keyWord).trim();
  }
  if (Array.isArray(exclude_keyword) && exclude_keyword.length > 0) {
    body.exclude_keyword = exclude_keyword.slice(0, 7);
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

  if (body.app_type === 1) {
    const gameCodes = Array.isArray(guangdadaGameCategoryCodes) && guangdadaGameCategoryCodes.length > 0
      ? (guangdadaGameCategoryCodes || []).map((c) => parseInt(String(c), 10)).filter((c) => !Number.isNaN(c))
      : [];
    if (gameCodes.length > 0) body.tag_ids = gameCodes;
  }
  if (body.app_type === 2) {
    const explicitCodes = Array.isArray(guangdadaToolCategoryCodes) && guangdadaToolCategoryCodes.length > 0
      ? (guangdadaToolCategoryCodes || []).map((c) => parseInt(String(c), 10)).filter((c) => !Number.isNaN(c))
      : [];
    if (explicitCodes.length > 0) {
      body.tag_ids = explicitCodes;
    } else if (Array.isArray(guangdadaToolCategories) && guangdadaToolCategories.length > 0) {
      const toolTagIds = (guangdadaToolCategories || [])
        .flatMap((name) => TOOL_CATEGORY_TAG_IDS[name] || [])
        .map((c) => parseInt(String(c), 10))
        .filter((c) => !Number.isNaN(c));
      if (toolTagIds.length > 0) body.tag_ids = toolTagIds;
    }
  }
  if (body.app_type !== 2) {
    const core = splitCoreTrack(guangdadaCoreTrack);
    if (core.tag_ids.length > 0 && !(Array.isArray(body.tag_ids) && body.tag_ids.length > 0)) body.tag_ids = core.tag_ids;
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

  body.ads_promote_type = landingPageTypeToApi(guangdadaLandingPageType);
  body.is_preorder = preorderToApi(guangdadaPreorderAd);
  body.redirect_filter_type = linkTypeToApi(guangdadaLinkType);
  body.resume_or_new_ads = retargetingToApi(guangdadaRetargeting);
  body.monetization_model = monetizationToApi(guangdadaMonetizationType);

  if (guangdadaCta) {
    body.cta_type = guangdadaCta;
  }
  if (guangdadaPlacement) {
    body.ad_positions = [parseInt(guangdadaPlacement, 10)].filter((n) => !Number.isNaN(n));
  }
  body.account_flag = !!guangdadaIncludePageInfo;
  body.view_illegal = !!guangdadaViolationAd;
  body.end_card = guangdadaEndCard ? 1 : 0;

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
  const resolutionList = [...(attr.resolution || []), ...(attr.resolutionCustom || [])].filter(Boolean);
  if (resolutionList.length > 0) {
    body.material_size = resolutionList.map((s) => String(s).trim());
  }

  const aiImage = buildAiTagObject(guangdadaImageAnalysis, IMAGE_AI_PARENT);
  if (aiImage) body.ai_image_tag = aiImage;
  const aiVideo = buildAiTagObject(guangdadaVideoAnalysis, VIDEO_AI_PARENT);
  if (aiVideo) body.ai_video_tag = aiVideo;

  return body;
}
