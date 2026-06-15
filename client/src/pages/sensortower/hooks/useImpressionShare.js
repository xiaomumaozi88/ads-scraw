import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildImpressionShareRequest } from '../utils/buildImpressionShareRequest.js';
import {
  CUSTOM_DATE_PRESET_ID,
  resolveDatePresetRange,
  toDateKey,
} from '../utils/galleryDatePresets.js';
import { IS_DATE_PRESET_RANGE_OPTIONS } from '../constants/impressionShareDatePresets.js';
import {
  loadImpressionShareAppsFromStorage,
  normalizeImpressionShareAppFromSearch,
  saveImpressionShareAppsToStorage,
} from '../utils/impressionShareAppsStorage.js';
import { fetchImpressionShareData } from '../utils/impressionShareApi.js';
import { buildChartDateAxis } from '../utils/impressionShareChartAxis.js';
import {
  buildSummaryCardsFromTableRows,
  computeImpressionShareTotal,
  parseImpressionShareChartSeries,
  parseImpressionShareTableRows,
} from '../utils/parseImpressionShareResponse.js';

const initialRange = resolveDatePresetRange('last30', new Date(), IS_DATE_PRESET_RANGE_OPTIONS);
const AUTO_FETCH_MS = 400;

export function useImpressionShare({ isLoggedIn, onRequireLogin, addLog } = {}) {
  const [apps, setApps] = useState(() => loadImpressionShareAppsFromStorage());
  const [appsPickerCollapsed, setAppsPickerCollapsed] = useState(
    () => loadImpressionShareAppsFromStorage().length > 0
  );
  const [addAppModalOpen, setAddAppModalOpen] = useState(false);
  const [platformId, setPlatformId] = useState('unified');
  const [metricId, setMetricId] = useState('impressionShare');
  const [datePresetId, setDatePresetId] = useState('last30');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [chartTypeId, setChartTypeId] = useState('line');
  const [adSourceId, setAdSourceId] = useState('networks');
  const [breakdownId, setBreakdownId] = useState('unifiedApp');
  const [metricOptionId, setMetricOptionId] = useState('marketShare');
  const [granularityId, setGranularityId] = useState('auto');
  const [allRegions, setAllRegions] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [allNetworks, setAllNetworks] = useState(true);
  const [selectedNetworks, setSelectedNetworks] = useState([]);
  const [allAdPlatforms, setAllAdPlatforms] = useState(true);
  const [selectedAdPlatforms, setSelectedAdPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tableRows, setTableRows] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [chartSeries, setChartSeries] = useState([]);

  const fetchRef = useRef(null);
  const requestSeqRef = useRef(0);

  const persistApps = useCallback((next) => {
    setApps(next);
    saveImpressionShareAppsToStorage(next);
  }, []);

  const applyDatePreset = useCallback((presetId) => {
    setDatePresetId(presetId);
    const { startDate: s, endDate: e } = resolveDatePresetRange(
      presetId,
      new Date(),
      IS_DATE_PRESET_RANGE_OPTIONS
    );
    setStartDate(s);
    setEndDate(e);
  }, []);

  const toggleAppSelected = useCallback(
    (unifiedAppId) => {
      persistApps(
        apps.map((a) =>
          a.unifiedAppId === unifiedAppId ? { ...a, selected: !a.selected } : a
        )
      );
    },
    [apps, persistApps]
  );

  const removeApp = useCallback(
    (unifiedAppId) => {
      const next = apps.filter((a) => a.unifiedAppId !== unifiedAppId);
      persistApps(next);
      if (!next.length) setAppsPickerCollapsed(false);
    },
    [apps, persistApps]
  );

  const addAppFromSearch = useCallback(
    (searchApp) => {
      const normalized = normalizeImpressionShareAppFromSearch(searchApp);
      if (!normalized) return;
      if (apps.some((a) => a.unifiedAppId === normalized.unifiedAppId)) {
        persistApps(
          apps.map((a) =>
            a.unifiedAppId === normalized.unifiedAppId ? { ...a, selected: true } : a
          )
        );
      } else {
        persistApps([...apps, normalized]);
      }
      setAddAppModalOpen(false);
      setAppsPickerCollapsed(false);
    },
    [apps, persistApps]
  );

  const collapseAppsPicker = useCallback(() => setAppsPickerCollapsed(true), []);
  const expandAppsPicker = useCallback(() => setAppsPickerCollapsed(false), []);

  const handleAllRegionsChange = useCallback((checked) => {
    setAllRegions(checked);
    if (checked) setSelectedRegions([]);
  }, []);

  const handleAllNetworksChange = useCallback((checked) => {
    setAllNetworks(checked);
    if (checked) setSelectedNetworks([]);
  }, []);

  const handleAllAdPlatformsChange = useCallback((checked) => {
    setAllAdPlatforms(checked);
    if (checked) setSelectedAdPlatforms([]);
  }, []);

  const selectedApps = useMemo(() => apps.filter((a) => a.selected), [apps]);

  const selectedAppIds = useMemo(
    () => selectedApps.map((a) => a.unifiedAppId),
    [selectedApps]
  );

  const apiRequest = useMemo(
    () =>
      buildImpressionShareRequest({
        platformId,
        startDate,
        endDate,
        breakdownId,
        metricOptionId,
        granularityId,
        adSourceId,
        chartTypeId,
        allRegions,
        selectedRegions,
        allNetworks,
        selectedNetworks,
        allAdPlatforms,
        selectedAdPlatforms,
        selectedAppIds,
      }),
    [
      platformId,
      startDate,
      endDate,
      breakdownId,
      metricOptionId,
      granularityId,
      adSourceId,
      chartTypeId,
      allRegions,
      selectedRegions,
      allNetworks,
      selectedNetworks,
      allAdPlatforms,
      selectedAdPlatforms,
      selectedAppIds,
    ]
  );

  const fetchKey = useMemo(
    () =>
      JSON.stringify({
        chart: apiRequest.chart,
        table: apiRequest.table,
      }),
    [apiRequest]
  );

  const fetchImpressionShare = useCallback(async () => {
    if (!isLoggedIn) {
      setTableRows([]);
      setTableTotal(0);
      setChartSeries([]);
      setError('');
      return;
    }
    if (!selectedAppIds.length) {
      setTableRows([]);
      setTableTotal(0);
      setChartSeries([]);
      setError('请至少添加并选择一个应用');
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError('');
    addLog?.('正在加载展示份额数据…', 'info');

    try {
      const result = await fetchImpressionShareData(apiRequest);
      if (seq !== requestSeqRef.current) return;

      if (!result.ok) {
        const msg = result.message || '加载失败';
        setError(msg);
        setTableRows([]);
        setTableTotal(0);
        setChartSeries([]);
        addLog?.(msg, 'error');
        if (result.code === 'NOT_LOGGED_IN' || result.code === 'SESSION_EXPIRED') {
          onRequireLogin?.();
        }
        return;
      }

      const axis = buildChartDateAxis(startDate, endDate, granularityId);
      const parsedTable = parseImpressionShareTableRows(result.tableRows, {
        breakdownId,
        adSourceId,
        apps: selectedApps,
      });
      const parsedChart = parseImpressionShareChartSeries(result.chartRows, {
        breakdownId,
        adSourceId,
        apps: selectedApps,
        axisDates: axis.dates,
      });

      setTableRows(parsedTable);
      setTableTotal(computeImpressionShareTotal(parsedTable));
      setChartSeries(parsedChart);
      addLog?.(
        `展示份额加载成功：${parsedTable.length} 条${parsedChart.length ? `，${parsedChart.length} 个系列` : ''}`,
        'success'
      );
    } catch (e) {
      if (seq !== requestSeqRef.current) return;
      const msg = e?.message || String(e);
      setError(msg);
      setTableRows([]);
      setTableTotal(0);
      setChartSeries([]);
      addLog?.(msg, 'error');
      if (e?.requiresLogin) onRequireLogin?.();
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [
    isLoggedIn,
    selectedAppIds,
    apiRequest,
    breakdownId,
    adSourceId,
    selectedApps,
    startDate,
    endDate,
    granularityId,
    onRequireLogin,
    addLog,
  ]);

  fetchRef.current = fetchImpressionShare;

  // 挂载时校正预设日期（避免旧逻辑残留的错误区间）
  useEffect(() => {
    if (datePresetId === CUSTOM_DATE_PRESET_ID) return;
    const range = resolveDatePresetRange(datePresetId, new Date(), IS_DATE_PRESET_RANGE_OPTIONS);
    setStartDate((s) => (toDateKey(s) === toDateKey(range.startDate) ? s : range.startDate));
    setEndDate((e) => (toDateKey(e) === toDateKey(range.endDate) ? e : range.endDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次挂载校正
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !selectedAppIds.length) {
      setTableRows([]);
      setTableTotal(0);
      setChartSeries([]);
      setError(isLoggedIn ? '' : '');
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      fetchRef.current?.();
    }, AUTO_FETCH_MS);
    return () => clearTimeout(timer);
  }, [isLoggedIn, selectedAppIds.length, fetchKey]);

  const summaryCards = useMemo(
    () => buildSummaryCardsFromTableRows(tableRows),
    [tableRows]
  );

  return {
    apps,
    selectedApps,
    addAppModalOpen,
    setAddAppModalOpen,
    platformId,
    setPlatformId,
    metricId,
    setMetricId,
    datePresetId,
    applyDatePreset,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    chartTypeId,
    setChartTypeId,
    adSourceId,
    setAdSourceId,
    breakdownId,
    setBreakdownId,
    metricOptionId,
    setMetricOptionId,
    granularityId,
    setGranularityId,
    allRegions,
    handleAllRegionsChange,
    selectedRegions,
    setSelectedRegions,
    allNetworks,
    handleAllNetworksChange,
    selectedNetworks,
    setSelectedNetworks,
    allAdPlatforms,
    handleAllAdPlatformsChange,
    selectedAdPlatforms,
    setSelectedAdPlatforms,
    apiRequest,
    selectedAppIds,
    toggleAppSelected,
    removeApp,
    addAppFromSearch,
    appsPickerCollapsed,
    collapseAppsPicker,
    expandAppsPicker,
    tableRows,
    tableTotal,
    chartSeries,
    summaryCards,
    loading,
    error,
    refetch: fetchImpressionShare,
  };
}
