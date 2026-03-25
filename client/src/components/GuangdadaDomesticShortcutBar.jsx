import React, { useMemo } from 'react';
import { Select } from 'antd';
import dayjs from 'dayjs';
import {
  DOMESTIC_RECOMMENDED_TAGS,
  DOMESTIC_SORT_OPTIONS,
  extractDomesticAdInfoSummary,
} from '../utils/guangdadaDomesticAdInfo';
import './GuangdadaDomesticShortcutBar.css';

/** 广大大国内版：筛选栏下方的快捷推荐 + 排序（与 BBA search_content / sort 对齐） */
function GuangdadaDomesticShortcutBar({
  recommendedKey,
  onRecommendedSelect,
  sort,
  onSortChange,
  result,
  fetchedAt,
  loading,
  formatCount,
}) {
  const summary = useMemo(() => extractDomesticAdInfoSummary(result), [result]);

  const creativeApprox =
    summary.creativeGroupApprox != null && summary.creativeGroupApprox !== ''
      ? typeof formatCount === 'function'
        ? formatCount(summary.creativeGroupApprox)
        : String(summary.creativeGroupApprox)
      : null;

  const materialText =
    summary.materialCount != null && summary.materialCount !== ''
      ? String(summary.materialCount)
      : '—';

  const updateText = useMemo(() => {
    if (summary.updateTime != null && summary.updateTime !== '') {
      const t = summary.updateTime;
      if (typeof t === 'number') {
        const ms = t < 1e12 ? t * 1000 : t;
        return dayjs(ms).format('YYYY-MM-DD HH:mm:ss');
      }
      return String(t);
    }
    if (fetchedAt) return dayjs(fetchedAt).format('YYYY-MM-DD HH:mm:ss');
    return '—';
  }, [summary.updateTime, fetchedAt]);

  return (
    <div className="gdd-domestic-shortcut" aria-busy={loading}>
      <div className="gdd-domestic-shortcut__row gdd-domestic-shortcut__row--tags">
        <span className="gdd-domestic-shortcut__label">推荐：</span>
        <div className="gdd-domestic-shortcut__tags">
          {DOMESTIC_RECOMMENDED_TAGS.map((tag) => {
            const isAll = tag === '全部';
            const active = isAll ? !recommendedKey : recommendedKey === tag;
            return (
              <button
                key={tag}
                type="button"
                className={`gdd-domestic-shortcut__tag${active ? ' is-active' : ''}${isAll ? ' is-all' : ''}`}
                disabled={loading}
                onClick={() => onRecommendedSelect?.(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
      <div className="gdd-domestic-shortcut__row gdd-domestic-shortcut__row--meta">
        <div className="gdd-domestic-shortcut__meta">
          <span>创意组{creativeApprox != null ? `约为 ${creativeApprox}` : ' —'}</span>
          <span className="gdd-domestic-shortcut__meta-sep">，</span>
          <span>素材数 {materialText}</span>
          <span className="gdd-domestic-shortcut__meta-sep">，</span>
          <span>更新时间：{updateText}</span>
        </div>
        <Select
          className="gdd-domestic-shortcut__sort"
          value={sort ?? 1}
          onChange={onSortChange}
          disabled={loading}
          options={DOMESTIC_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          popupMatchSelectWidth={false}
        />
      </div>
    </div>
  );
}

export default GuangdadaDomesticShortcutBar;
