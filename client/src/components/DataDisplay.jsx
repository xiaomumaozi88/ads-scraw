import React, { useState, useRef } from 'react';
import { Button, Modal, Checkbox, Tooltip, message, InputNumber } from 'antd';
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
  CUSTOM_SIZE_INDEX,
  CUSTOM_SIZE_MIN,
  CUSTOM_SIZE_MAX,
  getMediaDimensions,
  isSameAspectRatio,
  getCompetitorName,
  buildDownloadBaseName,
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
  onExitBatchMode,
  onBlockAdvertiser,
}) {
  const startDownloadBtnRef = useRef(null);
  /** 批量下载时各任务进度缓存，避免并发 setState 互相覆盖导致「共用一个进度」 */
  const batchProgressRef = useRef({});
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  /** 多选尺寸：选中的尺寸下标数组，如 [0,1,3] 表示 原尺寸、720×1280、800×800；含 CUSTOM_SIZE_INDEX 表示自定义 */
  const [selectedSizeIndices, setSelectedSizeIndices] = useState([0]);
  /** 同比例按原图下载：按尺寸下标，仅对非原尺寸（i>0）有效；含自定义下标占位 */
  const [sameRatioByIndex, setSameRatioByIndex] = useState(() =>
    [...BATCH_DOWNLOAD_SIZE_OPTIONS.map(() => false), false]
  );
  /** 自定义尺寸宽、高（仅当选中「自定义尺寸」时生效），范围 CUSTOM_SIZE_MIN～CUSTOM_SIZE_MAX */
  const [customSizeWidth, setCustomSizeWidth] = useState(720);
  const [customSizeHeight, setCustomSizeHeight] = useState(1280);

  /** 根据下标取尺寸配置（预设或自定义） */
  const getSizeOptionAtIndex = (index) => {
    if (index === CUSTOM_SIZE_INDEX) {
      const w = Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, Math.floor(Number(customSizeWidth)) || CUSTOM_SIZE_MIN));
      const h = Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, Math.floor(Number(customSizeHeight)) || CUSTOM_SIZE_MIN));
      return { label: `自定义 ${w}×${h}`, width: w, height: h, originalSize: false };
    }
    return BATCH_DOWNLOAD_SIZE_OPTIONS[index];
  };

  const toggleSizeIndex = (index) => {
    setSelectedSizeIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };
  const [guangdadaDetailItem, setGuangdadaDetailItem] = useState(null);
  const [insightrackrDetailItem, setInsightrackrDetailItem] = useState(null);
  /** 单卡片点击「下载视频」时暂存该项，弹窗确认后按所选尺寸下载 */
  const [pendingSingleDownloadItem, setPendingSingleDownloadItem] = useState(null);
  const { downloadList, setDownloadList, downloading, setDownloading, setBatchSizeLabel } = useDownloadList();
  const scrollToTop = () => {
    const scrollEl = document.querySelector('.data-card');
    if (!scrollEl) return;
    const start = scrollEl.scrollTop;
    const startTime = performance.now();
    const duration = 180;
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - (1 - t) * (1 - t);
      scrollEl.scrollTop = start * (1 - ease);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const backToTopBtn = (
    <Tooltip title="点击回到顶部" placement="left">
      <button
        type="button"
        className="back-to-top"
        onClick={scrollToTop}
        aria-label="回到顶部"
      >
        ↑
      </button>
    </Tooltip>
  );

  if (!data) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
        {backToTopBtn}
      </div>
    );
  }

  // 检查是否有错误信息
  if (data.code && data.code !== 200 && data.message) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p className="error-message">{data.message}</p>
        </div>
        {backToTopBtn}
      </div>
    );
  }

  // 提取列表数据
  let dataList = [];
  
  // 优先检查 creative_list 字段（广大大平台）
  // 注意：即使 platform 是 undefined，也要检查 creative_list
  if (data.data && data.data.creative_list && Array.isArray(data.data.creative_list)) {
    dataList = data.data.creative_list;

  } else if (data.data && data.data.data && data.data.data.creative_list && Array.isArray(data.data.data.creative_list)) {
    dataList = data.data.data.creative_list;
  
  } else if (data.creative_list && Array.isArray(data.creative_list)) {
    dataList = data.creative_list;
  
  } else if (data.list && Array.isArray(data.list)) {
    // Insightrackr 平台：data.list
    dataList = data.list;
  } else if (Array.isArray(data)) {
    dataList = data;
  } else if (data.data) {
    if (Array.isArray(data.data)) {
      dataList = data.data;
    } else if (data.data.list && Array.isArray(data.data.list)) {
      dataList = data.data.list;
    } else if (data.data.data && Array.isArray(data.data.data)) {
      dataList = data.data.data;
    } else if (data.data.items && Array.isArray(data.data.items)) {
      dataList = data.data.items;
    }
  } else if (data.items && Array.isArray(data.items)) {
    dataList = data.items;
  }
  

  if (dataList.length === 0) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
        {backToTopBtn}
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
    if (selectedSizeIndices.length === 0) {
      message.warning('请至少选择一种输出尺寸');
      return;
    }
    if (selectedSizeIndices.includes(CUSTOM_SIZE_INDEX)) {
      const w = Number(customSizeWidth);
      const h = Number(customSizeHeight);
      if (!Number.isInteger(w) || w < CUSTOM_SIZE_MIN || w > CUSTOM_SIZE_MAX ||
          !Number.isInteger(h) || h < CUSTOM_SIZE_MIN || h > CUSTOM_SIZE_MAX) {
        message.warning(`自定义尺寸宽、高须为 ${CUSTOM_SIZE_MIN}～${CUSTOM_SIZE_MAX} 之间的整数`);
        return;
      }
    }
    const selectedSizes = selectedSizeIndices.map((i) => getSizeOptionAtIndex(i));
    const isSingle = !!pendingSingleDownloadItem;
    const selectedItems = isSingle
      ? (() => {
          const raw = pendingSingleDownloadItem;
          const info = getBatchDownloadInfo(raw, platform);
          const id = getBatchItemId(raw, platform);
          return info.url ? [{ ...info, id, rawItem: raw }] : [];
        })()
      : dataList
          .filter((item) => selectedIds.has(getBatchItemId(item, platform)))
          .map((item) => {
            const info = getBatchDownloadInfo(item, platform);
            return { ...info, id: getBatchItemId(item, platform), rawItem: item };
          })
          .filter((x) => x.url);
    if (selectedItems.length === 0) {
      message.warning(isSingle ? '该素材没有可下载的 URL' : '所选素材中没有可下载的 URL');
      setSizeModalOpen(false);
      setPendingSingleDownloadItem(null);
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const tasks = [];
    selectedItems.forEach((one) => {
      selectedSizeIndices.forEach((sizeIndex) => {
        const opt = getSizeOptionAtIndex(sizeIndex);
        const sizeLabel = opt.originalSize ? '原尺寸' : `${opt.width}x${opt.height}`;
        tasks.push({
          ...one,
          sizeOpt: opt,
          sizeIndex,
          taskId: `${one.id}_${sizeLabel}`,
          baseFilename: buildDownloadBaseName(
            getCompetitorName(one.rawItem, platform),
            dateStr,
            one.id,
            sizeLabel
          ),
        });
      });
    });
    const initialList = tasks.map((t) => ({
      id: t.taskId,
      filename: t.baseFilename,
      isVideo: t.isVideo,
      status: 'pending',
      progress: 0,
      errorMessage: null,
      sizeLabel: t.sizeOpt.originalSize ? '原尺寸' : `${t.sizeOpt.width}×${t.sizeOpt.height}`,
    }));
    setDownloadList(initialList);
    batchProgressRef.current = {};
    setBatchSizeLabel(selectedSizes.map((o) => o.label).join('、') || '');
    setDownloading(true);
    setSizeModalOpen(false);
    setPendingSingleDownloadItem(null);
    onBatchDownloadCancel?.();

    const CONCURRENCY = 3;
    let nextIndex = 0;
    const runOne = async () => {
      while (nextIndex < tasks.length) {
        const task = tasks[nextIndex++];
        const { sizeOpt, sizeIndex, taskId, baseFilename } = task;
        const targetW = sizeOpt.originalSize ? null : sizeOpt.width;
        const targetH = sizeOpt.originalSize ? null : sizeOpt.height;
        const useSameRatioOriginal = sameRatioByIndex[sizeIndex];
        setDownloadList((prev) => updateDownloadItem(prev, taskId, { status: 'processing', progress: 0 }));
        console.info('[批量下载] 开始:', baseFilename);
        try {
          let useW = targetW;
          let useH = targetH;
          if (useSameRatioOriginal && targetW != null && targetH != null && !task.isHtml) {
            const dims = await getMediaDimensions(task.url, task.isVideo);
            if (dims && isSameAspectRatio(dims.width, dims.height, targetW, targetH)) {
              useW = null;
              useH = null;
            }
          }
          await processAndDownloadItem(task, useW, useH, (percent) => {
            const p = Math.min(100, Math.max(0, percent ?? 100));
            batchProgressRef.current[taskId] = Math.max(batchProgressRef.current[taskId] ?? 0, p);
            setDownloadList((prev) =>
              prev.map((item) => ({
                ...item,
                progress: Math.max(item.progress, batchProgressRef.current[item.id] ?? 0),
              }))
            );
          }, baseFilename);
          console.info('[批量下载] 完成:', baseFilename);
          setDownloadList((prev) => updateDownloadItem(prev, taskId, { status: 'done', progress: 100 }));
        } catch (e) {
          const msg = e?.message || String(e);
          console.error('[批量下载] 失败:', baseFilename, msg);
          setDownloadList((prev) =>
            updateDownloadItem(prev, taskId, { status: 'error', errorMessage: msg })
          );
          message.error(`下载失败: ${baseFilename}（${msg}）`);
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, runOne));
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
        <div className={`results-container${platform === 'insightrackr' && currentSearchParams?.insightrackrSearchTab === 'playable' ? ' results-container--playable' : ''}`}>
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
                  onBlockAdvertiser={onBlockAdvertiser}
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
                  isPlayable={platform === 'insightrackr' && currentSearchParams?.insightrackrSearchTab === 'playable'}
                  onOpenDetail={platform === 'insightrackr' && currentSearchParams?.insightrackrSearchTab === 'playable' ? undefined : () => setInsightrackrDetailItem(item)}
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
        width={700}
        className="batch-download-size-modal"
        onCancel={() => { setSizeModalOpen(false); setPendingSingleDownloadItem(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setSizeModalOpen(false); setPendingSingleDownloadItem(null); }}>取消</Button>,
          <Button
            key="ok"
            ref={startDownloadBtnRef}
            type="primary"
            disabled={
              (!pendingSingleDownloadItem && selectedIds.size === 0) ||
              selectedSizeIndices.length === 0 ||
              (selectedSizeIndices.includes(CUSTOM_SIZE_INDEX) && (
                (() => {
                  const w = Number(customSizeWidth);
                  const h = Number(customSizeHeight);
                  return !Number.isInteger(w) || w < CUSTOM_SIZE_MIN || w > CUSTOM_SIZE_MAX ||
                    !Number.isInteger(h) || h < CUSTOM_SIZE_MIN || h > CUSTOM_SIZE_MAX;
                })()
              ))
            }
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
          <>
            <div style={{ marginBottom: 8 }}>可多选，每个素材将按所选尺寸各输出一份：</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BATCH_DOWNLOAD_SIZE_OPTIONS.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Checkbox
                    className="batch-download-size-option"
                    checked={selectedSizeIndices.includes(i)}
                    onChange={() => toggleSizeIndex(i)}
                  >
                    {opt.label}
                  </Checkbox>
                  {i !== 0 && selectedSizeIndices.includes(i) && (
                    <Tooltip title="当资源比例与所选尺寸比例一致时，直接下载原图">
                      <span className="batch-download-same-ratio-wrap">
                        <Checkbox
                          checked={sameRatioByIndex[i]}
                          onChange={(e) => {
                            setSameRatioByIndex((prev) => {
                              const next = [...prev];
                              next[i] = e.target.checked;
                              return next;
                            });
                          }}
                        >
                          同比例按原图下载
                        </Checkbox>
                      </span>
                    </Tooltip>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Checkbox
                  className="batch-download-size-option"
                  checked={selectedSizeIndices.includes(CUSTOM_SIZE_INDEX)}
                  onChange={() => toggleSizeIndex(CUSTOM_SIZE_INDEX)}
                >
                  自定义尺寸
                </Checkbox>
                {selectedSizeIndices.includes(CUSTOM_SIZE_INDEX) && (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ whiteSpace: 'nowrap' }}>
                        宽：<InputNumber
                          min={CUSTOM_SIZE_MIN}
                          max={CUSTOM_SIZE_MAX}
                          step={1}
                          value={customSizeWidth}
                          onChange={(v) => {
                            const n = v != null ? Math.round(Number(v)) : CUSTOM_SIZE_MIN;
                            setCustomSizeWidth(Number.isNaN(n) ? CUSTOM_SIZE_MIN : Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, n)));
                          }}
                          style={{ width: 96 }}
                        />
                      </label>
                      <label style={{ whiteSpace: 'nowrap' }}>
                        高：<InputNumber
                          min={CUSTOM_SIZE_MIN}
                          max={CUSTOM_SIZE_MAX}
                          step={1}
                          value={customSizeHeight}
                          onChange={(v) => {
                            const n = v != null ? Math.round(Number(v)) : CUSTOM_SIZE_MIN;
                            setCustomSizeHeight(Number.isNaN(n) ? CUSTOM_SIZE_MIN : Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, n)));
                          }}
                          style={{ width: 96 }}
                        />
                      </label>
                      <span style={{ color: '#999', fontSize: 12 }}>（{CUSTOM_SIZE_MIN}～{CUSTOM_SIZE_MAX} 像素）</span>
                    </span>
                    <Tooltip title="当资源比例与所选尺寸比例一致时，直接下载原图">
                      <span className="batch-download-same-ratio-wrap">
                        <Checkbox
                          checked={sameRatioByIndex[CUSTOM_SIZE_INDEX]}
                          onChange={(e) => {
                            setSameRatioByIndex((prev) => {
                              const next = [...prev];
                              next[CUSTOM_SIZE_INDEX] = e.target.checked;
                              return next;
                            });
                          }}
                        >
                          同比例按原图下载
                        </Checkbox>
                      </span>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
      {backToTopBtn}
    </div>
  );
}

export default DataDisplay;
