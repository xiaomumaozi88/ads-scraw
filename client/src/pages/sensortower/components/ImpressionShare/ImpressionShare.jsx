import React, { useMemo } from 'react';
import { useImpressionShare } from '../../hooks/useImpressionShare.js';
import AddAppModal from '../CreativeGallery/AddAppModal.jsx';
import ImpressionShareSidebar from './components/ImpressionShareSidebar.jsx';
import ImpressionShareToolbar from './components/ImpressionShareToolbar.jsx';
import ImpressionShareContentHead from './components/ImpressionShareContentHead.jsx';
import ImpressionShareChart from './components/ImpressionShareChart.jsx';
import ImpressionShareTable from './components/ImpressionShareTable.jsx';
import '../CreativeGallery/CreativeGallery.css';
import './ImpressionShare.css';

function ImpressionShare({ isLoggedIn, addLog, onRequireLogin }) {
  const is = useImpressionShare({ isLoggedIn, addLog, onRequireLogin });

  const appsById = useMemo(() => {
    const m = new Map();
    is.apps.forEach((a) => m.set(a.unifiedAppId, a));
    return m;
  }, [is.apps]);

  const maxShare = useMemo(
    () => Math.max(0, ...is.tableRows.map((r) => Number(r.sharePercent) || 0)),
    [is.tableRows]
  );

  const handleExport = () => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    addLog?.('导出 CSV 将在接入数据后开放', 'info');
  };

  const handleOpenAddApp = () => {
    is.expandAppsPicker();
    is.setAddAppModalOpen(true);
  };

  const emptyChartMessage = !is.tableRows.length
    ? isLoggedIn
      ? is.selectedAppIds.length
        ? '当前筛选条件下暂无展示份额数据。'
        : '请选择至少一个应用以查看展示份额。'
      : '登录后将加载展示份额数据，可先配置筛选条件并添加应用。'
    : null;

  return (
    <div className="st-gallery st-is">
      <div className="st-gallery__body">
        <ImpressionShareSidebar
          apps={is.apps}
          platformId={is.platformId}
          onPlatformChange={is.setPlatformId}
          metricId={is.metricId}
          onMetricChange={is.setMetricId}
          onOpenAddApp={handleOpenAddApp}
          onToggleApp={is.toggleAppSelected}
          onToggleStoreVersion={is.toggleStoreVersion}
          onRemoveApp={is.removeApp}
          onEnrichApp={is.enrichAppDetails}
          appsPickerCollapsed={is.appsPickerCollapsed}
          onAppsPickerCollapse={is.collapseAppsPicker}
          onAppsPickerExpand={is.expandAppsPicker}
          datePresetId={is.datePresetId}
          onDatePresetChange={is.applyDatePreset}
          startDate={is.startDate}
          endDate={is.endDate}
          onStartDateChange={is.setStartDate}
          onEndDateChange={is.setEndDate}
          chartTypeId={is.chartTypeId}
          onChartTypeChange={is.setChartTypeId}
          adSourceId={is.adSourceId}
          onAdSourceChange={is.setAdSourceId}
          breakdownId={is.breakdownId}
          onBreakdownChange={is.setBreakdownId}
          metricOptionId={is.metricOptionId}
          onMetricOptionChange={is.setMetricOptionId}
          granularityId={is.granularityId}
          onGranularityChange={is.setGranularityId}
        />

        <AddAppModal
          open={is.addAppModalOpen}
          onClose={() => is.setAddAppModalOpen(false)}
          onSelectApp={is.addAppFromSearch}
        />

        <div className="st-gallery__main">
          <ImpressionShareToolbar
            adSourceId={is.adSourceId}
            allRegions={is.allRegions}
            onAllRegionsChange={is.handleAllRegionsChange}
            selectedRegions={is.selectedRegions}
            onSelectedRegionsChange={is.setSelectedRegions}
            allNetworks={is.allNetworks}
            onAllNetworksChange={is.handleAllNetworksChange}
            selectedNetworks={is.selectedNetworks}
            onSelectedNetworksChange={is.setSelectedNetworks}
            allAdPlatforms={is.allAdPlatforms}
            onAllAdPlatformsChange={is.handleAllAdPlatformsChange}
            selectedAdPlatforms={is.selectedAdPlatforms}
            onSelectedAdPlatformsChange={is.setSelectedAdPlatforms}
            onExportCsv={handleExport}
            exportDisabled={!is.tableRows.length}
          />

          {is.error ? <p className="st-gallery__error">{is.error}</p> : null}

          <ImpressionShareContentHead
            platformId={is.platformId}
            startDate={is.startDate}
            endDate={is.endDate}
            allRegions={is.allRegions}
            selectedRegions={is.selectedRegions}
            granularityId={is.granularityId}
            breakdownId={is.breakdownId}
            summaryCards={is.summaryCards}
            appsById={appsById}
          />

          <div className="st-is__chart-section">
            {is.loading ? (
              <p className="st-gallery__loading">加载中…</p>
            ) : emptyChartMessage ? (
              <p className="st-gallery__empty">{emptyChartMessage}</p>
            ) : (
              <ImpressionShareChart
                chartTypeId={is.chartTypeId}
                startDate={is.startDate}
                endDate={is.endDate}
                granularityId={is.granularityId}
                breakdownId={is.breakdownId}
                chartSeries={is.chartSeries}
                appsById={appsById}
              />
            )}
          </div>

          {is.tableRows.length > 0 ? (
            <ImpressionShareTable
              rows={is.tableRows}
              totalShare={is.tableTotal}
              appsById={appsById}
              maxShare={maxShare}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ImpressionShare;
