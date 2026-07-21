import { createDecipheriv, createHash } from 'node:crypto';

function deriveAesKey(entryTokenSignKey) {
  return createHash('sha256').update(entryTokenSignKey, 'utf8').digest();
}

function decodeUrlSafeBase64(token) {
  const padding = '='.repeat((4 - (token.length % 4)) % 4);
  return Buffer.from(token + padding, 'base64url');
}

/**
 * 解密门户跳转 token（AES-256-GCM）
 * @param {string} token
 * @param {string} entryTokenSignKey
 */
export function decryptEntryToken(token, entryTokenSignKey) {
  if (!token || !entryTokenSignKey) {
    throw new Error('token 或解密密钥缺失');
  }

  const raw = decodeUrlSafeBase64(String(token).trim());
  if (raw.length <= 12) {
    throw new Error('invalid token');
  }

  const nonce = raw.subarray(0, 12);
  const ciphertextWithTag = raw.subarray(12);
  const key = deriveAesKey(entryTokenSignKey);

  if (ciphertextWithTag.length < 16) {
    throw new Error('invalid token');
  }

  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

  let plain;
  try {
    // 与 IAM 文档 Python 示例一致：nonce + (ciphertext||tag)，AAD 为空
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    const err = new Error('token 解密失败，请确认 IAM_ENTRY_TOKEN_SIGN_KEY 与 IAM/门户侧一致');
    err.code = 'TOKEN_DECRYPT_FAILED';
    throw err;
  }

  const payload = JSON.parse(plain.toString('utf8'));
  const expiresAt = Number(payload.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error('token expired');
  }

  const userId = payload?.data?.user_id;
  const sessionExpireAt = Number(payload?.data?.expire_at);
  if (!userId || !Number.isFinite(sessionExpireAt)) {
    throw new Error('token payload 无效');
  }

  return {
    feishuUserId: String(userId),
    tokenExpiresAt: expiresAt,
    sessionExpireAt,
  };
}
