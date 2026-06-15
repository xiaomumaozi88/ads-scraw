import React from 'react';
import {
  GALLERY_NETWORK_OPTION_GROUPS,
  GALLERY_REGIONS,
} from '../../constants/galleryConstants.js';
import FacetFilterDropdown from './FacetFilterDropdown.jsx';

function GalleryMainToolbar({
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
    <header className="st-toolbar">
      <div className="st-toolbar__filters">
        <FacetFilterDropdown
          label="所有国家/地区"
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
          triggerClassName="st-toolbar__pill"
        />
        <FacetFilterDropdown
          label="所有网络"
          columnTitle="网络"
          allLabel="所有网络"
          showAllOption
          allSelected={allNetworks}
          onAllChange={onAllNetworksChange}
          optionGroups={GALLERY_NETWORK_OPTION_GROUPS}
          selectedValues={selectedNetworks}
          onChange={onSelectedNetworksChange}
          triggerClassName="st-toolbar__pill"
        />
      </div>
      <button
        type="button"
        className="st-toolbar__export"
        onClick={onExportCsv}
        disabled={exportDisabled}
      >
        导出 CSV
      </button>
    </header>
  );
}

export default GalleryMainToolbar;
