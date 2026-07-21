import * as insightrackrService from '../services/puppeteerServiceInsightrackr.js';
import * as guangdadaService from '../services/puppeteerService.js';
import {
  isExternalSearchDebugEnabled,
  pushExternalSearchDebugEntry,
} from '../utils/externalSearchDebugStore.js';

function getKeyWord(req) {
  const v = req.body?.keyWord ?? req.query?.keyWord;
  return String(v ?? '').trim();
}

function resolveExternalSortBy(req) {
  const raw = String(req.body?.sortBy ?? req.query?.sortBy ?? '').trim().toLowerCase();
  // 默认热度；其余与前端 CreativeCardInsightrackr / 广大大 sort_field 对齐
  if (['exposure', 'impression', 'exposure_estimate', '曝光', '曝光估值', '曝光预估', '展示估值'].includes(raw)) {
    return { key: 'exposure', label: '曝光估值' };
  }
  if (['share', 'shares', 'share_count', '转发', '分享', '分享数', '转发数'].includes(raw)) {
    return { key: 'share', label: '分享数' };
  }
  if (['like', 'likes', 'like_count', '点赞', '点赞数'].includes(raw)) {
    return { key: 'like', label: '点赞' };
  }
  if (['comment', 'comments', 'comment_count', '评论', '评论数'].includes(raw)) {
    return { key: 'comment', label: '评论' };
  }
  return { key: 'heat', label: '热度' };
}

/** Insightrackr baseOption.sortField：5=点赞 6=评论 7=转发 15=曝光预估 17=素材热度 */
const INSIGHTRACKR_SORT_FIELD_BY_KEY = {
  heat: '17',
  exposure: '15',
  share: '7',
  like: '5',
  comment: '6',
};

/** 广大大 sort_field */
const GUANGDADA_SORT_FIELD_BY_KEY = {
  heat: '-heat_degree',
  exposure: '-impression',
  share: '-share_count',
  like: '-like_count',
  comment: '-comment_count',
};

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildRecentOneYearRangeYmd() {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  return { startYmd: formatYmd(start), endYmd: formatYmd(end) };
}

function buildRecentDaysRangeYmd(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { startYmd: formatYmd(start), endYmd: formatYmd(end) };
}

function resolveExternalTimeRange(req) {
  const raw = String(req.body?.timeRange ?? req.query?.timeRange ?? '').trim().toLowerCase();
  if (['7', '7d', '7天', 'day7', 'last7days'].includes(raw)) return { key: '7d', label: '7天', days: 7 };
  if (['30', '30d', '30天', 'day30', 'last30days'].includes(raw)) return { key: '30d', label: '30天', days: 30 };
  if (['90', '90d', '90天', 'day90', 'last90days'].includes(raw)) return { key: '90d', label: '90天', days: 90 };
  if (['1y', '365', '365d', '近一年', '一年', 'last1year', 'year'].includes(raw)) return { key: '1y', label: '近一年', days: 365 };
  return { key: '1y', label: '近一年', days: 365 };
}

/**
 * 解析外部时间范围，支持：
 * - 显式传入 startDate/endDate（YYYY-MM-DD）
 * - 否则回退到 timeRange（7d/30d/90d/1y）
 */
function resolveExternalDateRangeYmd(req) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const rawStart = req.body?.startDate ?? req.query?.startDate;
  const rawEnd = req.body?.endDate ?? req.query?.endDate;
  const startStr = rawStart != null ? String(rawStart).trim() : '';
  const endStr = rawEnd != null ? String(rawEnd).trim() : '';
  if (dateOnly.test(startStr) && dateOnly.test(endStr)) {
    return { startYmd: startStr, endYmd: endStr, source: 'explicit' };
  }
  const range = resolveExternalTimeRange(req);
  const ymd =
    range.days === 365 ? buildRecentOneYearRangeYmd() : buildRecentDaysRangeYmd(range.days);
  return { ...ymd, source: range.key, range };
}

/** 返回条数 topN：不直接作为上游单页 page_size，由内部分页拼接 */
const DEFAULT_EXTERNAL_TOP_N = 50;
const MAX_EXTERNAL_TOP_N = 500;

function resolveExternalTopN(req) {
  const raw = req.body?.topN ?? req.query?.topN;
  let n = parseInt(String(raw ?? DEFAULT_EXTERNAL_TOP_N), 10);
  if (!Number.isFinite(n) || n < 1) n = DEFAULT_EXTERNAL_TOP_N;
  if (n > MAX_EXTERNAL_TOP_N) n = MAX_EXTERNAL_TOP_N;
  return n;
}

const INSIGHTRACKR_INTERNAL_PAGE_SIZE = 40;
const GUANGDADA_INTERNAL_PAGE_SIZE = 60;
/** 单请求最多翻页次数（防止上游异常时死循环） */
const MAX_INTERNAL_PAGE_ATTEMPTS = 200;

function snapshotClientRequest(req) {
  return {
    method: req.method,
    path: (req.originalUrl || req.url || '').split('?')[0],
    query: req.query && typeof req.query === 'object' ? { ...req.query } : {},
    body:
      req.method === 'POST' && req.body && typeof req.body === 'object' ? { ...req.body } : undefined,
  };
}

function makeDebugSession(req, platform) {
  if (!isExternalSearchDebugEnabled()) return null;
  return { platform, clientRequest: snapshotClientRequest(req), steps: [] };
}

function shrinkHeavyArraysForDebug(obj, maxArrayKeep = 1) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [];
    const first = shrinkHeavyArraysForDebug(obj[0], maxArrayKeep);
    if (obj.length === 1) return [first];
    return {
      __truncated: true,
      length: obj.length,
      firstItem: first,
    };
  }
  const out = {};
  for (const k of Object.keys(obj)) {
    out[k] = shrinkHeavyArraysForDebug(obj[k], maxArrayKeep);
  }
  return out;
}

function finalizeExternalDebugSession(session, responsePayload) {
  if (!session) return;
  try {
    pushExternalSearchDebugEntry({
      platform: session.platform,
      clientRequest: session.clientRequest,
      steps: session.steps,
      externalApiResponse: shrinkHeavyArraysForDebug(responsePayload),
    });
  } catch {
    // 调试记录失败不影响主接口
  }
}

/**
 * 将 Puppeteer 层返回结果整理为外部接口可读的错误信息（登录过期、人机验证、挤下线等）
 * @param {'insightrackr'|'guangdada'} platform
 * @param {{ success?: boolean, code?: unknown, message?: string, data?: unknown } | null} serviceResult
 */
function normalizeExternalServiceError(platform, serviceResult) {
  if (!serviceResult || typeof serviceResult !== 'object') {
    return {
      errorKind: 'INTERNAL',
      clientCode: 'NO_RESULT',
      message: '服务未返回有效结果',
    };
  }
  const topCode = serviceResult?.code;
  const topMsg = String(serviceResult?.message || '').trim();
  const d = serviceResult?.data;

  if (topCode === 'NOT_LOGGED_IN') {
    return {
      errorKind: 'LOGIN_REQUIRED',
      clientCode: 'NOT_LOGGED_IN',
      message: '当前平台未在服务端登录，请在管理端完成登录后再调用本接口',
      hint: '调用对应平台的 /api/{platform}/login 或打开前端完成登录',
    };
  }
  if (topCode === 'NO_LOGIN_PAGE') {
    return {
      errorKind: 'BROWSER_SESSION_INVALID',
      clientCode: 'NO_LOGIN_PAGE',
      message: '浏览器登录会话已失效或页面已关闭，请重新登录该平台',
      hint: '请联系管理员重新登录该平台，或在运维侧重启浏览器服务',
    };
  }
  if (topCode === 'BROWSER_NOT_INITIALIZED') {
    return {
      errorKind: 'BROWSER_NOT_READY',
      clientCode: 'BROWSER_NOT_INITIALIZED',
      message: '浏览器未初始化，无法发起上游请求',
    };
  }

  const inner = d && typeof d === 'object' ? d : null;
  const innerCode = inner && typeof inner.code === 'number' ? inner.code : null;
  const innerMsg = inner && inner.message != null ? String(inner.message) : '';
  const bizId = inner && inner.id != null ? String(inner.id) : '';

  if (platform === 'insightrackr') {
    if (innerCode === -3106) {
      return {
        errorKind: 'LOGIN_EXPIRED',
        clientCode: 'INSIGHTRACKR_LOGIN_EXPIRED',
        message: 'Insightrackr（热云）登录已过期，请重新登录',
        hint: innerMsg || undefined,
      };
    }
    if (innerCode === -3108) {
      return {
        errorKind: 'TOKEN_EMPTY',
        clientCode: 'INSIGHTRACKR_TOKEN_EMPTY',
        message: 'Insightrackr 鉴权令牌为空或失效，请重新登录或刷新会话',
        hint: innerMsg || undefined,
      };
    }
  }

  if (platform === 'guangdada') {
    if (
      bizId === 'need_human_machine_verification' ||
      innerMsg === 'need_human_machine_verification' ||
      /need_human_machine/i.test(innerMsg)
    ) {
      return {
        errorKind: 'CAPTCHA_REQUIRED',
        clientCode: 'GUANGDADA_HUMAN_VERIFICATION',
        message: '广大大要求人机验证，请在服务器侧浏览器中完成验证后再重试',
        hint: '可通过 /health 中的远程调试连接 DevTools，在官网页面完成验证',
      };
    }
    if (bizId === 'MULTI DEVICE LOGIN' || /multi device login/i.test(innerMsg)) {
      return {
        errorKind: 'MULTI_DEVICE_LOGIN',
        clientCode: 'GUANGDADA_MULTI_DEVICE_LOGIN',
        message: '广大大账号已在其他设备登录，当前会话已下线，请重新登录',
      };
    }
    if (inner && inner.code === 401) {
      return {
        errorKind: 'SESSION_EXPIRED',
        clientCode: 'GUANGDADA_UNAUTHORIZED',
        message: '广大大接口返回未授权（401），登录可能已过期，请重新登录',
        hint: innerMsg || undefined,
      };
    }
    if (bizId && bizId !== 'SUCCESS') {
      return {
        errorKind: 'UPSTREAM_BUSINESS_ERROR',
        clientCode: 'GUANGDADA_BUSINESS_ERROR',
        message: innerMsg || `广大大业务错误：${bizId}`,
        hint: bizId,
      };
    }
  }

  if (typeof topCode === 'number') {
    if (topCode === 401) {
      return {
        errorKind: 'HTTP_UNAUTHORIZED',
        clientCode: 'HTTP_401',
        message: topMsg || '上游 HTTP 401，未授权或登录已失效',
      };
    }
    if (topCode === 403) {
      return {
        errorKind: 'HTTP_FORBIDDEN',
        clientCode: 'HTTP_403',
        message: topMsg || '上游 HTTP 403，拒绝访问',
      };
    }
    if (topCode >= 500) {
      return {
        errorKind: 'HTTP_SERVER_ERROR',
        clientCode: `HTTP_${topCode}`,
        message: topMsg || `上游 HTTP ${topCode}`,
      };
    }
  }

  return {
    errorKind: 'UNKNOWN',
    clientCode: 'UPSTREAM_ERROR',
    message: topMsg || '上游请求失败',
    hint: innerMsg || (bizId && bizId !== 'SUCCESS' ? bizId : undefined),
  };
}

function jsonExternalError(platform, baseMeta, serviceResult, extraMeta = {}) {
  const norm = normalizeExternalServiceError(platform, serviceResult);
  return {
    success: false,
    code: norm.clientCode,
    message: norm.message,
    data: serviceResult?.data ?? null,
    meta: {
      platform,
      errorKind: norm.errorKind,
      ...(norm.hint ? { hint: norm.hint } : {}),
      ...baseMeta,
      ...extraMeta,
      upstreamMessage: serviceResult?.message,
      upstreamCode: serviceResult?.code,
    },
  };
}

/** 广大大 list：HTTP 200 但 body.id 非 SUCCESS 时视为失败（否则会当成空列表） */
function guangdadaListBodyIsHardFailure(data) {
  if (!data || typeof data !== 'object') return false;
  const id = data.id;
  if (id == null) return false;
  if (id === 'SUCCESS') return false;
  return true;
}

/** Insightrackr：HTTP 200 但 data.code 为负时视为业务失败（如 -3106 登录过期） */
function insightrackrSearchBodyIsHardFailure(data) {
  if (!data || typeof data !== 'object') return false;
  const c = data.code;
  return typeof c === 'number' && c < 0;
}

function beijingSeenRangeFromYmd(startYmd, endYmd) {
  const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const beginMs = Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0) - BEIJING_OFFSET_MS;
  const endMs = Date.UTC(ey, em - 1, ed, 23, 59, 59, 999) - BEIJING_OFFSET_MS;
  return { seen_begin: Math.floor(beginMs / 1000), seen_end: Math.floor(endMs / 1000) };
}

/** 将 query/body 中的逗号分隔或数组形式统一转为字符串数组 */
function parseStringArrayParam(v) {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Insightrackr：统一入口参数 aspectRatio -> creativeList 中 gs 取值 */
function applyInsightrackrAspectRatio(creativeList, aspectRatioRaw) {
  const list = Array.isArray(creativeList) ? [...creativeList] : [];
  const raw = String(aspectRatioRaw ?? '').trim().toLowerCase();
  if (!raw) return list;
  let value = null;
  if (['landscape', '横版', '横', 'h'].includes(raw)) value = '1';
  else if (['portrait', '竖版', '竖', 'v'].includes(raw)) value = '2';
  else if (['square', '方形', '方', 's'].includes(raw)) value = '3';
  if (!value) return list;
  // 与前端 CreativeSpecSelector 保持一致：creativeKey "gs"
  list.push({ creativeKey: 'gs', creativeValue: value });
  return list;
}

/** 广大大：统一入口参数 materialType / guangdadaMediaType -> ads_type */
function resolveGuangdadaAdsTypeCodes(req) {
  const raw =
    req.body?.guangdadaMediaType ??
    req.query?.guangdadaMediaType ??
    req.body?.materialType ??
    req.query?.materialType ??
    '';
  const val = String(raw).trim().toLowerCase();
  if (!val) return [];
  const codes = [];
  if (['image', 'img', '图片'].includes(val)) codes.push(1);
  else if (['video', '视频'].includes(val)) codes.push(2);
  else if (['carousel', '轮播'].includes(val)) codes.push(3);
  else if (['html'].includes(val)) codes.push(4);
  else if (['playable', '试玩', '试玩广告'].includes(val)) codes.push(7);
  return codes;
}

/** 广大大：统一入口参数 aspectRatio -> ads_format（尺寸比例枚举值） */
function resolveGuangdadaAspectFormats(req) {
  const raw = String(req.body?.aspectRatio ?? req.query?.aspectRatio ?? '').trim().toLowerCase();
  if (!raw) return [];
  const portrait = ['1:2', '9:16', '3:4', '4:5'];
  const landscape = ['2:1', '16:9', '4:3', '5:4', 'banner'];
  const square = ['1:1'];
  if (['portrait', '竖版', '竖', 'v'].includes(raw)) return portrait;
  if (['landscape', '横版', '横', 'h'].includes(raw)) return landscape;
  if (['square', '方形', '方', 's'].includes(raw)) return square;
  if (['all', 'any', '全部'].includes(raw)) return [];
  return [];
}

/** 与上游列表字段路径一致（浅层探测，优先较浅路径） */
function extractListPath(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.data?.list)) return ['data', 'list'];
  if (Array.isArray(data.list)) return ['list'];
  if (Array.isArray(data.data?.rows)) return ['data', 'rows'];
  if (Array.isArray(data.rows)) return ['rows'];
  if (Array.isArray(data.data?.data?.list)) return ['data', 'data', 'list'];
  if (Array.isArray(data.data?.data?.rows)) return ['data', 'data', 'rows'];
  return null;
}

function pickList(data) {
  const path = extractListPath(data);
  if (!path) return [];
  let cur = data;
  for (const k of path) cur = cur[k];
  return cur;
}

function summarizeUpstreamResult(platform, result) {
  if (!result || typeof result !== 'object') {
    return { note: '无有效返回' };
  }
  const batch = pickList(result.data);
  const base = {
    puppeteerSuccess: !!result.success,
    httpOrServiceCode: result.code,
    message: result.message,
    listItemCount: batch.length,
  };
  if (platform === 'guangdada' && result.data && typeof result.data === 'object') {
    return {
      ...base,
      bodyId: result.data.id,
      bodyCode: result.data.code,
    };
  }
  if (platform === 'insightrackr' && result.data && typeof result.data === 'object') {
    return {
      ...base,
      dataCode: result.data.code,
    };
  }
  return base;
}

function deepCloneJson(v) {
  if (v === null || v === undefined) return v;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}

function setAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
}

function withTopNList(rawData, n = 50) {
  const list = pickList(rawData);
  const top = list.slice(0, n);
  return replaceDataList(rawData, top);
}

/**
 * 将合并后的列表写回与上游一致的结构：对上游 body 做 JSON 级深拷贝后仅替换列表，
 * 其它字段与嵌套对象保持与平台返回一致；列表元素仍为上游原始对象引用（字段不裁剪）。
 */
function replaceDataList(rawData, newList) {
  const path = extractListPath(rawData);
  const clone = deepCloneJson(rawData);
  if (!clone || typeof clone !== 'object') {
    return path && path[path.length - 1] === 'rows'
      ? { data: { rows: newList } }
      : { data: { list: newList } };
  }
  if (path) {
    setAtPath(clone, path, newList);
    return clone;
  }
  return { ...clone, data: { ...(clone.data && typeof clone.data === 'object' ? clone.data : {}), list: newList } };
}

/**
 * 广大大：单页固定 page_size=60，按 topN 多次请求后拼接（不向单页传入 topN）
 */
async function fetchGuangdadaSearchMerged(basePayload, topN, debugSession) {
  const pageSize = GUANGDADA_INTERNAL_PAGE_SIZE;
  const merged = [];
  let page = 1;
  let lastResult = null;
  while (merged.length < topN && page <= MAX_INTERNAL_PAGE_ATTEMPTS) {
    const payload = { ...basePayload, page, page_size: pageSize };
    const result = await guangdadaService.fetchSearchData(payload);
    lastResult = result;
    if (debugSession) {
      debugSession.steps.push({
        label: `广大大 creative/list 第 ${page} 页`,
        upstream: 'POST https://guangdada.net/napi/v1/creative/list',
        requestBody: deepCloneJson(payload),
        responseSummary: summarizeUpstreamResult('guangdada', result),
      });
    }
    if (!result?.success) {
      return { ok: false, merged, lastResult, pagesFetched: page, pageSize };
    }
    if (guangdadaListBodyIsHardFailure(result.data)) {
      return {
        ok: false,
        merged,
        lastResult: { ...result, success: false },
        pagesFetched: page,
        pageSize,
      };
    }
    const batch = pickList(result.data);
    if (!batch.length) break;
    for (const item of batch) {
      if (merged.length >= topN) break;
      merged.push(item);
    }
    if (batch.length < pageSize) break;
    page += 1;
  }
  return { ok: true, merged, lastResult, pagesFetched: page, pageSize };
}

/**
 * Insightrackr（热云）：单页固定 baseOption.pageSize=40，按 topN 多次请求后拼接
 */
async function fetchInsightrackrSearchMerged(basePayloadTemplate, topN, debugSession) {
  const pageSize = INSIGHTRACKR_INTERNAL_PAGE_SIZE;
  const merged = [];
  let pageIndex = 1;
  let lastResult = null;
  while (merged.length < topN && pageIndex <= MAX_INTERNAL_PAGE_ATTEMPTS) {
    const payload = {
      ...basePayloadTemplate,
      baseOption: {
        ...basePayloadTemplate.baseOption,
        pageIndex,
        pageSize,
      },
    };
    const result = await insightrackrService.fetchSearchData(payload);
    lastResult = result;
    if (debugSession) {
      debugSession.steps.push({
        label: `Insightrackr imagevideo/search 第 ${pageIndex} 页`,
        upstream: 'POST https://data.insightrackr.com/cas/api/v2/imagevideo/search',
        requestBody: deepCloneJson(payload),
        responseSummary: summarizeUpstreamResult('insightrackr', result),
      });
    }
    if (!result?.success) {
      return { ok: false, merged, lastResult, pagesFetched: pageIndex, pageSize };
    }
    if (insightrackrSearchBodyIsHardFailure(result.data)) {
      return {
        ok: false,
        merged,
        lastResult: { ...result, success: false },
        pagesFetched: pageIndex,
        pageSize,
      };
    }
    const batch = pickList(result.data);
    if (!batch.length) break;
    for (const item of batch) {
      if (merged.length >= topN) break;
      merged.push(item);
    }
    if (batch.length < pageSize) break;
    pageIndex += 1;
  }
  return { ok: true, merged, lastResult, pagesFetched: pageIndex, pageSize };
}

/** 外部接口：Insightrackr 素材查询（关键词、排序、时间范围；条数由 topN 决定，内部分页每页 40） */
export const externalInsightrackrTop50 = async (req, res) => {
  let debugSession = null;
  try {
    debugSession = makeDebugSession(req, 'insightrackr');
    const keyWord = getKeyWord(req);
    const sort = resolveExternalSortBy(req);
    const { startYmd, endYmd, range } = resolveExternalDateRangeYmd(req);
    const topN = resolveExternalTopN(req);
    if (!keyWord) {
      return res.status(200).json({ success: false, code: 400, message: 'keyWord 不能为空', data: null });
    }
    const insightrackrSortField = INSIGHTRACKR_SORT_FIELD_BY_KEY[sort.key] || '17';
    const countries = parseStringArrayParam(req.body?.countryLevel2 ?? req.query?.countryLevel2);
    const languages = parseStringArrayParam(req.body?.languages ?? req.query?.languages);
    const materialType = String(
      req.body?.materialType ?? req.query?.materialType ?? ''
    ).trim();
    const aspectRatioRaw = req.body?.aspectRatio ?? req.query?.aspectRatio;
    const payload = {
      keyWord,
      keyWordType: '0,1,2,3,4,6,8',
      keyWordList: [],
      keyWordListType: true,
      isNew: false,
      creativeList: [],
      appealTypeList: [],
      interactionList: [],
      languages,
      productIds: [],
      classIds: [],
      seelTargets: [],
      webTools: [],
      demoadFormats: [],
      adMediaType: [],
      materialRemovalRepeat: false,
      materialType,
      creativeTeam: [],
      materialTag: [],
      baseOption: {
        permission: false,
        putOverseaInland: null,
        tradeLevel1: [],
        tradeLevel2: [],
        tradeLevel3: [],
        subjectType: [],
        countryLevel2: countries,
        adfactionIds: [],
        mediaIds: [],
        device: [],
        topicType: [],
        dayMode: 'DD',
        productModel: [],
        startTime: startYmd,
        endTime: endYmd,
        compareEndDate: '',
        compareStartDate: '',
        pageIndex: 1,
        pageSize: INSIGHTRACKR_INTERNAL_PAGE_SIZE,
        sortField: insightrackrSortField,
        sortRule: 'desc',
        gptSearch: true,
        globalSearch: false,
        materialTopLimit: '',
        szfxList: [],
      },
      insightrackrSearchTab: 'imagevideo',
      productOption: {
        productType: [],
        selling: [],
        monetization: [],
        payType: [],
        companyLocation: [],
        campaignList: [],
      },
    };
    // 画面比例：通过 creativeList 中 gs 维度表达（1-横版 2-竖版 3-方形）
    payload.creativeList = applyInsightrackrAspectRatio(payload.creativeList, aspectRatioRaw);
    const { ok, merged, lastResult, pagesFetched, pageSize } = await fetchInsightrackrSearchMerged(
      payload,
      topN,
      debugSession
    );
    if (!ok) {
      const errBody = jsonExternalError(
        'insightrackr',
        { keyWord, topN, internalPageSize: pageSize, pagesFetched },
        lastResult
      );
      finalizeExternalDebugSession(debugSession, errBody);
      return res.status(200).json(errBody);
    }
    const data = replaceDataList(lastResult?.data, merged);
    const okBody = {
      success: !!lastResult?.success,
      code: lastResult?.code ?? 200,
      message: lastResult?.message || 'ok',
      data,
      meta: {
        keyWord,
        sortBy: sort.label,
        timeRange: range?.label || undefined,
        topN,
        sortField: insightrackrSortField,
        sortRule: 'desc',
        startTime: startYmd,
        endTime: endYmd,
        returned: merged.length,
        internalPageSize: pageSize,
        pagesFetched,
      },
    };
    finalizeExternalDebugSession(debugSession, okBody);
    return res.status(200).json(okBody);
  } catch (error) {
    const errBody = {
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Insightrackr 外部查询异常: ${error.message || '未知错误'}`,
      data: null,
      meta: {
        platform: 'insightrackr',
        errorKind: 'INTERNAL',
        hint: '若为浏览器/页面崩溃，可在健康检查页查看浏览器状态或重启服务',
      },
    };
    finalizeExternalDebugSession(debugSession, errBody);
    return res.status(200).json(errBody);
  }
};

/** 外部接口：广大大素材查询（关键词、排序、时间范围；条数由 topN 决定，内部分页每页 60） */
export const externalGuangdadaTop50 = async (req, res) => {
  return res.status(503).json({
    success: false,
    code: 503,
    message: '广大大外部查询接口已临时禁用，以避免频繁拉取影响账户健康',
    data: null,
  });

  let debugSession = null;
  try {
    debugSession = makeDebugSession(req, 'guangdada');
    const keyWord = getKeyWord(req);
    const sort = resolveExternalSortBy(req);
    const { startYmd, endYmd, range } = resolveExternalDateRangeYmd(req);
    const topN = resolveExternalTopN(req);
    if (!keyWord) {
      return res.status(200).json({ success: false, code: 400, message: 'keyWord 不能为空', data: null });
    }
    const { seen_begin, seen_end } = beijingSeenRangeFromYmd(startYmd, endYmd);

    /** 与官网一致：纯文本关键词直连 creative/list，keyword 为数组、search_type=1，无需 multi-modal-search */
    const guangdadaSortField = GUANGDADA_SORT_FIELD_BY_KEY[sort.key] || '-heat_degree';
    const country = parseStringArrayParam(
      req.body?.guangdadaCountry ?? req.query?.guangdadaCountry
    );
    const copyLangs = parseStringArrayParam(
      req.body?.guangdadaCopyLangs ?? req.query?.guangdadaCopyLangs
    );
    const adsTypeCodes = resolveGuangdadaAdsTypeCodes(req);
    const aspectFormats = resolveGuangdadaAspectFormats(req);
    const payload = {
      keyword: [keyWord],
      page: 1,
      page_size: GUANGDADA_INTERNAL_PAGE_SIZE,
      seen_begin,
      seen_end,
      sort_field: guangdadaSortField,
      duplicate_removal: 0,
      search_type: 1,
      complete_country_match: false,
      fb_merge: false,
      new_ads_flag: 0,
      new_advertiser_flag: false,
      original_flag: 0,
      is_dynamic: 0,
      landing_page: 0,
      app_type: 1,
      position: '0',
    };
    if (country.length > 0) payload.geo = country;
    if (copyLangs.length > 0) payload.language = copyLangs;
    if (adsTypeCodes.length > 0) payload.ads_type = adsTypeCodes;
    if (aspectFormats.length > 0) payload.ads_format = aspectFormats;
    const { ok, merged, lastResult, pagesFetched, pageSize } = await fetchGuangdadaSearchMerged(
      payload,
      topN,
      debugSession
    );
    if (!ok) {
      const errBody = jsonExternalError(
        'guangdada',
        {
          keyWord,
          topN,
          internalPageSize: pageSize,
          pagesFetched,
        },
        lastResult
      );
      finalizeExternalDebugSession(debugSession, errBody);
      return res.status(200).json(errBody);
    }
    const data = replaceDataList(lastResult?.data, merged);
    const okBody = {
      success: !!lastResult?.success,
      code: lastResult?.code ?? 200,
      message: lastResult?.message || 'ok',
      data,
      meta: {
        keyWord,
        sortBy: sort.label,
        timeRange: range?.label || undefined,
        topN,
        sort_field: guangdadaSortField,
        seen_begin,
        seen_end,
        startTime: startYmd,
        endTime: endYmd,
        returned: merged.length,
        internalPageSize: pageSize,
        pagesFetched,
        listRequestMode: 'keyword_array_search_type_1',
      },
    };
    finalizeExternalDebugSession(debugSession, okBody);
    return res.status(200).json(okBody);
  } catch (error) {
    const errBody = {
      success: false,
      code: 'INTERNAL_ERROR',
      message: `广大大外部查询异常: ${error.message || '未知错误'}`,
      data: null,
      meta: {
        platform: 'guangdada',
        errorKind: 'INTERNAL',
        hint: '若为浏览器/页面崩溃，可在健康检查页查看浏览器状态或重启服务',
      },
    };
    finalizeExternalDebugSession(debugSession, errBody);
    return res.status(200).json(errBody);
  }
};
