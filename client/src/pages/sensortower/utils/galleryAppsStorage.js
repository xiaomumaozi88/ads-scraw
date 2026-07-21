import { isValidUnifiedAppId, formatMetric, normalizeStoreVersions } from './galleryAppSearch.js';

const STORAGE_KEY = 'st-gallery-selected-apps';

function normalizeStoredApp(raw, index) {
  const unifiedAppId = String(raw?.unifiedAppId || '').trim();
  if (!isValidUnifiedAppId(unifiedAppId)) return null;
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

export function loadGalleryAppsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, i) => normalizeStoredApp(item, i))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function saveGalleryAppsToStorage(apps) {
  try {
    const payload = (apps || [])
      .filter((a) => isValidUnifiedAppId(a?.unifiedAppId))
      .map((a, i) => ({
        unifiedAppId: a.unifiedAppId,
        name: a.name,
        publisher: a.publisher,
        iconUrl: a.iconUrl || '',
        accent: a.accent,
        iosCount: a.iosCount ?? 0,
        androidCount: a.androidCount ?? 0,
        iosApps: a.iosApps ?? [],
        androidApps: a.androidApps ?? [],
        downloads: a.downloads || '',
        revenue: a.revenue || '',
        selected: a.selected !== false,
        order: a.order ?? i + 1,
      }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}
