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
