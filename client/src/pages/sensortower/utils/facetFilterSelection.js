/** 扁平化下拉选项 value 列表 */
export function getFacetLeafValues(options = [], optionGroups = null) {
  if (optionGroups?.length) {
    return optionGroups.flatMap((g) =>
      (g.options || []).map((opt) => (typeof opt === 'string' ? opt : opt.value))
    );
  }
  return (options || []).map((opt) => (typeof opt === 'string' ? opt : opt.value));
}

export function normalizeFacetOption(opt) {
  if (typeof opt === 'string') return { value: opt, label: opt, flagUrl: null };
  return {
    value: opt.value,
    label: opt.label ?? opt.value,
    flagUrl: opt.flagUrl ?? null,
  };
}

/** 某叶子项在 UI 上是否勾选 */
export function isFacetLeafChecked(value, { allSelected, showAllOption, selectedValues }) {
  if (allSelected && showAllOption) return true;
  return selectedValues.includes(value);
}

/** 「选择全部」勾选态 */
export function getFacetSelectAllState(allLeafValues, selectedValues, allSelected, showAllOption) {
  if (!showAllOption) {
    return { checked: false, indeterminate: false };
  }
  if (allSelected) {
    return { checked: true, indeterminate: false };
  }
  const set = new Set(selectedValues);
  const count = allLeafValues.filter((v) => set.has(v)).length;
  if (count === 0) return { checked: false, indeterminate: false };
  if (count === allLeafValues.length) {
    return { checked: true, indeterminate: false };
  }
  return { checked: false, indeterminate: true };
}

/** 分组勾选态 */
export function getFacetGroupState(groupValues, ctx) {
  const total = groupValues.length;
  if (!total) return { checked: false, indeterminate: false };
  const checkedCount = groupValues.filter((v) => isFacetLeafChecked(v, ctx)).length;
  if (checkedCount === 0) return { checked: false, indeterminate: false };
  if (checkedCount === total) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

/** 从「全部」切换到显式选中列表 */
export function facetExplicitSelectionFromAll(allLeafValues, excludeValues = []) {
  const exclude = new Set(excludeValues);
  return allLeafValues.filter((v) => !exclude.has(v));
}

/** 合并分组选中 */
export function facetMergeGroupSelection(selectedValues, groupValues, selectGroup, allLeafValues, allSelected) {
  if (allSelected) {
    return selectGroup
      ? [...allLeafValues]
      : facetExplicitSelectionFromAll(allLeafValues, groupValues);
  }
  const set = new Set(selectedValues);
  if (selectGroup) {
    groupValues.forEach((v) => set.add(v));
  } else {
    groupValues.forEach((v) => set.delete(v));
  }
  return [...set];
}
