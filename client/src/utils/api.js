const API_BASE = '/api';

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
