import galleryRegions from './galleryRegions.json';

/** Sensor Tower 创意库允许的国家/地区（来源：docs/sensorTower/获取国家地区.txt） */
export const GALLERY_REGIONS = galleryRegions;

export const GALLERY_REGION_CODES = galleryRegions.map((r) => r.code);

export function getRegionFlagUrl(code) {
  const c = String(code || '').toLowerCase();
  return `https://app.sensortower-china.com/assets/flags/${c}.png`;
}

/** flag-icon-css 类名（ST 外链国旗受 WAF 拦截，改用本地 CSS 图标） */
export function getRegionFlagIconClass(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(c)) return null;
  return `flag-icon-${c}`;
}

export function getRegionByCode(code) {
  return galleryRegions.find((r) => r.code === code) ?? null;
}

export function getAllGalleryRegionCodes() {
  return [...GALLERY_REGION_CODES];
}
