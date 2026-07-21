/** data_url 跨域：企业门户权限页 https://touka.plus 会从浏览器 fetch data_url */

const DEFAULT_CATALOG_ORIGINS = [
  'https://touka.plus',
  'https://www.touka.plus',
];

export function getCatalogCorsOrigins() {
  const extra = (process.env.IAM_CATALOG_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_CATALOG_ORIGINS, ...extra])];
}

export function applyCatalogCors(req, res) {
  const origin = req.headers.origin;
  const allowed = getCatalogCorsOrigins();

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // 直接打开 URL 或 IAM 服务端拉取（通常无 Origin 头）
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // 其它浏览器来源：仍返回 * 便于联调（不含 Cookie）
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}
