import React, { useEffect, useRef, useState } from 'react';
import {
  facetExplicitSelectionFromAll,
  facetMergeGroupSelection,
  getFacetGroupState,
  getFacetLeafValues,
  getFacetSelectAllState,
  isFacetLeafChecked,
  normalizeFacetOption,
} from '../../utils/facetFilterSelection.js';

function formatCreativeCount(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-US');
}

function CheckboxInput({ checked, indeterminate, disabled, onChange }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/**
 * 多选下拉：支持「选择全部」时子项全选展示；可选 optionGroups 层级
 */
function FacetFilterDropdown({
  label,
  columnTitle,
  options = [],
  optionGroups = null,
  selectedValues,
  onChange,
  countMap = null,
  allLabel = '选择所有选项',
  showAllOption = true,
  onAllChange,
  allSelected = false,
  showFlags = false,
  triggerSummary,
  triggerClassName = 'st-ffd__trigger',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const allLeafValues = getFacetLeafValues(options, optionGroups);
  const selectionCtx = { allSelected, showAllOption, selectedValues };
  const selectAllState = getFacetSelectAllState(
    allLeafValues,
    selectedValues,
    allSelected,
    showAllOption
  );

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const exitAllMode = () => {
    if (onAllChange) onAllChange(false);
  };

  const toggleLeaf = (value) => {
    if (allSelected && showAllOption && onAllChange) {
      onAllChange(false);
      onChange(facetExplicitSelectionFromAll(allLeafValues, [value]));
      return;
    }
    const set = new Set(selectedValues);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange([...set]);
    if (onAllChange) onAllChange(false);
  };

  const toggleGroup = (groupValues) => {
    const groupState = getFacetGroupState(groupValues, selectionCtx);
    const selectGroup = !groupState.checked;
    const next = facetMergeGroupSelection(
      selectedValues,
      groupValues,
      selectGroup,
      allLeafValues,
      allSelected
    );
    exitAllMode();
    onChange(next);
  };

  const handleSelectAll = (checked) => {
    if (!onAllChange) return;
    onAllChange(checked);
    if (checked) onChange([]);
  };

  const summary =
    triggerSummary ||
    (allSelected && showAllOption
      ? /所有/.test(label)
        ? label
        : `${label}: 全部`
      : selectedValues.length === 0
        ? label
        : `${label}: ${selectedValues.length} 个`);

  const headerRight = columnTitle || 'Creative Count';

  const renderLeaf = (opt, { child = false } = {}) => {
    const { value, label: text, flagUrl } = normalizeFacetOption(opt);
    const checked = isFacetLeafChecked(value, selectionCtx);
    const count = countMap?.get?.(value) ?? countMap?.[value];
    const countText = formatCreativeCount(count);
    return (
      <label
        key={value}
        className={`st-ffd__row${child ? ' st-ffd__row--child' : ''}`}
      >
        <span className="st-ffd__row-left">
          <CheckboxInput checked={checked} onChange={() => toggleLeaf(value)} />
          {showFlags && flagUrl ? (
            <img className="st-ffd__flag" src={flagUrl} alt="" width={22} height={16} loading="lazy" />
          ) : null}
          <span className="st-ffd__row-label">{text}</span>
        </span>
        {countText != null ? (
          <span className="st-ffd__row-count">{countText}</span>
        ) : (
          <span className="st-ffd__row-count st-ffd__row-count--empty">—</span>
        )}
      </label>
    );
  };

  return (
    <div className="st-ffd" ref={rootRef}>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {summary}
        <span className="st-ffd__caret" aria-hidden />
      </button>
      {open ? (
        <div className="st-ffd__panel" role="listbox">
          <div className="st-ffd__header">
            <span className="st-ffd__header-label">
              {columnTitle ? (
                <>
                  {columnTitle}
                  <span className="st-ffd__header-sort" aria-hidden>
                    ↑
                  </span>
                </>
              ) : (
                label
              )}
            </span>
            <span className="st-ffd__header-count">{headerRight}</span>
          </div>
          {showAllOption && onAllChange ? (
            <label className="st-ffd__row st-ffd__row--all">
              <span className="st-ffd__row-left">
                <CheckboxInput
                  checked={selectAllState.checked}
                  indeterminate={selectAllState.indeterminate}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                <span>{allLabel}</span>
              </span>
              <span className="st-ffd__row-count" />
            </label>
          ) : null}
          {optionGroups?.length
            ? optionGroups.map((group) => {
                const groupValues = (group.options || []).map((o) => normalizeFacetOption(o).value);
                const groupState = getFacetGroupState(groupValues, selectionCtx);
                return (
                  <div key={group.id} className="st-ffd__group">
                    <label className="st-ffd__row st-ffd__row--group">
                      <span className="st-ffd__row-left">
                        <CheckboxInput
                          checked={groupState.checked}
                          indeterminate={groupState.indeterminate}
                          onChange={() => toggleGroup(groupValues)}
                        />
                        <span className="st-ffd__row-label st-ffd__row-label--group">
                          {group.label}
                        </span>
                      </span>
                      <span className="st-ffd__row-count" />
                    </label>
                    {(group.options || []).map((opt) => renderLeaf(opt, { child: true }))}
                  </div>
                );
              })
            : (options || []).map((opt) => renderLeaf(opt))}
        </div>
      ) : null}
    </div>
  );
}

export default FacetFilterDropdown;
