import {
  formatMetric,
  isValidUnifiedAppId,
  normalizeStoreVersions,
} from './galleryAppSearch.js';

const STORAGE_KEY = 'st-impression-share-apps';
let transientImpressionShareApps = [];

function normalizeStoredApp(raw, index) {
  const unifiedAppId = String(raw?.unifiedAppId || '').trim();
  if (!unifiedAppId) return null;
  return {
    unifiedAppId,
    name: String(raw?.name || '').trim() || `App ${unifiedAppId.slice(0, 8)}`,
    publisher: String(raw?.publisher || '').trim() || '—',
    iconUrl: String(raw?.iconUrl || '').trim(),
    accent: raw?.accent || '#5c6bc0',
    iosCount: Number(raw?.iosCount) || 0,
    androidCount: Number(raw?.androidCount) || 0,
    iosApps: normalizeStoreVersions(raw?.iosApps ?? raw?.ios_apps, 'ios'),
    androidApps: normalizeStoreVersions(raw?.androidApps ?? raw?.android_apps, 'android'),
    downloads: formatMetric(raw?.downloads) || String(raw?.downloads || '').trim(),
    revenue: formatMetric(raw?.revenue) || String(raw?.revenue || '').trim(),
    selected: raw?.selected !== false,
    order: Number(raw?.order) || index + 1,
  };
}

export function loadImpressionShareAppsFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return transientImpressionShareApps
    .map((item, i) => normalizeStoredApp(item, i))
    .filter(Boolean);
}

export function saveImpressionShareAppsToStorage(apps) {
  const payload = (apps || [])
    .filter((a) => a?.unifiedAppId)
    .map((a, i) => ({
      unifiedAppId: a.unifiedAppId,
      name: a.name,
      publisher: a.publisher,
      iconUrl: a.iconUrl,
      accent: a.accent,
      iosCount: a.iosCount ?? 0,
      androidCount: a.androidCount ?? 0,
      iosApps: a.iosApps ?? [],
      androidApps: a.androidApps ?? [],
      downloads: a.downloads || '',
      revenue: a.revenue || '',
      selected: a.selected !== false,
      order: i + 1,
    }));
  transientImpressionShareApps = payload;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function normalizeImpressionShareAppFromSearch(app) {
  const unifiedAppId = String(app?.unifiedAppId || '').trim();
  if (!isValidUnifiedAppId(unifiedAppId)) return null;
  return {
    unifiedAppId,
    name: String(app?.name || '').trim() || unifiedAppId,
    publisher: String(app?.publisher || '').trim() || '—',
    iconUrl: String(app?.iconUrl || '').trim(),
    accent: '#5c6bc0',
    iosCount: Number(app?.iosCount) || 0,
    androidCount: Number(app?.androidCount) || 0,
    iosApps: normalizeStoreVersions(app?.iosApps ?? app?.ios_apps, 'ios'),
    androidApps: normalizeStoreVersions(app?.androidApps ?? app?.android_apps, 'android'),
    downloads: formatMetric(app?.downloads) || String(app?.downloads || '').trim(),
    revenue: formatMetric(app?.revenue) || String(app?.revenue || '').trim(),
    selected: true,
  };
}
