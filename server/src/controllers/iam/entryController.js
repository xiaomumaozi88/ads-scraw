import { resolvePublicBaseUrl } from '../../config/iam.js';
import { establishSessionFromEntryToken } from '../../services/iam/entrySession.js';
import { logger } from '../../utils/logger.js';

function auditLog(event, detail) {
  logger.info(`[IAM] ${event}`, detail);
}

export async function handleIamEntry(req, res) {
  const { token, redirect_url: redirectUrlRaw } = req.query;

  try {
    const { redirectPath } = await establishSessionFromEntryToken(req, res, token, redirectUrlRaw);
    const base = resolvePublicBaseUrl(req);
    return res.redirect(302, `${base}${redirectPath}`);
  } catch (err) {
    auditLog('login_failed', { error: err.message, code: err.code });

    if (err.code === 'IAM_NOT_CONFIGURED') {
      return res.status(503).send(
        renderErrorPage(
          'IAM 未配置解密密钥',
          '请在服务端 .env 中配置 IAM_ENTRY_TOKEN_SIGN_KEY（或与门户一致的 ENTRY_TOKEN_SIGN_KEY）。配置后重启后端，再从门户重新进入。'
        )
      );
    }

    if (err.code === 'NOT_PLATFORM_MEMBER') {
      return res.status(403).send(renderErrorPage('无访问权限', '您不是本平台成员，请联系管理员在 IAM 中授权。'));
    }

    if (err.code === 'IAM_NOT_FOUND' || err.status === 404) {
      return res.status(403).send(renderErrorPage('权限查询失败', err.message));
    }

    if (err.status === 401 || err.code === 'IAM_UNAUTHORIZED') {
      return res.status(502).send(renderErrorPage('权限查询失败', err.message));
    }

    const hint =
      err.code === 'TOKEN_DECRYPT_FAILED'
        ? '解密密钥不正确，或 token 已过期（约 60 秒）。请从门户重新登录。'
        : err.message?.includes('expired')
          ? '登录 token 已过期，请从门户重新进入。'
          : err.message || 'token 无效，请从门户重新进入。';
    return res.status(401).send(renderErrorPage('登录失败', hint));
  }
}

function renderErrorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - 广告数据平台</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0; padding: 48px 16px; color: #1a1a1a; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { margin: 0; line-height: 1.6; color: #424242; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
