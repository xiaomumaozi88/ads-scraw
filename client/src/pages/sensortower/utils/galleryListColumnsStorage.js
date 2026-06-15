import {
  getAllConfigurableListColumnIds,
  getDefaultVisibleListColumns,
} from '../constants/galleryListColumns.js';

const STORAGE_KEY = 'st-gallery-list-columns';

export function loadVisibleListColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultVisibleListColumns();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultVisibleListColumns();
    const allowed = new Set(getAllConfigurableListColumnIds());
    const ids = parsed.filter((id) => allowed.has(id));
    return ids.length ? new Set(ids) : getDefaultVisibleListColumns();
  } catch {
    return getDefaultVisibleListColumns();
  }
}

export function saveVisibleListColumns(visibleSet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visibleSet]));
  } catch {
    /* ignore */
  }
}
