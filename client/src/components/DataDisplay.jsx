import React, { useState } from 'react';
import { Button, Modal, Radio, message } from 'antd';
import CreativeCardInsightrackr from './CreativeCardInsightrackr';
import CreativeCardGuangdada from './CreativeCardGuangdada';
import SortSelector from './SortSelector';
import Pagination from './Pagination';
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
}) {
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  /** 下载处理列表：{ id, filename, isVideo, status: 'pending'|'processing'|'done'|'error', progress: 0-100, errorMessage? } */
  const [downloadList, setDownloadList] = useState([]);
  const [downloadListExpanded, setDownloadListExpanded] = useState(true);
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
    setSizeModalOpen(true);
  };

  const updateDownloadItem = (list, id, updates) =>
    list.map((item) => (item.id === id ? { ...item, ...updates } : item));

  const handleStartBatchDownload = async () => {
    const opt = BATCH_DOWNLOAD_SIZE_OPTIONS[selectedSizeIndex];
    const targetW = opt.width;
    const targetH = opt.height;
    const selectedItems = dataList
      .filter((item) => selectedIds.has(getBatchItemId(item, platform)))
      .map((item) => {
        const info = getBatchDownloadInfo(item, platform);
        return { ...info, id: getBatchItemId(item, platform) };
      })
      .filter((x) => x.url);
    if (selectedItems.length === 0) {
      message.warning('所选素材中没有可下载的 URL');
      setSizeModalOpen(false);
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
    setDownloadListExpanded(true);
    setDownloading(true);
    setSizeModalOpen(false);

    try {
      for (const one of selectedItems) {
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
    } finally {
      setDownloading(false);
      const doneCount = initialList.length;
      message.success(`已处理 ${doneCount} 个素材，请查看下方下载列表`);
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
            const cardBatchProps = batchDownloadMode
              ? {
                  batchMode: true,
                  selected: selectedIds.has(itemId),
                  onToggleSelect: () => onToggleSelect && onToggleSelect(itemId),
                }
              : {};
            if (platform === 'guangdada') {
              return (
                <CreativeCardGuangdada
                  key={key}
                  item={item}
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
                  {...cardBatchProps}
                />
              );
            }
          })}
        </div>
      </div>
      {downloadList.length > 0 && (
        <div className="download-list-panel">
          <div
            className="download-list-panel__header"
            onClick={() => setDownloadListExpanded((e) => !e)}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => ev.key === 'Enter' && setDownloadListExpanded((e) => !e)}
          >
            <span className="download-list-panel__title">
              下载处理列表 ({downloadList.length})
              {downloading && <span className="download-list-panel__badge">处理中</span>}
            </span>
            <span className={`download-list-panel__chevron ${downloadListExpanded ? 'is-expanded' : ''}`}>
              ▼
            </span>
          </div>
          {downloadListExpanded && (
            <div className="download-list-panel__body">
              {downloadList.map((item) => (
                <div
                  key={item.id}
                  className={`download-list-item download-list-item--${item.status}`}
                >
                  <div className="download-list-item__main">
                    <span className="download-list-item__filename" title={item.filename}>
                      {item.filename.length > 40 ? item.filename.slice(0, 38) + '…' : item.filename}
                    </span>
                    <span className="download-list-item__status">
                      {item.status === 'pending' && '等待中'}
                      {item.status === 'processing' && `处理中 ${Math.round(item.progress)}%`}
                      {item.status === 'done' && '已完成'}
                      {item.status === 'error' && (item.errorMessage || '失败')}
                    </span>
                  </div>
                  {(item.status === 'processing' || item.status === 'done') && (
                    <div className="download-list-item__progress-wrap">
                      <div
                        className="download-list-item__progress-bar"
                        style={{
                          width: `${item.status === 'processing' && item.progress < 100
                            ? Math.max(item.progress, 2)
                            : item.progress}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
        onCancel={() => setSizeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setSizeModalOpen(false)}>取消</Button>,
          <Button
            key="ok"
            type="primary"
            loading={downloading}
            disabled={selectedIds.size === 0}
            onClick={handleStartBatchDownload}
          >
            开始下载
          </Button>,
        ]}
      >
        {selectedIds.size === 0 ? (
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
