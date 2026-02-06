import React, { useState, useMemo } from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import './SortSelector.css';

// 排序选项配置（按用户提供的值映射）
const SORT_OPTIONS_ALL = [
  { label: '相关性', value: '11' },
  { label: '关联创意组数', value: '14' },
  { label: '首次发现时间', value: '3' },
  { label: '投放天数', value: '4' },
  { label: '曝光预估', value: '15' },
  { label: '播放', value: '8' },
  { label: '点赞', value: '5' },
  { label: '评论', value: '6' },
  { label: '转发', value: '7' },
  { label: '受众人群数量', value: '16' },
  { label: '素材热度', value: '17' },
];

// 试玩广告 Tab 仅保留：相关性、首次发现时间、投放天数、曝光预估
const SORT_OPTIONS_PLAYABLE = SORT_OPTIONS_ALL.filter(
  (o) => ['11', '3', '4', '15'].includes(o.value)
);

// 排序说明文案（完整版）
const SORT_DESCRIPTION = `相关性
根据与搜索词关联度从高到低排序
关联创意组数
所选时间范围，素材关联的创意组数的正序或倒序排列，通常关联创意组数越多，说明素材效果越好
首次发现时间
所选时间范围，数据首次被发现的时间正序或倒序排列`;

function SortSelector({ sortField, sortRule, onSortChange, platform, insightrackrSearchTab = 'imagevideo' }) {
  // 只对 Insightrackr 平台显示
  if (platform !== 'insightrackr') {
    return null;
  }

  const sortOptions = insightrackrSearchTab === 'playable' ? SORT_OPTIONS_PLAYABLE : SORT_OPTIONS_ALL;

  // 点击排序字段时切换排序方向
  const handleFieldChange = (newField) => {
    // 如果点击的是当前选中的字段，则切换排序方向
    if (sortField === newField) {
      const newRule = sortRule === 'desc' ? 'asc' : 'desc';
      onSortChange({
        sortField: newField,
        sortRule: newRule
      });
    } else {
      // 如果点击的是新字段，默认使用降序
      onSortChange({
        sortField: newField,
        sortRule: 'desc'
      });
    }
  };

  const currentSortRule = sortRule || 'desc';

  return (
    <div className="sort-selector">
      <span className="sort-label">排序：</span>
      <div className="sort-options-container">
        {sortOptions.map(option => {
          const isSelected = sortField === option.value;
          const arrow = isSelected 
            ? (currentSortRule === 'desc' ? '↓' : '↑')
            : '';
          return (
            <span
              key={option.value}
              className={`sort-option-link ${isSelected ? 'active' : ''}`}
              onClick={() => handleFieldChange(option.value)}
            >
              {option.label}
              {arrow && <span className="sort-arrow">{arrow}</span>}
            </span>
          );
        })}
      </div>
      <Tooltip 
        title={SORT_DESCRIPTION}
        placement="top"
        overlayStyle={{ whiteSpace: 'pre-line', maxWidth: '350px' }}
      >
        <span className="sort-help">
          <QuestionCircleOutlined /> 排序说明
        </span>
      </Tooltip>
    </div>
  );
}

export default SortSelector;
