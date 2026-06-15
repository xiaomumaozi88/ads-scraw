import React from 'react';

/**
 * 侧栏开关行：胶囊开关 + 文案 + 可选说明图标（hover 显示 tooltip）
 */
function GalleryToggleOption({ checked, onChange, label, tooltip }) {
  return (
    <div className="st-toggle-row">
      <label className="st-toggle-row__leading">
        <span className="st-toggle-row__switch">
          <input
            type="checkbox"
            className="st-toggle-row__input"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="st-toggle-row__slider" aria-hidden />
        </span>
        <span className="st-toggle-row__label">{label}</span>
      </label>
      {tooltip ? (
        <span className="st-toggle-row__info-wrap">
          <button
            type="button"
            className="st-toggle-row__info"
            tabIndex={0}
            aria-label={`${label}说明`}
          >
            i
          </button>
          <span className="st-toggle-row__tooltip" role="tooltip">
            {tooltip}
          </span>
        </span>
      ) : null}
    </div>
  );
}

export default GalleryToggleOption;
