import React, { useState, useRef } from 'react';
import { Button, Modal, Radio, message } from 'antd';
import CreativeCardInsightrackr from './CreativeCardInsightrackr';
import CreativeCardGuangdada from './CreativeCardGuangdada';
import GuangdadaDetailModal from './GuangdadaDetailModal';
import InsightrackrDetailModal from './InsightrackrDetailModal';
import SortSelector from './SortSelector';
import Pagination from './Pagination';
import { useDownloadList } from '../contexts/DownloadListContext';
import {
  getBatchItemId,
  getBatchDownloadInfo,
  BATCH_DOWNLOAD_SIZE_OPTIONS,
  processAndDownloadItem,
} from '../utils/batchDownloadProcessor';

function DataDisplay({
  data,
  platform,
  onSortChange,
  currentSearchParams,
  countData,
  mediaDistribute = {},
  appDistribute = {},
  onPageChange,
  batchDownloadMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAllPage,
  onBatchDownloadCancel,
  onEnterBatchMode,
  onBatchModeEnteredWithHint,
}) {
  const startDownloadBtnRef = useRef(null);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [guangdadaDetailItem, setGuangdadaDetailItem] = useState(null);
  const [insightrackrDetailItem, setInsightrackrDetailItem] = useState(null);
  /** 单卡片点击「下载视频」时暂存该项，弹窗确认后按所选尺寸下载 */
  const [pendingSingleDownloadItem, setPendingSingleDownloadItem] = useState(null);
  const { downloadList, setDownloadList, downloading, setDownloading, setBatchSizeLabel } = useDownloadList();
  if (!data) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
      </div>
    );
  }

  // 调试：输出数据结构
  console.log(`[${platform}] 数据提取 - 原始数据:`, data);
  console.log(`[${platform}] 数据提取 - data.data:`, data.data);
  if (data.data && data.data.data) {
    console.log(`[${platform}] 数据提取 - data.data.data:`, data.data.data);
    console.log(`[${platform}] 数据提取 - data.data.data.creative_list:`, data.data.data.creative_list);
  }

  // 检查是否有错误信息
  if (data.code && data.code !== 200 && data.message) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p className="error-message">{data.message}</p>
        </div>
      </div>
    );
  }

  // 提取列表数据
  let dataList = [];
  
  // 优先检查 creative_list 字段（广大大平台）
  // 注意：即使 platform 是 undefined，也要检查 creative_list
  if (data.data && data.data.creative_list && Array.isArray(data.data.creative_list)) {
    dataList = data.data.creative_list;
    console.log(`[${platform || 'guangdada'}] ✅ 从 data.data.creative_list 提取到 ${dataList.length} 条数据`);
  } else if (data.data && data.data.data && data.data.data.creative_list && Array.isArray(data.data.data.creative_list)) {
    dataList = data.data.data.creative_list;
    console.log(`[${platform || 'guangdada'}] ✅ 从 data.data.data.creative_list 提取到 ${dataList.length} 条数据`);
  } else if (data.creative_list && Array.isArray(data.creative_list)) {
    dataList = data.creative_list;
    console.log(`[${platform || 'guangdada'}] ✅ 从 data.creative_list 提取到 ${dataList.length} 条数据`);
  } else if (data.list && Array.isArray(data.list)) {
    // Insightrackr 平台：data.list
    dataList = data.list;
    console.log(`[${platform || 'insightrackr'}] ✅ 从 data.list 提取到 ${dataList.length} 条数据`);
  } else if (Array.isArray(data)) {
    dataList = data;
    console.log(`[${platform || 'unknown'}] ✅ 从 data (数组) 提取到 ${dataList.length} 条数据`);
  } else if (data.data) {
    if (Array.isArray(data.data)) {
      dataList = data.data;
      console.log(`[${platform || 'unknown'}] ✅ 从 data.data (数组) 提取到 ${dataList.length} 条数据`);
    } else if (data.data.list && Array.isArray(data.data.list)) {
      dataList = data.data.list;
      console.log(`[${platform || 'insightrackr'}] ✅ 从 data.data.list 提取到 ${dataList.length} 条数据`);
    } else if (data.data.data && Array.isArray(data.data.data)) {
      dataList = data.data.data;
      console.log(`[${platform || 'unknown'}] ✅ 从 data.data.data 提取到 ${dataList.length} 条数据`);
    } else if (data.data.items && Array.isArray(data.data.items)) {
      dataList = data.data.items;
      console.log(`[${platform || 'unknown'}] ✅ 从 data.data.items 提取到 ${dataList.length} 条数据`);
    }
  } else if (data.items && Array.isArray(data.items)) {
    dataList = data.items;
    console.log(`[${platform || 'unknown'}] ✅ 从 data.items 提取到 ${dataList.length} 条数据`);
  }
  
  console.log(`[${platform || 'unknown'}] 最终提取到的数据列表长度:`, dataList.length);
  
  // 如果还是没有找到数据，输出详细调试信息
  if (dataList.length === 0) {
    console.warn(`[${platform || 'unknown'}] ⚠️ 未找到数据，完整数据结构:`, {
      'data.data': data.data,
      'data.data.creative_list': data.data?.creative_list,
      'data.data.data': data.data?.data,
      'data.data.data.creative_list': data.data?.data?.creative_list,
      'data.list': data.list,
      'data.creative_list': data.creative_list,
      '完整数据': data
    });
  }

  if (dataList.length === 0) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
      </div>
    );
  }

  // 处理排序变化
  const handleSortChange = (newSortParams) => {
    if (onSortChange && currentSearchParams) {
      // 更新搜索参数并重新搜索
      const updatedParams = {
        ...currentSearchParams,
        baseOption: {
          ...(currentSearchParams.baseOption || {}),
          sortField: newSortParams.sortField,
          sortRule: newSortParams.sortRule
        }
      };
      onSortChange(updatedParams);
    }
  };

  // 从currentSearchParams中获取排序信息
  const sortField = currentSearchParams?.baseOption?.sortField || '8';
  const sortRule = currentSearchParams?.baseOption?.sortRule || 'desc';
  
  // 分页信息：Insightrackr 用 countData.totalSize；广大大用 count 接口的 result_total，无 count 时回退 data.data.total_count
  const countInfo = countData?.data || countData;
  const totalSize = platform === 'guangdada'
    ? (countInfo?.result_total ?? data?.data?.total_count ?? data?.total_count ?? 0)
    : (countInfo?.totalSize ?? 0);
  const newNum = countInfo?.newNum ?? 0;
  const latestDate = countInfo?.latestDate ?? '';
  const currentPage = platform === 'guangdada'
    ? (currentSearchParams?.page ?? 1)
    : (currentSearchParams?.baseOption?.pageIndex || 1);
  const pageSize = platform === 'guangdada'
    ? (currentSearchParams?.pageSize ?? 60)
    : (currentSearchParams?.baseOption?.pageSize || 60);

  const pageItemIds = dataList.map((item) => getBatchItemId(item, platform));
  const handleSelectAllPage = () => {
    if (onSelectAllPage) onSelectAllPage(pageItemIds);
  };
  const handleConfirmDownload = () => {
    setPendingSingleDownloadItem(null);
    setSizeModalOpen(true);
  };

  /** 卡片内点击「下载视频」时调用，弹出尺寸选择后下载该条视频 */
  const handleRequestVideoDownload = (item) => {
    setPendingSingleDownloadItem(item);
    setSizeModalOpen(true);
  };

  const updateDownloadItem = (list, id, updates) =>
    list.map((item) => (item.id === id ? { ...item, ...updates } : item));

  const handleStartBatchDownload = async () => {
    const opt = BATCH_DOWNLOAD_SIZE_OPTIONS[selectedSizeIndex];
    const targetW = opt.originalSize ? null : opt.width;
    const targetH = opt.originalSize ? null : opt.height;
    const isSingle = !!pendingSingleDownloadItem;
    const selectedItems = isSingle
      ? (() => {
          const info = getBatchDownloadInfo(pendingSingleDownloadItem, platform);
          const id = getBatchItemId(pendingSingleDownloadItem, platform);
          return info.url ? [{ ...info, id }] : [];
        })()
      : dataList
          .filter((item) => selectedIds.has(getBatchItemId(item, platform)))
          .map((item) => {
            const info = getBatchDownloadInfo(item, platform);
            return { ...info, id: getBatchItemId(item, platform) };
          })
          .filter((x) => x.url);
    if (selectedItems.length === 0) {
      message.warning(isSingle ? '该素材没有可下载的 URL' : '所选素材中没有可下载的 URL');
      setSizeModalOpen(false);
      setPendingSingleDownloadItem(null);
      return;
    }
    const initialList = selectedItems.map((one) => ({
      id: one.id,
      filename: one.filename,
      isVideo: one.isVideo,
      status: 'pending',
      progress: 0,
      errorMessage: null,
    }));
    setDownloadList(initialList);
    setBatchSizeLabel(opt.label || '');
    setDownloading(true);
    setSizeModalOpen(false);
    setPendingSingleDownloadItem(null);
    onBatchDownloadCancel?.();

    const CONCURRENCY = 3;
    let nextIndex = 0;
    const runOne = async () => {
      while (nextIndex < selectedItems.length) {
        const one = selectedItems[nextIndex++];
        setDownloadList((prev) => updateDownloadItem(prev, one.id, { status: 'processing', progress: 0 }));
        try {
          await processAndDownloadItem(one, targetW, targetH, (percent) => {
            setDownloadList((prev) => updateDownloadItem(prev, one.id, { progress: percent ?? 100 }));
          });
          setDownloadList((prev) => updateDownloadItem(prev, one.id, { status: 'done', progress: 100 }));
        } catch (e) {
          const msg = e?.message || String(e);
          console.error('[批量下载] 单条失败:', one.filename, one.id, e);
          setDownloadList((prev) =>
            updateDownloadItem(prev, one.id, { status: 'error', errorMessage: msg })
          );
          message.error(`下载失败: ${one.filename}（${msg}）`);
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, selectedItems.length) }, runOne));
    } finally {
      setDownloading(false);
      const doneCount = initialList.length;
      message.success(doneCount === 1 ? '已加入下载列表，请点击右上角「下载列表」查看' : `已处理 ${doneCount} 个素材，请点击右上角「下载列表」查看`);
    }
  };

  return (
    <div className="data-container">
      <div className="data-content">
        {!batchDownloadMode ? (
          <div className="batch-download-toolbar">
            <Button type="primary" ghost onClick={onEnterBatchMode}>
              批量下载
            </Button>
          </div>
        ) : (
          <div className="batch-download-toolbar batch-download-toolbar--active">
            <Button type="primary" ghost onClick={handleSelectAllPage}>
              全选本页
            </Button>
            <Button type="primary" onClick={handleConfirmDownload} disabled={selectedIds.size === 0}>
              确认下载 ({selectedIds.size})
            </Button>
            <Button onClick={onBatchDownloadCancel}>取消</Button>
          </div>
        )}
        <div className="results-container">
          {dataList.map((item, index) => {
            const key = item.ad_key || item.id || item.search_flag || index;
            const creativeId = item.id || item.search_flag || item.ad_key || item.bizId || item.materialId;
            const itemId = getBatchItemId(item, platform);
            const cardBatchProps = {
              batchMode: batchDownloadMode,
              selected: selectedIds.has(itemId),
              onToggleSelect: () => onToggleSelect && onToggleSelect(itemId),
              onEnterBatchMode: batchDownloadMode ? undefined : onEnterBatchMode,
            };
            if (platform === 'guangdada') {
              return (
                <CreativeCardGuangdada
                  key={key}
                  item={item}
                  onOpenDetail={() => setGuangdadaDetailItem(item)}
                  onRequestVideoDownload={handleRequestVideoDownload}
                  {...cardBatchProps}
                />
              );
            } else {
              return (
                <CreativeCardInsightrackr
                  key={key}
                  item={item}
                  sortField={sortField}
                  sortRule={sortRule}
                  mediaChannels={creativeId ? (mediaDistribute[creativeId] || []) : []}
                  appList={creativeId ? (appDistribute[creativeId] || []) : []}
                  onOpenDetail={() => setInsightrackrDetailItem(item)}
                  onRequestVideoDownload={handleRequestVideoDownload}
                  {...cardBatchProps}
                />
              );
            }
          })}
        </div>
      </div>
      {platform === 'guangdada' && (
        <GuangdadaDetailModal
          item={guangdadaDetailItem}
          open={!!guangdadaDetailItem}
          onClose={() => setGuangdadaDetailItem(null)}
          onRequestDownload={handleRequestVideoDownload}
        />
      )}
      {platform === 'insightrackr' && (
        <InsightrackrDetailModal
          item={insightrackrDetailItem}
          mediaChannels={insightrackrDetailItem ? (mediaDistribute[insightrackrDetailItem.ad_key || insightrackrDetailItem.id || insightrackrDetailItem.search_flag] || []) : []}
          appList={insightrackrDetailItem ? (appDistribute[insightrackrDetailItem.ad_key || insightrackrDetailItem.id || insightrackrDetailItem.search_flag] || []) : []}
          open={!!insightrackrDetailItem}
          onClose={() => setInsightrackrDetailItem(null)}
          onRequestVideoDownload={handleRequestVideoDownload}
        />
      )}
      {totalSize > 0 && (
        <Pagination
          totalSize={totalSize}
          newNum={newNum}
          latestDate={latestDate}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={onPageChange}
          showStats={platform !== 'guangdada'}
        />
      )}
      <Modal
        title="选择输出尺寸"
        open={sizeModalOpen}
        zIndex={1060}
        onCancel={() => { setSizeModalOpen(false); setPendingSingleDownloadItem(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setSizeModalOpen(false); setPendingSingleDownloadItem(null); }}>取消</Button>,
          <Button
            key="ok"
            ref={startDownloadBtnRef}
            type="primary"
            loading={downloading}
            disabled={!pendingSingleDownloadItem && selectedIds.size === 0}
            onClick={() => {
              if (onBatchModeEnteredWithHint && startDownloadBtnRef.current) {
                onBatchModeEnteredWithHint(startDownloadBtnRef.current.getBoundingClientRect());
              }
              handleStartBatchDownload();
            }}
          >
            开始下载
          </Button>,
        ]}
      >
        {!pendingSingleDownloadItem && selectedIds.size === 0 ? (
          <p style={{ color: '#faad14', margin: 0 }}>请先勾选要下载的素材，再确认下载。</p>
        ) : (
          <Radio.Group
            value={selectedSizeIndex}
            onChange={(e) => setSelectedSizeIndex(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {BATCH_DOWNLOAD_SIZE_OPTIONS.map((opt, i) => (
              <Radio key={i} value={i}>
                {opt.label}
              </Radio>
            ))}
          </Radio.Group>
        )}
      </Modal>
    </div>
  );
}

export default DataDisplay;
