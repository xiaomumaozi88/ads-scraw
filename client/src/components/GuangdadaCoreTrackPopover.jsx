import React, { useState, useMemo, useEffect } from 'react';
import { Input, Button, Checkbox } from 'antd';
import { GUANGDADA_CORE_TRACK_CATEGORIES } from '../data/guangdadaCoreTrack';

function GuangdadaCoreTrackPopover({ value = [], onChange, onConfirm, onCancel, open }) {
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
    const visibleValues = GUANGDADA_CORE_TRACK_CATEGORIES.flatMap((cat) =>
      cat.items
        .filter(
          (item) =>
            !q ||
            item.label.toLowerCase().includes(q) ||
            String(item.value).toLowerCase().includes(q)
        )
        .map((item) => item.value)
    );
    const nextSet = new Set([...selectedSet]);
    visibleValues.forEach((v) => nextSet.add(v));
    setDraft(Array.from(nextSet));
  };

  const handleConfirm = () => {
    onChange(draft);
    onConfirm?.();
  };

  const filteredCategories = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return GUANGDADA_CORE_TRACK_CATEGORIES;
    return GUANGDADA_CORE_TRACK_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          String(item.value).toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [search]);

  return (
    <div className="guangdada-core-track-popover">
      <div className="guangdada-core-track-popover-title">
        <Input
          placeholder="快速检索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="guangdada-core-track-popover-search"
        />
        <Button type="text" onClick={selectAllVisible}>
          全部
        </Button>
      </div>
      <div className="guangdada-core-track-popover-content">
        <div className="guangdada-core-track-popover-scroll">
          {filteredCategories.map((cat) => (
            <div key={cat.title} className="guangdada-core-track-popover-section">
              <div className="guangdada-core-track-popover-section-header">
                <div className="guangdada-core-track-popover-section-title guangdada-core-track-popover-section-title--relative">
                  {cat.title}
                  {cat.newBadge && (
                    <span className="ant-badge antd-sm-badge-wrap guangdada-core-track-new-badge" title="NEW">
                      <sup className="ant-scroll-number ant-badge-count ant-badge-multiple-words">NEW</sup>
                    </span>
                  )}
                </div>
              </div>
              <div className="guangdada-core-track-popover-grid">
                {cat.items.map((item) => (
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
                      <span className="guangdada-core-track-item-label">
                        {item.label}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="guangdada-core-track-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaCoreTrackPopover;
