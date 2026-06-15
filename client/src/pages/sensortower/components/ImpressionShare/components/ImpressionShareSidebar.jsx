import React from 'react';
import {
  IS_AD_SOURCES,
  IS_BREAKDOWNS,
  IS_CHART_TYPES,
  IS_GRANULARITIES,
  IS_METRIC_OPTIONS,
  IS_METRICS,
} from '../../../constants/impressionShareConstants.js';
import GalleryDateRangePicker from '../../CreativeGallery/GalleryDateRangePicker.jsx';
import { IS_DATE_PRESET_RANGE_OPTIONS } from '../../../constants/impressionShareDatePresets.js';
import ImpressionShareAppPicker from './ImpressionShareAppPicker.jsx';

function ChartTypeIcon({ type }) {
  if (type === 'line') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M4 18 L8 12 L12 14 L20 6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (type === 'marketShare') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M4 18 L4 14 L8 12 L8 8 L12 6 L12 4 L16 6 L20 4 L20 18 Z" fill="currentColor" opacity="0.35" />
        <path d="M4 18 L8 12 L12 10 L20 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (type === 'groupedBar') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <rect x="4" y="11" width="3" height="7" fill="currentColor" />
        <rect x="8" y="8" width="3" height="10" fill="currentColor" opacity="0.65" />
        <rect x="13" y="10" width="3" height="8" fill="currentColor" />
        <rect x="17" y="6" width="3" height="12" fill="currentColor" opacity="0.65" />
      </svg>
    );
  }
  if (type === 'stackedBar') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <rect x="6" y="14" width="5" height="4" fill="currentColor" opacity="0.45" />
        <rect x="6" y="9" width="5" height="5" fill="currentColor" opacity="0.7" />
        <rect x="6" y="4" width="5" height="5" fill="currentColor" />
        <rect x="14" y="12" width="5" height="6" fill="currentColor" opacity="0.45" />
        <rect x="14" y="6" width="5" height="6" fill="currentColor" />
      </svg>
    );
  }
  return null;
}

function ImpressionShareSidebar({
  apps,
  platformId,
  onPlatformChange,
  metricId,
  onMetricChange,
  onOpenAddApp,
  onToggleApp,
  onRemoveApp,
  appsPickerCollapsed,
  onAppsPickerCollapse,
  onAppsPickerExpand,
  datePresetId,
  onDatePresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  chartTypeId,
  onChartTypeChange,
  adSourceId,
  onAdSourceChange,
  breakdownId,
  onBreakdownChange,
  metricOptionId,
  onMetricOptionChange,
  granularityId,
  onGranularityChange,
}) {
  return (
    <aside className="st-sidebar st-is-sidebar" aria-label="展示份额筛选侧栏">
      <GalleryDateRangePicker
        datePresetId={datePresetId}
        onDatePresetChange={onDatePresetChange}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        presetRangeOptions={IS_DATE_PRESET_RANGE_OPTIONS}
      />

      <label className="st-is-sidebar__metric">
        <span className="st-is-sidebar__metric-label">指标</span>
        <select
          className="st-is-sidebar__metric-select"
          value={metricId}
          onChange={(e) => onMetricChange(e.target.value)}
          aria-label="指标"
        >
          {IS_METRICS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="st-sidebar__add-app" onClick={onOpenAddApp}>
        <span className="st-sidebar__add-icon" aria-hidden>
          +
        </span>
        添加应用
      </button>

      <ImpressionShareAppPicker
        apps={apps}
        platformId={platformId}
        onPlatformChange={onPlatformChange}
        collapsed={appsPickerCollapsed}
        onCollapse={onAppsPickerCollapse}
        onExpand={onAppsPickerExpand}
        onToggleApp={onToggleApp}
        onRemoveApp={onRemoveApp}
        onOpenAddApp={onOpenAddApp}
      />

      <div className="st-is-sidebar__section-title">报告选项</div>

      <div className="st-is-sidebar__chart-types" role="group" aria-label="图表类型">
        {IS_CHART_TYPES.map((ct) => (
          <button
            key={ct.id}
            type="button"
            title={ct.title || ct.label}
            className={`st-is-sidebar__chart-type${chartTypeId === ct.id ? ' st-is-sidebar__chart-type--active' : ''}`}
            aria-pressed={chartTypeId === ct.id}
            onClick={() => onChartTypeChange(ct.id)}
          >
            <ChartTypeIcon type={ct.icon} />
          </button>
        ))}
      </div>

      <div className="st-is-sidebar__pill-group" role="group" aria-label="广告来源">
        {IS_AD_SOURCES.map((src) => (
          <button
            key={src.id}
            type="button"
            className={`st-is-sidebar__pill${adSourceId === src.id ? ' st-is-sidebar__pill--active' : ''}`}
            aria-pressed={adSourceId === src.id}
            onClick={() => onAdSourceChange(src.id)}
          >
            {src.label}
          </button>
        ))}
      </div>

      <p className="st-is-sidebar__option-label">细分</p>
      <div className="st-is-sidebar__segment-row" role="group" aria-label="细分">
        {IS_BREAKDOWNS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`st-is-sidebar__segment${breakdownId === b.id ? ' st-is-sidebar__segment--active' : ''}`}
            onClick={() => onBreakdownChange(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="st-is-sidebar__pill-group st-is-sidebar__pill-group--wrap" role="group" aria-label="指标选项">
        {IS_METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`st-is-sidebar__pill${metricOptionId === opt.id ? ' st-is-sidebar__pill--active' : ''}`}
            aria-pressed={metricOptionId === opt.id}
            onClick={() => onMetricOptionChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="st-is-sidebar__option-label">日期颗粒度</p>
      <div className="st-is-sidebar__granularity" role="group" aria-label="日期颗粒度">
        {IS_GRANULARITIES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`st-is-sidebar__granularity-btn${granularityId === g.id ? ' st-is-sidebar__granularity-btn--active' : ''}`}
            onClick={() => onGranularityChange(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="st-is-sidebar__compare">
        <span className="st-is-sidebar__option-label st-is-sidebar__option-label--inline">比较指标</span>
        <button type="button" className="st-is-sidebar__compare-add">
          + 选择
        </button>
      </div>
    </aside>
  );
}

export default ImpressionShareSidebar;
