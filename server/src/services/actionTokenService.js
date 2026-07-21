import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { APP_SESSION_SECRET } from '../config/iam.js';

const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = Math.max(
  60 * 1000,
  parseInt(process.env.ACTION_TOKEN_TTL_MS || String(DEFAULT_TOKEN_TTL_MS), 10)
    || DEFAULT_TOKEN_TTL_MS
);

function sign(encodedPayload) {
  return createHmac('sha256', APP_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
}

function subjectForProfile(profile) {
  return String(
    profile?.feishu_user_id
      || profile?.platform_user_id
      || profile?.email
      || profile?.user_name
      || 'anonymous'
  );
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded) {
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

export function createActionToken(profile) {
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = {
    typ: 'ads-scraw-action',
    sub: subjectForProfile(profile),
    sessionExp: profile?.session_expire_at ?? null,
    iat: now,
    exp: expiresAt,
    nonce: randomBytes(12).toString('base64url'),
  };
  const encoded = encodePayload(payload);
  return {
    token: `${encoded}.${sign(encoded)}`,
    expiresAt,
    expiresInMs: TOKEN_TTL_MS,
  };
}

export function verifyActionToken(token, profile) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing' };
  }
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return { ok: false, reason: 'malformed' };

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'signature' };
  }

  let payload;
  try {
    payload = decodePayload(encoded);
  } catch {
    return { ok: false, reason: 'payload' };
  }

  if (payload.typ !== 'ads-scraw-action') return { ok: false, reason: 'type' };
  if (!payload.exp || payload.exp < Date.now()) return { ok: false, reason: 'expired' };
  if (payload.sub !== subjectForProfile(profile)) return { ok: false, reason: 'subject' };
  if ((payload.sessionExp ?? null) !== (profile?.session_expire_at ?? null)) {
    return { ok: false, reason: 'session' };
  }

  return { ok: true, payload };
}
