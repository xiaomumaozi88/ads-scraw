import { createActionToken } from '../services/actionTokenService.js';

/** GET /api/security/action-token — 前端短期操作令牌 */
export function getActionToken(req, res) {
  const token = createActionToken(req.iamProfile);
  res.json({
    success: true,
    code: 200,
    data: token,
  });
}
