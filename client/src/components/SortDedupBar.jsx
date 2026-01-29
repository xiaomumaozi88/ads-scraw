import React from 'react';
import { Radio, Tooltip } from 'antd';
import { GUANGDADA_SORT_OPTIONS, GUANGDADA_DEDUP_OPTIONS } from '../data/guangdadaSortOptions';

const RELEVANCE_VALUE = 'relevance';
const MATERIAL_RELEVANCE_VALUE = 'material_relevance';
const RELEVANCE_DISABLED_TIP = '只有在输入关键词后才可以进行相关性排序';
const MATERIAL_RELEVANCE_DISABLED_TIP = '只有在素材内容搜索时有效';

function SortDedupBar({ sortField = '-first_seen', dedupType = 0, hasKeyword = false, onSortChange, onDedupChange, className }) {
  const renderSortOption = (opt) => {
    const isRelevance = opt.value === RELEVANCE_VALUE;
    const isMaterialRelevance = opt.value === MATERIAL_RELEVANCE_VALUE;
    const disabledByKeyword = isRelevance && !hasKeyword;
    const disabled = isMaterialRelevance ? true : (opt.disabled || disabledByKeyword);
    const tooltipTitle =
      disabled && isRelevance ? RELEVANCE_DISABLED_TIP
      : disabled && isMaterialRelevance ? MATERIAL_RELEVANCE_DISABLED_TIP
      : null;

    const btn = (
      <button
        key={opt.value}
        type="button"
        className={`sort-dedup-bar-option ${sortField === opt.value ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        onClick={() => !disabled && onSortChange?.(opt.value)}
      >
        <span className="sort-dedup-bar-option-text">{opt.label}</span>
        <span className="sort-dedup-bar-option-arrow" aria-hidden />
      </button>
    );

    if (tooltipTitle) {
      return (
        <Tooltip key={opt.value} title={tooltipTitle}>
          <span className="sort-dedup-bar-option-wrap">{btn}</span>
        </Tooltip>
      );
    }
    return btn;
  };

  return (
    <div className={`sort-dedup-bar ${className || ''}`}>
      <div className="sort-dedup-bar-sort">
        <span className="sort-dedup-bar-label">排序</span>
        <div className="sort-dedup-bar-options">
          {GUANGDADA_SORT_OPTIONS.map(renderSortOption)}
        </div>
      </div>
      <div className="sort-dedup-bar-spacer" />
      <div className="sort-dedup-bar-dedup">
        <span className="sort-dedup-bar-label">去重</span>
        <Radio.Group
          optionType="button"
          buttonStyle="outlined"
          value={dedupType}
          onChange={(e) => onDedupChange?.(e.target.value)}
          className="sort-dedup-bar-dedup-group"
        >
          {GUANGDADA_DEDUP_OPTIONS.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value}>
              {opt.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>
    </div>
  );
}

export default SortDedupBar;
