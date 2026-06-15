import {
  formatDurationLabel,
  formatGalleryDate,
  formatSharePercent,
} from './formatGallery.js';

function joinFacetValues(value) {
  if (Array.isArray(value)) {
    const parts = value.filter((v) => v != null && String(v).trim() !== '');
    return parts.length ? parts.join(', ') : '—';
  }
  if (value == null || value === '') return '—';
  return String(value);
}

export function formatListCellValue(columnId, creative, app) {
  switch (columnId) {
    case 'app':
      return null;
    case 'network':
      return creative?.network || '—';
    case 'region':
      return joinFacetValues(creative?.grouped_creative_regions);
    case 'firstSeen':
      return formatGalleryDate(creative?.grouped_creative_first_seen_at);
    case 'lastSeen':
      return formatGalleryDate(creative?.grouped_creative_last_seen_at);
    case 'duration':
      return formatDurationLabel(creative);
    case 'share':
      return formatSharePercent(creative?.grouped_creative_share);
    case 'adType':
    case 'adFormat':
      return joinFacetValues(creative?.grouped_creative_ad_formats);
    case 'placement':
      return joinFacetValues(creative?.grouped_creative_placements);
    case 'videoDuration':
      return formatDurationLabel(creative);
    case 'mediaSize':
      return '—';
    case 'adPublisher':
      return app?.publisher || '—';
    default:
      return '—';
  }
}
