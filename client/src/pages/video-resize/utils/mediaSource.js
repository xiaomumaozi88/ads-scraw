const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv|flv)(\?|$)/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i;

/** @typedef {'video'|'image'} MediaKind */

/**
 * @param {File} file
 * @returns {MediaKind|null}
 */
export function detectMediaTypeFromFile(file) {
  if (!file) return null;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('image/')) return 'image';
  const name = String(file.name || '').toLowerCase();
  if (VIDEO_EXT.test(name)) return 'video';
  if (IMAGE_EXT.test(name)) return 'image';
  return null;
}

/**
 * @param {string} url
 * @returns {MediaKind|null}
 */
export function detectMediaTypeFromUrl(url) {
  if (!url) return null;
  const path = String(url).split('?')[0].split('#')[0].toLowerCase();
  if (VIDEO_EXT.test(path)) return 'video';
  if (IMAGE_EXT.test(path)) return 'image';
  return null;
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeHttpUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function sanitizeBaseName(name, fallback = 'material') {
  const base = String(name || fallback).replace(/\.[^.]+$/, '');
  return base.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || fallback;
}

export function displayNameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'remote';
  } catch {
    return 'remote';
  }
}

export function buildManualProcessPayload({
  url,
  isVideo,
  displayName,
  targetW,
  targetH,
  baseFilename,
}) {
  return {
    url,
    isVideo,
    isHtml: false,
    filename: displayName,
    targetW,
    targetH,
    baseFilename,
  };
}

export function buildManualTask({
  url,
  sourceUrl,
  isVideo,
  displayName,
  sourceLabel,
  sourceType,
  originalWidth,
  originalHeight,
  targetWidth,
  targetHeight,
  sizeLabel,
  baseFilename,
  localFile = null,
}) {
  return {
    filename: baseFilename,
    sizeLabel,
    sourceUrl: sourceUrl ?? (sourceType === 'remote' ? url : ''),
    sourceLabel,
    originalWidth,
    originalHeight,
    targetWidth,
    targetHeight,
    isVideo,
    isHtml: false,
    sourceType,
    localFile,
    processPayload: buildManualProcessPayload({
      url,
      isVideo,
      displayName,
      targetW: targetWidth,
      targetH: targetHeight,
      baseFilename,
    }),
  };
}
