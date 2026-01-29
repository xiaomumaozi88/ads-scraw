import React, { useState, useMemo, useEffect } from 'react';
import { Input, Button, Checkbox } from 'antd';
import { GUANGDADA_IMAGE_ANALYSIS_CATEGORIES } from '../data/guangdadaImageAnalysis';

function GuangdadaImageAnalysisPopover({ value = [], onChange, onConfirm, onCancel, open }) {
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
    const visibleValues = GUANGDADA_IMAGE_ANALYSIS_CATEGORIES.flatMap((cat) =>
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
    if (!q) return GUANGDADA_IMAGE_ANALYSIS_CATEGORIES;
    return GUANGDADA_IMAGE_ANALYSIS_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          String(item.value).toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [search]);

  return (
    <div className="guangdada-image-analysis-popover">
      <div className="guangdada-image-analysis-popover-title">
        <Input
          placeholder="快速检索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="guangdada-image-analysis-popover-search"
        />
        <Button type="text" onClick={selectAllVisible}>
          全部
        </Button>
      </div>
      <div className="guangdada-image-analysis-popover-content">
        <div className="guangdada-image-analysis-popover-scroll">
          {filteredCategories.map((cat) => (
            <div key={cat.title} className="guangdada-image-analysis-popover-section">
              <div className="guangdada-image-analysis-popover-section-header">
                <div className="guangdada-image-analysis-popover-section-title">
                  {cat.title}
                </div>
              </div>
              <div className="guangdada-image-analysis-popover-grid">
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
                      <span className="guangdada-image-analysis-item-label">
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
      <div className="guangdada-image-analysis-popover-footer">
        <Button onClick={onCancel}>取 消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确 定
        </Button>
      </div>
    </div>
  );
}

export default GuangdadaImageAnalysisPopover;
