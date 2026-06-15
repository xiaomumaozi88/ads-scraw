import { isValidSensorTowerPageId } from '../constants/sensorTowerPages.js';

const STORAGE_KEY = 'ads-scraw:sensortower-page';

export function readStoredSensorTowerPage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && isValidSensorTowerPageId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredSensorTowerPage(pageId) {
  try {
    if (isValidSensorTowerPageId(pageId)) {
      localStorage.setItem(STORAGE_KEY, pageId);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
