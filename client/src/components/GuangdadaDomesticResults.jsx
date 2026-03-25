import React, { useMemo, useState, useCallback } from 'react';
import { getDomesticAdInfoListItems } from '../utils/guangdadaDomesticAdInfo';
import { getBatchItemId } from '../utils/batchDownloadProcessor';
import GuangdadaDomesticCreativeCard from './GuangdadaDomesticCreativeCard';
import GuangdadaDomesticDetailModal from './GuangdadaDomesticDetailModal';
import './GuangdadaDomesticResults.css';

/** 国内版 ad-info 列表区：卡片网格 */
function GuangdadaDomesticResults({
  result,
  onRequestDownload,
  batchDownloadMode = false,
  selectedIds,
  onToggleSelect,
  onEnterBatchMode,
}) {
  const list = useMemo(() => getDomesticAdInfoListItems(result), [result]);
  const [detailIndex, setDetailIndex] = useState(null);
  const detailOpen = detailIndex != null && detailIndex >= 0;
  const closeDetail = useCallback(() => setDetailIndex(null), []);
  const navigateDetail = useCallback((i) => setDetailIndex(i), []);

  if (!list.length) {
    return (
      <div className="gdd-results gdd-results--empty">
        <p>本次查询未返回列表数据（或结构异常）。</p>
        <p className="gdd-results__hint">请确认接口 <code>status</code> 为成功且 <code>data.data</code> 为数组。</p>
      </div>
    );
  }

  return (
    <div className="gdd-results">
      <div className="gdd-results__grid">
        {list.map((item, idx) => {
          const itemId = getBatchItemId(item, 'guangdada');
          return (
            <GuangdadaDomesticCreativeCard
              key={item.material_key || item.creative_id || `domestic-${idx}`}
              item={item}
              onOpenDetail={() => setDetailIndex(idx)}
              batchMode={batchDownloadMode}
              selected={selectedIds?.has(itemId) ?? false}
              onToggleSelect={() => onToggleSelect?.(itemId)}
              onEnterBatchMode={batchDownloadMode ? undefined : onEnterBatchMode}
            />
          );
        })}
      </div>
      <GuangdadaDomesticDetailModal
        open={detailOpen}
        onClose={closeDetail}
        list={list}
        index={detailIndex != null ? detailIndex : 0}
        onNavigate={navigateDetail}
        onRequestDownload={onRequestDownload}
      />
    </div>
  );
}

export default GuangdadaDomesticResults;
