import { searchData } from '../../../utils/api.js';

const RECENT_APPS_STORAGE_KEY = 'st-gallery-recent-apps';
const RECENT_MAX = 12;

export function isValidUnifiedAppId(id) {
  return /^[a-f0-9]{24}$/i.test(String(id || '').trim());
}

export async function searchGalleryApps(term, limit = 20) {
  const result = await searchData('sensortower', {
    action: 'searchApps',
    term: String(term || '').trim(),
    limit,
    mode: 'search',
  });
  if (!result.success) {
    throw new Error(result.message || '搜索应用失败');
  }
  return result.data?.apps ?? [];
}

export async function fetchRecentGalleryApps(limit = 12) {
  const result = await searchData('sensortower', {
    action: 'searchApps',
    mode: 'recent',
    limit,
  });
  if (!result.success) {
    return loadRecentAppsFromStorage();
  }
  const apps = result.data?.apps ?? [];
  if (apps.length) return apps;
  return loadRecentAppsFromStorage();
}

export function loadRecentAppsFromStorage() {
  try {
    const raw = localStorage.getItem(RECENT_APPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a) => isValidUnifiedAppId(a?.unifiedAppId)) : [];
  } catch {
    return [];
  }
}

export function saveRecentAppToStorage(app) {
  if (!app?.unifiedAppId || !isValidUnifiedAppId(app.unifiedAppId)) return;
  const prev = loadRecentAppsFromStorage().filter((a) => a.unifiedAppId !== app.unifiedAppId);
  const next = [app, ...prev].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_APPS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function formatMetric(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return String(value);
  }
  return String(value);
}

/** 单商店版本（ios_apps / android_apps 条目） */
export function normalizeStoreVersion(raw, os) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.app_id ?? '').trim();
  if (!id) return null;

  const downloads =
    raw.downloads ??
    raw.humanized_worldwide_last_month_downloads?.string ??
    raw.humanized_worldwide_last_month_downloads?.downloads ??
    null;
  const revenue =
    raw.revenue ??
    raw.humanized_worldwide_last_month_revenue?.string ??
    raw.humanized_worldwide_last_month_revenue?.revenue ??
    null;

  return {
    id,
    os,
    name: String(raw.name ?? raw.humanized_name ?? '').trim(),
    publisher: String(raw.publisher ?? raw.publisher_name ?? '').trim(),
    iconUrl: String(raw.iconUrl ?? raw.icon_url ?? '').trim(),
    downloads: formatMetric(downloads) || String(downloads || '').trim(),
    revenue: formatMetric(revenue) || String(revenue || '').trim(),
    selected: raw?.selected !== false,
  };
}

export function normalizeStoreVersions(list, os) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizeStoreVersion(item, os)).filter(Boolean);
}

export function toggleStoreVersionSelection(app, versionId, os) {
  const key = os === 'ios' ? 'iosApps' : 'androidApps';
  const list = app?.[key];
  if (!Array.isArray(list) || !list.length) return app;

  return {
    ...app,
    [key]: list.map((item) =>
      String(item.id) === String(versionId)
        ? { ...item, selected: !(item.selected !== false) }
        : item
    ),
  };
}

/** 将 internal_entities 响应规范为搜索/添加应用使用的结构 */
export function normalizeUnifiedAppDetails(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const unifiedAppId = String(raw.unifiedAppId ?? raw.id ?? raw.app_id ?? '').trim();
  if (!isValidUnifiedAppId(unifiedAppId)) return null;

  let iconUrl = String(raw.iconUrl ?? raw.icon_url ?? '').trim();
  const downloads =
    raw.downloads ??
    raw.humanized_worldwide_last_month_downloads?.string ??
    raw.humanized_worldwide_last_month_downloads?.downloads ??
    null;
  const revenue =
    raw.revenue ??
    raw.humanized_worldwide_last_month_revenue?.string ??
    raw.humanized_worldwide_last_month_revenue?.revenue ??
    null;

  return {
    unifiedAppId,
    name: String(raw.name ?? raw.humanized_name ?? '').trim(),
    publisher: String(raw.publisher ?? raw.publisher_name ?? '').trim(),
    iconUrl,
    iosCount:
      raw.iosCount ??
      (Array.isArray(raw.ios_apps) ? raw.ios_apps.length : null),
    androidCount:
      raw.androidCount ??
      (Array.isArray(raw.android_apps) ? raw.android_apps.length : null),
    iosApps:
      Array.isArray(raw.iosApps) && raw.iosApps.length > 0
        ? raw.iosApps
        : normalizeStoreVersions(raw.ios_apps, 'ios'),
    androidApps:
      Array.isArray(raw.androidApps) && raw.androidApps.length > 0
        ? raw.androidApps
        : normalizeStoreVersions(raw.android_apps, 'android'),
    downloads,
    revenue,
  };
}

function buildRawAppsById(response) {
  const rawApps = response?.apps;
  if (!Array.isArray(rawApps)) return new Map();
  const map = new Map();
  for (const raw of rawApps) {
    const id = String(raw?.id ?? raw?.app_id ?? '').trim();
    if (isValidUnifiedAppId(id)) map.set(id, raw);
  }
  return map;
}

function resolveAppDetailsSource(app, rawById) {
  const unifiedAppId = String(app?.unifiedAppId ?? app?.id ?? app?.app_id ?? '').trim();
  const raw = rawById.get(unifiedAppId);
  if (!raw) return app;
  return {
    ...raw,
    ...app,
    unifiedAppId,
    ios_apps: raw.ios_apps ?? app?.ios_apps,
    android_apps: raw.android_apps ?? app?.android_apps,
    iosApps: app?.iosApps,
    androidApps: app?.androidApps,
  };
}

export function parseFetchAppDetailsData(data) {
  const rawById = buildRawAppsById(data?.response);
  const normalizedApps = Array.isArray(data?.apps) ? data.apps : [];

  if (normalizedApps.length) {
    return normalizedApps
      .map((app) => normalizeUnifiedAppDetails(resolveAppDetailsSource(app, rawById)))
      .filter(Boolean);
  }

  return [...rawById.values()]
    .map((raw) => normalizeUnifiedAppDetails(raw))
    .filter(Boolean);
}

export function mergeAppSearchWithDetails(searchApp, detailsApp) {
  if (!searchApp) return detailsApp;
  if (!detailsApp) return searchApp;
  return {
    ...searchApp,
    ...detailsApp,
    unifiedAppId: searchApp.unifiedAppId || detailsApp.unifiedAppId,
    name: detailsApp.name || searchApp.name,
    publisher: detailsApp.publisher || searchApp.publisher,
    iconUrl: detailsApp.iconUrl || searchApp.iconUrl,
    iosCount: detailsApp.iosCount ?? searchApp.iosCount,
    androidCount: detailsApp.androidCount ?? searchApp.androidCount,
    iosApps: detailsApp.iosApps?.length ? detailsApp.iosApps : searchApp.iosApps ?? [],
    androidApps: detailsApp.androidApps?.length ? detailsApp.androidApps : searchApp.androidApps ?? [],
    downloads: detailsApp.downloads ?? searchApp.downloads,
    revenue: detailsApp.revenue ?? searchApp.revenue,
  };
}

export async function fetchUnifiedAppDetails(appIds) {
  const ids = (Array.isArray(appIds) ? appIds : [appIds])
    .map((id) => String(id || '').trim())
    .filter(isValidUnifiedAppId);
  if (!ids.length) return [];

  const result = await searchData('sensortower', {
    action: 'fetchAppDetails',
    appIds: ids,
  });
  if (!result.success) {
    throw new Error(result.message || '加载应用详情失败');
  }
  return parseFetchAppDetailsData(result.data);
}

export async function fetchUnifiedAppDetail(unifiedAppId) {
  const apps = await fetchUnifiedAppDetails([unifiedAppId]);
  return apps[0] ?? null;
}
