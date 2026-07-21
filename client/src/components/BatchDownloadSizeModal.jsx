import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Checkbox, Tooltip, InputNumber } from 'antd';
import FolderPickerField from './FolderPickerField.jsx';
import {
  BATCH_DOWNLOAD_SIZE_OPTIONS,
  CUSTOM_SIZE_INDEX,
  CUSTOM_SIZE_MIN,
  CUSTOM_SIZE_MAX,
} from '../utils/batchDownloadProcessor';

function BatchDownloadSizeModal({
  open,
  onClose,
  onConfirm,
  emptySelection = false,
}) {
  const startDownloadBtnRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSizeIndices, setSelectedSizeIndices] = useState([0]);
  const [sameRatioByIndex, setSameRatioByIndex] = useState(() =>
    [...BATCH_DOWNLOAD_SIZE_OPTIONS.map(() => false), false]
  );
  const [customSizeWidth, setCustomSizeWidth] = useState(720);
  const [customSizeHeight, setCustomSizeHeight] = useState(1280);

  useEffect(() => {
    if (!open) return;
    setSelectedSizeIndices([0]);
    setSameRatioByIndex([...BATCH_DOWNLOAD_SIZE_OPTIONS.map(() => false), false]);
    setCustomSizeWidth(720);
    setCustomSizeHeight(1280);
  }, [open]);

  const toggleSizeIndex = (index) => {
    setSelectedSizeIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const getSizeOptionAtIndex = (index) => {
    if (index === CUSTOM_SIZE_INDEX) {
      return {
        label: `自定义 ${customSizeWidth}×${customSizeHeight}`,
        width: customSizeWidth,
        height: customSizeHeight,
        originalSize: false,
      };
    }
    return BATCH_DOWNLOAD_SIZE_OPTIONS[index];
  };

  const customSizeInvalid = selectedSizeIndices.includes(CUSTOM_SIZE_INDEX) && (() => {
    const w = Number(customSizeWidth);
    const h = Number(customSizeHeight);
    return (
      !Number.isInteger(w) ||
      w < CUSTOM_SIZE_MIN ||
      w > CUSTOM_SIZE_MAX ||
      !Number.isInteger(h) ||
      h < CUSTOM_SIZE_MIN ||
      h > CUSTOM_SIZE_MAX
    );
  })();

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm?.({
        selectedSizeIndices,
        sameRatioByIndex,
        customSizeWidth,
        customSizeHeight,
        getSizeOptionAtIndex,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="选择输出尺寸"
      open={open}
      zIndex={1060}
      width={700}
      className="batch-download-size-modal"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="ok"
          ref={startDownloadBtnRef}
          type="primary"
          loading={submitting}
          disabled={
            submitting ||
            emptySelection ||
            selectedSizeIndices.length === 0 ||
            customSizeInvalid
          }
          onClick={handleConfirm}
        >
          开始下载
        </Button>,
      ]}
    >
      {emptySelection ? (
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
                {i !== 0 && selectedSizeIndices.includes(i) ? (
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
                ) : null}
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
              {selectedSizeIndices.includes(CUSTOM_SIZE_INDEX) ? (
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ whiteSpace: 'nowrap' }}>
                      宽：
                      <InputNumber
                        min={CUSTOM_SIZE_MIN}
                        max={CUSTOM_SIZE_MAX}
                        step={1}
                        value={customSizeWidth}
                        onChange={(v) => {
                          const n = v != null ? Math.round(Number(v)) : CUSTOM_SIZE_MIN;
                          setCustomSizeWidth(
                            Number.isNaN(n)
                              ? CUSTOM_SIZE_MIN
                              : Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, n))
                          );
                        }}
                        style={{ width: 96 }}
                      />
                    </label>
                    <label style={{ whiteSpace: 'nowrap' }}>
                      高：
                      <InputNumber
                        min={CUSTOM_SIZE_MIN}
                        max={CUSTOM_SIZE_MAX}
                        step={1}
                        value={customSizeHeight}
                        onChange={(v) => {
                          const n = v != null ? Math.round(Number(v)) : CUSTOM_SIZE_MIN;
                          setCustomSizeHeight(
                            Number.isNaN(n)
                              ? CUSTOM_SIZE_MIN
                              : Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, n))
                          );
                        }}
                        style={{ width: 96 }}
                      />
                    </label>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      （{CUSTOM_SIZE_MIN}～{CUSTOM_SIZE_MAX} 像素）
                    </span>
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
              ) : null}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default BatchDownloadSizeModal;
