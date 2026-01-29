import React, { useState, useEffect } from 'react';
import { Radio, Checkbox, Button, InputNumber } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  GUANGDADA_VIDEO_DURATION_OPTIONS,
  GUANGDADA_SIZE_OPTIONS,
  GUANGDADA_QUALITY_OPTIONS,
  GUANGDADA_RESOLUTION_DEFAULTS,
} from '../data/guangdadaMaterialAttr';

const DEFAULT_ATTR = {
  videoDuration: '',
  videoDurationMin: null,
  videoDurationMax: null,
  size: [],
  quality: [],
  resolution: [],
  resolutionCustom: [], // 用户通过「添加」加入的分辨率
};

function GuangdadaMaterialAttrPopover({ value, onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_ATTR, ...(value || {}) }));
  const [addResW, setAddResW] = useState(null);
  const [addResH, setAddResH] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_ATTR, ...(value || {}) });
      setAddResW(null);
      setAddResH(null);
    }
  }, [open, value]);

  const updateDraft = (key, val) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const resolutionList = [...GUANGDADA_RESOLUTION_DEFAULTS, ...(draft.resolutionCustom || [])];
  const selectedResSet = new Set([...(draft.resolution || [])]);

  const toggleResolution = (r) => {
    const next = selectedResSet.has(r)
      ? (draft.resolution || []).filter((x) => x !== r)
      : [...(draft.resolution || []), r];
    updateDraft('resolution', next);
  };

  const handleAddResolution = () => {
    const w = addResW;
    const h = addResH;
    if (w == null || h == null || w < 1 || h < 1) return;
    const str = `${w} x ${h}`;
    if (resolutionList.includes(str)) {
      setAddResW(null);
      setAddResH(null);
      return;
    }
    updateDraft('resolutionCustom', [...(draft.resolutionCustom || []), str]);
    updateDraft('resolution', [...(draft.resolution || []), str]);
    setAddResW(null);
    setAddResH(null);
  };

  const handleConfirm = () => {
    onChange(draft);
    onConfirm?.();
  };

  const isCustomDuration = draft.videoDuration === '-';

  return (
    <div className="guangdada-material-attr-popover">
      <div className="guangdada-material-attr-content space-y-12">
        {/* 视频时长 */}
        <div className="guangdada-material-attr-row">
          <div className="guangdada-material-attr-label">视频时长</div>
          <div className="guangdada-material-attr-control">
            <Radio.Group
              value={draft.videoDuration}
              onChange={(e) => updateDraft('videoDuration', e.target.value)}
              className="guangdada-material-attr-radio-group"
            >
              {GUANGDADA_VIDEO_DURATION_OPTIONS.filter((o) => !o.isCustom).map((o) => (
                <Radio key={o.value || 'all'} value={o.value}>
                  {o.label}
                </Radio>
              ))}
              <Radio value="-">
                <span
                  className="guangdada-material-attr-custom-duration"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <InputNumber
                    placeholder="最小值"
                    min={0}
                    value={draft.videoDurationMin}
                    onChange={(v) => updateDraft('videoDurationMin', v)}
                    className="guangdada-material-attr-input-number"
                  />
                  <span className="guangdada-material-attr-sep">-</span>
                  <InputNumber
                    placeholder="最大值"
                    min={0}
                    value={draft.videoDurationMax}
                    onChange={(v) => updateDraft('videoDurationMax', v)}
                    className="guangdada-material-attr-input-number"
                  />
                </span>
              </Radio>
            </Radio.Group>
          </div>
        </div>

        {/* 尺寸 */}
        <div className="guangdada-material-attr-row guangdada-material-attr-row--align-top">
          <div className="guangdada-material-attr-label">尺寸</div>
          <div className="guangdada-material-attr-size-grid">
            {GUANGDADA_SIZE_OPTIONS.map((o) => (
              <label key={o.value} className="ant-checkbox-wrapper">
                <Checkbox
                  checked={(draft.size || []).includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...(draft.size || []), o.value]
                      : (draft.size || []).filter((x) => x !== o.value);
                    updateDraft('size', next);
                  }}
                  value={o.value}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 画质 */}
        <div className="guangdada-material-attr-row">
          <div className="guangdada-material-attr-label">画质</div>
          <div className="guangdada-material-attr-quality-group">
            {GUANGDADA_QUALITY_OPTIONS.map((o) => (
              <label key={o.value} className="ant-checkbox-wrapper guangdada-material-attr-quality-item">
                <Checkbox
                  checked={(draft.quality || []).includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...(draft.quality || []), o.value]
                      : (draft.quality || []).filter((x) => x !== o.value);
                    updateDraft('quality', next);
                  }}
                  value={o.value}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 分辨率 */}
        <div className="guangdada-material-attr-row guangdada-material-attr-row--align-top">
          <div className="guangdada-material-attr-label">分辨率</div>
          <div className="guangdada-material-attr-resolution-wrap">
            <div className="guangdada-material-attr-resolution-grid">
              {resolutionList.map((r) => (
                <label key={r} className="ant-checkbox-wrapper items-center">
                  <Checkbox
                    checked={selectedResSet.has(r)}
                    onChange={() => toggleResolution(r)}
                    value={r}
                  />
                  <span>{r}</span>
                </label>
              ))}
              <div className="guangdada-material-attr-add-res">
                <InputNumber
                  placeholder="宽"
                  min={1}
                  value={addResW}
                  onChange={setAddResW}
                  className="guangdada-material-attr-res-input"
                />
                <span className="guangdada-material-attr-sep">x</span>
                <InputNumber
                  placeholder="高"
                  min={1}
                  value={addResH}
                  onChange={setAddResH}
                  className="guangdada-material-attr-res-input"
                />
                <Button
                  type="default"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddResolution}
                  className="guangdada-material-attr-add-btn"
                >
                  添加
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="guangdada-material-attr-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaMaterialAttrPopover;
export { DEFAULT_ATTR };
