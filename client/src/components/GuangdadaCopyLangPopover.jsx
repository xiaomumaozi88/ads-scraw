import React, { useState, useEffect } from 'react';
import { Button, Checkbox } from 'antd';
import { GUANGDADA_COPY_LANG_OPTIONS } from '../data/guangdadaCopyLangs';

function GuangdadaCopyLangPopover({ value = [], onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => [...(value || [])]);

  useEffect(() => {
    if (open) {
      setDraft([...(value || [])]);
    }
  }, [open, value]);

  const selectedSet = new Set(draft);

  const toggle = (v) => {
    const next = selectedSet.has(v)
      ? draft.filter((x) => x !== v)
      : [...draft, v];
    setDraft(next);
  };

  const selectAll = () => {
    if (draft.length === GUANGDADA_COPY_LANG_OPTIONS.length) {
      setDraft([]);
    } else {
      setDraft(GUANGDADA_COPY_LANG_OPTIONS.map((item) => item.value));
    }
  };

  const handleConfirm = () => {
    onChange(draft);
    onConfirm?.();
  };

  return (
    <div className="guangdada-copy-lang-popover">
      <div className="guangdada-copy-lang-popover-title">
        <div>文案语言</div>
        <Button type="text" onClick={selectAll}>
          全部
        </Button>
      </div>
      <div className="guangdada-copy-lang-popover-content">
        <div className="guangdada-copy-lang-popover-scroll">
          <div className="guangdada-copy-lang-popover-grid">
            {GUANGDADA_COPY_LANG_OPTIONS.map((item) => (
              <label
                key={item.value}
                className="ant-checkbox-wrapper checkbox-custom popover-checkbox"
              >
                <Checkbox
                  checked={selectedSet.has(item.value)}
                  onChange={() => toggle(item.value)}
                  value={item.value}
                />
                <span>
                  <span className="guangdada-copy-lang-item-label">{item.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="guangdada-copy-lang-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaCopyLangPopover;
