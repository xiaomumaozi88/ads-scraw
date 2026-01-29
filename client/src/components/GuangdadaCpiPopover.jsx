import React, { useState, useEffect } from 'react';
import { Checkbox, Button } from 'antd';
import { GUANGDADA_CPI_RANGE, GUANGDADA_CPI_CURRENCY } from '../data/guangdadaCpi';

const defaultValue = { cpiRange: [], currency: [] };

function GuangdadaCpiPopover({ value = defaultValue, onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => ({
    cpiRange: [...(value?.cpiRange || [])],
    currency: [...(value?.currency || [])],
  }));

  useEffect(() => {
    if (open) {
      setDraft({
        cpiRange: [...(value?.cpiRange || [])],
        currency: [...(value?.currency || [])],
      });
    }
  }, [open, value]);

  const handleCpiRangeChange = (checkedValues) => {
    setDraft((prev) => ({ ...prev, cpiRange: checkedValues }));
  };

  const handleCurrencyChange = (checkedValues) => {
    setDraft((prev) => ({ ...prev, currency: checkedValues }));
  };

  const handleConfirm = () => {
    onChange({ cpiRange: draft.cpiRange, currency: draft.currency });
    onConfirm?.();
  };

  return (
    <div className="guangdada-cpi-popover">
      <div className="guangdada-cpi-popover-content">
        <div className="guangdada-cpi-popover-grid">
          <div className="guangdada-cpi-popover-label">CPI范围</div>
          <Checkbox.Group
            value={draft.cpiRange}
            onChange={handleCpiRangeChange}
            className="guangdada-cpi-popover-group"
          >
            {GUANGDADA_CPI_RANGE.map((item) => (
              <Checkbox key={item.value} value={item.value} className="guangdada-cpi-popover-checkbox">
                {item.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
          <div className="guangdada-cpi-popover-label">币种</div>
          <Checkbox.Group
            value={draft.currency}
            onChange={handleCurrencyChange}
            className="guangdada-cpi-popover-group"
          >
            {GUANGDADA_CPI_CURRENCY.map((item) => (
              <Checkbox key={item.value} value={item.value} className="guangdada-cpi-popover-checkbox">
                {item.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      </div>
      <div className="guangdada-cpi-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaCpiPopover;

/** 用于 SearchForm 计算已选数量 */
export function getCpiSelectedCount(val) {
  if (!val || typeof val !== 'object') return 0;
  return (val.cpiRange?.length || 0) + (val.currency?.length || 0);
}
