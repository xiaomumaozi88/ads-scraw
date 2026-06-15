import { searchData } from '../../../utils/api.js';
import { CREATIVES_PAGE_SIZE } from '../constants/galleryConstants.js';

function extractFacetRows(res) {
  return res?.data?.response?.data ?? [];
}

function extractFacetMeta(res) {
  return res?.data?.response?.meta ?? {};
}

/**
 * @param {object} filters buildGalleryFilters 返回值
 */
export async function fetchGalleryKpis(filters) {
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_kpis',
    payload: {
      breakdowns: [['unified_app_id']],
      facets: [
        { facet: 'unified_app_id' },
        { facet: 'grouped_creative_count', measure: 'absolute' },
      ],
      filters,
    },
  });
}

/**
 * @param {object} filters
 * @param {{ limit?: number, offset?: number }} [pagination]
 */
export async function fetchGalleryCreatives(filters, pagination = {}, sort = {}) {
  const limit = pagination.limit ?? CREATIVES_PAGE_SIZE;
  const offset = pagination.offset ?? 0;
  const field = sort.orderField || 'grouped_creative_share';
  const dir = sort.orderDir || 'desc';
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_creatives',
    payload: {
      breakdowns: [['unified_app_id', 'grouped_creative_id', 'network']],
      facets: [
        { facet: 'unified_app_id' },
        { facet: 'creative_ids' },
        { facet: 'grouped_creative_ad_formats' },
        { facet: 'grouped_creative_duration' },
        { facet: 'grouped_creative_first_seen_at' },
        { facet: 'grouped_creative_id' },
        { facet: 'grouped_creative_last_seen_at' },
        { facet: 'grouped_creative_placements' },
        { facet: 'grouped_creative_regions' },
        { facet: 'grouped_creative_share' },
        { facet: 'network' },
      ],
      filters,
      limit,
      offset,
      order_by: [{ [field]: dir }],
    },
  });
}

/** 筛选器各维度创意数量（creative_gallery_filter_counts） */
export async function fetchGalleryFilterCounts(filters) {
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_filter_counts',
    payload: {
      breakdowns: [
        ['filter_ad_type'],
        ['filter_aspect_ratio'],
        ['filter_banner_dimensions'],
        ['filter_placement'],
        ['filter_video_duration'],
        ['filter_ad_objective'],
      ],
      facets: [
        { facet: 'filter_ad_type' },
        { facet: 'filter_aspect_ratio' },
        { facet: 'filter_banner_dimensions' },
        { facet: 'filter_placement' },
        { facet: 'filter_video_duration' },
        { facet: 'filter_ad_objective' },
        { facet: 'grouped_creative_count', measure: 'absolute' },
      ],
      filters,
    },
  });
}

export async function fetchGalleryData(filters, pagination = {}, sort = {}) {
  const [kpisRes, creativesRes] = await Promise.all([
    fetchGalleryKpis(filters),
    fetchGalleryCreatives(filters, pagination, sort),
  ]);

  if (!kpisRes.success) {
    return {
      ok: false,
      code: kpisRes.code,
      message: kpisRes.message || 'KPI 请求失败',
      kpisRes,
      creativesRes,
    };
  }
  if (!creativesRes.success) {
    return {
      ok: false,
      code: creativesRes.code,
      message: creativesRes.message || 'Creatives 请求失败',
      kpisRes,
      creativesRes,
    };
  }

  return {
    ok: true,
    kpisRows: extractFacetRows(kpisRes),
    creativesRows: extractFacetRows(creativesRes),
    totalCount: extractFacetMeta(creativesRes).total_count ?? null,
    kpisRes,
    creativesRes,
  };
}
