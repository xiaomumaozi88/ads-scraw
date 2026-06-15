import { GALLERY_NETWORKS } from '../constants/galleryConstants.js';
import { getAllGalleryRegionCodes } from '../constants/galleryRegionCodes.js';
import { isValidUnifiedAppId } from './galleryAppSearch.js';

function toIsoDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 组装 creative_gallery_* facets 请求的 filters 对象
 */
export function buildGalleryFilters({
  startDate,
  endDate,
  selectedAppIds,
  selectedNetworks,
  allNetworks,
  selectedRegions,
  allRegions,
  selectedAdTypes,
  placements = [],
  videoDurations = [],
  aspectRatios = [],
  bannerDimensions = [],
  adObjectives = [],
  newCreativesOnly = false,
  creativesWithImpressionsOnly = false,
}) {
  const unified_app_ids = (selectedAppIds || []).filter((id) => isValidUnifiedAppId(id));
  const networks = allNetworks ? [...GALLERY_NETWORKS] : (selectedNetworks || []).filter(Boolean);
  const picked = (selectedRegions || []).filter(Boolean);
  const regions = allRegions || picked.length === 0
    ? getAllGalleryRegionCodes()
    : picked;

  return {
    ad_types: (selectedAdTypes || []).filter(Boolean),
    end_date: toIsoDate(endDate),
    start_date: toIsoDate(startDate),
    networks,
    regions,
    unified_app_ids,
    placements,
    video_durations: videoDurations,
    aspect_ratios: aspectRatios,
    banner_dimensions: bannerDimensions,
    ad_objectives: adObjectives,
    new_creatives_only: !!newCreativesOnly,
    creatives_with_impressions_only: !!creativesWithImpressionsOnly,
  };
}

export function getDefaultDateRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { startDate: start, endDate: end };
}

export function toInputDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export { toIsoDate };
