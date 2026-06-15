import React from 'react';
import { DATE_PRESETS, GALLERY_NETWORKS, GALLERY_REGIONS } from '../../constants/galleryConstants.js';
import { formatDateRangeLabel } from '../../utils/formatGallery.js';
import { toInputDate } from '../../utils/buildGalleryFilters.js';
import FacetFilterDropdown from './FacetFilterDropdown.jsx';

function GalleryTopBar({
  datePresetId,
  onDatePresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  allRegions,
  onAllRegionsChange,
  selectedRegions,
  onSelectedRegionsChange,
  allNetworks,
  onAllNetworksChange,
  selectedNetworks,
  onSelectedNetworksChange,
  onExportCsv,
  exportDisabled,
}) {
  return (
    <header className="st-topbar">
      <div className="st-topbar__left">
        <label className="st-topbar__date-preset">
          <select
            value={datePresetId}
            onChange={(e) => onDatePresetChange(e.target.value)}
            aria-label="日期预设"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <span className="st-topbar__date-range">{formatDateRangeLabel(startDate, endDate)}</span>
        <label className="st-topbar__date-input">
          <input
            type="date"
            value={toInputDate(startDate)}
            onChange={(e) => onStartDateChange(new Date(`${e.target.value}T12:00:00`))}
            aria-label="开始日期"
          />
        </label>
        <span className="st-topbar__date-sep">—</span>
        <label className="st-topbar__date-input">
          <input
            type="date"
            value={toInputDate(endDate)}
            onChange={(e) => onEndDateChange(new Date(`${e.target.value}T12:00:00`))}
            aria-label="结束日期"
          />
        </label>
      </div>
      <div className="st-topbar__filters">
        <FacetFilterDropdown
          label="国家/地区"
          columnTitle="国家/地区"
          allLabel="选择所有选项"
          showAllOption
          allSelected={allRegions}
          onAllChange={onAllRegionsChange}
          options={GALLERY_REGIONS.map((r) => ({
            value: r.code,
            label: r.nameZh,
            flagUrl: r.flagUrl,
          }))}
          showFlags
          selectedValues={selectedRegions}
          onChange={onSelectedRegionsChange}
        />
        <FacetFilterDropdown
          label="网络"
          columnTitle="网络"
          allLabel="选择所有选项"
          showAllOption
          allSelected={allNetworks}
          onAllChange={onAllNetworksChange}
          options={GALLERY_NETWORKS.map((n) => ({ value: n, label: n }))}
          selectedValues={selectedNetworks}
          onChange={onSelectedNetworksChange}
        />
      </div>
      <button
        type="button"
        className="st-topbar__export"
        onClick={onExportCsv}
        disabled={exportDisabled}
      >
        导出 CSV
      </button>
    </header>
  );
}

export default GalleryTopBar;
