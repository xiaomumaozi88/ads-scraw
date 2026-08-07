import { auditMaterialIngestionSync } from './auditLogService.js';
import { ingestMaterials, resolveCreativeIntelligenceConfig } from './creativeIntelligenceService.js';
import { consumeGuangdadaQuotaWithReserve } from './guangdadaQuotaService.js';
import * as guangdadaPuppeteerService from './puppeteerService.js';
import { logger } from '../utils/logger.js';

let warnedMissingConfig = false;

const DEFAULT_SYNC_DELAY_MS = 10 * 60 * 1000;
const DEFAULT_SYNC_DELAY_JITTER_MS = 2 * 60 * 1000;
const DEFAULT_GUANGDADA_DETAIL_LIMIT = 10;
const DEFAULT_GUANGDADA_DETAIL_RESERVE = 1000;
const DEFAULT_GUANGDADA_DETAIL_MIN_INTERVAL_MS = 25 * 1000;
const DEFAULT_GUANGDADA_DETAIL_MAX_INTERVAL_MS = 90 * 1000;
const DEFAULT_DETAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DETAIL_CACHE_LIMIT = 10000;

const detailCache = new Map();

function envInt(name, fallback, min = 0) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, value);
}

function envMs(name, fallback, min = 0) {
  return envInt(name, fallback, min);
}

function getAutoSyncOptions() {
  const detailMinIntervalMs = envMs(
    'CREATIVE_INTELLIGENCE_GUANGDADA_DETAIL_MIN_INTERVAL_MS',
    DEFAULT_GUANGDADA_DETAIL_MIN_INTERVAL_MS,
    0
  );
  const detailMaxIntervalMs = Math.max(
    detailMinIntervalMs,
    envMs(
      'CREATIVE_INTELLIGENCE_GUANGDADA_DETAIL_MAX_INTERVAL_MS',
      DEFAULT_GUANGDADA_DETAIL_MAX_INTERVAL_MS,
      detailMinIntervalMs
    )
  );
  return {
    syncDelayMs: envMs('CREATIVE_INTELLIGENCE_SYNC_DELAY_MS', DEFAULT_SYNC_DELAY_MS, 0),
    syncDelayJitterMs: envMs('CREATIVE_INTELLIGENCE_SYNC_DELAY_JITTER_MS', DEFAULT_SYNC_DELAY_JITTER_MS, 0),
    guangdadaDetailLimit: envInt(
      'CREATIVE_INTELLIGENCE_GUANGDADA_DETAIL_LIMIT',
      DEFAULT_GUANGDADA_DETAIL_LIMIT,
      0
    ),
    guangdadaDetailReserve: envInt(
      'CREATIVE_INTELLIGENCE_GUANGDADA_DETAIL_RESERVE',
      DEFAULT_GUANGDADA_DETAIL_RESERVE,
      0
    ),
    detailMinIntervalMs,
    detailMaxIntervalMs,
    detailCacheTtlMs: envMs(
      'CREATIVE_INTELLIGENCE_DETAIL_CACHE_TTL_MS',
      DEFAULT_DETAIL_CACHE_TTL_MS,
      60 * 1000
    ),
  };
}

function randomBetween(min, max) {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function wait(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractItems(result) {
  const candidates = [
    result?.data?.creative_list,
    result?.data?.data?.creative_list,
    result?.data?.creatives,
    result?.data?.data?.creatives,
    result?.creatives,
    result?.creative_list,
    result?.list,
    result?.data?.list,
    result?.data?.data?.list,
    result?.data?.items,
    result?.items,
    result?.data?.data,
    result?.data,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function safeIdPart(value, fallback = 'unknown') {
  const text = value == null ? '' : String(value).trim();
  return (text || fallback)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 80);
}

function getSearchContext(platform, searchParams = {}) {
  if (platform === 'guangdada') {
    return {
      page: searchParams.page ?? null,
      displayPage: searchParams.guangdadaDisplayPage ?? null,
      pageSize: searchParams.page_size ?? searchParams.pageSize ?? null,
      appType: searchParams.app_type ?? null,
      keyword: searchParams.keyword ?? searchParams.keyWord ?? null,
      searchCategory: searchParams.guangdadaSearchCategory ?? searchParams.guangdada_search_category ?? null,
      chartType: searchParams.chart_type ?? null,
      rankWeek: searchParams.date ?? searchParams.rank_week ?? null,
    };
  }
  return {
    page: searchParams.baseOption?.pageIndex ?? searchParams.pageIndex ?? null,
    pageSize: searchParams.baseOption?.pageSize ?? searchParams.pageSize ?? null,
    keyword: searchParams.keyWord ?? null,
    sortField: searchParams.baseOption?.sortField ?? searchParams.sortField ?? null,
    sortRule: searchParams.baseOption?.sortRule ?? searchParams.sortRule ?? null,
    startTime: searchParams.baseOption?.startTime ?? searchParams.startTime ?? null,
    endTime: searchParams.baseOption?.endTime ?? searchParams.endTime ?? null,
  };
}

function cloneItems(items) {
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    try {
      return JSON.parse(JSON.stringify(item));
    } catch {
      return { ...item };
    }
  });
}

function getGuangdadaDetailCacheKey(item) {
  const adKey = item?.ad_key == null ? '' : String(item.ad_key).trim();
  if (!adKey) return null;
  const appType = item?.app_type ?? item?.ads_type ?? 1;
  return `${appType}:${adKey}`;
}

function getCachedDetail(cacheKey, ttlMs) {
  const entry = detailCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) {
    detailCache.delete(cacheKey);
    return null;
  }
  return entry.raw;
}

function setCachedDetail(cacheKey, raw) {
  if (!cacheKey || !raw || typeof raw !== 'object') return;
  detailCache.set(cacheKey, {
    raw,
    cachedAt: Date.now(),
  });
  if (detailCache.size > DETAIL_CACHE_LIMIT) {
    const oldestKey = detailCache.keys().next().value;
    detailCache.delete(oldestKey);
  }
}

function isGuangdadaPlayableItem(item) {
  const resources = Array.isArray(item?.resource_urls) ? item.resource_urls : [];
  return Number(item?.ads_type) === 7 || resources.some((resource) => (
    Number(resource?.type) === 7 || Boolean(resource?.html_url)
  ));
}

function extractGuangdadaDetailRaw(result) {
  const payload = result?.data;
  const raw = payload?.data ?? payload ?? null;
  return raw && typeof raw === 'object' ? raw : null;
}

function mergeDetailIntoItem(item, detailRaw) {
  if (!detailRaw || typeof detailRaw !== 'object') return item;
  return {
    ...item,
    ...detailRaw,
    _creative_intelligence_detail_enriched: true,
  };
}

function selectDetailEnrichedItems(items, stats) {
  const selected = items.filter((item) => item?._creative_intelligence_detail_enriched);
  if (stats && typeof stats === 'object') {
    stats.selectedForIngestionCount = selected.length;
    stats.unselectedCount = Math.max(0, items.length - selected.length);
  }
  return selected;
}

function buildSuccessMessage({ sentCount, acceptedCount, enrichmentStats }) {
  const parts = [`搜索结果延迟同步完成：送入 ${sentCount} 条`];
  if (acceptedCount !== sentCount) parts.push(`上游接收 ${acceptedCount} 条`);
  if (enrichmentStats) parts.push(`详情补全 ${enrichmentStats.enrichedCount ?? 0} 条`);
  return parts.join('，');
}

function getSelectionDroppedCount(originalCount, selectedCount) {
  return Math.max(0, Number(originalCount || 0) - Number(selectedCount || 0));
}

async function enrichGuangdadaItemsWithDetails(items, batch, options) {
  const nextItems = [...items];
  const stats = {
    enabled: options.guangdadaDetailLimit > 0,
    candidateCount: 0,
    requestedCount: 0,
    enrichedCount: 0,
    cachedCount: 0,
    skippedCount: 0,
    stoppedReason: null,
    reserveRemaining: options.guangdadaDetailReserve,
    detailLimit: options.guangdadaDetailLimit,
    intervalMs: {
      min: options.detailMinIntervalMs,
      max: options.detailMaxIntervalMs,
    },
  };

  if (!stats.enabled) {
    stats.stoppedReason = 'disabled';
    return { items: nextItems, stats };
  }

  const status = await guangdadaPuppeteerService.getStatus().catch(() => null);
  if (status?.status !== 'ONLINE') {
    stats.stoppedReason = 'not_logged_in';
    return { items: nextItems, stats };
  }

  const candidates = [];
  for (let index = 0; index < nextItems.length; index += 1) {
    const item = nextItems[index];
    if (!item?.ad_key || isGuangdadaPlayableItem(item)) {
      stats.skippedCount += 1;
      continue;
    }
    candidates.push({ item, index });
    if (candidates.length >= options.guangdadaDetailLimit) break;
  }
  stats.candidateCount = candidates.length;

  for (const [candidateIndex, candidate] of candidates.entries()) {
    const cacheKey = getGuangdadaDetailCacheKey(candidate.item);
    const cachedRaw = cacheKey ? getCachedDetail(cacheKey, options.detailCacheTtlMs) : null;
    if (cachedRaw) {
      nextItems[candidate.index] = mergeDetailIntoItem(candidate.item, cachedRaw);
      stats.cachedCount += 1;
      stats.enrichedCount += 1;
      continue;
    }

    if (candidateIndex > 0) {
      await wait(randomBetween(options.detailMinIntervalMs, options.detailMaxIntervalMs));
    }

    const quotaResult = await consumeGuangdadaQuotaWithReserve('ads_detail', 1, options.guangdadaDetailReserve, {
      endpoint: '/catalog/g1/creative-detail',
      source: 'creative_intelligence_background_enrichment',
      sourceChannel: batch.sourceChannel,
      clientBatchId: batch.clientBatchId,
      ad_key: candidate.item.ad_key,
      app_type: candidate.item.app_type ?? candidate.item.ads_type ?? 1,
    });
    if (!quotaResult.allowed) {
      stats.stoppedReason = quotaResult.code || 'quota_reserved';
      logger.info(`[CreativeIntelligence] 广大大详情补全暂停: ${quotaResult.message}`);
      break;
    }

    stats.requestedCount += 1;
    const detailResult = await guangdadaPuppeteerService.fetchCreativeDetail({
      ad_key: candidate.item.ad_key,
      app_type: candidate.item.app_type ?? candidate.item.ads_type ?? 1,
      search_flag: candidate.item.search_flag ?? candidate.item.search_fag,
    });
    if (!detailResult?.success) {
      logger.warn(
        `[CreativeIntelligence] 广大大详情补全失败 ad_key=${candidate.item.ad_key}: ${detailResult?.message || detailResult?.code || 'unknown'}`
      );
      continue;
    }

    const raw = extractGuangdadaDetailRaw(detailResult);
    if (!raw) {
      logger.warn(`[CreativeIntelligence] 广大大详情补全返回结构异常 ad_key=${candidate.item.ad_key}`);
      continue;
    }

    setCachedDetail(cacheKey, raw);
    nextItems[candidate.index] = mergeDetailIntoItem(candidate.item, raw);
    stats.enrichedCount += 1;
  }

  return { items: nextItems, stats };
}

async function processDelayedIngestionBatch(batch) {
  const options = getAutoSyncOptions();
  const originalItemCount = batch.items.length;
  let selectedItemCount = originalItemCount;
  let items = cloneItems(batch.items);
  let enrichmentStats = null;

  if (batch.platformKey === 'guangdada') {
    const enriched = await enrichGuangdadaItemsWithDetails(items, batch, options);
    enrichmentStats = enriched.stats;
    items = selectDetailEnrichedItems(enriched.items, enrichmentStats);
    selectedItemCount = items.length;
  }

  if (items.length === 0) {
    const message = batch.platformKey === 'guangdada'
      ? '搜索结果延迟同步跳过：无详情补全素材可推送'
      : '搜索结果延迟同步跳过：无可推送素材';
    auditMaterialIngestionSync({
      operatorProfile: batch.operatorProfile,
      platform: batch.platformKey,
      status: 'skipped',
      success: false,
      message,
      metadata: {
        sourceChannel: batch.sourceChannel,
        clientBatchId: batch.clientBatchId,
        requestId: batch.requestId,
        itemCount: originalItemCount,
        selectedCount: selectedItemCount,
        sentCount: 0,
        acceptedCount: 0,
        droppedCount: originalItemCount,
        selectionDroppedCount: getSelectionDroppedCount(originalItemCount, selectedItemCount),
        ingestionDroppedCount: 0,
        upstreamStatus: null,
        searchContext: batch.context,
        delayed: true,
        scheduledAt: batch.scheduledAt,
        processedAt: Date.now(),
        delayMs: batch.delayMs,
        enrichment: enrichmentStats,
      },
    });
    logger.info(`[CreativeIntelligence] ${batch.platformKey} ${message}`);
    return;
  }

  try {
    const syncResult = await ingestMaterials({
      platform: batch.platformKey,
      sourceChannel: batch.sourceChannel,
      businessLine: batch.businessLine,
      clientBatchId: batch.clientBatchId,
      requestId: batch.requestId,
      idempotencyKey: `idem_${batch.clientBatchId}_${items.length}`,
      items,
    });
    const receiptId = syncResult?.upstream?.data?.receipt_id ?? null;
    const sentCount = syncResult?.requestPayloadSummary?.sentCount ?? 0;
    const acceptedCount = syncResult?.upstream?.data?.accepted_count ?? sentCount;
    const ingestionDroppedCount = syncResult?.requestPayloadSummary?.droppedCount ?? 0;
    const selectionDroppedCount = getSelectionDroppedCount(originalItemCount, selectedItemCount);
    auditMaterialIngestionSync({
      operatorProfile: batch.operatorProfile,
      platform: batch.platformKey,
      success: true,
      message: buildSuccessMessage({ sentCount, acceptedCount, enrichmentStats }),
      metadata: {
        sourceChannel: batch.sourceChannel,
        clientBatchId: batch.clientBatchId,
        requestId: batch.requestId,
        receiptId,
        itemCount: originalItemCount,
        selectedCount: selectedItemCount,
        sentCount,
        acceptedCount,
        droppedCount: Math.max(0, originalItemCount - sentCount),
        selectionDroppedCount,
        ingestionDroppedCount,
        upstreamStatus: syncResult?.upstream?.data?.status ?? null,
        ingestionRequest: syncResult?.request ?? null,
        ingestionResponse: syncResult?.response ?? null,
        upstreamResponse: syncResult?.upstream ?? null,
        searchContext: batch.context,
        delayed: true,
        scheduledAt: batch.scheduledAt,
        processedAt: Date.now(),
        delayMs: batch.delayMs,
        enrichment: enrichmentStats,
      },
    });
    logger.info(`[CreativeIntelligence] ${batch.platformKey} 搜索结果延迟同步完成: sent=${sentCount}, accepted=${acceptedCount}, total=${originalItemCount}`);
  } catch (error) {
    if (error?.code === 'NO_VALID_ITEMS') {
      const ingestionDroppedCount = error?.requestPayloadSummary?.droppedCount ?? selectedItemCount;
      const selectionDroppedCount = getSelectionDroppedCount(originalItemCount, selectedItemCount);
      auditMaterialIngestionSync({
        operatorProfile: batch.operatorProfile,
        platform: batch.platformKey,
        status: 'skipped',
        success: false,
        message: '搜索结果延迟同步跳过：无可推送的视频/图片素材',
        metadata: {
          sourceChannel: batch.sourceChannel,
          clientBatchId: batch.clientBatchId,
          requestId: batch.requestId,
          itemCount: originalItemCount,
          selectedCount: selectedItemCount,
          sentCount: 0,
          acceptedCount: 0,
          droppedCount: originalItemCount,
          selectionDroppedCount,
          ingestionDroppedCount,
          ingestionRequest: error?.ingestionRequest ?? null,
          searchContext: batch.context,
          delayed: true,
          scheduledAt: batch.scheduledAt,
          processedAt: Date.now(),
          delayMs: batch.delayMs,
          enrichment: enrichmentStats,
        },
      });
      logger.info(`[CreativeIntelligence] ${batch.platformKey} 搜索结果无可推送的视频/图片素材，已跳过`);
      return;
    }
    const sentCount = error?.requestPayloadSummary?.sentCount ?? null;
    const selectionDroppedCount = getSelectionDroppedCount(originalItemCount, selectedItemCount);
    auditMaterialIngestionSync({
      operatorProfile: batch.operatorProfile,
      platform: batch.platformKey,
      success: false,
      message: error?.message || '搜索结果延迟同步失败',
      metadata: {
        sourceChannel: batch.sourceChannel,
        clientBatchId: batch.clientBatchId,
        requestId: batch.requestId,
        itemCount: originalItemCount,
        selectedCount: selectedItemCount,
        sentCount,
        droppedCount: sentCount == null ? null : Math.max(0, originalItemCount - sentCount),
        selectionDroppedCount,
        ingestionDroppedCount: error?.requestPayloadSummary?.droppedCount ?? null,
        status: error?.status ?? null,
        code: error?.code ?? null,
        ingestionRequest: error?.ingestionRequest ?? null,
        ingestionResponse: error?.ingestionResponse ?? null,
        upstreamResponse: error?.response ?? null,
        searchContext: batch.context,
        delayed: true,
        scheduledAt: batch.scheduledAt,
        processedAt: Date.now(),
        delayMs: batch.delayMs,
        enrichment: enrichmentStats,
      },
    });
    logger.warn(`[CreativeIntelligence] ${batch.platformKey} 搜索结果延迟同步失败: ${error?.message || error}`);
  }
}

export function scheduleSearchResultIngestion({
  platform,
  result,
  searchParams,
  operatorProfile,
  sourceChannel = 'search_result_auto_sync',
  businessLine = 'ad_ops',
}) {
  if (String(searchParams?.insightrackrSearchTab || '').trim() === 'playable') {
    return;
  }

  const config = resolveCreativeIntelligenceConfig();
  if (!config.enabled) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.warn('[CreativeIntelligence] 未配置 CREATIVE_INTELLIGENCE_API_KEY，跳过搜索结果自动同步');
    }
    return;
  }

  const success = result?.success !== false;
  const items = success ? extractItems(result) : [];
  if (!success || items.length === 0) return;

  const now = Date.now();
  const platformKey = platform === 'guangdada' ? 'guangdada' : 'insightrackr';
  const context = getSearchContext(platformKey, searchParams);
  const requestId = `req_ads_scraw_${platformKey}_${now}`;
  const clientBatchId = `ads_scraw_${platformKey}_${safeIdPart(context.page)}_${now}`;
  const idempotencyKey = `idem_${clientBatchId}_${items.length}`;

  const options = getAutoSyncOptions();
  const delayMs = options.syncDelayMs + randomBetween(0, options.syncDelayJitterMs);
  const batch = {
    platformKey,
    sourceChannel,
    businessLine,
    clientBatchId,
    requestId,
    idempotencyKey,
    items: cloneItems(items),
    searchParams,
    context,
    operatorProfile,
    scheduledAt: now,
    delayMs,
  };

  const timer = setTimeout(() => {
    processDelayedIngestionBatch(batch).catch((error) => {
      logger.warn(`[CreativeIntelligence] ${platformKey} 延迟同步任务异常: ${error?.message || error}`);
    });
  }, delayMs);
  timer.unref?.();

  logger.info(
    `[CreativeIntelligence] ${platformKey} 搜索结果已缓存，计划 ${Math.round(delayMs / 1000)} 秒后延迟同步: ${items.length} 条`
  );
}
