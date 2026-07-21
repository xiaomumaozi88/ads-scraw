import { buildDomesticAdInfoQuery } from './guangdadaDomesticAdInfo';
import { API_BASE } from '../config/api';

const ACTION_TOKEN_REFRESH_SKEW_MS = 60 * 1000;
let actionTokenCache = null;
let actionTokenPromise = null;

function resolveUrl(url) {
  if (typeof window === 'undefined') return null;
  try {
    return new URL(url, window.location.origin);
  } catch {
    return null;
  }
}

function resolveApiBaseUrl() {
  if (typeof window === 'undefined') return null;
  try {
    return new URL(API_BASE, window.location.origin);
  } catch {
    return null;
  }
}

function apiRelativePath(url) {
  const requestUrl = resolveUrl(url);
  const baseUrl = resolveApiBaseUrl();
  if (!requestUrl || !baseUrl || requestUrl.origin !== baseUrl.origin) return '';
  const basePath = baseUrl.pathname.replace(/\/+$/, '') || '/api';
  if (requestUrl.pathname !== basePath && !requestUrl.pathname.startsWith(`${basePath}/`)) {
    return '';
  }
  const relative = requestUrl.pathname.slice(basePath.length) || '/';
  return relative.startsWith('/') ? relative : `/${relative}`;
}

function shouldAttachActionToken(url) {
  const path = apiRelativePath(url);
  if (!path) return false;
  return !(
    path === '/security/action-token'
    || path.startsWith('/security/action-token/')
    || path === '/iam'
    || path.startsWith('/iam/')
    || path === '/proxy-media'
    || path.startsWith('/proxy-media/')
    || path === '/download-image'
    || path.startsWith('/download-image/')
    || path === '/external'
    || path.startsWith('/external/')
  );
}

async function fetchActionToken() {
  const now = Date.now();
  if (
    actionTokenCache?.token
    && actionTokenCache.expiresAt
    && actionTokenCache.expiresAt - ACTION_TOKEN_REFRESH_SKEW_MS > now
  ) {
    return actionTokenCache.token;
  }

  if (!actionTokenPromise) {
    actionTokenPromise = fetch(`${API_BASE}/security/action-token`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.data?.token) {
          throw new Error(data.message || `获取操作令牌失败: ${res.status}`);
        }
        const expiresAt = Number(data.data.expiresAt) || Date.now() + 5 * 60 * 1000;
        actionTokenCache = {
          token: data.data.token,
          expiresAt,
        };
        return actionTokenCache.token;
      })
      .finally(() => {
        actionTokenPromise = null;
      });
  }

  return actionTokenPromise;
}

function clearActionTokenCache() {
  actionTokenCache = null;
  actionTokenPromise = null;
}

function buildRequestOptions(options, actionToken = null) {
  const requestOptions = { ...options };
  if (!requestOptions.credentials || requestOptions.credentials === 'same-origin') {
    requestOptions.credentials = 'include';
  }
  if (actionToken) {
    const headers = new Headers(requestOptions.headers || {});
    if (!headers.has('X-Action-Token')) {
      headers.set('X-Action-Token', actionToken);
    }
    requestOptions.headers = headers;
  }
  return requestOptions;
}

/** 带 Cookie 的 API 请求（IAM 会话） */
export async function apiFetch(url, options = {}) {
  const attachToken = shouldAttachActionToken(url);
  const token = attachToken ? await fetchActionToken() : null;
  let response = await fetch(url, buildRequestOptions(options, token));

  if (attachToken && response.status === 403) {
    const data = await response.clone().json().catch(() => ({}));
    if (data?.code === 'ACTION_TOKEN_INVALID') {
      clearActionTokenCache();
      const freshToken = await fetchActionToken();
      response = await fetch(url, buildRequestOptions(options, freshToken));
    }
  }

  return response;
}

const PLATFORM_API_PREFIXES = {
  guangdada: 'catalog/g1',
  insightrackr: 'insightrackr',
  sensortower: 'sensortower',
};

function joinApiPath(base, path = '') {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return cleanPath ? `${base}/${cleanPath}` : base;
}

function platformApiUrl(platform, path = '') {
  const prefix = PLATFORM_API_PREFIXES[platform] || String(platform || '').replace(/^\/+|\/+$/g, '');
  return joinApiPath(`${API_BASE}/${prefix}`, path);
}

function guangdadaApiUrl(path = '') {
  return platformApiUrl('guangdada', path);
}

export async function getIamMe() {
  const res = await apiFetch(`${API_BASE}/iam/me`);
  return res.json();
}

export async function iamLogout() {
  const res = await apiFetch(`${API_BASE}/iam/logout`, { method: 'POST' });
  return res.json();
}

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

/**
 * 后端转码视频：提交异步任务 → 轮询 → 下载 MP4 Blob
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTranscodeJob(jobId) {
  const res = await apiFetch(`${API_BASE}/transcode-jobs/${encodeURIComponent(jobId)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `查询转码任务失败: ${res.status}`);
  }
  return res.json();
}

export async function listTranscodeJobs(options = {}) {
  const params = new URLSearchParams();
  if (options.activeOnly === false) params.set('active', '0');
  if (options.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/transcode-jobs${qs ? `?${qs}` : ''}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `读取转码任务列表失败: ${res.status}`);
  }
  const data = await res.json();
  return data.jobs ?? [];
}

export async function listOperationAudits(options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.platform) params.set('platform', options.platform);
  if (options.action) params.set('action', options.action);
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/health/operation-audits${qs ? `?${qs}` : ''}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `读取操作审计失败: ${res.status}`);
  }
  const data = await res.json();
  return data.data ?? { items: [], total: 0 };
}

export async function getOperationAuditSummary(options = {}) {
  const params = new URLSearchParams();
  if (options.platform) params.set('platform', options.platform);
  if (options.action) params.set('action', options.action);
  if (options.days) params.set('days', String(options.days));
  if (options.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/health/operation-audits/summary${qs ? `?${qs}` : ''}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `读取操作审计汇总失败: ${res.status}`);
  }
  const data = await res.json();
  return data.data ?? { items: [], days: options.days || 7 };
}

function toMaterialAuditTask(task) {
  const sourceUrl = task.sourceUrl
    || (task.sourceType === 'local' ? '' : (task.processPayload?.url ?? ''));
  return {
    id: task.id,
    filename: task.filename,
    sizeLabel: task.sizeLabel,
    sourceUrl,
    sourceLabel: task.sourceLabel,
    originalWidth: task.originalWidth ?? null,
    originalHeight: task.originalHeight ?? null,
    targetWidth: task.targetWidth ?? task.processPayload?.targetW ?? null,
    targetHeight: task.targetHeight ?? task.processPayload?.targetH ?? null,
    isVideo: !!task.isVideo,
    isHtml: !!task.isHtml,
    sourceType: task.sourceType || 'remote',
    processPayload: {
      url: sourceUrl,
      targetW: task.processPayload?.targetW ?? null,
      targetH: task.processPayload?.targetH ?? null,
    },
  };
}

export async function auditMaterialBatchSubmit(batch) {
  const res = await apiFetch(`${API_BASE}/material-processing/batch-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchId: batch.id,
      source: batch.source,
      sourceLabel: batch.sourceLabel,
      folderName: batch.folderName,
      tasks: (batch.tasks || []).map(toMaterialAuditTask),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `记录操作日志失败: ${res.status}`);
  }
  return data;
}

export async function waitAndDownloadTranscodeJob(jobId, signal = null, onProgress = null) {
  const started = Date.now();
  const timeoutMs = 360000;
  while (true) {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('等待转码结果超时');
    }
    const job = await getTranscodeJob(jobId);
    if (onProgress && job.phase && job.status === 'running') {
      const phaseProgress = { downloading: 20, probing: 40, transcoding: 70 };
      onProgress(phaseProgress[job.phase] ?? 10);
    }
    if (job.status === 'completed') {
      if (onProgress) onProgress(95);
      const res = await apiFetch(`${API_BASE}/transcode-jobs/${encodeURIComponent(jobId)}/download`, {
        credentials: 'same-origin',
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `下载转码结果失败: ${res.status}`);
      }
      const blob = await res.blob();
      if (onProgress) onProgress(100);
      return blob;
    }
    if (job.status === 'failed') {
      throw new Error(job.errorMessage || '转码失败');
    }
    await sleep(1500);
  }
}

/**
 * @param {Object} [meta]
 * @param {string} [meta.clientBatchId]
 * @param {string} [meta.clientTaskId]
 * @param {string} [meta.sourceLabel]
 * @param {(jobId: string) => void} [meta.onJobSubmitted]
 */
export async function transcodeVideoBackend(videoUrl, targetW = 800, targetH = 800, signal = null, meta = {}) {
  const res = await apiFetch(`${API_BASE}/transcode-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl: String(videoUrl).trim(),
      targetW: Number(targetW) || 800,
      targetH: Number(targetH) || 800,
      clientBatchId: meta.clientBatchId ?? undefined,
      clientTaskId: meta.clientTaskId ?? undefined,
      sourceLabel: meta.sourceLabel ?? undefined,
    }),
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `转码失败: ${res.status}`);
  }
  const data = await res.json();
  const jobId = data.jobId;
  if (!jobId) throw new Error('服务器未返回转码任务 ID');
  meta.onJobSubmitted?.(jobId);
  return waitAndDownloadTranscodeJob(jobId, signal, meta.onProgress);
}

/**
 * 获取后端视频转码队列状态，用于下载列表与健康页展示
 * @returns {Promise<{ running: number, waiting: number, jobs?: Array }>}
 */
export async function getTranscodeQueueStatus() {
  const res = await apiFetch(`${API_BASE}/transcode-queue`, { credentials: 'same-origin' });
  if (!res.ok) return { running: 0, waiting: 0 };
  return res.json();
}

export async function getStatus(platform) {
  // 使用相对路径，localhost 与 IP 访问都会走当前页面的 origin，由 Vite 代理到后端；登录状态在后端共享
  const response = await apiFetch(platformApiUrl(platform, 'status'), {
    credentials: 'same-origin',
  });
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    // 后端重启瞬间可能出现空响应，避免直接抛出 JSON.parse 错误
    return { code: 200, data: { status: 'LOGGED_OUT', email: null }, message: '状态接口返回空响应', success: false };
  }
  let result;
  try {
    result = JSON.parse(raw);
  } catch (e) {
    throw new Error(`状态接口返回了非 JSON 内容: ${raw.slice(0, 120)}`);
  }
  // 统一从 data.status 读取，兼容 200 且 success: false 时仍有 data
  if (result && result.data == null && !response.ok) {
    throw new Error(result.message || `请求失败: ${response.status}`);
  }
  return result;
}

export async function login(platform, email, password, otp, authLink) {
  const body = { email, password };
  if (otp != null && String(otp).trim() !== '') {
    body.otp = String(otp).trim();
  }
  if (authLink != null && String(authLink).trim() !== '') {
    body.authLink = String(authLink).trim();
  }
  const response = await apiFetch(platformApiUrl(platform, 'login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return await response.json();
}

/** 服务端是否配置了平台一键登录凭据 */
export async function getPlatformAutoLoginInfo(platform) {
  const res = await apiFetch(platformApiUrl(platform, 'auto-login-info'), {
    credentials: 'same-origin',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    return { configured: false };
  }
  return json.data || { configured: false };
}

/** Insightrackr 服务端是否配置了一键登录凭据 */
export async function getInsightrackrAutoLoginInfo() {
  return getPlatformAutoLoginInfo('insightrackr');
}

/** 触发服务端凭据登录（互斥锁，已登录则跳过） */
export async function triggerPlatformLogin(platform) {
  const res = await apiFetch(platformApiUrl(platform, 'trigger-login'), {
    method: 'POST',
    credentials: 'same-origin',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.message) {
    throw new Error(`登录请求失败: ${res.status}`);
  }
  return json;
}

/** 触发 Insightrackr 服务端凭据登录（互斥锁，已登录则跳过） */
export async function triggerInsightrackrLogin() {
  return triggerPlatformLogin('insightrackr');
}

export async function getPlatformCredentials() {
  const res = await apiFetch(`${API_BASE}/health/platform-credentials`, {
    credentials: 'same-origin',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.message || `读取平台账号配置失败: ${res.status}`);
  }
  return json.data || [];
}

export async function updatePlatformCredentials(platform, values) {
  const res = await apiFetch(`${API_BASE}/health/platform-credentials/${encodeURIComponent(platform)}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.message || `保存平台账号配置失败: ${res.status}`);
  }
  return json.data;
}

export async function clearLogin(platform) {
  const response = await apiFetch(platformApiUrl(platform, 'clearLogin'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}

// 需要重新登录的错误码
const LOGIN_REQUIRED_CODES = ['NOT_LOGGED_IN', 'NO_LOGIN_PAGE', 'SESSION_EXPIRED'];

/** 广大大接口若返回人机验证，弹窗并抛错，便于上层统一处理 */
function checkGuangdadaHumanVerification(result) {
  if (
    result &&
    result.data &&
    (result.data.id === 'need_human_machine_verification' ||
      result.data.message === 'need_human_machine_verification')
  ) {
    alert('出现了人机交互验证，请联系管理员处理');
    const err = new Error('need_human_machine_verification');
    err.needHumanVerification = true;
    throw err;
  }
}

export async function searchData(platform, searchParams) {
  const payload = platform === 'guangdada' ? bodyForGuangdadaSearch(searchParams) : searchParams;
  const response = await apiFetch(platformApiUrl(platform, 'search'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

  if (platform === 'guangdada') checkGuangdadaHumanVerification(result);
  return result;
}

function stripGuangdadaClientOnlyFields(params) {
  if (!params || typeof params !== 'object') return params;
  const {
    guangdadaMultimodalRequest: _drop,
    multi_modal_file_cdn_url: _cdn,
    multimodal_preview_url: _previewUrl,
    multimodal_preview_type: _previewType,
    multimodal_resource_link: _resourceLink,
    ...rest
  } = params;
  return rest;
}

/** 广大大 list/count 请求体中勿传仅前端使用的字段 */
function bodyForGuangdadaSearch(searchParams) {
  return stripGuangdadaClientOnlyFields(searchParams);
}

/** 广大大素材内容 multi-modal-search：与 guangdada.net 一致（经后端 Puppeteer 转发）。
 * - 字符串：http(s) → type=3+content；否则 type=1+content
 * - { mode:'url', url }
 * - { mode:'file', media:'image'|'video', file: File }
 */
export async function guangdadaMultiModalSearch(keywordOrPayload) {
  let body;

  const fileToBase64Payload = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = reader.result;
        if (typeof s !== 'string') {
          reject(new Error('读取文件失败'));
          return;
        }
        const i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });

  if (keywordOrPayload && typeof keywordOrPayload === 'object' && !Array.isArray(keywordOrPayload) && keywordOrPayload.mode === 'url') {
    const url = String(keywordOrPayload.url || '').trim();
    body = { multimodal_search_type: '3', multimodal_search_content: url, snapshot_flag: 'false' };
  } else if (keywordOrPayload && typeof keywordOrPayload === 'object' && keywordOrPayload.mode === 'file' && keywordOrPayload.file) {
    const file = keywordOrPayload.file;
    const base64 = await fileToBase64Payload(file);
    const isVideo = keywordOrPayload.media === 'video' || (file.type && file.type.startsWith('video/'));
    body = {
      multimodal_search_type: isVideo ? '3' : '2',
      multimodal_search_content: '',
      snapshot_flag: 'false',
      file: {
        filename: file.name || (isVideo ? 'upload.mp4' : 'upload.png'),
        mimeType: file.type || (isVideo ? 'video/mp4' : 'image/png'),
        base64,
      },
    };
  } else {
    const raw =
      keywordOrPayload != null
        ? typeof keywordOrPayload === 'string'
          ? keywordOrPayload.trim()
          : Array.isArray(keywordOrPayload) && keywordOrPayload.length > 0
            ? String(keywordOrPayload[0]).trim()
            : ''
        : '';
    if (!raw) {
      return { success: false, data: { multimodal_md5: null }, message: '多模态内容为空' };
    }
    const isUrl = /^https?:\/\//i.test(raw);
    body = isUrl
      ? { multimodal_search_type: '3', multimodal_search_content: raw, snapshot_flag: 'false' }
      : { multimodal_search_type: '1', multimodal_search_content: raw, snapshot_flag: 'false' };
  }

  const response = await apiFetch(guangdadaApiUrl('multi-modal-search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  return result;
}

export async function getGuangdadaQuotaStatus(options = {}) {
  const params = new URLSearchParams();
  if (options.forceRefresh) params.set('force', '1');
  const qs = params.toString();
  const response = await apiFetch(`${guangdadaApiUrl('quota-status')}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  return response.json();
}

export async function consumeGuangdadaQuota(quotaKey, amount = 1, metadata = {}) {
  const response = await apiFetch(guangdadaApiUrl('quota-consume'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      quotaKey,
      amount,
      metadata,
    }),
  });
  return response.json();
}

// 广大大广告主联想（搜索框输入时下拉列表）
export async function getGuangdadaAdvertiserAssociation(keyword, appType = 1) {
  const k = keyword != null ? String(keyword).trim() : '';
  if (!k) return { success: true, data: { advertiser_list: [] } };
  const params = new URLSearchParams({ association_kwd: k, app_type: String(appType) });
  const response = await apiFetch(`${guangdadaApiUrl('advertiser-association')}?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin'
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  return result;
}

// 广大大素材内容属性：GET /napi/v1/creative/ai-tags-v2?app_type=1，经后端已登录浏览器转发
export async function getGuangdadaAiTagsV2(appType = 1) {
  const params = new URLSearchParams({ app_type: String(appType || 1) });
  const response = await apiFetch(`${guangdadaApiUrl('ai-tags-v2')}?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  return result;
}

export async function getGuangdadaCreativeRankList(body = {}) {
  const response = await apiFetch(guangdadaApiUrl('creative-rank/list'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

// 获取数据总数（count 接口：Insightrackr、广大大）
export async function getCount(platform, searchParams) {
  if (platform !== 'insightrackr' && platform !== 'guangdada') {
    throw new Error('Count 接口仅支持 Insightrackr、广大大 平台');
  }

  const payload = platform === 'guangdada' ? bodyForGuangdadaSearch(searchParams) : searchParams;
  const response = await apiFetch(platformApiUrl(platform, 'count'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

  if (platform === 'guangdada') checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(`${API_BASE}/insightrackr/search-global`, {
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
  const response = await apiFetch(platformApiUrl(platform, 'distribute/media'), {
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
  const { ad_key, app_type = 1, search_flag, search_fag } = params || {};
  const effectiveSearchFlag = search_flag ?? search_fag;
  const qs = new URLSearchParams();
  if (ad_key) qs.set('ad_key', ad_key);
  if (app_type != null) qs.set('app_type', String(app_type));
  if (effectiveSearchFlag != null) qs.set('search_flag', String(effectiveSearchFlag));
  const response = await apiFetch(`${guangdadaApiUrl('creative-detail')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

export async function getGuangdadaRelatedDynamic(params) {
  const qs = new URLSearchParams();
  const { dynamic_number, app_type = 1, creative_key, ad_key, platform, created_at } = params || {};
  if (dynamic_number != null) qs.set('dynamic_number', String(dynamic_number));
  if (app_type != null) qs.set('app_type', String(app_type));
  if (creative_key || ad_key) qs.set('creative_key', String(creative_key || ad_key));
  if (platform != null && platform !== '') qs.set('platform', String(platform));
  if (created_at != null) qs.set('created_at', String(created_at));
  const response = await apiFetch(`${guangdadaApiUrl('related-dynamic')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

export async function getGuangdadaRankStatus(params) {
  const qs = new URLSearchParams();
  const { ad_key, app_type = 1 } = params || {};
  if (ad_key) qs.set('ad_key', String(ad_key));
  if (app_type != null) qs.set('app_type', String(app_type));
  const response = await apiFetch(`${guangdadaApiUrl('rank-status')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
  if (!result.success && result.code && LOGIN_REQUIRED_CODES.includes(result.code)) {
    const err = new Error(result.message || '需要重新登录');
    err.code = result.code;
    err.requiresLogin = true;
    throw err;
  }
  return result;
}

export async function getGuangdadaMaterialScriptAnalysis(params) {
  const qs = new URLSearchParams();
  const { ad_key, app_type = 1, search_flag, ads_type } = params || {};
  if (ad_key) qs.set('ad_key', String(ad_key));
  if (app_type != null) qs.set('app_type', String(app_type));
  if (search_flag != null) qs.set('search_flag', String(search_flag));
  if (ads_type != null) qs.set('ads_type', String(ads_type));
  const response = await apiFetch(`${guangdadaApiUrl('material-script-analysis')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(`${guangdadaApiUrl('hidden-info')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(guangdadaApiUrl('translate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      text: text != null ? String(text).trim() : '',
      target_lan: target_lan && String(target_lan).trim() ? String(target_lan).trim() : 'zh-CN',
    }),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(guangdadaApiUrl('related-advertisers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(guangdadaApiUrl('related-ads'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(guangdadaApiUrl('similar-ads'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(`${guangdadaApiUrl('daily-popularity')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(guangdadaApiUrl('adv-rec-list'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(`${guangdadaApiUrl('advertiser-detail')}?${qs.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await response.json();
  checkGuangdadaHumanVerification(result);
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
  const response = await apiFetch(platformApiUrl(platform, 'distribute/app'), {
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

/**
 * 国内版 BBA 广告列表：GET /api/catalog/g1-cn/ad-info（服务端代理；优先 X-BBA-Authorization / 环境变量；否则 Puppeteer 登录页从 localStorage jwt.cn 读取）
 * @param {object} payload - GuangdadaDomesticSearchForm 提交的表单对象（含 position、keyword、exactSearch、excludeKeyword、dateRange 等）
 * @param {{ bbaAuthorization?: string, bbaCookie?: string }} [options] - 可选：显式 JWT；bbaCookie 保留为兼容字段（上游当前不转发 Cookie）
 */
export async function searchGuangdadaCnAdInfo(payload, options = {}) {
  const qs = buildDomesticAdInfoQuery(payload).toString();
  const headers = { Accept: 'application/json' };
  if (options.bbaAuthorization) {
    headers['X-BBA-Authorization'] = String(options.bbaAuthorization).trim();
  }
  if (options.bbaCookie) {
    headers['X-BBA-Cookie'] = String(options.bbaCookie).trim();
  }
  const pathAndQuery = `${API_BASE}/catalog/g1-cn/ad-info?${qs}`;
  if (typeof window !== 'undefined') {
    const fullUrl = `${window.location.origin}${pathAndQuery}`;
    console.warn(
      '[国内版 ad-info] ① 浏览器 → 本机后端（与 DevTools Network 中该条 URL 一致；② 转发 BBA 见服务端日志 tag「请求链路」）',
      {
        fullUrl,
        pathAndQuery,
        queryString: qs,
        headersToBackend: {
          Accept: headers.Accept,
          'X-BBA-Authorization': headers['X-BBA-Authorization'] ? '[已设置]' : '(未设置，由服务端用登录态 JWT)',
          'X-BBA-Cookie': headers['X-BBA-Cookie'] ? '[已设置]' : '(未设置)',
        },
      },
    );
  }
  const response = await apiFetch(pathAndQuery, {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _parseError: true, raw: text };
  }
  if (!response.ok) {
    const msg =
      (data && typeof data === 'object' && (data.message || data.msg)) ||
      (typeof text === 'string' && text.slice(0, 200)) ||
      response.statusText;
    const err = new Error(String(msg));
    if (
      data &&
      typeof data === 'object' &&
      (data.requiresLogin === true || data.code === 'BBA_AUTH_REQUIRED')
    ) {
      err.requiresLogin = true;
    }
    throw err;
  }

  // 代理 HTTP 200 但 BBA 业务码非 20000 时，在浏览器控制台打印完整返回便于排查
  if (data && typeof data === 'object' && typeof data.status === 'number' && data.status !== 20000) {
    const forLog =
      data.data && typeof data.data === 'object' && Array.isArray(data.data.data)
        ? {
            ...data,
            data: {
              ...data.data,
              data: `[已省略 ${data.data.data.length} 条，见服务端日志可含完整结构]`,
            },
          }
        : data;
    console.warn('[国内版 ad-info] 广大大(BBA) 实际返回（业务 status≠20000）:', forLog);
  }

  return data;
}
