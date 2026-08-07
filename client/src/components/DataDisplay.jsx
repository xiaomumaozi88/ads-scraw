import React, { useState, useRef } from 'react';
import { Button, Modal, Checkbox, Tooltip, message, InputNumber } from 'antd';
import CreativeCardInsightrackr from './CreativeCardInsightrackr';
import CreativeCardGuangdada from './CreativeCardGuangdada';
import GuangdadaDetailModal from './GuangdadaDetailModal';
import GuangdadaDomesticResults from './GuangdadaDomesticResults';
import './GuangdadaDomesticResults.css';
import InsightrackrDetailModal from './InsightrackrDetailModal';
import SortSelector from './SortSelector';
import Pagination from './Pagination';
import { useMaterialProcessing } from '../contexts/MaterialProcessingContext';
import {
  getBatchItemId,
  getBatchDownloadInfo,
  BATCH_DOWNLOAD_SIZE_OPTIONS,
  CUSTOM_SIZE_INDEX,
  CUSTOM_SIZE_MIN,
  CUSTOM_SIZE_MAX,
  getMediaDimensions,
  isSameAspectRatio,
  getCompetitorName,
  buildDownloadBaseName,
} from '../utils/batchDownloadProcessor';
import FolderPickerField from './FolderPickerField';
import {
  getDomesticAdInfoListItems,
  getDomesticAdInfoRootMeta,
  DOMESTIC_AD_INFO_PAGE_SIZE,
} from '../utils/guangdadaDomesticAdInfo';
import {
  GUANGDADA_DISPLAY_PAGE_SIZE,
  getGuangdadaDisplayOffset,
  getGuangdadaDisplayPageFromParams,
} from '../utils/guangdadaPaging';
import { scrollPageToTop } from '../utils/scrollToTop';

function DataDisplay({
  data,
  /** 广大大国内版 BBA 列表响应：与 data 二选一，用于复用尺寸选择弹窗与下载队列 */
  domesticAdInfoResult = null,
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
  onBatchDownloadCancel,
  onEnterBatchMode,
  onBatchModeEnteredWithHint,
  onExitBatchMode,
  onBlockAdvertiser,
  onGuangdadaDownloadQuotaConsume,
  onGuangdadaQuotaChanged,
}) {
  const isDomesticGuangdadaView = platform === 'guangdada' && domesticAdInfoResult != null;
  const rootRef = useRef(null);
  const startDownloadBtnRef = useRef(null);
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
  const [downloadSubmitting, setDownloadSubmitting] = useState(false);
  const { startBatch } = useMaterialProcessing();
  const scrollToTop = () => {
    scrollPageToTop(rootRef.current);
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

  if (!isDomesticGuangdadaView && !data) {
    return (
      <div ref={rootRef} className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
        {backToTopBtn}
      </div>
    );
  }

  // 检查是否有错误信息（国内版常用 status 20000）
  if (!isDomesticGuangdadaView && data.code != null && data.code !== 200 && data.message) {
    return (
      <div ref={rootRef} className="data-container data-container--empty">
        <div className="data-placeholder">
          <p className="error-message">{data.message}</p>
        </div>
        {backToTopBtn}
      </div>
    );
  }

  // 提取列表数据
  let dataList = [];

  if (isDomesticGuangdadaView) {
    dataList = getDomesticAdInfoListItems(domesticAdInfoResult);
  } else {
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
  }

  const isGuangdadaSplitPage = platform === 'guangdada' && !isDomesticGuangdadaView;
  const guangdadaDisplayPage = isGuangdadaSplitPage
    ? getGuangdadaDisplayPageFromParams(currentSearchParams)
    : null;
  const guangdadaDisplayOffset = isGuangdadaSplitPage ? getGuangdadaDisplayOffset(guangdadaDisplayPage) : 0;
  const displayDataList = isGuangdadaSplitPage
    ? dataList.slice(guangdadaDisplayOffset, guangdadaDisplayOffset + GUANGDADA_DISPLAY_PAGE_SIZE)
    : dataList;

  if (displayDataList.length === 0 && !isDomesticGuangdadaView) {
    return (
      <div ref={rootRef} className="data-container data-container--empty">
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
  const domesticMeta = isDomesticGuangdadaView ? getDomesticAdInfoRootMeta(domesticAdInfoResult) : null;
  const totalSize = isDomesticGuangdadaView
    ? (domesticMeta?.total != null ? domesticMeta.total : 0)
    : platform === 'guangdada'
      ? (countInfo?.result_total ?? data?.data?.total_count ?? data?.total_count ?? 0)
      : (countInfo?.totalSize ?? 0);
  const newNum = countInfo?.newNum ?? 0;
  const latestDate = countInfo?.latestDate ?? '';
  const currentPage = platform === 'guangdada'
    ? (isDomesticGuangdadaView ? (currentSearchParams?.page ?? 1) : guangdadaDisplayPage)
    : (currentSearchParams?.baseOption?.pageIndex || 1);
  const pageSize = isDomesticGuangdadaView
    ? (currentSearchParams?.pageSize ?? DOMESTIC_AD_INFO_PAGE_SIZE)
    : platform === 'guangdada'
      ? GUANGDADA_DISPLAY_PAGE_SIZE
      : (currentSearchParams?.baseOption?.pageSize || 60);

  const handleConfirmDownload = () => {
    setPendingSingleDownloadItem(null);
    setSizeModalOpen(true);
  };

  /** 卡片内点击「下载视频」时调用，弹出尺寸选择后下载该条视频 */
  const handleRequestVideoDownload = (item) => {
    setPendingSingleDownloadItem(item);
    setSizeModalOpen(true);
  };

  const SOURCE_LABELS = {
    insightrackr: 'Insightrackr 素材下载',
    guangdada: '广大大 素材下载',
    sensortower: 'Sensor Tower 素材下载',
  };

  const handleStartBatchDownload = async () => {
    if (downloadSubmitting) return;
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
    setDownloadSubmitting(true);
    try {
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
      const taskDefs = [];
      for (const one of selectedItems) {
        const effectiveSizeIndices = one.isHtml ? [0] : selectedSizeIndices;
        for (const sizeIndex of effectiveSizeIndices) {
          const opt = one.isHtml
            ? { label: 'HTML', width: null, height: null, originalSize: true }
            : getSizeOptionAtIndex(sizeIndex);
          const sizeLabel = one.isHtml ? 'HTML' : opt.originalSize ? '原尺寸' : `${opt.width}×${opt.height}`;
          const targetW = opt.originalSize ? null : opt.width;
          const targetH = opt.originalSize ? null : opt.height;
          let useW = targetW;
          let useH = targetH;
          const useSameRatioOriginal = sameRatioByIndex[sizeIndex];
          if (useSameRatioOriginal && targetW != null && targetH != null && !one.isHtml) {
            const dims = await getMediaDimensions(one.url, one.isVideo);
            if (dims && isSameAspectRatio(dims.width, dims.height, targetW, targetH)) {
              useW = null;
              useH = null;
            }
          }
          const dims = !one.isHtml ? await getMediaDimensions(one.url, one.isVideo) : null;
          taskDefs.push({
            filename: buildDownloadBaseName(
              getCompetitorName(one.rawItem, platform),
              dateStr,
              one.id,
              sizeLabel.replace(/×/g, 'x')
            ),
            sizeLabel,
            sourceUrl: one.url,
            sourceLabel: getCompetitorName(one.rawItem, platform) || one.filename,
            originalWidth: dims?.width ?? null,
            originalHeight: dims?.height ?? null,
            targetWidth: useW,
            targetHeight: useH,
            isVideo: one.isVideo,
            isHtml: one.isHtml,
            sourceType: 'remote',
            processPayload: {
              url: one.url,
              isVideo: one.isVideo,
              isHtml: one.isHtml,
              filename: one.filename,
              targetW: useW,
              targetH: useH,
              baseFilename: buildDownloadBaseName(
                getCompetitorName(one.rawItem, platform),
                dateStr,
                one.id,
                sizeLabel.replace(/×/g, 'x')
              ),
            },
          });
        }
      }

      if (platform === 'guangdada' && typeof onGuangdadaDownloadQuotaConsume === 'function') {
        const ok = await onGuangdadaDownloadQuotaConsume({
          amount: taskDefs.length,
          metadata: {
            action: isSingle ? 'single_material_download' : 'batch_material_download',
            selectedItemCount: selectedItems.length,
            taskCount: taskDefs.length,
            sourceUrls: taskDefs.map((task) => task.sourceUrl).filter(Boolean).slice(0, 20),
            sizeLabels: selectedSizes.map((size) => size.label),
          },
        });
        if (!ok) return;
      }

      setSizeModalOpen(false);
      setPendingSingleDownloadItem(null);
      onBatchDownloadCancel?.();

      await startBatch({
        source: platform,
        sourceLabel: SOURCE_LABELS[platform] || `${platform} 素材下载`,
        tasks: taskDefs,
      });
      message.success(
        taskDefs.length === 1
          ? '已加入下载列表，请点击右上角「下载列表」查看'
          : `已加入下载队列，共 ${taskDefs.length} 个任务，请点击右上角「下载列表」查看`
      );
    } catch (e) {
      message.error(e?.message || '批量下载启动失败');
    } finally {
      setDownloadSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="data-container">
      <div className="data-content">
        {displayDataList.length > 0 &&
          (!batchDownloadMode ? (
            <div className="batch-download-toolbar">
              <Button type="primary" ghost onClick={onEnterBatchMode}>
                批量下载
              </Button>
            </div>
          ) : (
            <div className="batch-download-toolbar batch-download-toolbar--active">
              <Button type="primary" onClick={handleConfirmDownload} disabled={selectedIds.size === 0}>
                确认下载 ({selectedIds.size})
              </Button>
              <Button onClick={onBatchDownloadCancel}>取消</Button>
            </div>
          ))}
        {isDomesticGuangdadaView ? (
          displayDataList.length === 0 ? (
            <div className="gdd-results gdd-results--empty">
              <p>本次查询未返回列表数据（或结构异常）。</p>
              <p className="gdd-results__hint">
                请确认接口 <code>status</code> 为成功且 <code>data.data</code> 为数组。
              </p>
            </div>
          ) : (
            <GuangdadaDomesticResults
              result={domesticAdInfoResult}
              onRequestDownload={handleRequestVideoDownload}
              batchDownloadMode={batchDownloadMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onEnterBatchMode={onEnterBatchMode}
            />
          )
        ) : (
          <div
            className={`results-container${platform === 'insightrackr' && currentSearchParams?.insightrackrSearchTab === 'playable' ? ' results-container--playable' : ''}`}
          >
            {displayDataList.map((item, index) => {
              const displayIndex = guangdadaDisplayOffset + index;
              const key = item.ad_key || item.id || item.search_flag || displayIndex;
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
                    onBeforeDownload={(rawItem, meta) => onGuangdadaDownloadQuotaConsume?.({
                      amount: 1,
                      metadata: {
                        action: 'direct_material_download',
                        adKey: rawItem?.ad_key,
                        advertiserName: rawItem?.advertiser_name,
                        ...meta,
                      },
                    })}
                    {...cardBatchProps}
                  />
                );
              }
              return (
                <CreativeCardInsightrackr
                  key={key}
                  item={item}
                  sortField={sortField}
                  sortRule={sortRule}
                  mediaChannels={creativeId ? (mediaDistribute[creativeId] || []) : []}
                  appList={creativeId ? (appDistribute[creativeId] || []) : []}
                  isPlayable={platform === 'insightrackr' && currentSearchParams?.insightrackrSearchTab === 'playable'}
                  onOpenDetail={
                    platform === 'insightrackr' && currentSearchParams?.insightrackrSearchTab === 'playable'
                      ? undefined
                      : () => setInsightrackrDetailItem(item)
                  }
                  onRequestVideoDownload={handleRequestVideoDownload}
                  {...cardBatchProps}
                />
              );
            })}
          </div>
        )}
      </div>
      {platform === 'guangdada' && !isDomesticGuangdadaView && (
        <GuangdadaDetailModal
          item={guangdadaDetailItem}
          open={!!guangdadaDetailItem}
          onClose={() => setGuangdadaDetailItem(null)}
          onRequestDownload={handleRequestVideoDownload}
          onQuotaChanged={onGuangdadaQuotaChanged}
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
            loading={downloadSubmitting}
            disabled={
              downloadSubmitting ||
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
            <div style={{ marginBottom: 16 }}>
              <FolderPickerField size="small" />
            </div>
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
