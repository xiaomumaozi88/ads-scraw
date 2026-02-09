import * as puppeteerService from '../services/puppeteerService.js';

/**
 * 广大大搜索：由后端在已登录的浏览器中请求 guangdada.net/napi/v1/creative/list
 * 前端需先登录，后端浏览器登录后跳转到 display-ads 并持久化认证信息，查询时在浏览器内发起请求
 */
export const search = async (req, res) => {
  try {
    const searchParams = req.body || {};
    const result = await puppeteerService.fetchSearchData(searchParams);

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

/** 广大大素材内容多模态搜索：仅请求 multi-modal-search 返回 multimodal_md5，供前端显式调用；请求体与广大大实际参数一致 */
export const multiModalSearch = async (req, res) => {
  try {
    const body = req.body || {};
    const params = {
      multimodal_search_type: body.multimodal_search_type != null ? String(body.multimodal_search_type) : '1',
      multimodal_search_content: body.multimodal_search_content != null ? String(body.multimodal_search_content).trim() : (body.keyword != null ? String(body.keyword).trim() : ''),
      snapshot_flag: body.snapshot_flag != null ? String(body.snapshot_flag) : 'false',
    };
    const result = await puppeteerService.fetchMultiModalSearch(params);
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
    const { ad_key, app_type, search_flag } = req.query || req.body || {};
    const result = await puppeteerService.fetchCreativeDetail({
      ad_key,
      app_type: app_type != null ? Number(app_type) : 1,
      search_flag: search_flag != null ? Number(search_flag) : undefined
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
    console.error('广大大创意详情失败:', error);
    res.status(200).json({
      data: null,
      success: false,
      code: 500,
      message: `请求创意详情失败: ${error.message || '未知错误'}`
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
