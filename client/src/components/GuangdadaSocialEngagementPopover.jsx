import React, { useState, useEffect } from 'react';
import { Radio, Button, InputNumber } from 'antd';

const PRESET_OPTIONS = [
  { value: '', label: '全部' },
  { value: '1~100', label: '1~100' },
  { value: '101~1000', label: '101~1000' },
  { value: '1000~', label: '≥1000' },
];

const METRIC_KEYS = [
  { key: 'like', label: '点赞' },
  { key: 'comment', label: '评论' },
  { key: 'share', label: '分享' },
];

const DEFAULT_ROW = { value: '', min: undefined, max: undefined };

const DEFAULT_VALUE = {
  like: { ...DEFAULT_ROW },
  comment: { ...DEFAULT_ROW },
  share: { ...DEFAULT_ROW },
};

function GuangdadaSocialEngagementPopover({ value = DEFAULT_VALUE, onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => ({
    like: { ...DEFAULT_ROW, ...(value?.like || {}) },
    comment: { ...DEFAULT_ROW, ...(value?.comment || {}) },
    share: { ...DEFAULT_ROW, ...(value?.share || {}) },
  }));

  useEffect(() => {
    if (open) {
      setDraft({
        like: { ...DEFAULT_ROW, ...(value?.like || {}) },
        comment: { ...DEFAULT_ROW, ...(value?.comment || {}) },
        share: { ...DEFAULT_ROW, ...(value?.share || {}) },
      });
    }
  }, [open, value]);

  const updateRow = (key, field, val) => {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const handleConfirm = () => {
    onChange({
      like: { value: draft.like.value, min: draft.like.value === '~' ? draft.like.min : undefined, max: draft.like.value === '~' ? draft.like.max : undefined },
      comment: { value: draft.comment.value, min: draft.comment.value === '~' ? draft.comment.min : undefined, max: draft.comment.value === '~' ? draft.comment.max : undefined },
      share: { value: draft.share.value, min: draft.share.value === '~' ? draft.share.min : undefined, max: draft.share.value === '~' ? draft.share.max : undefined },
    });
    onConfirm?.();
  };

  return (
    <div className="guangdada-social-engagement-popover">
      <div className="guangdada-social-engagement-popover-content">
        {METRIC_KEYS.map(({ key, label }) => {
          const row = draft[key] || DEFAULT_ROW;
          const isCustom = row.value === '~';
          return (
            <div key={key} className="guangdada-social-engagement-popover-grid">
              <div className="guangdada-social-engagement-popover-label">{label}</div>
              <Radio.Group
                value={row.value}
                onChange={(e) => updateRow(key, 'value', e.target.value)}
                className="guangdada-social-engagement-popover-radio-group"
              >
                {PRESET_OPTIONS.map((opt) => (
                  <Radio key={opt.value} value={opt.value}>
                    {opt.label}
                  </Radio>
                ))}
                <Radio value="~">
                  <span className="guangdada-social-engagement-popover-custom">
                    <InputNumber
                      placeholder="最小值"
                      min={0}
                      value={isCustom ? row.min : undefined}
                      onChange={(v) => updateRow(key, 'min', v ?? undefined)}
                      disabled={!isCustom}
                      className="guangdada-social-engagement-popover-input"
                    />
                    <span className="guangdada-social-engagement-popover-sep"> ~ </span>
                    <InputNumber
                      placeholder="最大值"
                      min={0}
                      value={isCustom ? row.max : undefined}
                      onChange={(v) => updateRow(key, 'max', v ?? undefined)}
                      disabled={!isCustom}
                      className="guangdada-social-engagement-popover-input"
                    />
                  </span>
                </Radio>
              </Radio.Group>
            </div>
          );
        })}
      </div>
      <div className="guangdada-social-engagement-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaSocialEngagementPopover;

/** 用于 SearchForm 判断是否有设置 */
export function hasSocialEngagementSet(val) {
  if (!val || typeof val !== 'object') return false;
  const row = (r) => r && (r.value === '~' ? (r.min != null || r.max != null) : !!r.value);
  return row(val.like) || row(val.comment) || row(val.share);
}
