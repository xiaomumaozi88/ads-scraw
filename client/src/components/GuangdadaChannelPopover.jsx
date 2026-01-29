import React, { useState, useMemo, useEffect } from 'react';
import { Input, Button, Checkbox } from 'antd';
import { GUANGDADA_CHANNEL_CATEGORIES } from '../data/guangdadaChannels';

function GuangdadaChannelPopover({ value = [], onChange, onConfirm, onCancel, open }) {
  const [draft, setDraft] = useState(() => [...(value || [])]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraft([...(value || [])]);
      setSearch('');
    }
  }, [open, value]);

  const selectedSet = useMemo(() => new Set(draft), [draft]);

  const toggle = (v) => {
    const next = selectedSet.has(v)
      ? draft.filter((x) => x !== v)
      : [...draft, v];
    setDraft(next);
  };

  const selectAllVisible = () => {
    const q = (search || '').trim().toLowerCase();
    const visibleValues = GUANGDADA_CHANNEL_CATEGORIES.flatMap((cat) =>
      cat.items
        .filter(
          (item) =>
            !q || item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
        )
        .map((item) => item.value)
    );
    const nextSet = new Set([...selectedSet]);
    visibleValues.forEach((v) => nextSet.add(v));
    setDraft(Array.from(nextSet));
  };

  const selectAllInCategory = (category) => {
    const vals = category.items.map((item) => item.value);
    const nextSet = new Set(draft);
    const allSelected = vals.every((v) => nextSet.has(v));
    if (allSelected) {
      vals.forEach((v) => nextSet.delete(v));
    } else {
      vals.forEach((v) => nextSet.add(v));
    }
    setDraft(Array.from(nextSet));
  };

  const handleConfirm = () => {
    onChange(draft);
    onConfirm?.();
  };

  const filteredCategories = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return GUANGDADA_CHANNEL_CATEGORIES;
    return GUANGDADA_CHANNEL_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [search]);

  return (
    <div className="guangdada-channel-popover">
      <div className="guangdada-channel-popover-title">
        <Input
          placeholder="快速检索渠道"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="guangdada-channel-popover-search"
        />
        <Button type="text" onClick={selectAllVisible}>
          全部
        </Button>
      </div>
      <div className="guangdada-channel-popover-content">
        <div className="guangdada-channel-popover-scroll">
          {filteredCategories.map((cat) => (
            <div key={cat.title} className="guangdada-channel-popover-section">
              <div className="guangdada-channel-popover-section-header">
                <Checkbox
                  checked={cat.items.length > 0 && cat.items.every((item) => selectedSet.has(item.value))}
                  indeterminate={
                    cat.items.some((item) => selectedSet.has(item.value)) &&
                    !cat.items.every((item) => selectedSet.has(item.value))
                  }
                  onChange={() => selectAllInCategory(cat)}
                  className="checkbox-label"
                >
                  <span>{cat.title}</span>
                </Checkbox>
              </div>
              <div className="guangdada-channel-popover-grid">
                {cat.items.map((item) => (
                  <label
                    key={item.value}
                    className={`ant-checkbox-wrapper checkbox-custom popover-checkbox ${item.value === 'merge_facebook' ? 'col-span-2 min-w-165' : ''}`}
                  >
                    <Checkbox
                      checked={selectedSet.has(item.value)}
                      onChange={() => toggle(item.value)}
                      value={item.value}
                    />
                    <span>
                      {item.beta ? (
                        <span className="ant-badge antd-sm-badge-wrap guangdada-channel-badge">
                          <span className="guangdada-channel-item-inner">
                            {item.iconClass && (
                              <span className={`net-icon ${item.iconClass}`} />
                            )}
                            <span className="guangdada-channel-item-label">{item.label}</span>
                          </span>
                          <sup className="ant-scroll-number ant-badge-count ant-badge-multiple-words" title="Beta">Beta</sup>
                        </span>
                      ) : (
                        <span className="guangdada-channel-item-inner">
                          {item.iconClass && (
                            <span className={`net-icon ${item.iconClass}`} />
                          )}
                          <span className="guangdada-channel-item-label">{item.label}</span>
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="guangdada-channel-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>确 定</Button>
      </div>
    </div>
  );
}

export default GuangdadaChannelPopover;
