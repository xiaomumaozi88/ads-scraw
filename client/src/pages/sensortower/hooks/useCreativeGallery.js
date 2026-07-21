import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DATE_PRESETS,
  GALLERY_AD_TYPES,
  GALLERY_AD_OBJECTIVES,
  GALLERY_ASPECT_RATIOS,
  GALLERY_BANNER_DIMENSIONS,
  GALLERY_DEFAULT_PAGE_SIZE,
  GALLERY_NETWORKS,
  GALLERY_PLACEMENTS,
  GALLERY_SORT_OPTIONS,
  GALLERY_VIDEO_DURATIONS,
  GALLERY_VIEW_MODES,
  getAllGalleryRegionCodes,
  getGalleryAdTypeOptionGroups,
} from '../constants/galleryConstants.js';
import { loadGalleryViewMode, saveGalleryViewMode } from '../utils/galleryViewStorage.js';
import {
  isValidUnifiedAppId,
  fetchUnifiedAppDetail,
  mergeAppSearchWithDetails,
  toggleStoreVersionSelection,
} from '../utils/galleryAppSearch.js';
import { loadGalleryAppsFromStorage, saveGalleryAppsToStorage } from '../utils/galleryAppsStorage.js';
import { buildGalleryFilters, getDefaultDateRange } from '../utils/buildGalleryFilters.js';
import { resolveDatePresetRange } from '../utils/galleryDatePresets.js';
import { fetchGalleryData, fetchGalleryFilterCounts } from '../utils/galleryApi.js';
import { buildFilterFacetCountMaps, buildKpiCountMap, dedupeCreativeGalleryRows, getCreativeGalleryRowKey } from '../utils/formatGallery.js';

const defaultRange = getDefaultDateRange(30);
const AUTO_FETCH_MS = 400;

export function useCreativeGallery({ isLoggedIn, onRequireLogin, addLog }) {
  const [platformId, setPlatformId] = useState('android');
  const [datePresetId, setDatePresetId] = useState('last30');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [allRegions, setAllRegions] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [allNetworks, setAllNetworks] = useState(true);
  const [selectedNetworks, setSelectedNetworks] = useState([]);
  const [allPlacements, setAllPlacements] = useState(true);
  const [selectedPlacements, setSelectedPlacements] = useState([]);
  const [allAdObjectives, setAllAdObjectives] = useState(true);
  const [selectedAdObjectives, setSelectedAdObjectives] = useState([]);
  const [allVideoDurations, setAllVideoDurations] = useState(true);
  const [selectedVideoDurations, setSelectedVideoDurations] = useState([]);
  const [allAspectRatios, setAllAspectRatios] = useState(true);
  const [selectedAspectRatios, setSelectedAspectRatios] = useState([]);
  const [allBannerDimensions, setAllBannerDimensions] = useState(true);
  const [selectedBannerDimensions, setSelectedBannerDimensions] = useState([]);
  const [selectedAdTypes, setSelectedAdTypes] = useState([]);
  const [apps, setApps] = useState(() => loadGalleryAppsFromStorage());

  useEffect(() => {
    const validValues = new Set(
      getGalleryAdTypeOptionGroups(platformId).flatMap((g) =>
        (g.options || []).map((o) => o.value)
      )
    );
    setSelectedAdTypes((prev) => {
      const next = prev.filter((value) => validValues.has(value));
      return next.length === prev.length ? prev : next;
    });
  }, [platformId]);
  const [appsPickerCollapsed, setAppsPickerCollapsed] = useState(
    () => loadGalleryAppsFromStorage().length > 0
  );
  const [addAppModalOpen, setAddAppModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('report');
  const [keywordItems, setKeywordItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [kpisRows, setKpisRows] = useState([]);
  const [creativesRows, setCreativesRows] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [placementCountMap, setPlacementCountMap] = useState(() => new Map());
  const [adTypeCountMap, setAdTypeCountMap] = useState(() => new Map());
  const [adObjectiveCountMap, setAdObjectiveCountMap] = useState(() => new Map());
  const [aspectRatioCountMap, setAspectRatioCountMap] = useState(() => new Map());
  const [videoDurationCountMap, setVideoDurationCountMap] = useState(() => new Map());
  const [bannerDimensionCountMap, setBannerDimensionCountMap] = useState(() => new Map());
  const [viewMode, setViewMode] = useState(() => loadGalleryViewMode());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(GALLERY_DEFAULT_PAGE_SIZE);
  const [sortById, setSortById] = useState('share');
  const [newCreativesOnly, setNewCreativesOnly] = useState(false);
  const [creativesWithImpressionsOnly, setCreativesWithImpressionsOnly] = useState(false);

  const fetchGalleryRef = useRef(null);
  const skipNextAutoFetchRef = useRef(false);

  const selectedAppIds = useMemo(
    () => apps.filter((a) => a.selected).map((a) => a.unifiedAppId),
    [apps]
  );

  const filters = useMemo(
    () =>
      buildGalleryFilters({
        startDate,
        endDate,
        selectedAppIds,
        selectedNetworks,
        allNetworks,
        selectedRegions: allRegions ? [] : selectedRegions,
        allRegions,
        selectedAdTypes,
        placements: allPlacements ? [] : selectedPlacements,
        adObjectives: allAdObjectives ? [] : selectedAdObjectives,
        videoDurations: allVideoDurations ? [] : selectedVideoDurations,
        aspectRatios: allAspectRatios ? [] : selectedAspectRatios,
        bannerDimensions: allBannerDimensions ? [] : selectedBannerDimensions,
        newCreativesOnly,
        creativesWithImpressionsOnly,
      }),
    [
      startDate,
      endDate,
      selectedAppIds,
      selectedNetworks,
      allNetworks,
      selectedRegions,
      allRegions,
      selectedAdTypes,
      selectedPlacements,
      allPlacements,
      allAdObjectives,
      selectedAdObjectives,
      allVideoDurations,
      selectedVideoDurations,
      allAspectRatios,
      selectedAspectRatios,
      allBannerDimensions,
      selectedBannerDimensions,
      newCreativesOnly,
      creativesWithImpressionsOnly,
    ]
  );

  const sortOption = useMemo(
    () => GALLERY_SORT_OPTIONS.find((s) => s.id === sortById) || GALLERY_SORT_OPTIONS[0],
    [sortById]
  );

  const filtersForCounts = useMemo(
    () =>
      buildGalleryFilters({
        startDate,
        endDate,
        selectedAppIds,
        selectedNetworks,
        allNetworks,
        selectedRegions: allRegions ? [] : selectedRegions,
        allRegions,
        selectedAdTypes: [],
        placements: [],
      }),
    [
      startDate,
      endDate,
      selectedAppIds,
      selectedNetworks,
      allNetworks,
      selectedRegions,
      allRegions,
    ]
  );

  const kpiCountMap = useMemo(() => buildKpiCountMap(kpisRows), [kpisRows]);

  const totalPages = useMemo(() => {
    const total = totalCount ?? 0;
    return Math.max(1, Math.ceil(total / pageSize) || 1);
  }, [totalCount, pageSize]);

  const hasMore = useMemo(() => {
    if (viewMode === GALLERY_VIEW_MODES.list) return false;
    if (totalCount == null) return false;
    return creativesRows.length < totalCount;
  }, [viewMode, creativesRows.length, totalCount]);

  const appSummaries = useMemo(
    () =>
      apps
        .filter((a) => a.selected)
        .map((a) => ({
          ...a,
          creativeCount: kpiCountMap.get(a.unifiedAppId) ?? 0,
        })),
    [apps, kpiCountMap]
  );

  useEffect(() => {
    saveGalleryAppsToStorage(apps);
  }, [apps]);

  const fetchGallery = useCallback(async ({ append = false, targetPage } = {}) => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    if (!selectedAppIds.length) {
      setError('请至少添加并选择一个应用');
      setKpisRows([]);
      setCreativesRows([]);
      setTotalCount(null);
      return;
    }
    const isListView = viewMode === GALLERY_VIEW_MODES.list;
    if (append && isListView) return;

    if (append) {
      if (loading || loadingMore || !hasMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');
    const requestPage = append ? page + 1 : (isListView ? (targetPage ?? page) : 1);
    if (!append) {
      addLog?.('正在加载创意库数据…', 'info');
    }
    try {
      const result = await fetchGalleryData(
        filters,
        { limit: pageSize, offset: (requestPage - 1) * pageSize },
        { orderField: sortOption.orderField, orderDir: sortOption.orderDir }
      );
      if (!result.ok) {
        const msg = result.message || '加载失败';
        setError(msg);
        addLog?.(msg, 'error');
        if (result.code === 'NOT_LOGGED_IN' || result.code === 'SESSION_EXPIRED') {
          onRequireLogin?.();
        }
        return;
      }
      if (append) {
        setCreativesRows((prev) => {
          const seen = new Set(prev.map(getCreativeGalleryRowKey));
          const nextRows = result.creativesRows.filter(
            (row) => !seen.has(getCreativeGalleryRowKey(row))
          );
          return nextRows.length ? [...prev, ...nextRows] : prev;
        });
        setPage(requestPage);
      } else {
        setKpisRows(result.kpisRows);
        setCreativesRows(dedupeCreativeGalleryRows(result.creativesRows));
        setTotalCount(result.totalCount);
        setPage(requestPage);
        addLog?.(
          `创意库加载成功：${result.creativesRows.length} 条创意${result.totalCount != null ? ` / 共 ${result.totalCount}` : ''}`,
          'success'
        );
      }
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
      addLog?.(msg, 'error');
      if (e?.requiresLogin) onRequireLogin?.();
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [
    isLoggedIn,
    selectedAppIds,
    filters,
    page,
    pageSize,
    sortOption,
    viewMode,
    onRequireLogin,
    addLog,
    loading,
    loadingMore,
    hasMore,
  ]);

  fetchGalleryRef.current = fetchGallery;

  const fetchFilterCounts = useCallback(async () => {
    if (!isLoggedIn || !selectedAppIds.length) {
      setPlacementCountMap(new Map());
      setAdTypeCountMap(new Map());
      setAdObjectiveCountMap(new Map());
      setAspectRatioCountMap(new Map());
      setVideoDurationCountMap(new Map());
      setBannerDimensionCountMap(new Map());
      return;
    }
    try {
      const res = await fetchGalleryFilterCounts(filtersForCounts);
      if (!res.success) return;
      const rows = res?.data?.response?.data ?? [];
      const {
        placements,
        adTypes,
        adObjectives,
        aspectRatios,
        videoDurations,
        bannerDimensions,
      } = buildFilterFacetCountMaps(rows);
      setPlacementCountMap(placements);
      setAdTypeCountMap(adTypes);
      setAdObjectiveCountMap(adObjectives);
      setAspectRatioCountMap(aspectRatios);
      setVideoDurationCountMap(videoDurations);
      setBannerDimensionCountMap(bannerDimensions);
    } catch {
      /* 计数失败不阻断主流程 */
    }
  }, [isLoggedIn, selectedAppIds, filtersForCounts]);

  useEffect(() => {
    if (!isLoggedIn || !selectedAppIds.length) return undefined;
    const timer = setTimeout(() => fetchFilterCounts(), AUTO_FETCH_MS);
    return () => clearTimeout(timer);
  }, [isLoggedIn, selectedAppIds, filtersForCounts, fetchFilterCounts]);

  useEffect(() => {
    setPage(1);
    setCreativesRows([]);
    setTotalCount(null);
  }, [filters, sortById, pageSize]);

  const loadMore = useCallback(() => {
    if (viewMode !== GALLERY_VIEW_MODES.grid) return;
    fetchGalleryRef.current?.({ append: true });
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== GALLERY_VIEW_MODES.list) return;
    if (page > totalPages) setPage(totalPages);
  }, [viewMode, page, totalPages]);

  useEffect(() => {
    if (!isLoggedIn || !selectedAppIds.length) return undefined;
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchGalleryRef.current?.({ append: false });
    }, AUTO_FETCH_MS);
    return () => clearTimeout(timer);
  }, [
    isLoggedIn,
    selectedAppIds,
    filters,
    pageSize,
    sortById,
    viewMode,
    ...(viewMode === GALLERY_VIEW_MODES.list ? [page] : []),
  ]);

  const handleViewModeChange = useCallback((mode) => {
    const next = mode === GALLERY_VIEW_MODES.list ? GALLERY_VIEW_MODES.list : GALLERY_VIEW_MODES.grid;
    setViewMode(next);
    setPage(1);
    setCreativesRows([]);
    saveGalleryViewMode(next);
  }, []);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const selectAllRegions = useCallback(() => {
    setAllRegions(true);
    setSelectedRegions([]);
  }, []);

  const handleAllNetworksChange = useCallback((checked) => {
    setAllNetworks(checked);
    if (checked) setSelectedNetworks([]);
  }, []);

  const applyDatePreset = useCallback((presetId) => {
    setDatePresetId(presetId);
    if (presetId === 'custom') return;
    if (!DATE_PRESETS.some((p) => p.id === presetId)) return;
    const range = resolveDatePresetRange(presetId);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, []);

  const handleAllRegionsChange = useCallback(
    (checked) => {
      if (checked) {
        selectAllRegions();
      } else {
        setAllRegions(false);
        setSelectedRegions([]);
      }
    },
    [selectAllRegions]
  );

  const handleAllPlacementsChange = useCallback((checked) => {
    setAllPlacements(checked);
    if (checked) setSelectedPlacements([]);
  }, []);

  const handleAllAdObjectivesChange = useCallback((checked) => {
    setAllAdObjectives(checked);
    if (checked) setSelectedAdObjectives([]);
  }, []);

  const handleAllVideoDurationsChange = useCallback((checked) => {
    setAllVideoDurations(checked);
    if (checked) setSelectedVideoDurations([]);
  }, []);

  const handleAllAspectRatiosChange = useCallback((checked) => {
    setAllAspectRatios(checked);
    if (checked) setSelectedAspectRatios([]);
  }, []);

  const handleAllBannerDimensionsChange = useCallback((checked) => {
    setAllBannerDimensions(checked);
    if (checked) setSelectedBannerDimensions([]);
  }, []);

  const resetFilters = useCallback(() => {
    skipNextAutoFetchRef.current = true;
    const range = getDefaultDateRange(30);
    setDatePresetId('last30');
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    selectAllRegions();
    setAllNetworks(true);
    setSelectedNetworks([]);
    setAllPlacements(true);
    setSelectedPlacements([]);
    setSelectedAdTypes([]);
    setAllAdObjectives(true);
    setSelectedAdObjectives([]);
    setAllVideoDurations(true);
    setSelectedVideoDurations([]);
    setAllAspectRatios(true);
    setSelectedAspectRatios([]);
    setAllBannerDimensions(true);
    setSelectedBannerDimensions([]);
    setPlatformId('android');
    setSortById('share');
    setNewCreativesOnly(false);
    setCreativesWithImpressionsOnly(false);
    setTimeout(() => fetchGalleryRef.current?.({ append: false }), 0);
  }, [selectAllRegions]);

  const toggleAppSelected = useCallback((unifiedAppId) => {
    setApps((prev) =>
      prev.map((a) =>
        a.unifiedAppId === unifiedAppId ? { ...a, selected: !a.selected } : a
      )
    );
  }, []);

  const collapseAppsPicker = useCallback(() => setAppsPickerCollapsed(true), []);
  const expandAppsPicker = useCallback(() => setAppsPickerCollapsed(false), []);

  const toggleStoreVersion = useCallback((unifiedAppId, versionId, os) => {
    setApps((prev) =>
      prev.map((a) =>
        a.unifiedAppId === unifiedAppId
          ? toggleStoreVersionSelection(a, versionId, os)
          : a
      )
    );
  }, []);

  const addAppFromSearch = useCallback((app) => {
    const id = String(app?.unifiedAppId || '').trim();
    if (!isValidUnifiedAppId(id)) return false;
    setApps((prev) => {
      if (prev.some((a) => a.unifiedAppId === id)) {
        return prev.map((a) =>
          a.unifiedAppId === id
            ? {
                ...a,
                selected: true,
                name: app.name || a.name,
                iconUrl: app.iconUrl || a.iconUrl,
                publisher: app.publisher || a.publisher,
                iosCount: app.iosCount ?? a.iosCount,
                androidCount: app.androidCount ?? a.androidCount,
                iosApps: app.iosApps?.length ? app.iosApps : a.iosApps,
                androidApps: app.androidApps?.length ? app.androidApps : a.androidApps,
                downloads: app.downloads ?? a.downloads,
                revenue: app.revenue ?? a.revenue,
              }
            : a
        );
      }
      return [
        ...prev,
        {
          unifiedAppId: id,
          name: app.name || `App ${id.slice(0, 8)}`,
          publisher: app.publisher || '—',
          iconUrl: app.iconUrl || '',
          accent: '#5c6bc0',
          iosCount: app.iosCount ?? 0,
          androidCount: app.androidCount ?? 0,
          iosApps: app.iosApps ?? [],
          androidApps: app.androidApps ?? [],
          downloads: app.downloads || '',
          revenue: app.revenue || '',
          selected: true,
          order: prev.length + 1,
        },
      ];
    });
    return true;
  }, []);

  const enrichAppDetails = useCallback(async (unifiedAppId) => {
    const detail = await fetchUnifiedAppDetail(unifiedAppId);
    if (!detail) return null;

    let merged = null;
    setApps((prev) => {
      const app = prev.find((a) => a.unifiedAppId === unifiedAppId);
      if (!app) return prev;
      if ((app.iosApps?.length || 0) + (app.androidApps?.length || 0) > 0) {
        merged = app;
        return prev;
      }
      merged = mergeAppSearchWithDetails(app, detail);
      const next = prev.map((a) =>
        a.unifiedAppId === unifiedAppId ? { ...a, ...merged } : a
      );
      saveGalleryAppsToStorage(next);
      return next;
    });
    return merged;
  }, []);

  const removeApp = useCallback((unifiedAppId) => {
    setApps((prev) => prev.filter((a) => a.unifiedAppId !== unifiedAppId));
  }, []);

  const addKeyword = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setKeywordItems((prev) => {
      if (prev.some((item) => item.text === trimmed)) return prev;
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: trimmed,
          selected: true,
        },
      ];
    });
  }, []);

  const toggleKeyword = useCallback((id) => {
    setKeywordItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  }, []);

  return {
    platformId,
    setPlatformId,
    datePresetId,
    applyDatePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    allRegions,
    setAllRegions,
    handleAllRegionsChange,
    selectedRegions,
    setSelectedRegions,
    allNetworks,
    handleAllNetworksChange,
    selectedNetworks,
    setSelectedNetworks,
    allPlacements,
    handleAllPlacementsChange,
    selectedPlacements,
    setSelectedPlacements,
    selectedAdTypes,
    setSelectedAdTypes,
    placementCountMap,
    adTypeCountMap,
    adObjectiveCountMap,
    aspectRatioCountMap,
    videoDurationCountMap,
    bannerDimensionCountMap,
    allAdObjectives,
    handleAllAdObjectivesChange,
    selectedAdObjectives,
    setSelectedAdObjectives,
    allVideoDurations,
    handleAllVideoDurationsChange,
    selectedVideoDurations,
    setSelectedVideoDurations,
    allAspectRatios,
    handleAllAspectRatiosChange,
    selectedAspectRatios,
    setSelectedAspectRatios,
    allBannerDimensions,
    handleAllBannerDimensionsChange,
    selectedBannerDimensions,
    setSelectedBannerDimensions,
    apps,
    setApps,
    appsPickerCollapsed,
    collapseAppsPicker,
    expandAppsPicker,
    toggleAppSelected,
    toggleStoreVersion,
    addAppFromSearch,
    enrichAppDetails,
    removeApp,
    addAppModalOpen,
    setAddAppModalOpen,
    sidebarTab,
    setSidebarTab,
    keywordItems,
    addKeyword,
    toggleKeyword,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    kpisRows,
    creativesRows,
    totalCount,
    appSummaries,
    filters,
    fetchGallery,
    resetFilters,
    viewMode,
    handleViewModeChange,
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    totalPages,
    sortById,
    setSortById,
    newCreativesOnly,
    setNewCreativesOnly,
    creativesWithImpressionsOnly,
    setCreativesWithImpressionsOnly,
  };
}
