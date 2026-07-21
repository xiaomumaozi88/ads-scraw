import * as puppeteerService from '../services/puppeteerService.js';
import {
  GUANGDADA_QUOTA_EXCEEDED_CODE,
  consumeGuangdadaQuota,
  getGuangdadaQuotaStatus,
} from '../services/guangdadaQuotaService.js';
import { auditPlatformRequest } from '../services/auditLogService.js';

const CREATIVE_RANK_CACHE_TTL_MS = 10 * 60 * 1000;
const CREATIVE_RANK_CACHE_LIMIT = 120;
const creativeRankCache = new Map();

function normalizeCacheValue(value) {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeCacheValue(item));
    const sortable = normalized.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item));
    return sortable ? [...normalized].sort((a, b) => String(a).localeCompare(String(b))) : normalized;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = normalizeCacheValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function getStableCacheKey(value) {
  return JSON.stringify(normalizeCacheValue(value));
}

function getCreativeRankCacheEntry(cacheKey) {
  const entry = creativeRankCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CREATIVE_RANK_CACHE_TTL_MS) {
    creativeRankCache.delete(cacheKey);
    return null;
  }
  return entry;
}

function setCreativeRankCacheEntry(cacheKey, payload) {
  creativeRankCache.set(cacheKey, {
    payload,
    cachedAt: Date.now(),
  });
  if (creativeRankCache.size > CREATIVE_RANK_CACHE_LIMIT) {
    const oldestKey = creativeRankCache.keys().next().value;
    creativeRankCache.delete(oldestKey);
  }
}

function getQuotaTargetAccount(quotaResult) {
  const account = quotaResult?.quotaStatus?.account;
  return account?.email || account?.username || (account?.userId != null ? String(account.userId) : null);
}

function recordGuangdadaRequest(req, {
  quotaResult,
  endpoint,
  requestAction,
  quotaKey,
  quotaAmount = 1,
  success,
  blocked = false,
  message,
  metadata = {},
}) {
  auditPlatformRequest({
    platform: 'guangdada',
    operatorProfile: req.iamProfile,
    targetAccount: getQuotaTargetAccount(quotaResult),
    endpoint,
    requestAction,
    quotaKey,
    quotaAmount,
    success,
    blocked,
    message,
    metadata: {
      quotaRemaining: quotaResult?.quota?.remaining ?? null,
      quotaLimit: quotaResult?.quota?.limit ?? null,
      quotaUsed: quotaResult?.quota?.used ?? null,
      quotaCycle: quotaResult?.quota?.cycle ?? null,
      ...metadata,
    },
  });
}

function sendQuotaBlocked(req, res, quotaResult, context = {}) {
  recordGuangdadaRequest(req, {
    quotaResult,
    success: false,
    blocked: true,
    message: quotaResult.message || '广大大账户额度不足，已拦截请求',
    ...context,
  });
  return res.status(200).json({
    data: null,
    success: false,
    code: quotaResult.code || GUANGDADA_QUOTA_EXCEEDED_CODE,
    message: quotaResult.message || '广大大账户额度不足',
    quota: quotaResult.quota || null,
    quotaStatus: quotaResult.quotaStatus || null,
  });
}

function withQuotaStatus(payload, quotaResult) {
  return {
    ...payload,
    quotaStatus: quotaResult?.quotaStatus || null,
  };
}

export const quotaStatus = async (req, res) => {
  try {
    const forceRefresh = req.query?.force === '1' || req.query?.force === 'true';
    const status = await getGuangdadaQuotaStatus({ forceRefresh });
    res.status(200).json({
      data: status,
      success: true,
      code: 200,
      message: 'success',
    });
  } catch (error) {
    console.error('读取广大大额度状态失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: error.code || 'GUANGDADA_QUOTA_UNAVAILABLE',
      message: error.message || '读取广大大额度状态失败',
    });
  }
};

export const consumeQuota = async (req, res) => {
  try {
    const body = req.body || {};
    const quotaKey = body.quotaKey != null ? String(body.quotaKey).trim() : '';
    const amount = Math.max(1, Math.floor(Number(body.amount) || 1));
    if (!quotaKey) {
      return res.status(200).json({
        data: null,
        success: false,
        code: 400,
        message: '缺少 quotaKey',
      });
    }
    const quotaResult = await consumeGuangdadaQuota(quotaKey, amount, body.metadata || {});
    if (!quotaResult.allowed) {
      return sendQuotaBlocked(req, res, quotaResult, {
        endpoint: '/catalog/g1/quota-consume',
        requestAction: 'download',
        quotaKey,
        quotaAmount: amount,
        metadata: body.metadata || {},
      });
    }
    recordGuangdadaRequest(req, {
      quotaResult,
      endpoint: '/catalog/g1/quota-consume',
      requestAction: 'download',
      quotaKey,
      quotaAmount: amount,
      success: true,
      message: `下载额度已扣减 ${amount}`,
      metadata: body.metadata || {},
    });
    res.status(200).json({
      data: {
        quota: quotaResult.quota,
        quotaStatus: quotaResult.quotaStatus,
      },
      success: true,
      code: 200,
      message: 'success',
      quotaStatus: quotaResult.quotaStatus,
    });
  } catch (error) {
    console.error('消费广大大额度失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `消费广大大额度失败: ${error.message || '未知错误'}`,
    });
  }
};

/**
 * 广大大搜索：由后端在已登录的浏览器中请求 guangdada.net/napi/v1/creative/list
 * 前端需先登录，后端浏览器登录后跳转到 display-ads 并持久化认证信息，查询时在浏览器内发起请求
 */
export const search = async (req, res) => {
  try {
    const searchParams = req.body || {};
    const quotaResult = await consumeGuangdadaQuota('search', 1, {
      endpoint: '/catalog/g1/search',
      page: searchParams.page ?? searchParams.pageIndex ?? null,
      pageSize: searchParams.page_size ?? searchParams.pageSize ?? null,
      displayPage: searchParams.guangdadaDisplayPage ?? null,
    });
    if (!quotaResult.allowed) {
      return sendQuotaBlocked(req, res, quotaResult, {
        endpoint: '/catalog/g1/search',
        requestAction: 'search',
        quotaKey: 'search',
        quotaAmount: 1,
        metadata: {
          page: searchParams.page ?? null,
          displayPage: searchParams.guangdadaDisplayPage ?? null,
          pageSize: searchParams.page_size ?? searchParams.pageSize ?? null,
          appType: searchParams.app_type ?? null,
          searchCategory: searchParams.guangdadaSearchCategory ?? searchParams.guangdada_search_category ?? null,
        },
      });
    }

    const result = await puppeteerService.fetchSearchData(searchParams);
    recordGuangdadaRequest(req, {
      quotaResult,
      endpoint: '/catalog/g1/search',
      requestAction: 'search',
      quotaKey: 'search',
      quotaAmount: 1,
      success: !!result.success,
      message: result.success ? '搜索请求成功，已扣减搜索额度 1' : (result.message || '搜索请求失败'),
      metadata: {
        page: searchParams.page ?? null,
        displayPage: searchParams.guangdadaDisplayPage ?? null,
        pageSize: searchParams.page_size ?? searchParams.pageSize ?? null,
        appType: searchParams.app_type ?? null,
        searchCategory: searchParams.guangdadaSearchCategory ?? searchParams.guangdada_search_category ?? null,
      },
    });

    if (!result.success) {
      return res.status(200).json(withQuotaStatus({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      }, quotaResult));
    }

    res.status(200).json(withQuotaStatus({
      data: result.data,
      success: true,
      code: result.code,
      message: result.message
    }, quotaResult));
  } catch (error) {
    console.error('广大大搜索失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求搜索数据失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大 count 接口：参数与 search 一致，返回 all_total / default_total / result_total，用于分页 */
export const count = async (req, res) => {
  try {
    const searchParams = req.body || {};
    const result = await puppeteerService.fetchCountData(searchParams);
    recordGuangdadaRequest(req, {
      quotaResult: null,
      endpoint: '/catalog/g1/count',
      requestAction: 'count',
      quotaKey: 'count',
      quotaAmount: 0,
      success: !!result.success,
      message: result.success ? 'count 请求成功' : (result.message || 'count 请求失败'),
      metadata: {
        page: searchParams.page ?? null,
        displayPage: searchParams.guangdadaDisplayPage ?? null,
        pageSize: searchParams.page_size ?? searchParams.pageSize ?? null,
        appType: searchParams.app_type ?? null,
        searchCategory: searchParams.guangdadaSearchCategory ?? searchParams.guangdada_search_category ?? null,
      },
    });

    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }

    res.status(200).json({
      data: result.data,
      success: true,
      code: result.code,
      message: result.message
    });
  } catch (error) {
    console.error('广大大 count 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求 count 失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大素材内容多模态搜索：仅请求 multi-modal-search 返回 multimodal_md5，供前端显式调用；与 guangdada.net 一致：链接 type=3+content；图 type=2+file；视频文件 type=3+file；纯文本 type=1+content */
export const multiModalSearch = async (req, res) => {
  try {
    const body = req.body || {};
    const rawFile = body.file;
    const file =
      rawFile && typeof rawFile === 'object' && rawFile.base64 != null && String(rawFile.base64).trim() !== ''
        ? {
            base64: String(rawFile.base64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, ''),
            filename: String(rawFile.filename || rawFile.name || 'upload').slice(0, 512),
            mimeType: String(rawFile.mimeType || rawFile.type || 'application/octet-stream').slice(0, 128),
          }
        : null;
    const params = {
      multimodal_search_type: body.multimodal_search_type != null ? String(body.multimodal_search_type) : '1',
      multimodal_search_content:
        body.multimodal_search_content != null
          ? String(body.multimodal_search_content)
          : body.keyword != null
            ? String(body.keyword).trim()
            : '',
      snapshot_flag: body.snapshot_flag != null ? String(body.snapshot_flag) : 'false',
      file,
    };
    const quotaResult = await consumeGuangdadaQuota('multimodal_search', 1, {
      endpoint: '/catalog/g1/multi-modal-search',
      multimodal_search_type: params.multimodal_search_type,
      hasFile: !!file,
    });
    if (!quotaResult.allowed) {
      return sendQuotaBlocked(req, res, quotaResult, {
        endpoint: '/catalog/g1/multi-modal-search',
        requestAction: 'multimodal_search',
        quotaKey: 'multimodal_search',
        quotaAmount: 1,
        metadata: {
          multimodalSearchType: params.multimodal_search_type,
          hasFile: !!file,
        },
      });
    }

    const result = await puppeteerService.fetchMultiModalSearch(params);
    recordGuangdadaRequest(req, {
      quotaResult,
      endpoint: '/catalog/g1/multi-modal-search',
      requestAction: 'multimodal_search',
      quotaKey: 'multimodal_search',
      quotaAmount: 1,
      success: !!result.success,
      message: result.success ? '素材内容搜索成功，已扣减额度 1' : (result.message || '素材内容搜索失败'),
      metadata: {
        multimodalSearchType: params.multimodal_search_type,
        hasFile: !!file,
      },
    });
    if (!result.success) {
      return res.status(200).json(withQuotaStatus({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      }, quotaResult));
    }
    res.status(200).json(withQuotaStatus({
      data: result.data,
      success: true,
      code: result.code,
      message: result.message
    }, quotaResult));
  } catch (error) {
    console.error('广大大 multi-modal-search 失败:', error);
    res.status(200).json({
      data: { multimodal_md5: null },
      success: false,
      code: 500,
      message: `multi-modal-search 失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大广告主联想：搜索框输入时下拉展示广告主列表 */
export const advertiserAssociation = async (req, res) => {
  try {
    const { association_kwd, app_type } = req.query || req.body || {};
    const result = await puppeteerService.fetchAdvertiserAssociation({
      association_kwd: association_kwd != null ? String(association_kwd) : '',
      app_type: app_type != null ? Number(app_type) : 1
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message || 'success'
    });
  } catch (error) {
    console.error('广大大广告主联想失败:', error);
    res.status(200).json({
      data: { advertiser_list: [] },
      success: false,
      code: 500,
      message: `请求失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大素材内容属性：ai-tags-v2 */
export const aiTagsV2 = async (req, res) => {
  try {
    const { app_type } = req.query || req.body || {};
    const result = await puppeteerService.fetchAiTagsV2({
      app_type: app_type != null ? Number(app_type) : 1
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data || [],
        success: false,
        code: result.code,
        message: result.message
      });
    }
    res.status(200).json({
      data: result.data || [],
      success: true,
      code: 200,
      message: result.message || 'success'
    });
  } catch (error) {
    console.error('广大大 ai-tags-v2 失败:', error);
    res.status(200).json({
      data: [],
      success: false,
      code: 500,
      message: `请求素材内容属性失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大创意排行榜：creative-rank/list */
export const creativeRankList = async (req, res) => {
  try {
    const body = req.body || {};
    const requestBody = puppeteerService.normalizeCreativeRankListBody(body);
    const chartType = requestBody.chart_type ?? null;
    const appType = requestBody.app_type ?? null;
    const page = requestBody.page ?? null;
    const pageSize = requestBody.page_size ?? null;
    const cacheKey = getStableCacheKey(requestBody);
    const cached = getCreativeRankCacheEntry(cacheKey);
    if (cached) {
      recordGuangdadaRequest(req, {
        quotaResult: null,
        endpoint: '/catalog/g1/creative-rank/list',
        requestAction: 'rank_list_cache',
        quotaKey: 'search',
        quotaAmount: 0,
        success: true,
        message: '创意排行榜命中缓存，未扣减搜索额度',
        metadata: { chartType, appType, page, pageSize, cacheHit: true },
      });
      return res.status(200).json({
        ...cached.payload,
        cached: true,
        fromCache: true,
      });
    }

    const quotaResult = await consumeGuangdadaQuota('search', 1, {
      endpoint: '/catalog/g1/creative-rank/list',
      chartType,
      appType,
      page,
      pageSize,
    });
    if (!quotaResult.allowed) {
      return sendQuotaBlocked(req, res, quotaResult, {
        endpoint: '/catalog/g1/creative-rank/list',
        requestAction: 'rank_list',
        quotaKey: 'search',
        quotaAmount: 1,
        metadata: { chartType, appType, page, pageSize },
      });
    }

    const result = await puppeteerService.fetchCreativeRankList(requestBody);
    recordGuangdadaRequest(req, {
      quotaResult,
      endpoint: '/catalog/g1/creative-rank/list',
      requestAction: 'rank_list',
      quotaKey: 'search',
      quotaAmount: 1,
      success: !!result.success,
      message: result.success ? '创意排行榜请求成功，已扣减搜索额度 1' : (result.message || '创意排行榜请求失败'),
      metadata: { chartType, appType, page, pageSize },
    });

    const responsePayload = withQuotaStatus({
      data: result.data,
      success: !!result.success,
      code: result.code,
      message: result.message,
    }, quotaResult);
    if (result.success) {
      setCreativeRankCacheEntry(cacheKey, responsePayload);
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('广大大创意排行榜失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求创意排行榜失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大隐藏信息（hidden-info），用于「不看该广告主创意」获取 advertiser_id */
export const hiddenInfo = async (req, res) => {
  try {
    const query = req.query || req.body || {};
    const ad_key = query.ad_key;
    const app_type = query.app_type != null ? Number(query.app_type) : 1;
    const created_at = query.created_at != null ? Number(query.created_at) : undefined;
    const result = await puppeteerService.fetchHiddenInfo({ ad_key, app_type, created_at });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message
    });
  } catch (error) {
    console.error('广大大 hidden-info 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大创意详情 detail-v2，用于弹窗展示文案语言、地区、素材尺寸、material_id 等 */
export const creativeDetail = async (req, res) => {
  try {
    const detailParams = { ...(req.body || {}), ...(req.query || {}) };
    const { ad_key, app_type } = detailParams;
    const search_flag = detailParams.search_flag ?? detailParams.search_fag;
    if (!ad_key) {
      return res.status(200).json({
        data: null,
        success: false,
        code: 400,
        message: '缺少 ad_key'
      });
    }
    const quotaResult = await consumeGuangdadaQuota('ads_detail', 1, {
      endpoint: '/catalog/g1/creative-detail',
      ad_key,
      app_type,
    });
    if (!quotaResult.allowed) {
      return sendQuotaBlocked(req, res, quotaResult, {
        endpoint: '/catalog/g1/creative-detail',
        requestAction: 'ads_detail',
        quotaKey: 'ads_detail',
        quotaAmount: 1,
        metadata: {
          adKey: ad_key,
          appType: app_type,
        },
      });
    }

    const result = await puppeteerService.fetchCreativeDetail({
      ad_key,
      app_type: app_type != null ? Number(app_type) : 1,
      search_flag: search_flag != null ? Number(search_flag) : undefined
    });
    recordGuangdadaRequest(req, {
      quotaResult,
      endpoint: '/catalog/g1/creative-detail',
      requestAction: 'ads_detail',
      quotaKey: 'ads_detail',
      quotaAmount: 1,
      success: !!result.success,
      message: result.success ? '创意详情请求成功，已扣减详情额度 1' : (result.message || '创意详情请求失败'),
      metadata: {
        adKey: ad_key,
        appType: app_type,
      },
    });
    if (!result.success) {
      return res.status(200).json(withQuotaStatus({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      }, quotaResult));
    }
    res.status(200).json(withQuotaStatus({
      data: result.data,
      success: true,
      code: 200,
      message: result.message
    }, quotaResult));
  } catch (error) {
    console.error('广大大创意详情失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求创意详情失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大详情页关联版本：related-dynamic */
export const relatedDynamic = async (req, res) => {
  try {
    const query = req.query || req.body || {};
    const result = await puppeteerService.fetchRelatedDynamic({
      dynamic_number: query.dynamic_number,
      app_type: query.app_type != null ? Number(query.app_type) : 1,
      creative_key: query.creative_key || query.ad_key,
      platform: query.platform,
      created_at: query.created_at != null ? Number(query.created_at) : undefined,
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大 related-dynamic 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求关联版本失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大详情页榜单状态：rank-status */
export const rankStatus = async (req, res) => {
  try {
    const query = req.query || req.body || {};
    const result = await puppeteerService.fetchRankStatus({
      ad_key: query.ad_key,
      app_type: query.app_type != null ? Number(query.app_type) : 1,
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大 rank-status 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求榜单状态失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大详情页素材脚本分析：material-script-analysis */
export const materialScriptAnalysis = async (req, res) => {
  try {
    const query = req.query || req.body || {};
    const result = await puppeteerService.fetchMaterialScriptAnalysis({
      ad_key: query.ad_key,
      app_type: query.app_type != null ? Number(query.app_type) : 1,
      search_flag: query.search_flag != null ? Number(query.search_flag) : undefined,
      ads_type: query.ads_type != null ? Number(query.ads_type) : undefined,
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大 material-script-analysis 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求素材脚本分析失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大文案翻译（translate-text），需已登录 */
export const translateText = async (req, res) => {
  try {
    const body = req.body || {};
    const text = body.text;
    const target_lan = body.target_lan != null ? String(body.target_lan).trim() : 'zh-CN';
    const result = await puppeteerService.fetchTranslateText({ text, target_lan });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message
    });
  } catch (error) {
    console.error('广大大翻译失败:', error);
    res.status(200).json({
      data: { result: [] },
      success: false,
      code: 500,
      message: `翻译请求失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大创意每日人气趋势（daily-popularity），用于数据趋势折线图 */
export const dailyPopularity = async (req, res) => {
  try {
    const query = req.query || req.body || {};
    const { creative_key, first_seen, last_seen, app_type = 1, platform = 'admob', category } = query;
    const result = await puppeteerService.fetchDailyPopularity({
      creative_key,
      first_seen: first_seen != null ? Number(first_seen) : undefined,
      last_seen: last_seen != null ? Number(last_seen) : undefined,
      app_type: Number(app_type) || 1,
      platform: platform || 'admob',
      category: category != null && category !== '' ? String(category) : undefined,
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大 daily-popularity 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求数据趋势失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大使用相同素材的其他广告主（相似广告主） */
export const relatedAdvertisers = async (req, res) => {
  try {
    const body = req.body || {};
    const { app_type = 1, material_id, page = 1, created_at, page_size = 20 } = body;
    const result = await puppeteerService.fetchRelatedAdvertisers({
      app_type: Number(app_type) || 1,
      material_id,
      page: Number(page) || 1,
      created_at,
      page_size: Number(page_size) || 20
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message
    });
  } catch (error) {
    console.error('广大大 related-advertisers 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求相似广告主失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大使用相同素材的其他广告（关联广告） */
export const relatedAds = async (req, res) => {
  try {
    const body = req.body || {};
    const { app_type = 1, material_id, page = 1, created_at, page_size = 5 } = body;
    const result = await puppeteerService.fetchRelatedAds({
      app_type: Number(app_type) || 1,
      material_id,
      page: Number(page) || 1,
      created_at,
      page_size: Number(page_size) || 5
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        total: result.total,
        success: false,
        code: result.code,
        message: result.message
      });
    }
    res.status(200).json({
      data: result.data,
      total: result.total,
      success: true,
      code: 200,
      message: result.message
    });
  } catch (error) {
    console.error('广大大 related-ads 失败:', error);
    res.status(200).json({
      data: null,
      total: 0,
      success: false,
      code: 500,
      message: `请求关联广告失败: ${error.message || '未知错误'}`
    });
  }
};

/** 广大大广告主概览（agg-advertiser），用于右侧 Drawer */
export const advertiserDetail = async (req, res) => {
  try {
    const { domain } = req.query || {};
    const result = await puppeteerService.fetchAdvertiserDetail({ domain });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大广告主详情失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求广告主详情失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大相似广告主推荐（adv-rec-list） */
export const advRecList = async (req, res) => {
  try {
    const body = req.body || {};
    const { domain, app_type = 1, country = 'USA', page = 1, page_size = 8 } = body;
    const result = await puppeteerService.fetchAdvRecList({
      domain,
      app_type: Number(app_type) || 1,
      country: country || 'USA',
      page: Number(page) || 1,
      page_size: Number(page_size) || 8,
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      total: result.total,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大 adv-rec-list 失败:', error);
    res.status(200).json({
      data: null,
      total: 0,
      success: false,
      code: 500,
      message: `请求相似广告主失败: ${error.message || '未知错误'}`,
    });
  }
};

/** 广大大相似素材推荐（similar-ads） */
export const similarAds = async (req, res) => {
  try {
    const body = req.body || {};
    const { resource_url, ad_key, app_type = 1, created_at, similar_ads_count = 8 } = body;
    const result = await puppeteerService.fetchSimilarAds({
      resource_url,
      ad_key,
      app_type: Number(app_type) || 1,
      created_at,
      similar_ads_count: Number(similar_ads_count) || 8,
    });
    if (!result.success) {
      return res.status(200).json({
        data: result.data,
        success: false,
        code: result.code,
        message: result.message,
      });
    }
    res.status(200).json({
      data: result.data,
      success: true,
      code: 200,
      message: result.message,
    });
  } catch (error) {
    console.error('广大大 similar-ads 失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求相似素材失败: ${error.message || '未知错误'}`,
    });
  }
};
