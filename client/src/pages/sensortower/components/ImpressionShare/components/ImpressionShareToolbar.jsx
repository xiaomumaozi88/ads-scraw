import React, { useMemo } from 'react';
import { GALLERY_REGIONS } from '../../../constants/galleryConstants.js';
import {
  getAdSourceById,
  IS_AD_PLATFORMS,
  IS_NETWORK_OPTION_GROUPS,
} from '../../../constants/impressionShareConstants.js';
import FacetFilterDropdown from '../../CreativeGallery/FacetFilterDropdown.jsx';

function ImpressionShareToolbar({
  adSourceId,
  allRegions,
  onAllRegionsChange,
  selectedRegions,
  onSelectedRegionsChange,
  allNetworks,
  onAllNetworksChange,
  selectedNetworks,
  onSelectedNetworksChange,
  allAdPlatforms,
  onAllAdPlatformsChange,
  selectedAdPlatforms,
  onSelectedAdPlatformsChange,
  onExportCsv,
  exportDisabled,
}) {
  const adSource = getAdSourceById(adSourceId);
  const isNetworks = adSource.filterKey === 'networks';

  const adPlatformOptions = useMemo(
    () => IS_AD_PLATFORMS.map((p) => ({ value: p.value, label: p.label })),
    []
  );

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
        {isNetworks ? (
          <FacetFilterDropdown
            label={adSource.toolbarLabel}
            columnTitle={adSource.toolbarColumnTitle}
            allLabel="所有网络"
            showAllOption
            allSelected={allNetworks}
            onAllChange={onAllNetworksChange}
            optionGroups={IS_NETWORK_OPTION_GROUPS}
            selectedValues={selectedNetworks}
            onChange={onSelectedNetworksChange}
            triggerClassName="st-toolbar__pill"
          />
        ) : (
          <FacetFilterDropdown
            label={adSource.toolbarLabel}
            columnTitle={adSource.toolbarColumnTitle}
            allLabel="所有购买平台"
            showAllOption
            allSelected={allAdPlatforms}
            onAllChange={onAllAdPlatformsChange}
            options={adPlatformOptions}
            selectedValues={selectedAdPlatforms}
            onChange={onSelectedAdPlatformsChange}
            triggerClassName="st-toolbar__pill"
          />
        )}
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

export default ImpressionShareToolbar;
