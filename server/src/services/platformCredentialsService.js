import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { REPO_ROOT } from '../config.js';
import { APP_SESSION_SECRET } from '../config/iam.js';

export const PLATFORM_CREDENTIALS = {
  insightrackr: {
    code: 'insightrackr',
    name: '热云',
    envPrefix: 'INSIGHTRACKR',
  },
  guangdada: {
    code: 'guangdada',
    name: '广大大',
    envPrefix: 'GUANGDADA',
  },
  sensortower: {
    code: 'sensortower',
    name: 'Sensor Tower',
    envPrefix: 'SENSORTOWER',
  },
};

const CREDENTIALS_FILE = join(REPO_ROOT, 'server', 'data', 'platform-credentials.json');
const ENCRYPTION_PREFIX = 'enc:v1:';

function normalizePlatform(platform) {
  const code = String(platform || '').trim().toLowerCase();
  if (!PLATFORM_CREDENTIALS[code]) {
    const err = new Error('不支持的平台账号配置');
    err.code = 'UNKNOWN_PLATFORM';
    throw err;
  }
  return code;
}

function encryptionKey() {
  const secret = process.env.PLATFORM_CREDENTIALS_SECRET || APP_SESSION_SECRET;
  return createHash('sha256').update(String(secret || '')).digest();
}

function encryptText(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_PREFIX,
    iv.toString('base64url'),
    ':',
    tag.toString('base64url'),
    ':',
    encrypted.toString('base64url'),
  ].join('');
}

function decryptText(value) {
  if (!value || typeof value !== 'string') return null;
  if (!value.startsWith(ENCRYPTION_PREFIX)) return null;
  try {
    const payload = value.slice(ENCRYPTION_PREFIX.length);
    const [ivText, tagText, encryptedText] = payload.split(':');
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivText, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

function readStore() {
  if (!existsSync(CREDENTIALS_FILE)) {
    return { version: 1, credentials: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { version: 1, credentials: {} };
    return {
      version: 1,
      credentials:
        parsed.credentials && typeof parsed.credentials === 'object'
          ? parsed.credentials
          : {},
    };
  } catch {
    return { version: 1, credentials: {} };
  }
}

function writeStore(store) {
  mkdirSync(dirname(CREDENTIALS_FILE), { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function envValue(platform, suffix) {
  const meta = PLATFORM_CREDENTIALS[platform];
  return process.env[`${meta.envPrefix}_${suffix}`];
}

function resolveEnvCredential(platform) {
  const email = String(envValue(platform, 'EMAIL') || '').trim();
  const password = envValue(platform, 'PASSWORD') || '';
  const rawAutoLogin = envValue(platform, 'AUTO_LOGIN');
  return {
    email: email || null,
    password: password || null,
    autoLoginEnabled: rawAutoLogin == null || rawAutoLogin === ''
      ? true
      : String(rawAutoLogin).trim().toLowerCase() !== 'false',
  };
}

function emailPreview(email) {
  const value = String(email || '').trim();
  if (!value) return null;
  const at = value.indexOf('@');
  if (at > 0) return `${value.slice(0, Math.min(2, at))}***${value.slice(at)}`;
  return value.length <= 4 ? `${value[0] || ''}***` : `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function operatorSummary(profile) {
  if (!profile) return null;
  return {
    feishu_user_id: profile.feishu_user_id ?? null,
    user_name: profile.user_name ?? null,
    email: profile.email ?? null,
  };
}

export function getResolvedPlatformCredentials(platform) {
  const code = normalizePlatform(platform);
  const store = readStore();
  const stored = store.credentials[code] || {};
  const env = resolveEnvCredential(code);
  const storedPassword = decryptText(stored.passwordEncrypted);
  const email = String(stored.email || '').trim() || env.email;
  const password = storedPassword || env.password;
  const source = stored.email || stored.passwordEncrypted ? 'admin_config' : (env.email || env.password ? 'env' : 'none');
  const autoLoginEnabled =
    typeof stored.autoLoginEnabled === 'boolean'
      ? stored.autoLoginEnabled
      : env.autoLoginEnabled;

  return {
    platform: code,
    name: PLATFORM_CREDENTIALS[code].name,
    email: email || null,
    password: password || null,
    configured: Boolean(email && password),
    autoLoginEnabled,
    source,
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
    hasStoredPassword: Boolean(stored.passwordEncrypted),
    hasEnvPassword: Boolean(env.password),
  };
}

export function getPlatformCredentialPublicInfo(platform) {
  const credential = getResolvedPlatformCredentials(platform);
  return {
    platform: credential.platform,
    name: credential.name,
    configured: credential.configured,
    autoLoginEnabled: credential.autoLoginEnabled,
    source: credential.source,
    email: credential.email,
    emailPreview: emailPreview(credential.email),
    hasPassword: Boolean(credential.password),
    hasStoredPassword: credential.hasStoredPassword,
    hasEnvPassword: credential.hasEnvPassword,
    updatedAt: credential.updatedAt,
    updatedBy: credential.updatedBy,
  };
}

export function listPlatformCredentialPublicInfo() {
  return Object.keys(PLATFORM_CREDENTIALS).map(getPlatformCredentialPublicInfo);
}

export function updatePlatformCredentials(platform, values = {}, operatorProfile = null) {
  const code = normalizePlatform(platform);
  const email = String(values.email || '').trim();
  if (!email) {
    const err = new Error('账号邮箱不能为空');
    err.code = 'EMAIL_REQUIRED';
    throw err;
  }

  const store = readStore();
  const current = store.credentials[code] || {};
  const next = {
    ...current,
    email,
    autoLoginEnabled: values.autoLoginEnabled !== false,
    updatedAt: new Date().toISOString(),
    updatedBy: operatorSummary(operatorProfile),
  };

  if (Object.prototype.hasOwnProperty.call(values, 'password')) {
    const password = String(values.password || '');
    if (password) {
      next.passwordEncrypted = encryptText(password);
    }
  }

  store.credentials[code] = next;
  writeStore(store);
  return getPlatformCredentialPublicInfo(code);
}

export function credentialsFilePath() {
  return CREDENTIALS_FILE;
}
