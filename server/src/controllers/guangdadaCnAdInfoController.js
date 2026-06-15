import { bbaApiAuthorization, bbaApiBase } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  getStoredGuangdadaBbaAuthorization,
  refreshGuangdadaBbaAuthFromLoginPage,
} from '../services/puppeteerService.js';

/** BBA 上游：不携带 Origin、Cookie（仅 Authorization + Referer 等） */
function buildBbaUpstreamHeaders(auth) {
  const base = bbaApiBase.replace(/\/$/, '');

  return {
    /**
     * 须明确要 JSON：若用浏览器式 Accept（优先 text/html），Django REST framework 会返回可浏览 HTML 整页而非纯 JSON。
     */
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'max-age=0',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    Authorization: auth,
    Referer: `${base}/iframe-cn/ads?token=${encodeURIComponent(auth)}&is_new=1&lang=cn`,
    /** 与 Chrome 对同域 bba 的 fetch/XHR 一致，部分网关会校验 */
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
  };
}

/**
 * 代理国内版 BBA 广告列表：GET /bbaapi/ad/ad-info
 * 鉴权：X-BBA-Authorization → BBA_API_AUTHORIZATION → 已登录广大大 JWT；均无则 503 + requiresLogin。
 * 上游：Referer(iframe-cn?token=JWT)、UA、Accept-Language、sec-ch-ua 等；不发送 Origin、Cookie。
 */
export async function getGuangdadaCnAdInfo(req, res) {
  try {
    await refreshGuangdadaBbaAuthFromLoginPage();
    const auth =
      (req.headers['x-bba-authorization'] && String(req.headers['x-bba-authorization']).trim()) ||
      (bbaApiAuthorization && String(bbaApiAuthorization).trim()) ||
      getStoredGuangdadaBbaAuthorization();
    if (!auth) {
      return res.status(503).json({
        success: false,
        message: '请先登录',
        requiresLogin: true,
        code: 'BBA_AUTH_REQUIRED',
      });
    }

    const bbaParams = new URLSearchParams(req.query);
    if (!bbaParams.has('format')) {
      bbaParams.set('format', 'json');
    }
    const qs = bbaParams.toString();
    const url = `${bbaApiBase.replace(/\/$/, '')}/bbaapi/ad/ad-info${qs ? `?${qs}` : ''}`;

    const fetchHeaders = buildBbaUpstreamHeaders(auth);
    const upstream = await fetch(url, {
      method: 'GET',
      headers: fetchHeaders,
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();

    let parsedUpstream = null;
    try {
      parsedUpstream = text ? JSON.parse(text) : null;
    } catch {
      parsedUpstream = null;
    }

    res.status(upstream.status);
    if (parsedUpstream != null) {
      return res.type('application/json').json(parsedUpstream);
    }
    if (contentType.includes('application/json')) {
      res.type('application/json');
      try {
        return res.send(JSON.parse(text));
      } catch {
        return res.send(text);
      }
    }
    res.type(contentType);
    return res.send(text);
  } catch (e) {
    logger.error('[guangdada-cn/ad-info]', e);
    return res.status(502).json({
      success: false,
      message: e.message || '代理请求失败',
    });
  }
}
