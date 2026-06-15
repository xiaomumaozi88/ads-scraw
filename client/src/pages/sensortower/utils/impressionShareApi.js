import { searchData } from '../../../utils/api.js';

function extractFacetRows(res) {
  const inner = res?.data?.response;
  if (Array.isArray(inner?.data)) return inner.data;
  if (Array.isArray(inner)) return inner;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

function buildSearchPayload(apiRequest, kind) {
  const block = kind === 'chart' ? apiRequest.chart : apiRequest.table;
  return {
    queryIdentifier: block.queryIdentifier,
    payload: block.body,
  };
}

export async function fetchImpressionShareChart(apiRequest) {
  return searchData('sensortower', buildSearchPayload(apiRequest, 'chart'));
}

export async function fetchImpressionShareTable(apiRequest) {
  return searchData('sensortower', buildSearchPayload(apiRequest, 'table'));
}

/**
 * 并行请求 chart + table facets
 * @param {ReturnType<import('./buildImpressionShareRequest.js').buildImpressionShareRequest>} apiRequest
 */
export async function fetchImpressionShareData(apiRequest) {
  const [chartRes, tableRes] = await Promise.all([
    fetchImpressionShareChart(apiRequest),
    fetchImpressionShareTable(apiRequest),
  ]);

  if (!chartRes.success) {
    return {
      ok: false,
      code: chartRes.code,
      message: chartRes.message || '图表数据请求失败',
      chartRes,
      tableRes,
    };
  }
  if (!tableRes.success) {
    return {
      ok: false,
      code: tableRes.code,
      message: tableRes.message || '表格数据请求失败',
      chartRes,
      tableRes,
    };
  }

  return {
    ok: true,
    chartRows: extractFacetRows(chartRes),
    tableRows: extractFacetRows(tableRes),
    chartRes,
    tableRes,
  };
}

export { extractFacetRows };
