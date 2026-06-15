import galleryRegions from './galleryRegions.json';

/** Sensor Tower 创意库允许的国家/地区（来源：docs/sensorTower/获取国家地区.txt） */
export const GALLERY_REGIONS = galleryRegions;

export const GALLERY_REGION_CODES = galleryRegions.map((r) => r.code);

export function getRegionFlagUrl(code) {
  const c = String(code || '').toLowerCase();
  return `https://app.sensortower-china.com/assets/flags/${c}.png`;
}

export function getRegionByCode(code) {
  return galleryRegions.find((r) => r.code === code) ?? null;
}

export function getAllGalleryRegionCodes() {
  return [...GALLERY_REGION_CODES];
}
