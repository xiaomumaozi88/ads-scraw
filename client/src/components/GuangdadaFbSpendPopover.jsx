import React, { useState, useEffect } from 'react';
import { Radio, Button, InputNumber } from 'antd';

const PRESET_OPTIONS = [
  { value: '0~', label: '>0 $' },
  { value: '1~100', label: '1~100 $' },
  { value: '101~1000', label: '101~1000 $' },
  { value: '1000~', label: '≥1000 $' },
];

const DEFAULT_VALUE = { value: '', min: undefined, max: undefined };

function GuangdadaFbSpendPopover({ value = DEFAULT_VALUE, onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => ({
    value: value?.value ?? '',
    min: value?.min ?? undefined,
    max: value?.max ?? undefined,
  }));

  useEffect(() => {
    if (open) {
      setDraft({
        value: value?.value ?? '',
        min: value?.min ?? undefined,
        max: value?.max ?? undefined,
      });
    }
  }, [open, value]);

  const isCustom = draft.value === '~';

  const handleConfirm = () => {
    onChange({
      value: draft.value,
      min: isCustom ? draft.min : undefined,
      max: isCustom ? draft.max : undefined,
    });
    onConfirm?.();
  };

  return (
    <div className="guangdada-fb-spend-popover">
      <div className="guangdada-fb-spend-popover-content">
        <div className="guangdada-fb-spend-popover-grid">
          <div className="guangdada-fb-spend-popover-label">FB广告花费</div>
          <Radio.Group
            value={draft.value}
            onChange={(e) => setDraft((prev) => ({ ...prev, value: e.target.value }))}
            className="guangdada-fb-spend-popover-radio-group"
          >
            {PRESET_OPTIONS.map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                {opt.label}
              </Radio>
            ))}
            <Radio value="~">
              <span className="guangdada-fb-spend-popover-custom">
                <InputNumber
                  placeholder="最小值"
                  min={0}
                  value={isCustom ? draft.min : undefined}
                  onChange={(v) => setDraft((prev) => ({ ...prev, min: v ?? undefined }))}
                  disabled={!isCustom}
                  className="guangdada-fb-spend-popover-input"
                />
                <span className="guangdada-fb-spend-popover-dollar"> $</span>
                <span className="guangdada-fb-spend-popover-sep"> ~ </span>
                <InputNumber
                  placeholder="最大值"
                  min={0}
                  value={isCustom ? draft.max : undefined}
                  onChange={(v) => setDraft((prev) => ({ ...prev, max: v ?? undefined }))}
                  disabled={!isCustom}
                  className="guangdada-fb-spend-popover-input"
                />
                <span className="guangdada-fb-spend-popover-dollar"> $</span>
              </span>
            </Radio>
          </Radio.Group>
        </div>
      </div>
      <div className="guangdada-fb-spend-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaFbSpendPopover;

/** 用于 SearchForm 展示已选文案 */
export function getFbSpendDisplayText(val) {
  if (!val || !val.value) return '';
  const preset = PRESET_OPTIONS.find((o) => o.value === val.value);
  if (preset) return preset.label;
  if (val.value === '~' && (val.min != null || val.max != null)) {
    return `${val.min ?? '最小值'} ~ ${val.max ?? '最大值'} $`;
  }
  return '';
}
