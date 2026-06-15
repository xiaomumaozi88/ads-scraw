import { DEFAULT_IMPRESSION_SHARE_APPS } from '../constants/impressionShareConstants.js';
import { isValidUnifiedAppId } from './galleryAppSearch.js';

const STORAGE_KEY = 'st-impression-share-apps';

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
    selected: raw?.selected !== false,
    order: Number(raw?.order) || index + 1,
  };
}

export function loadImpressionShareAppsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_IMPRESSION_SHARE_APPS.map((a, i) => normalizeStoredApp(a, i)).filter(Boolean);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return DEFAULT_IMPRESSION_SHARE_APPS.map((a, i) => normalizeStoredApp(a, i)).filter(Boolean);
    }
    return parsed.map((item, i) => normalizeStoredApp(item, i)).filter(Boolean);
  } catch {
    return DEFAULT_IMPRESSION_SHARE_APPS.map((a, i) => normalizeStoredApp(a, i)).filter(Boolean);
  }
}

export function saveImpressionShareAppsToStorage(apps) {
  try {
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
        selected: a.selected !== false,
        order: i + 1,
      }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
    selected: true,
  };
}
