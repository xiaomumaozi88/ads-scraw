import { createHmac, timingSafeEqual } from 'node:crypto';
import { APP_SESSION_SECRET, SESSION_COOKIE_NAME, sessionCookieOptions } from '../../config/iam.js';

function signPayload(encodedPayload) {
  return createHmac('sha256', APP_SESSION_SECRET).update(encodedPayload).digest('base64url');
}

function encodeSession(session) {
  const encoded = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function decodeSession(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded);
  const sigBuf = Buffer.from(signature, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function readSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE_NAME];
  const session = decodeSession(raw);
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!session.expire_at || session.expire_at < now) return null;
  if (!session.profile) return null;

  return session;
}

export function createSession(profile, sessionExpireAt) {
  const expireAt = Math.min(
    Number(sessionExpireAt),
    Math.floor(Date.now() / 1000) + 86400
  );

  return {
    profile: {
      ...profile,
      session_expire_at: expireAt,
    },
    expire_at: expireAt,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export function setSessionCookie(res, session) {
  const token = encodeSession(session);
  const opts = sessionCookieOptions();
  const maxAgeSec = Math.max(0, session.expire_at - Math.floor(Date.now() / 1000));
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${opts.sameSite === 'none' ? 'None' : opts.sameSite === 'strict' ? 'Strict' : 'Lax'}`,
  ];
  if (opts.secure) parts.push('Secure');
  if (maxAgeSec > 0) parts.push(`Max-Age=${maxAgeSec}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  const opts = sessionCookieOptions();
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    `SameSite=${opts.sameSite === 'none' ? 'None' : opts.sameSite === 'strict' ? 'Strict' : 'Lax'}`,
  ];
  if (opts.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
