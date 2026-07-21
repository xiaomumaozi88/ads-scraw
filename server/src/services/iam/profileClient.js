import { IAM_API_KEY, IAM_BASE_URL, IAM_PLATFORM_CODE } from '../../config/iam.js';

/**
 * 调用 IAM profile 接口获取用户权限
 * @param {string} feishuUserId
 */
export async function fetchIamProfile(feishuUserId) {
  if (!IAM_API_KEY) {
    throw new Error('IAM_API_KEY 未配置');
  }

  const url = `${IAM_BASE_URL}/api/platforms/${encodeURIComponent(IAM_PLATFORM_CODE)}/users/${encodeURIComponent(feishuUserId)}/profile`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-API-Key': IAM_API_KEY,
    },
  });

  if (res.status === 404) {
    const err = new Error('用户或平台不存在');
    err.code = 'IAM_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (res.status === 401) {
    const err = new Error('IAM API Key 无效');
    err.code = 'IAM_UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`IAM profile 请求失败: ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}
