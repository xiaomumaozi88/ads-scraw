/** Sensor Tower 内复刻的官方页面 */
export const SENSOR_TOWER_PAGE_IDS = {
  CREATIVE_GALLERY: 'creative-gallery',
  IMPRESSION_SHARE: 'impression-share',
};

export const SENSOR_TOWER_PAGES = [
  {
    id: SENSOR_TOWER_PAGE_IDS.CREATIVE_GALLERY,
    label: '广告素材库',
    officialPath: '/app-analysis/creative-gallery',
  },
  {
    id: SENSOR_TOWER_PAGE_IDS.IMPRESSION_SHARE,
    label: '曝光份额',
    officialPath: '/app-analysis/impression-share',
  },
];

const PAGE_BY_ID = new Map(SENSOR_TOWER_PAGES.map((p) => [p.id, p]));

export const SENSOR_TOWER_DEFAULT_PAGE_ID = SENSOR_TOWER_PAGE_IDS.CREATIVE_GALLERY;

export function isValidSensorTowerPageId(id) {
  return PAGE_BY_ID.has(id);
}

export function getSensorTowerPageById(id) {
  return PAGE_BY_ID.get(id) ?? PAGE_BY_ID.get(SENSOR_TOWER_DEFAULT_PAGE_ID);
}
