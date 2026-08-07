import { fetchNbsInfo } from './puppeteerService.js';
import { getQuotaUsage, incrementQuotaUsage } from '../repositories/guangdadaQuotaRepository.js';

export const GUANGDADA_QUOTA_EXCEEDED_CODE = 'GUANGDADA_QUOTA_EXCEEDED';
export const GUANGDADA_QUOTA_UNAVAILABLE_CODE = 'GUANGDADA_QUOTA_UNAVAILABLE';

const NBS_CACHE_TTL_MS = 5 * 60 * 1000;
const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const QUOTA_LABELS = {
  search: '搜索查询',
  download: '素材下载',
  ads_detail: '创意详情',
  ads_dialog: '广告对话',
  multimodal_search: '素材内容搜索',
  landing_page_search: '落地页搜索',
  creative_collect: '素材收藏',
  advertiser_search: '广告主搜索',
  advertiser_rank: '广告主榜单',
  text_search: '文案搜索',
  ai_draw: 'AI 绘图',
  ai_dub: 'AI 配音',
  ai_text: 'AI 文案',
  ai_prompt: 'AI 提示词',
  video_recognize: '视频智能识别',
  voice_separation: '人声分离',
  ai_text_analysis: 'AI 文案分析',
  creative_video_clips_analysis: '视频片段分析',
  ads_archived_read: '归档广告读取',
  ads_restore: '广告恢复',
  advertiser_creative_report: '广告主创意报告',
  creative_picture_ocr: '图片 OCR',
  unbind_device: '解绑设备',
};

const QUOTA_ORDER = [
  'search',
  'download',
  'ads_detail',
  'multimodal_search',
  'advertiser_search',
  'text_search',
  'landing_page_search',
  'creative_collect',
  'ads_dialog',
  'advertiser_rank',
  'video_recognize',
  'creative_picture_ocr',
  'ai_text',
  'ai_draw',
  'ai_dub',
  'ai_prompt',
];

let nbsCache = null;
let quotaLock = Promise.resolve();

export function clearGuangdadaQuotaCache() {
  nbsCache = null;
}

function withQuotaLock(fn) {
  const run = quotaLock.then(fn, fn);
  quotaLock = run.catch(() => {});
  return run;
}

function getBeijingParts(date = new Date()) {
  const shifted = new Date(date.getTime() + BEIJING_UTC_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildPeriod(cycle = 'd', date = new Date()) {
  const parts = getBeijingParts(date);
  if (cycle === 'm') {
    const periodKey = `${parts.year}-${pad2(parts.month)}`;
    const startMs = Date.UTC(parts.year, parts.month - 1, 1) - BEIJING_UTC_OFFSET_MS;
    const endMs = Date.UTC(parts.year, parts.month, 1) - BEIJING_UTC_OFFSET_MS;
    return { cycle, periodKey, periodStartMs: startMs, periodEndMs: endMs };
  }

  const periodKey = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  const startMs = Date.UTC(parts.year, parts.month - 1, parts.day) - BEIJING_UTC_OFFSET_MS;
  const endMs = Date.UTC(parts.year, parts.month - 1, parts.day + 1) - BEIJING_UTC_OFFSET_MS;
  return { cycle: 'd', periodKey, periodStartMs: startMs, periodEndMs: endMs };
}

function cycleLabel(cycle) {
  if (cycle === 'm') return '本月';
  if (cycle === 'd') return '今日';
  return '当前周期';
}

function normalizeLimit(raw) {
  const count = Number(raw?.count);
  if (!Number.isFinite(count) || count < 0) return null;
  return {
    count: Math.floor(count),
    cycle: raw?.cycle === 'm' ? 'm' : 'd',
  };
}

function getAccountInfo(nbsInfo = {}) {
  const product = nbsInfo.product || 'guangdada';
  const userId = nbsInfo.user_id ?? null;
  const companyId = nbsInfo.company_id ?? null;
  const email = nbsInfo.email || null;
  const username = nbsInfo.username || null;
  const accountKey =
    userId != null
      ? `${product}:user:${userId}`
      : email
        ? `${product}:email:${email}`
        : `${product}:unknown`;

  return {
    accountKey,
    userId,
    companyId,
    username,
    email,
    product,
    expireTime: nbsInfo.expire_time ?? null,
  };
}

async function getNbsInfo(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && nbsCache?.data && now - nbsCache.fetchedAt < NBS_CACHE_TTL_MS) {
    return { ...nbsCache, fromCache: true };
  }

  const result = await fetchNbsInfo();
  if (result?.success && result.data) {
    nbsCache = {
      data: result.data,
      fetchedAt: now,
      warning: null,
    };
    return { ...nbsCache, fromCache: false };
  }

  if (nbsCache?.data) {
    return {
      ...nbsCache,
      fromCache: true,
      warning: result?.message || 'nbs-info 暂时不可用，已使用最近一次额度配置',
    };
  }

  const err = new Error(result?.message || '无法读取广大大账户额度信息');
  err.code = result?.code || GUANGDADA_QUOTA_UNAVAILABLE_CODE;
  throw err;
}

function quotaSortRank(key) {
  const index = QUOTA_ORDER.indexOf(key);
  return index >= 0 ? index : QUOTA_ORDER.length + 1;
}

async function buildQuotaStatusUnlocked({ forceRefresh = false } = {}) {
  const nbs = await getNbsInfo(forceRefresh);
  const nbsInfo = nbs.data;
  const account = getAccountInfo(nbsInfo);
  const userCount = nbsInfo?.permission?.user_count || {};
  const entries = Object.entries(userCount)
    .map(([key, raw]) => {
      const limit = normalizeLimit(raw);
      return limit ? { key, ...limit } : null;
    })
    .filter(Boolean)
    .sort((a, b) => quotaSortRank(a.key) - quotaSortRank(b.key) || a.key.localeCompare(b.key));

  const quotas = [];
  for (const entry of entries) {
    const period = buildPeriod(entry.cycle);
    const usage = await getQuotaUsage(account.accountKey, entry.key, period.periodKey);
    const usedCount = Math.max(0, Number(usage?.usedCount) || 0);
    const remaining = Math.max(0, entry.count - usedCount);
    quotas.push({
      key: entry.key,
      label: QUOTA_LABELS[entry.key] || entry.key,
      limit: entry.count,
      used: usedCount,
      remaining,
      cycle: entry.cycle,
      cycleLabel: cycleLabel(entry.cycle),
      periodKey: period.periodKey,
      periodStartMs: period.periodStartMs,
      periodEndMs: period.periodEndMs,
      exhausted: remaining <= 0,
      low: entry.count > 0 && remaining / entry.count <= 0.1,
    });
  }

  return {
    account,
    quotas,
    quotaMap: Object.fromEntries(quotas.map((q) => [q.key, q])),
    fetchedAt: nbs.fetchedAt,
    fromCache: !!nbs.fromCache,
    warning: nbs.warning || null,
  };
}

function buildQuotaExceededMessage(quota, amount) {
  const amountText = amount > 1 ? `本次需要 ${amount} 次，` : '';
  const stateText = quota.remaining <= 0 ? '已用完' : '不足';
  return `「${quota.label}」额度${stateText}（${quota.cycleLabel} ${quota.used}/${quota.limit}，${amountText}剩余 ${quota.remaining}）。请在群里参与「账户排队」以使用其他账户。`;
}

export async function getGuangdadaQuotaStatus(options = {}) {
  return withQuotaLock(() => buildQuotaStatusUnlocked(options));
}

export async function consumeGuangdadaQuota(quotaKey, amount = 1, metadata = {}) {
  const normalizedAmount = Math.max(1, Math.floor(Number(amount) || 1));
  return withQuotaLock(async () => {
    try {
      const status = await buildQuotaStatusUnlocked({ forceRefresh: false });
      const quota = status.quotaMap?.[quotaKey];
      if (!quota) {
        if (normalizedReserve > 0) {
          return {
            allowed: false,
            code: GUANGDADA_QUOTA_UNAVAILABLE_CODE,
            message: `无法读取「${QUOTA_LABELS[quotaKey] || quotaKey}」额度，自动补全已暂停。`,
            quota: null,
            quotaStatus: status,
          };
        }
        return {
          allowed: true,
          code: 200,
          message: 'success',
          quota: null,
          quotaStatus: status,
        };
      }

      if (quota.remaining < normalizedAmount) {
        return {
          allowed: false,
          code: GUANGDADA_QUOTA_EXCEEDED_CODE,
          message: buildQuotaExceededMessage(quota, normalizedAmount),
          quota,
          quotaStatus: status,
        };
      }

      await incrementQuotaUsage({
        accountKey: status.account.accountKey,
        quotaKey,
        periodKey: quota.periodKey,
        periodStartMs: quota.periodStartMs,
        periodEndMs: quota.periodEndMs,
        amount: normalizedAmount,
        limitCount: quota.limit,
        cycle: quota.cycle,
        metadata,
      });

      const nextStatus = await buildQuotaStatusUnlocked({ forceRefresh: false });
      return {
        allowed: true,
        code: 200,
        message: 'success',
        quota: nextStatus.quotaMap?.[quotaKey] || quota,
        quotaStatus: nextStatus,
      };
    } catch (err) {
      return {
        allowed: false,
        code: err.code || GUANGDADA_QUOTA_UNAVAILABLE_CODE,
        message: err.message || '无法读取广大大账户额度信息，请确认已登录后重试',
        quota: null,
        quotaStatus: null,
      };
    }
  });
}

export async function consumeGuangdadaQuotaWithReserve(quotaKey, amount = 1, reserveRemaining = 0, metadata = {}) {
  const normalizedAmount = Math.max(1, Math.floor(Number(amount) || 1));
  const normalizedReserve = Math.max(0, Math.floor(Number(reserveRemaining) || 0));
  return withQuotaLock(async () => {
    try {
      const status = await buildQuotaStatusUnlocked({ forceRefresh: false });
      const quota = status.quotaMap?.[quotaKey];
      if (!quota) {
        return {
          allowed: true,
          code: 200,
          message: 'success',
          quota: null,
          quotaStatus: status,
        };
      }

      if (quota.remaining < normalizedAmount || quota.remaining - normalizedAmount < normalizedReserve) {
        return {
          allowed: false,
          code: GUANGDADA_QUOTA_EXCEEDED_CODE,
          message: `「${quota.label}」自动补全已暂停（${quota.cycleLabel} ${quota.used}/${quota.limit}，剩余 ${quota.remaining}，需预留 ${normalizedReserve} 给用户使用）。`,
          quota,
          quotaStatus: status,
        };
      }

      await incrementQuotaUsage({
        accountKey: status.account.accountKey,
        quotaKey,
        periodKey: quota.periodKey,
        periodStartMs: quota.periodStartMs,
        periodEndMs: quota.periodEndMs,
        amount: normalizedAmount,
        limitCount: quota.limit,
        cycle: quota.cycle,
        metadata,
      });

      const nextStatus = await buildQuotaStatusUnlocked({ forceRefresh: false });
      return {
        allowed: true,
        code: 200,
        message: 'success',
        quota: nextStatus.quotaMap?.[quotaKey] || quota,
        quotaStatus: nextStatus,
      };
    } catch (err) {
      return {
        allowed: false,
        code: err.code || GUANGDADA_QUOTA_UNAVAILABLE_CODE,
        message: err.message || '无法读取广大大账户额度信息，请确认已登录后重试',
        quota: null,
        quotaStatus: null,
      };
    }
  });
}
