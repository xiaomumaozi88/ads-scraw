import { GALLERY_VIEW_MODES } from '../constants/galleryConstants.js';

const VIEW_KEY = 'st-gallery-view-mode';

export function loadGalleryViewMode() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === GALLERY_VIEW_MODES.list ? GALLERY_VIEW_MODES.list : GALLERY_VIEW_MODES.grid;
  } catch {
    return GALLERY_VIEW_MODES.grid;
  }
}

export function saveGalleryViewMode(mode) {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    /* ignore */
  }
}
