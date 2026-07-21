import React, { useEffect, useRef, useState } from 'react';
import RegionFlagIcon from '../shared/RegionFlagIcon.jsx';

/**
 * 简易多选下拉（Material 风格）
 */
function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  allLabel = '全部',
  showAllOption = true,
  onAllChange,
  allSelected = false,
  showFlags = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (value) => {
    const set = new Set(selectedValues);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange([...set]);
    if (onAllChange) onAllChange(false);
  };

  const summary =
    allSelected && showAllOption
      ? allLabel
      : selectedValues.length === 0
        ? label
        : `${label}: ${selectedValues.length} 个`;

  return (
    <div className="st-msd" ref={rootRef}>
      <button
        type="button"
        className="st-msd__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {summary}
        <span className="st-msd__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="st-msd__panel" role="listbox">
          {showAllOption && onAllChange ? (
            <label className="st-msd__item st-msd__item--all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  onAllChange(e.target.checked);
                  setOpen(false);
                }}
              />
              <span>{allLabel}</span>
            </label>
          ) : null}
          {options.map((opt) => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const text = typeof opt === 'string' ? opt : opt.label;
            const checked = selectedValues.includes(value);
            return (
              <label key={value} className="st-msd__item">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={allSelected && showAllOption}
                  onChange={() => toggle(value)}
                />
                <span className="st-msd__option-content">
                  {showFlags ? <RegionFlagIcon code={value} className="st-msd__flag" /> : null}
                  <span className="st-msd__option-label">{text}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default MultiSelectDropdown;
