import React, { useEffect, useRef, useState } from 'react';
import { GALLERY_LIST_COLUMN_GROUPS } from '../../constants/galleryListColumns.js';

function GalleryColumnsDropdown({
  open,
  onOpenChange,
  selectionState,
  isColumnVisible,
  onToggleColumn,
  onSetAllColumns,
  onResetColumns,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  return (
    <div className={`st-columns-dd${open ? ' st-columns-dd--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="st-results-head__columns"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="配置列表列"
      >
        列
        <span className={`st-results-head__columns-caret${open ? ' st-results-head__columns-caret--up' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="st-columns-dd__panel" role="dialog" aria-label="列配置">
          <div className="st-columns-dd__header">
            <label className="st-columns-dd__select-all">
              <input
                type="checkbox"
                checked={selectionState.allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = selectionState.indeterminate;
                }}
                onChange={(e) => onSetAllColumns(e.target.checked)}
              />
              <span>选择全部</span>
            </label>
            <button type="button" className="st-columns-dd__reset" onClick={onResetColumns}>
              重置列
            </button>
          </div>
          {GALLERY_LIST_COLUMN_GROUPS.map((group) => (
            <div key={group.id} className="st-columns-dd__group">
              <p className="st-columns-dd__group-title">{group.label}</p>
              <ul className="st-columns-dd__list">
                {group.columns.map((col) => (
                  <li key={col.id}>
                    <label className="st-columns-dd__item">
                      <input
                        type="checkbox"
                        checked={isColumnVisible(col.id)}
                        onChange={() => onToggleColumn(col.id)}
                      />
                      <span>{col.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default GalleryColumnsDropdown;
