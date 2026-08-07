const DEFAULT_BASE_URL = 'https://skylink-gateway.com/api/v1';
const DEFAULT_INGESTION_PATH = '/creative-intelligence/material-ingestions';
const MAX_ITEMS_PER_BATCH = 200;
const MAX_PROVIDER_RAW_CHARS = 180000;
const REQUEST_TIMEOUT_MS = 45000;

function trimString(value, maxLength = 1000) {
  if (value == null) return undefined;
  const text = String(value).replace(/<[^>]+>/g, '').trim();
  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function firstValue(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const found = value.find((item) => item != null && String(item).trim() !== '');
      if (found != null) return found;
      continue;
    }
    if (String(value).trim() !== '') return value;
  }
  return undefined;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function flattenValues(value) {
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenValues);
  return asArray(value);
}

function uniqueStrings(values, limit = 50) {
  const source = flattenValues(values);
  const seen = new Set();
  const result = [];
  for (const value of source) {
    const text = trimString(value, 128);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function numberOrUndefined(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function timestampToIso(value) {
  if (value == null || value === '') return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value).trim();
  if (!raw) return undefined;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) {
    const millis = asNumber > 100000000000 ? asNumber : asNumber * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeUrl(value) {
  const text = trimString(value, 4096);
  if (!text) return undefined;
  const markdown = text.match(/^\[[^\]]*]\((https?:\/\/[^)\s]+)\)$/i);
  if (markdown) return markdown[1].replace(/[，,。.;；:：]+$/u, '');
  const firstUrl = text.match(/https?:\/\/[^\s)\]]+/i);
  return firstUrl ? firstUrl[0].replace(/[，,。.;；:：]+$/u, '') : undefined;
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function originFromUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function truncateRaw(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  try {
    const text = JSON.stringify(raw);
    if (text.length <= MAX_PROVIDER_RAW_CHARS) return raw;
    return {
      truncated: true,
      raw_preview: text.slice(0, MAX_PROVIDER_RAW_CHARS),
    };
  } catch {
    return undefined;
  }
}

function compactObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const compact = compactObject(value);
      if (compact && Object.keys(compact).length > 0) result[key] = compact;
      continue;
    }
    result[key] = value;
  }
  return result;
}

function normalizePlatform(value, fallback = 'unknown') {
  const raw = firstValue(value);
  if (!raw) return fallback;
  const text = String(raw).trim().toLowerCase();
  const map = {
    facebook: 'facebook',
    instagram: 'instagram',
    audience_network: 'facebook',
    messenger: 'facebook',
    admob: 'admob',
    youtube: 'youtube',
    tiktok: 'tiktok',
    twitter: 'x',
    x: 'x',
    applovin: 'applovin',
    unity_ads: 'unity',
    unityads: 'unity',
    ironsource: 'ironsource',
  };
  return map[text] || text;
}

function resourceTypeFromKind(kind) {
  const text = String(kind || '').trim().toLowerCase();
  if (['video', 'image', 'unknown'].includes(text)) return text;
  if (['html', 'playable'].includes(text)) return 'unknown';
  return 'unknown';
}

function pushAsset(assets, asset) {
  const url = normalizeUrl(asset?.url);
  if (!url) return;
  const kind = String(asset.kind || '').toLowerCase();
  if (!kind) return;
  if (assets.some((item) => item.url === url)) return;
  assets.push(compactObject({
    asset_external_id: trimString(asset.asset_external_id, 128),
    kind,
    url,
    cover_url: normalizeUrl(asset.cover_url),
    duration_seconds: numberOrUndefined(asset.duration_seconds),
    width: numberOrUndefined(asset.width),
    height: numberOrUndefined(asset.height),
  }));
}

function guangdadaAssets(item) {
  const resources = Array.isArray(item?.resource_urls) ? item.resource_urls : [];
  const assets = [];
  for (const [index, resource] of resources.entries()) {
    const type = Number(resource?.type);
    const videoUrl = normalizeUrl(resource?.video_url);
    const imageUrl = normalizeUrl(resource?.image_url);
    const width = firstValue(resource?.width, resource?.ad_width, resource?.material_width, item?.width, item?.ad_width, item?.material_width);
    const height = firstValue(resource?.height, resource?.ad_height, resource?.material_height, item?.height, item?.ad_height, item?.material_height);
    if (videoUrl || type === 2) {
      pushAsset(assets, {
        asset_external_id: `${item?.ad_key || 'resource'}-${index}-video`,
        kind: 'video',
        url: videoUrl,
        cover_url: imageUrl || item?.preview_img_url,
        duration_seconds: item?.video_duration,
        width,
        height,
      });
    } else if (imageUrl || type === 1 || type === 3) {
      pushAsset(assets, {
        asset_external_id: `${item?.ad_key || 'resource'}-${index}-image`,
        kind: 'image',
        url: imageUrl,
        cover_url: item?.preview_img_url,
        width,
        height,
      });
    }
  }
  if (assets.length === 0 && Number(item?.ads_type) === 1) {
    pushAsset(assets, {
      asset_external_id: `${item?.ad_key || 'preview'}-image`,
      kind: 'image',
      url: item?.preview_img_url,
      width: firstValue(item?.width, item?.ad_width, item?.material_width),
      height: firstValue(item?.height, item?.ad_height, item?.material_height),
    });
  }
  return assets.slice(0, 8);
}

function isGuangdadaPlayableItem(item) {
  const resources = Array.isArray(item?.resource_urls) ? item.resource_urls : [];
  return Number(item?.ads_type) === 7 || resources.some((resource) => (
    Number(resource?.type) === 7 || Boolean(normalizeUrl(resource?.html_url))
  ));
}

function guangdadaResourceType(item, assets) {
  if (Number(item?.ads_type) === 2 || assets.some((asset) => asset.kind === 'video')) return 'video';
  if (Number(item?.ads_type) === 1 || assets.some((asset) => asset.kind === 'image')) return 'image';
  return 'unknown';
}

function buildGuangdadaDetailUrl(item) {
  const adKey = trimString(item?.ad_key, 256);
  if (!adKey) return undefined;
  const params = new URLSearchParams({
    channel: String(firstValue(item?.platform, 'admob')),
    id: adKey,
    type: String(item?.app_type ?? item?.ads_type ?? 1),
    created_at: String(item?.created_at ?? ''),
    fb_merge: 'false',
    search_flag: String(item?.search_flag ?? item?.search_fag ?? ''),
  });
  return `https://guangdada.net/modules/creative/display-ads/detail?${params.toString()}`;
}

function mapGuangdadaItem(item) {
  if (isGuangdadaPlayableItem(item)) return null;
  const assets = guangdadaAssets(item);
  const landingUrl = normalizeUrl(firstValue(
    item?.landing_page?.url,
    item?.landing_page_info?.url,
    item?.store?.url,
    item?.store_url,
    item?.landing_page_url,
    item?.landing_page,
    item?.source_url,
    item?.target_url,
    item?.targetUrl
  ));
  const postUrl = normalizeUrl(firstValue(item?.post_url, item?.source_url)) || buildGuangdadaDetailUrl(item);
  const title = trimString(firstValue(item?.title, item?.headline, item?.message, item?.body, item?.copywriting), 4096);
  return compactObject({
    external_material_id: trimString(firstValue(item?.ad_key, item?.material_id, item?.search_flag, item?.image_ahash_md5), 255),
    platform: normalizePlatform(item?.platform, 'unknown'),
    resource_type: guangdadaResourceType(item, assets),
    title,
    ad_name: title,
    content: trimString(firstValue(item?.body, item?.message, item?.description, item?.text, item?.copy, item?.title), 100000),
    language: trimString(firstValue(item?.language, item?.copy_language, item?.copy_lang, item?.languages, item?.lan), 32),
    countries: uniqueStrings([item?.countries, item?.country_codes, item?.country_names, item?.geo, item?.country, item?.country_code]),
    keywords: uniqueStrings([
      item?.keywords,
      item?.custom_tag,
      item?.ad_features,
      item?.material_ai_search_word,
      item?.material_ai_search_word_new,
      item?.material_ai_tag,
      item?.game_core_track,
      item?.game_play,
      item?.game_theme,
      item?.game_ip,
      item?.ip,
    ]),
    publish_time: timestampToIso(item?.created_at ?? item?.first_seen),
    last_seen_at: timestampToIso(item?.last_seen),
    metrics: {
      view_count: numberOrUndefined(item?.view_count ?? item?.impression),
      like_count: numberOrUndefined(item?.like_count),
      comment_count: numberOrUndefined(item?.comment_count),
      active_days: numberOrUndefined(item?.days_count),
    },
    advertiser: {
      name: trimString(firstValue(item?.advertiser_name, item?.page_name), 255),
      external_id: trimString(firstValue(item?.advertiser_id, item?.ecom_advertiser_id, item?.domain), 255),
    },
    landing_page: landingUrl ? {
      url: landingUrl,
      base_url: originFromUrl(landingUrl),
      domain: domainFromUrl(landingUrl),
    } : undefined,
    source_urls: {
      post_url: postUrl,
    },
    assets,
    tags: uniqueStrings(item?.ad_features).map((tag) => ({
      source_provider: 'guangdada',
      taxonomy_domain: 'creative',
      category_key: 'ad_features',
      tag_code: tag,
    })),
    provider_raw: truncateRaw(item),
  });
}

function insightrackrAssets(item) {
  const assets = [];
  const isVideo = Number(item?.materialType) === 2 || !!trimString(item?.videoUrl, 4096);
  if (isVideo) {
    pushAsset(assets, {
      asset_external_id: `${firstValue(item?.id, item?.search_flag, item?.ad_key, 'resource')}-video`,
      kind: 'video',
      url: item?.videoUrl,
      cover_url: firstValue(item?.thumbnailConverUrl, item?.converUrl, item?.thumbnailImageUrl, item?.imageUrl),
      duration_seconds: item?.duration ?? item?.videoDuration ?? item?.materialDuration,
      width: item?.width ?? item?.materialWidth,
      height: item?.height ?? item?.materialHeight,
    });
  } else {
    const images = uniqueStrings([item?.thumbnailImageUrl, item?.imageUrl, item?.converUrl], 8);
    images.forEach((url, index) => {
      pushAsset(assets, {
        asset_external_id: `${firstValue(item?.id, item?.search_flag, item?.ad_key, 'resource')}-${index}-image`,
        kind: 'image',
        url,
        width: item?.width ?? item?.materialWidth,
        height: item?.height ?? item?.materialHeight,
      });
    });
  }
  return assets.slice(0, 8);
}

function isInsightrackrPlayableItem(item) {
  return Boolean(normalizeUrl(item?.playHtmlUrl));
}

function mapInsightrackrItem(item) {
  if (isInsightrackrPlayableItem(item)) return null;
  const assets = insightrackrAssets(item);
  const app = Array.isArray(item?.appList) ? item.appList[0] : null;
  const title = trimString(firstValue(item?.title, item?.name, item?.adName), 4096);
  const desc = trimString(firstValue(item?.describe, item?.description, item?.content), 100000);
  const landingUrl = normalizeUrl(firstValue(
    item?.landingPageUrl,
    item?.landing_page_url,
    item?.landingUrl,
    item?.targetUrl,
    item?.storeUrl,
    app?.url
  ));
  return compactObject({
    external_material_id: trimString(firstValue(item?.id, item?.search_flag, item?.ad_key, item?.bizId, item?.materialId), 255),
    platform: normalizePlatform(firstValue(item?.mediaName, item?.platformName, item?.channel, item?.platform), 'unknown'),
    resource_type: resourceTypeFromKind(assets.find((asset) => asset.kind === 'video')?.kind || assets[0]?.kind),
    title,
    ad_name: title,
    content: desc,
    language: trimString(firstValue(item?.language, item?.lang), 32),
    countries: uniqueStrings([item?.country, item?.countryName, item?.region, item?.countryList]),
    keywords: uniqueStrings([item?.tags, item?.materialTag, item?.tagList]),
    publish_time: timestampToIso(item?.globalFirstTime ?? item?.firstTime),
    last_seen_at: timestampToIso(item?.globalLastTime ?? item?.lastTime),
    metrics: {
      view_count: numberOrUndefined(item?.playCnt ?? item?.impression),
      like_count: numberOrUndefined(item?.likeCnt),
      comment_count: numberOrUndefined(item?.commentCnt),
      active_days: numberOrUndefined(item?.findCntSum ?? item?.findCnt),
    },
    advertiser: {
      name: trimString(firstValue(item?.advertiserName, item?.advertiser, item?.brandName, app?.name), 255),
      external_id: trimString(firstValue(item?.advertiserId, item?.brandId, app?.id, app?.appId), 255),
    },
    landing_page: landingUrl ? {
      url: landingUrl,
      base_url: originFromUrl(landingUrl),
      domain: domainFromUrl(landingUrl),
    } : undefined,
    source_urls: {
      post_url: normalizeUrl(firstValue(item?.sourceUrl, item?.detailUrl, item?.pageUrl, item?.originalUrl)),
    },
    assets,
    provider_raw: truncateRaw(item),
  });
}

function normalizePlatformKey(platform) {
  const key = String(platform || '').trim().toLowerCase();
  if (key === 'insightrackr' || key === 'hotcloud' || key === 'reyun' || key === '热云') return 'insightrackr';
  if (key === 'guangdada' || key === 'g1' || key === '广大大') return 'guangdada';
  return key;
}

export function mapMaterialsForIngestion({ platform, items }) {
  const platformKey = normalizePlatformKey(platform);
  const list = Array.isArray(items) ? items : [];
  const mapped = list
    .slice(0, MAX_ITEMS_PER_BATCH)
    .map((item) => {
      if (platformKey === 'guangdada') return mapGuangdadaItem(item);
      if (platformKey === 'insightrackr') return mapInsightrackrItem(item);
      return null;
    })
    .filter((item) => item && (
      item.resource_type === 'video' ||
      item.resource_type === 'image'
    ))
    .filter((item) => Array.isArray(item.assets) && item.assets.some((asset) => (
      asset?.kind === 'video' || asset?.kind === 'image'
    )))
    .filter((item) => (
      item.title ||
      item.ad_name ||
      item.content ||
      (Array.isArray(item.assets) && item.assets.length > 0)
    ));

  return {
    platformKey,
    items: mapped,
    droppedCount: Math.max(0, list.length - mapped.length),
  };
}

export function resolveCreativeIntelligenceConfig() {
  const apiKey = String(process.env.CREATIVE_INTELLIGENCE_API_KEY || '').trim();
  const baseUrl = String(process.env.CREATIVE_INTELLIGENCE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const ingestionPath = String(process.env.CREATIVE_INTELLIGENCE_INGESTION_PATH || DEFAULT_INGESTION_PATH).trim() || DEFAULT_INGESTION_PATH;
  return {
    apiKey,
    baseUrl,
    ingestionPath: ingestionPath.startsWith('/') ? ingestionPath : `/${ingestionPath}`,
    enabled: Boolean(apiKey),
  };
}

export async function ingestMaterials({
  platform,
  sourceChannel = 'ads_scraw_results',
  businessLine = 'ad_ops',
  clientBatchId,
  items,
  requestId,
  idempotencyKey,
}) {
  const config = resolveCreativeIntelligenceConfig();
  if (!config.enabled) {
    const err = new Error('未配置 CREATIVE_INTELLIGENCE_API_KEY');
    err.code = 'CONFIG_MISSING';
    throw err;
  }

  const { platformKey, items: mappedItems, droppedCount } = mapMaterialsForIngestion({ platform, items });
  if (!['guangdada', 'insightrackr'].includes(platformKey)) {
    const err = new Error('暂仅支持广大大、热云同步');
    err.code = 'UNSUPPORTED_PLATFORM';
    throw err;
  }
  if (mappedItems.length === 0) {
    const err = new Error('没有满足最低完整性要求的素材可同步');
    err.code = 'NO_VALID_ITEMS';
    throw err;
  }

  const now = Date.now();
  const safeBatchId = trimString(clientBatchId, 128) || `ads_scraw_${platformKey}_${now}`;
  const xRequestId = requestId || `req_ads_scraw_${now}`;
  const idempotencyHeader = idempotencyKey || `idem_${safeBatchId}_${mappedItems.length}`;
  const payload = {
    schema_version: '2026-07-31',
    source_system: {
      client_batch_id: safeBatchId,
      source_provider: platformKey,
      source_channel: trimString(sourceChannel, 64) || 'ads_scraw_results',
      business_line: trimString(businessLine, 64) || 'ad_ops',
    },
    items: mappedItems,
  };
  const requestUrl = `${config.baseUrl}${config.ingestionPath}`;
  const ingestionRequest = {
    method: 'POST',
    url: requestUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': xRequestId,
      'Idempotency-Key': idempotencyHeader,
    },
    body: payload,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Request-Id': xRequestId,
        'Idempotency-Key': idempotencyHeader,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 1000) };
    }
    const ingestionResponse = {
      status: res.status,
      statusText: res.statusText,
      body: json,
    };
    if (!res.ok) {
      const err = new Error(json?.message || json?.error?.message || `素材同步接口请求失败: ${res.status}`);
      err.status = res.status;
      err.response = json;
      err.ingestionRequest = ingestionRequest;
      err.ingestionResponse = ingestionResponse;
      err.requestPayloadSummary = {
        clientBatchId: safeBatchId,
        sourceChannel,
        businessLine,
        sentCount: mappedItems.length,
        droppedCount,
      };
      throw err;
    }
    return {
      platformKey,
      request: ingestionRequest,
      response: ingestionResponse,
      requestPayloadSummary: {
        clientBatchId: safeBatchId,
        sourceChannel,
        businessLine,
        sentCount: mappedItems.length,
        droppedCount,
      },
      upstream: json,
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error('素材同步接口请求超时');
      timeoutError.code = 'TIMEOUT';
      timeoutError.ingestionRequest = ingestionRequest;
      timeoutError.requestPayloadSummary = {
        clientBatchId: safeBatchId,
        sourceChannel,
        businessLine,
        sentCount: mappedItems.length,
        droppedCount,
      };
      throw timeoutError;
    }
    if (err && typeof err === 'object') {
      err.ingestionRequest = err.ingestionRequest || ingestionRequest;
      err.requestPayloadSummary = err.requestPayloadSummary || {
        clientBatchId: safeBatchId,
        sourceChannel,
        businessLine,
        sentCount: mappedItems.length,
        droppedCount,
      };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
