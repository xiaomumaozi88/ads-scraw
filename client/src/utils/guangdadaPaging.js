export const GUANGDADA_UPSTREAM_PAGE_SIZE = 60;
export const GUANGDADA_DISPLAY_PAGE_SIZE = 30;

export function normalizeGuangdadaDisplayPage(value) {
  const n = Math.floor(Number(value) || 1);
  return Math.max(1, n);
}

export function getGuangdadaUpstreamPage(displayPage) {
  const page = normalizeGuangdadaDisplayPage(displayPage);
  return Math.floor((page - 1) / 2) + 1;
}

export function getGuangdadaDisplayOffset(displayPage) {
  const page = normalizeGuangdadaDisplayPage(displayPage);
  return ((page - 1) % 2) * GUANGDADA_DISPLAY_PAGE_SIZE;
}

export function getGuangdadaDisplayPageFromParams(params = {}) {
  if (params.guangdadaDisplayPage != null) {
    return normalizeGuangdadaDisplayPage(params.guangdadaDisplayPage);
  }
  if (params.displayPage != null) {
    return normalizeGuangdadaDisplayPage(params.displayPage);
  }
  const upstreamPage = Math.max(1, Math.floor(Number(params.page) || 1));
  return (upstreamPage - 1) * 2 + 1;
}

export function withGuangdadaPaging(params = {}, displayPage) {
  const nextDisplayPage = displayPage != null
    ? normalizeGuangdadaDisplayPage(displayPage)
    : getGuangdadaDisplayPageFromParams(params);
  return {
    ...params,
    guangdadaDisplayPage: nextDisplayPage,
    page: getGuangdadaUpstreamPage(nextDisplayPage),
    pageSize: GUANGDADA_UPSTREAM_PAGE_SIZE,
    page_size: GUANGDADA_UPSTREAM_PAGE_SIZE,
  };
}
