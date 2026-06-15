import React, { useMemo } from 'react';
import {
  GALLERY_AD_OBJECTIVES,
  GALLERY_AD_TYPE_OPTION_GROUPS,
  GALLERY_ASPECT_RATIOS,
  GALLERY_PLACEMENTS,
  GALLERY_VIDEO_DURATIONS,
} from '../../constants/galleryConstants.js';
import { mergeFacetOptionGroups, mergeFacetOptions } from '../../utils/formatGallery.js';
import FacetFilterDropdown from './FacetFilterDropdown.jsx';

function facetSummary({ allSelected, selected, baseLabel, allText }) {
  if (allSelected) return allText;
  if (selected.length) return `${baseLabel}: ${selected.length} 个`;
  return baseLabel;
}

function GalleryFilterBar({
  selectedAdTypes,
  onSelectedAdTypesChange,
  allPlacements,
  onAllPlacementsChange,
  selectedPlacements,
  onSelectedPlacementsChange,
  placementCountMap,
  adTypeCountMap,
  allAdObjectives,
  onAllAdObjectivesChange,
  selectedAdObjectives,
  onSelectedAdObjectivesChange,
  adObjectiveCountMap,
  allVideoDurations,
  onAllVideoDurationsChange,
  selectedVideoDurations,
  onSelectedVideoDurationsChange,
  videoDurationCountMap,
  allAspectRatios,
  onAllAspectRatiosChange,
  selectedAspectRatios,
  onSelectedAspectRatiosChange,
  aspectRatioCountMap,
}) {
  const adTypeOptionGroups = useMemo(
    () => mergeFacetOptionGroups(GALLERY_AD_TYPE_OPTION_GROUPS, adTypeCountMap),
    [adTypeCountMap]
  );
  const placementOptions = useMemo(
    () => mergeFacetOptions(GALLERY_PLACEMENTS, placementCountMap),
    [placementCountMap]
  );
  const adObjectiveOptions = useMemo(
    () => mergeFacetOptions(GALLERY_AD_OBJECTIVES, adObjectiveCountMap),
    [adObjectiveCountMap]
  );
  const aspectRatioOptions = useMemo(
    () => mergeFacetOptions(GALLERY_ASPECT_RATIOS, aspectRatioCountMap),
    [aspectRatioCountMap]
  );
  const videoDurationOptions = useMemo(
    () => mergeFacetOptions(GALLERY_VIDEO_DURATIONS, videoDurationCountMap),
    [videoDurationCountMap]
  );

  const adTypeSummary =
    selectedAdTypes.length > 0
      ? `广告类型: ${selectedAdTypes.length} 个过滤器`
      : '广告类型';

  const placementSummary = facetSummary({
    allSelected: allPlacements,
    selected: selectedPlacements,
    baseLabel: '广告位',
    allText: '广告位: 所有',
  });

  const adObjectiveSummary = facetSummary({
    allSelected: allAdObjectives,
    selected: selectedAdObjectives,
    baseLabel: '广告目标',
    allText: '广告目标: 所有',
  });

  const aspectRatioSummary = facetSummary({
    allSelected: allAspectRatios,
    selected: selectedAspectRatios,
    baseLabel: '纵横比',
    allText: '纵横比: 所有',
  });

  const videoDurationSummary = facetSummary({
    allSelected: allVideoDurations,
    selected: selectedVideoDurations,
    baseLabel: '视频时长',
    allText: '视频时长: 所有',
  });

  const pill = 'st-filterbar__pill';

  return (
    <div className="st-filterbar">
      <FacetFilterDropdown
        label={adTypeSummary}
        columnTitle="广告类型"
        showAllOption={false}
        optionGroups={adTypeOptionGroups}
        selectedValues={selectedAdTypes}
        onChange={onSelectedAdTypesChange}
        countMap={adTypeCountMap}
        triggerClassName={pill}
      />
      <FacetFilterDropdown
        label={placementSummary}
        columnTitle="广告位"
        allLabel="选择所有选项"
        showAllOption
        allSelected={allPlacements}
        onAllChange={onAllPlacementsChange}
        options={placementOptions}
        selectedValues={selectedPlacements}
        onChange={onSelectedPlacementsChange}
        countMap={placementCountMap}
        triggerClassName={pill}
      />
      <FacetFilterDropdown
        label={adObjectiveSummary}
        columnTitle="广告目标"
        allLabel="选择所有选项"
        showAllOption
        allSelected={allAdObjectives}
        onAllChange={onAllAdObjectivesChange}
        options={adObjectiveOptions}
        selectedValues={selectedAdObjectives}
        onChange={onSelectedAdObjectivesChange}
        countMap={adObjectiveCountMap}
        triggerClassName={pill}
      />
      <FacetFilterDropdown
        label={aspectRatioSummary}
        columnTitle="纵横比"
        allLabel="选择所有选项"
        showAllOption
        allSelected={allAspectRatios}
        onAllChange={onAllAspectRatiosChange}
        options={aspectRatioOptions}
        selectedValues={selectedAspectRatios}
        onChange={onSelectedAspectRatiosChange}
        countMap={aspectRatioCountMap}
        triggerClassName={pill}
      />
      <FacetFilterDropdown
        label={videoDurationSummary}
        columnTitle="视频时长"
        allLabel="选择所有选项"
        showAllOption
        allSelected={allVideoDurations}
        onAllChange={onAllVideoDurationsChange}
        options={videoDurationOptions}
        selectedValues={selectedVideoDurations}
        onChange={onSelectedVideoDurationsChange}
        countMap={videoDurationCountMap}
        triggerClassName={pill}
      />
    </div>
  );
}

export default GalleryFilterBar;
