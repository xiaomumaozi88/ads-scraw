import { searchData } from '../../../utils/api.js';
import { CREATIVES_PAGE_SIZE } from '../constants/galleryConstants.js';

const METADATA_ENTITIES = {
  unified_app_id: [{ field: 'name' }, { field: 'icon_url' }],
  creative_id: [
    { field: 'ad_type' },
    { field: 'thumbnail_media_url' },
    { field: 'width' },
    { field: 'height' },
  ],
};

function extractFacetRows(res) {
  return res?.data?.response?.data ?? [];
}

function extractFacetMeta(res) {
  return res?.data?.response?.meta ?? {};
}

function extractFacetEntities(res) {
  return res?.data?.response?.entities ?? {};
}

function creativeRowKey(row) {
  return `${row.unified_app_id}|${row.grouped_creative_id}|${row.network}`;
}

function buildGroupedCreativesFilter(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((row) => ({
    unified_app_id: row.unified_app_id,
    grouped_creative_id: row.grouped_creative_id,
    network: row.network,
  }));
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

/**
 * 第二步：按 grouped_creatives 批量拉取创意 metadata（含 ad_type / 缩略图）
 * @param {object} filters
 * @param {Array<{ unified_app_id: string, grouped_creative_id: string, network: string }>} groupedCreatives
 */
export async function fetchGalleryCreativesMetadata(filters, groupedCreatives) {
  if (!groupedCreatives?.length) {
    return { success: true, data: { response: { data: [], entities: {} } } };
  }
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_creatives_metadata',
    payload: {
      breakdowns: [['unified_app_id', 'grouped_creative_id', 'network']],
      facets: [
        { facet: 'unified_app_id' },
        { facet: 'creative_ids', limit: 10 },
        { facet: 'grouped_creative_first_seen_at' },
        { facet: 'grouped_creative_id' },
        { facet: 'network' },
      ],
      filters: {
        ...filters,
        grouped_creatives: groupedCreatives,
      },
      entities: METADATA_ENTITIES,
    },
  });
}

/** 将 metadata 响应合并进 creatives 列表行 */
export function mergeCreativesWithMetadata(creativesRows, metadataRes) {
  if (!metadataRes?.success || !creativesRows?.length) return creativesRows ?? [];

  const metadataRows = extractFacetRows(metadataRes);
  const entities = extractFacetEntities(metadataRes)?.creative_id ?? {};
  const metadataByKey = new Map(metadataRows.map((row) => [creativeRowKey(row), row]));

  return creativesRows.map((creative) => {
    const meta = metadataByKey.get(creativeRowKey(creative));
    if (!meta) return creative;

    const creativeIds = meta.creative_ids ?? creative.creative_ids ?? [];
    const entityList = creativeIds
      .map((id) => ({ id, ...(entities[id] ?? {}) }))
      .filter((e) => e.ad_type);
    const primaryEntity = entityList[0];
    const adTypes = [...new Set(entityList.map((e) => e.ad_type))];

    return {
      ...creative,
      creative_ids: creativeIds,
      grouped_creative_first_seen_at:
        meta.grouped_creative_first_seen_at ?? creative.grouped_creative_first_seen_at,
      grouped_creative_ad_formats: adTypes.length
        ? adTypes
        : creative.grouped_creative_ad_formats,
      primary_ad_type: primaryEntity?.ad_type,
      thumbnail_media_url: primaryEntity?.thumbnail_media_url,
      creative_width: primaryEntity?.width,
      creative_height: primaryEntity?.height,
    };
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

  const creativesRows = extractFacetRows(creativesRes);
  const groupedCreatives = buildGroupedCreativesFilter(creativesRows);
  let metadataRes = null;
  let enrichedRows = creativesRows;

  if (groupedCreatives.length) {
    metadataRes = await fetchGalleryCreativesMetadata(filters, groupedCreatives);
    if (metadataRes.success) {
      enrichedRows = mergeCreativesWithMetadata(creativesRows, metadataRes);
    }
  }

  return {
    ok: true,
    kpisRows: extractFacetRows(kpisRes),
    creativesRows: enrichedRows,
    totalCount: extractFacetMeta(creativesRes).total_count ?? null,
    kpisRes,
    creativesRes,
    metadataRes,
  };
}

const DIALOG_ENTITIES = {
  unified_app_id: [
    { field: 'name' },
    { field: 'icon_url' },
    { field: 'publisher_id' },
    { field: 'publisher_name' },
  ],
  creative_id: [
    { field: 'ad_type' },
    { field: 'preview_media_url' },
    { field: 'thumbnail_media_url' },
    { field: 'creative_media_url' },
    { field: 'html_media_url' },
    { field: 'width' },
    { field: 'height' },
    { field: 'video_duration' },
    { field: 'caption' },
    { field: 'cta' },
    { field: 'landing_page_url' },
  ],
};

function buildSingleGroupedCreativeFilter(creative) {
  if (!creative?.grouped_creative_id) return [];
  return [
    {
      unified_app_id: creative.unified_app_id,
      grouped_creative_id: creative.grouped_creative_id,
      network: creative.network,
    },
  ];
}

function dialogPayloadBase(filters, groupedCreatives) {
  return {
    breakdowns: [['unified_app_id', 'grouped_creative_id', 'network']],
    filters: {
      ...filters,
      grouped_creatives: groupedCreatives,
    },
  };
}

/** 弹窗：创意详情（含多 variant 媒体链接） */
export async function fetchCreativeGalleryDialog(filters, creative) {
  const groupedCreatives = buildSingleGroupedCreativeFilter(creative);
  if (!groupedCreatives.length) {
    return { success: false, code: 'INVALID_ARGUMENT', message: '缺少创意信息' };
  }
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_dialog',
    payload: {
      ...dialogPayloadBase(filters, groupedCreatives),
      facets: [
        { facet: 'unified_app_id' },
        { facet: 'network' },
        { facet: 'creative_ids' },
        { facet: 'grouped_creative_ad_formats' },
        { facet: 'grouped_creative_duration' },
        { facet: 'grouped_creative_first_seen_at' },
        { facet: 'grouped_creative_id' },
        { facet: 'grouped_creative_last_seen_at' },
        { facet: 'grouped_creative_placements' },
        { facet: 'grouped_creative_regions' },
      ],
      entities: DIALOG_ENTITIES,
    },
  });
}

/** 弹窗：展示份额 */
export async function fetchCreativeGalleryDialogShare(filters, creative) {
  const groupedCreatives = buildSingleGroupedCreativeFilter(creative);
  if (!groupedCreatives.length) {
    return { success: true, data: { response: { data: [] } } };
  }
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_dialog_share',
    payload: {
      ...dialogPayloadBase(filters, groupedCreatives),
      facets: [
        { facet: 'unified_app_id' },
        { facet: 'grouped_creative_id' },
        { facet: 'grouped_creative_share' },
        { facet: 'network' },
      ],
    },
  });
}

/** 弹窗：曝光份额时序 */
export async function fetchCreativeGalleryTimeSeries(filters, creative) {
  const groupedCreatives = buildSingleGroupedCreativeFilter(creative);
  if (!groupedCreatives.length) {
    return { success: true, data: { response: { data: [] } } };
  }
  return searchData('sensortower', {
    queryIdentifier: 'creative_gallery_time_series',
    payload: {
      breakdowns: [['unified_app_id', 'grouped_creative_id', 'network', 'date']],
      facets: [
        { facet: 'unified_app_id' },
        { facet: 'network' },
        { facet: 'grouped_creative_id' },
        { facet: 'grouped_creative_share' },
        { facet: 'date', granularity: 'week' },
      ],
      filters: {
        ...filters,
        grouped_creatives: groupedCreatives,
      },
    },
  });
}

/** 解析弹窗 API 响应为详情 + 多素材 variant */
export function parseCreativeDialogBundle({ dialogRes, shareRes, timeSeriesRes }, fallbackCreative) {
  const dataRow = extractFacetRows(dialogRes)[0] ?? {};
  const entities = extractFacetEntities(dialogRes);
  const creativeEntities = entities.creative_id ?? {};
  const appEntity = entities.unified_app_id?.[dataRow.unified_app_id] ?? {};

  const creativeIds = dataRow.creative_ids ?? fallbackCreative?.creative_ids ?? [];
  const variants = creativeIds.map((id, index) => {
    const entity = creativeEntities[id] ?? {};
    const isVideo = entity.ad_type === 'video';
    const mediaUrl = entity.creative_media_url || entity.preview_media_url || null;
    return {
      id,
      index,
      adType: entity.ad_type,
      thumbUrl: entity.thumbnail_media_url,
      previewUrl: entity.preview_media_url,
      mediaUrl,
      videoUrl: isVideo ? mediaUrl : null,
      imageUrl: !isVideo ? mediaUrl : null,
      width: entity.width,
      height: entity.height,
      duration: entity.video_duration,
      caption: entity.caption,
      cta: entity.cta,
      landingPageUrl: entity.landing_page_url,
    };
  });

  const shareRow = extractFacetRows(shareRes)[0];
  const timeSeriesRows = extractFacetRows(timeSeriesRes);
  const shareTimeSeries = timeSeriesRows
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((row) => ({
      date: row.date,
      share: Number(row.grouped_creative_share),
    }))
    .filter((row) => Number.isFinite(row.share));
  const shareSeries = shareTimeSeries.map((row) => row.share);

  const detail = {
    ...fallbackCreative,
    ...dataRow,
    grouped_creative_share:
      shareRow?.grouped_creative_share ?? fallbackCreative?.grouped_creative_share,
    primary_ad_type: variants[0]?.adType ?? fallbackCreative?.primary_ad_type,
    grouped_creative_ad_formats:
      dataRow.grouped_creative_ad_formats ?? fallbackCreative?.grouped_creative_ad_formats,
    publisher_name: appEntity.publisher_name,
    app_name: appEntity.name,
    app_icon_url: appEntity.icon_url,
  };

  return { detail, variants, shareSeries, shareTimeSeries };
}

/** 并行拉取弹窗所需的全部数据 */
export async function fetchCreativeDialogBundle(filters, creative) {
  const [dialogRes, shareRes, timeSeriesRes] = await Promise.all([
    fetchCreativeGalleryDialog(filters, creative),
    fetchCreativeGalleryDialogShare(filters, creative),
    fetchCreativeGalleryTimeSeries(filters, creative),
  ]);

  if (!dialogRes.success) {
    return {
      ok: false,
      code: dialogRes.code,
      message: dialogRes.message || '创意详情加载失败',
      dialogRes,
      shareRes,
      timeSeriesRes,
    };
  }

  const parsed = parseCreativeDialogBundle({ dialogRes, shareRes, timeSeriesRes }, creative);
  return {
    ok: true,
    ...parsed,
    dialogRes,
    shareRes,
    timeSeriesRes,
  };
}
