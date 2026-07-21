import { useCallback, useState } from 'react';
import { Button, message } from 'antd';
import { useMaterialProcessing } from '../../../contexts/MaterialProcessingContext';
import BatchDownloadSizeModal from '../../../components/BatchDownloadSizeModal.jsx';
import {
  getBatchItemId,
  getBatchDownloadInfo,
  getCompetitorName,
  buildDownloadBaseName,
  getMediaDimensions,
  isSameAspectRatio,
  CUSTOM_SIZE_INDEX,
  CUSTOM_SIZE_MIN,
  CUSTOM_SIZE_MAX,
} from '../../../utils/batchDownloadProcessor';

const PLATFORM = 'sensortower';
const SOURCE_LABEL = 'Sensor Tower 素材下载';

function withAppName(creative, appsById) {
  const app = appsById?.get?.(creative?.unified_app_id);
  return {
    ...creative,
    unified_app_name: app?.name || creative?.unified_app_name || '',
  };
}

export function useGalleryBatchDownload(creativesRows, appsById) {
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const { startBatch } = useMaterialProcessing();

  const enterBatchMode = useCallback(() => setBatchMode(true), []);

  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((itemId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const openBatchDownloadModal = useCallback(() => {
    setPendingItem(null);
    setSizeModalOpen(true);
  }, []);

  const requestSingleDownload = useCallback((creative) => {
    setPendingItem(withAppName(creative, appsById));
    setSizeModalOpen(true);
  }, [appsById]);

  const closeSizeModal = useCallback(() => {
    setSizeModalOpen(false);
    setPendingItem(null);
  }, []);

  const handleConfirmDownload = useCallback(
    async ({ selectedSizeIndices, sameRatioByIndex, customSizeWidth, customSizeHeight, getSizeOptionAtIndex }) => {
      if (selectedSizeIndices.length === 0) {
        message.warning('请至少选择一种输出尺寸');
        return;
      }
      if (selectedSizeIndices.includes(CUSTOM_SIZE_INDEX)) {
        const w = Number(customSizeWidth);
        const h = Number(customSizeHeight);
        if (
          !Number.isInteger(w) ||
          w < CUSTOM_SIZE_MIN ||
          w > CUSTOM_SIZE_MAX ||
          !Number.isInteger(h) ||
          h < CUSTOM_SIZE_MIN ||
          h > CUSTOM_SIZE_MAX
        ) {
          message.warning(`自定义尺寸宽、高须为 ${CUSTOM_SIZE_MIN}～${CUSTOM_SIZE_MAX} 之间的整数`);
          return;
        }
      }

      const isSingle = !!pendingItem;
      const selectedItems = isSingle
        ? (() => {
            const raw = pendingItem;
            const info = getBatchDownloadInfo(raw, PLATFORM);
            const id = getBatchItemId(raw, PLATFORM);
            return info.url ? [{ ...info, id, rawItem: raw }] : [];
          })()
        : creativesRows
            .filter((row) => selectedIds.has(getBatchItemId(withAppName(row, appsById), PLATFORM)))
            .map((row) => {
              const raw = withAppName(row, appsById);
              const info = getBatchDownloadInfo(raw, PLATFORM);
              return { ...info, id: getBatchItemId(raw, PLATFORM), rawItem: raw };
            })
            .filter((x) => x.url);

      if (selectedItems.length === 0) {
        message.warning(isSingle ? '该素材没有可下载的 URL' : '所选素材中没有可下载的 URL');
        closeSizeModal();
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const taskDefs = [];
      for (const one of selectedItems) {
        for (const sizeIndex of selectedSizeIndices) {
          const opt = getSizeOptionAtIndex(sizeIndex);
          const sizeLabel = opt.originalSize ? '原尺寸' : `${opt.width}×${opt.height}`;
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
              getCompetitorName(one.rawItem, PLATFORM),
              dateStr,
              one.id,
              sizeLabel.replace(/×/g, 'x')
            ),
            sizeLabel,
            sourceUrl: one.url,
            sourceLabel: getCompetitorName(one.rawItem, PLATFORM) || one.filename,
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
                getCompetitorName(one.rawItem, PLATFORM),
                dateStr,
                one.id,
                sizeLabel.replace(/×/g, 'x')
              ),
            },
          });
        }
      }

      closeSizeModal();
      exitBatchMode();

      try {
        await startBatch({
          source: PLATFORM,
          sourceLabel: SOURCE_LABEL,
          tasks: taskDefs,
        });
        message.success(
          taskDefs.length === 1
            ? '已加入下载列表，请点击右上角「下载列表」查看'
            : `已加入下载队列，共 ${taskDefs.length} 个任务，请点击右上角「下载列表」查看`
        );
      } catch (e) {
        message.error(e?.message || '批量下载启动失败');
      }
    },
    [pendingItem, creativesRows, selectedIds, appsById, closeSizeModal, exitBatchMode, startBatch]
  );

  const getCardBatchProps = useCallback(
    (creative) => {
      const enriched = withAppName(creative, appsById);
      const itemId = getBatchItemId(enriched, PLATFORM);
      return {
        batchMode,
        selected: selectedIds.has(itemId),
        onToggleSelect: () => toggleSelect(itemId),
        onEnterBatchMode: batchMode ? undefined : enterBatchMode,
        onRequestDownload: () => requestSingleDownload(creative),
      };
    },
    [appsById, batchMode, selectedIds, toggleSelect, enterBatchMode, requestSingleDownload]
  );

  const batchToolbar =
    creativesRows.length > 0 ? (
      !batchMode ? (
        <div className="batch-download-toolbar">
          <Button type="primary" ghost onClick={enterBatchMode}>
            批量下载
          </Button>
        </div>
      ) : (
        <div className="batch-download-toolbar batch-download-toolbar--active">
          <Button type="primary" onClick={openBatchDownloadModal} disabled={selectedIds.size === 0}>
            确认下载 ({selectedIds.size})
          </Button>
          <Button onClick={exitBatchMode}>取消</Button>
        </div>
      )
    ) : null;

  const sizeModal = (
    <BatchDownloadSizeModal
      open={sizeModalOpen}
      onClose={closeSizeModal}
      onConfirm={handleConfirmDownload}
      emptySelection={!pendingItem && selectedIds.size === 0}
    />
  );

  return {
    batchMode,
    batchToolbar,
    sizeModal,
    getCardBatchProps,
  };
}
