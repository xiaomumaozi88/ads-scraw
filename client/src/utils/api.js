const API_BASE = '/api';

/** 需走代理的 CDN 域名（防盗链会导致部署到非白名单域名时 403，通过后端代理可正常播放） */
const PROXY_MEDIA_HOST_SUFFIXES = ['zingfront.com'];

/**
 * 返回通过后端代理下载图片的 URL，用于直接触发浏览器下载（避免跨域时只能新标签打开）。
 * 仅用于白名单域名内的 app icon 等图片。
 */
export function getDownloadImageUrl(url, filename = 'app-icon.png') {
  if (!url || typeof url !== 'string') return '';
  return `${API_BASE}/download-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

/**
 * 若 url 属于需代理的 CDN，返回代理地址；否则返回原 url。
 * 用于广大大等视频/图片在部署到 IP 或非白名单域名时的播放与展示。
 */
export function getProxiedMediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const needProxy = PROXY_MEDIA_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
    if (needProxy) return `${API_BASE}/proxy-media?url=${encodeURIComponent(url)}`;
  } catch (_) {}
  return url;
}

/** 请求失败时的统一提示文案：message + 请重试 */
export function formatRequestError(message) {
  const msg = message && String(message).trim();
  return msg ? `${msg}，请重试。` : '请重试。';
}

export async function getStatus(platform) {
  // 使用相对路径，localhost 与 IP 访问都会走当前页面的 origin，由 Vite 代理到后端；登录状态在后端共享
  const response = await fetch(`${API_BASE}/${platform}/status`, {
    credentials: 'same-origin',
  });
  const result = await response.json();
  // 统一从 data.status 读取，兼容 200 且 success: false 时仍有 data
  if (result && result.data == null && !response.ok) {
    throw new Error(result.message || `请求失败: ${response.status}`);
  }
  return result;
}

export async function login(platform, email, password) {
  const response = await fetch(`${API_BASE}/${platform}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return await response.json();
}

export async function clearLogin(platform) {
  const response = await fetch(`${API_BASE}/${platform}/clearLogin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}

// 需要重新登录的错误码
const LOGIN_REQUIRED_CODES = ['NOT_LOGGED_IN', 'NO_LOGIN_PAGE'];

export async function searchData(platform, searchParams) {
  const response = await fetch(`${API_BASE}/${platform}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchParams),
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    if (response.status === 401 && text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.data && (parsed.data.id === 'MULTI DEVICE LOGIN' || /multi device login/i.test(String(parsed.data.message || parsed.message || '')))) {
          const loginError = new Error(parsed.data?.message || parsed.message || '账号已在其他设备登录，当前已下线');
          loginError.code = 401;
          loginError.requiresLogin = true;
          throw loginError;
        }
      } catch (e) {
        if (e.requiresLogin) throw e;
      }
    }
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`期望 JSON 响应，但收到: ${contentType || '未知类型'}. 响应内容: ${text.substring(0, 200)}`);
  }
  if (!text || text.trim() === '') {
    throw new Error('服务器返回空响应');
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    console.error('JSON 解析失败，响应内容:', text);
    throw new Error(`JSON 解析失败: ${error.message}. 响应内容: ${text.substring(0, 200)}`);
  }

  // 检查是否需要重新登录：顶层 code 或 data.code（如 Insightrackr -3106 Login expired）
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const loginError = new Error(result.message || '需要重新登录');
    loginError.code = result.code;
    loginError.requiresLogin = true;
    throw loginError;
  }
  if (result.data && result.data.code === -3106) {
    const loginError = new Error(result.data.message || result.data.msg || 'Login expired');
    loginError.code = -3106;
    loginError.requiresLogin = true;
    throw loginError;
  }
  // 广大大：401 且 multi device login 表示被其他设备挤下线，需切换为未登录
  if (result.code === 401 && result.data && (
    result.data.id === 'MULTI DEVICE LOGIN' ||
    /multi device login/i.test(String(result.data.message || '')) ||
    /multi device login/i.test(String(result.message || ''))
  )) {
    const loginError = new Error(result.data?.message || result.message || '账号已在其他设备登录，当前已下线');
    loginError.code = 401;
    loginError.requiresLogin = true;
    throw loginError;
  }

  return result;
}

/** 广大大素材内容多模态搜索：显式请求 multi-modal-search，返回 multimodal_md5；请求体与广大大实际参数一致，便于在 Network 中查看 */
export async function guangdadaMultiModalSearch(keyword) {
  const multimodal_search_content = keyword != null
    ? (typeof keyword === 'string' ? keyword.trim() : (Array.isArray(keyword) && keyword.length > 0 ? String(keyword[0]).trim() : ''))
    : '';
  const response = await fetch(`${API_BASE}/guangdada/multi-modal-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      multimodal_search_type: '1',
      multimodal_search_content: multimodal_search_content || '',
      snapshot_flag: 'false',
    }),
  });
  const result = await response.json();
  return result;
}

// 广大大广告主联想（搜索框输入时下拉列表）
export async function getGuangdadaAdvertiserAssociation(keyword, appType = 1) {
  const k = keyword != null ? String(keyword).trim() : '';
  if (!k) return { success: true, data: { advertiser_list: [] } };
  const params = new URLSearchParams({ association_kwd: k, app_type: String(appType) });
  const response = await fetch(`${API_BASE}/guangdada/advertiser-association?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin'
  });
  const result = await response.json();
  return result;
}

// 获取数据总数（count 接口：Insightrackr、广大大）
export async function getCount(platform, searchParams) {
  if (platform !== 'insightrackr' && platform !== 'guangdada') {
    throw new Error('Count 接口仅支持 Insightrackr、广大大 平台');
  }

  const response = await fetch(`${API_BASE}/${platform}/count`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchParams),
  });
  
  // 检查响应状态
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }
  
  // 检查响应内容类型
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`期望 JSON 响应，但收到: ${contentType || '未知类型'}. 响应内容: ${text.substring(0, 200)}`);
  }
  
  // 获取响应文本以便调试
  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error('服务器返回空响应');
  }
  
  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    console.error('JSON 解析失败，响应内容:', text);
    throw new Error(`JSON 解析失败: ${error.message}. 响应内容: ${text.substring(0, 200)}`);
  }
  
  // 检查是否需要重新登录（含 data.code === -3106）
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const loginError = new Error(result.message || '需要重新登录');
    loginError.code = result.code;
    loginError.requiresLogin = true;
    throw loginError;
  }
  if (result.data && result.data.code === -3106) {
    const loginError = new Error(result.data.message || result.data.msg || 'Login expired');
    loginError.code = -3106;
    loginError.requiresLogin = true;
    throw loginError;
  }
  // 广大大：401 且 multi device login 表示被其他设备挤下线
  if (result.code === 401 && result.data && (
    result.data.id === 'MULTI DEVICE LOGIN' ||
    /multi device login/i.test(String(result.data.message || '')) ||
    /multi device login/i.test(String(result.message || ''))
  )) {
    const loginError = new Error(result.data?.message || result.message || '账号已在其他设备登录，当前已下线');
    loginError.code = 401;
    loginError.requiresLogin = true;
    throw loginError;
  }

  return result;
}

// Insightrackr 全局搜索（search-global）：每次请求都带 baseOption
const INSIGHTRACKR_SEARCH_GLOBAL_BASE_OPTION = {
  sortField: '3',
  sortRule: 'desc',
  dayMode: 'ALL',
  gptSearch: false
};

// Insightrackr 全局搜索（search-global）：应用/产品、开发者；全局搜索时发两请求 searchType "1"（左侧Apps）与 "2"（右侧开发者旗下APP），均带 baseOption
export async function getInsightrackrSearchGlobal(keyWord, searchType = '1') {
  const k = keyWord != null ? String(keyWord).trim() : '';
  if (!k) return { success: true, data: { productList: [], companyList: [] } };
  const response = await fetch(`${API_BASE}/insightrackr/search-global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      keyWord: k,
      searchType: String(searchType),
      baseOption: INSIGHTRACKR_SEARCH_GLOBAL_BASE_OPTION
    })
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type');
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`期望 JSON 响应，但收到: ${contentType || '未知类型'}`);
  }
  if (!text || text.trim() === '') throw new Error('服务器返回空响应');
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  if (result.data && result.data.code === -3106) {
    const err = new Error(result.data.message || result.data.msg || 'Login expired');
    err.code = -3106;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 流量分布渠道（Insightrackr）- body 为搜索参数 + ids（当前列表创意 id 数组）
export async function getDistributeMedia(platform, body) {
  if (platform !== 'insightrackr') {
    throw new Error('distribute/media 仅支持 Insightrackr');
  }
  const response = await fetch(`${API_BASE}/${platform}/distribute/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  if (result.data && result.data.code === -3106) {
    const err = new Error(result.data.message || result.data.msg || 'Login expired');
    err.code = -3106;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广大大创意详情（detail-v2），返回文案语言、地区、素材尺寸、material_id 等
export async function getGuangdadaCreativeDetail(params) {
  const { ad_key, app_type = 1, search_flag } = params || {};
  const qs = new URLSearchParams();
  if (ad_key) qs.set('ad_key', ad_key);
  if (app_type != null) qs.set('app_type', String(app_type));
  if (search_flag != null) qs.set('search_flag', String(search_flag));
  const response = await fetch(`${API_BASE}/guangdada/creative-detail?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

/** 广大大隐藏信息（hidden-info），用于「不看该广告主创意」获取 advertiser_id；需已登录 */
export async function getGuangdadaHiddenInfo(params) {
  const { ad_key, app_type = 1, created_at } = params || {};
  const qs = new URLSearchParams();
  if (ad_key) qs.set('ad_key', ad_key);
  if (app_type != null) qs.set('app_type', String(app_type));
  if (created_at != null) qs.set('created_at', String(created_at));
  const response = await fetch(`${API_BASE}/guangdada/hidden-info?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

/** 广大大文案翻译（走后端代理，需已登录）text 为字符串，target_lan 如 zh-CN / en，返回译文字符串 */
export async function translateTextGuangdada(text, target_lan = 'zh-CN') {
  const response = await fetch(`${API_BASE}/guangdada/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      text: text != null ? String(text).trim() : '',
      target_lan: target_lan && String(target_lan).trim() ? String(target_lan).trim() : 'zh-CN',
    }),
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  if (!result.success) throw new Error(result.message || '翻译失败');
  const list = result.data?.result;
  if (Array.isArray(list) && list.length > 0) return list[0];
  return '';
}

// 广大大使用相同素材的其他广告主（相似广告主）
export async function getGuangdadaRelatedAdvertisers(body) {
  const response = await fetch(`${API_BASE}/guangdada/related-advertisers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广大大使用相同素材的其他广告（关联广告）
export async function getGuangdadaRelatedAds(body) {
  const response = await fetch(`${API_BASE}/guangdada/related-ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广大大相似素材推荐（similar-ads）
export async function getGuangdadaSimilarAds(body) {
  const response = await fetch(`${API_BASE}/guangdada/similar-ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广大大创意每日人气趋势（daily-popularity），用于数据趋势折线图
export async function getGuangdadaDailyPopularity(params) {
  const qs = new URLSearchParams();
  const { creative_key, first_seen, last_seen, app_type = 1, platform = 'admob', category } = params || {};
  if (creative_key) qs.set('creative_key', creative_key);
  if (first_seen != null) qs.set('first_seen', String(first_seen));
  if (last_seen != null) qs.set('last_seen', String(last_seen));
  if (app_type != null) qs.set('app_type', String(app_type));
  if (platform != null) qs.set('platform', String(platform));
  if (category != null && category !== '') qs.set('category', String(category));
  const response = await fetch(`${API_BASE}/guangdada/daily-popularity?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广大大相似广告主推荐（adv-rec-list），用于概览「相似广告主」
export async function getGuangdadaAdvRecList(body) {
  const response = await fetch(`${API_BASE}/guangdada/adv-rec-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广大大广告主概览（agg-advertiser），用于右侧 Drawer
export async function getGuangdadaAdvertiserDetail(params) {
  const qs = new URLSearchParams();
  if (params?.domain) qs.set('domain', params.domain);
  const response = await fetch(`${API_BASE}/guangdada/advertiser-detail?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 广告发行商/App 信息（Insightrackr）- body 为搜索参数 + ids
export async function getDistributeApp(platform, body) {
  if (platform !== 'insightrackr') {
    throw new Error('distribute/app 仅支持 Insightrackr');
  }
  const response = await fetch(`${API_BASE}/${platform}/distribute/app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }
  const result = await response.json();
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  if (result.data && result.data.code === -3106) {
    const err = new Error(result.data.message || result.data.msg || 'Login expired');
    err.code = -3106;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}
