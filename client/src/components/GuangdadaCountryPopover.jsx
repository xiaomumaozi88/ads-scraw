import React, { useState, useMemo, useEffect } from 'react';
import { Input, Button, Checkbox, Switch } from 'antd';
import { GUANGDADA_COUNTRY_CATEGORIES } from '../data/guangdadaCountries';

function GuangdadaCountryPopover({
  value = [],
  onChange,
  onlyInSelectedRegion = false,
  onOnlyInSelectedRegionChange,
  onConfirm,
  onCancel,
  open,
}) {
  const [draft, setDraft] = useState(() => [...(value || [])]);
  const [search, setSearch] = useState('');
  const [draftSwitch, setDraftSwitch] = useState(!!onlyInSelectedRegion);

  useEffect(() => {
    if (open) {
      setDraft([...(value || [])]);
      setDraftSwitch(!!onlyInSelectedRegion);
      setSearch('');
    }
  }, [open, value, onlyInSelectedRegion]);

  const selectedSet = useMemo(() => new Set(draft), [draft]);

  const toggle = (v) => {
    const next = selectedSet.has(v)
      ? draft.filter((x) => x !== v)
      : [...draft, v];
    setDraft(next);
  };

  const selectAllVisible = () => {
    const q = (search || '').trim().toLowerCase();
    const visibleValues = GUANGDADA_COUNTRY_CATEGORIES.flatMap((cat) =>
      cat.items
        .filter(
          (item) =>
            !q ||
            item.label.toLowerCase().includes(q) ||
            item.value.toLowerCase().includes(q)
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
    if (typeof onOnlyInSelectedRegionChange === 'function') {
      onOnlyInSelectedRegionChange(draftSwitch);
    }
    onConfirm?.();
  };

  const filteredCategories = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return GUANGDADA_COUNTRY_CATEGORIES;
    return GUANGDADA_COUNTRY_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.value.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [search]);

  return (
    <div className="guangdada-country-popover">
      <div className="guangdada-country-popover-title">
        <Input
          placeholder="快速检索国家与地区"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="guangdada-country-popover-search"
        />
        <Button type="text" onClick={selectAllVisible}>
          全部
        </Button>
      </div>
      <div className="guangdada-country-popover-content">
        <div className="guangdada-country-popover-scroll">
          {filteredCategories.map((cat) => (
            <div key={cat.title} className="guangdada-country-popover-section">
              <div className="guangdada-country-popover-section-header">
                <Checkbox
                  checked={
                    cat.items.length > 0 &&
                    cat.items.every((item) => selectedSet.has(item.value))
                  }
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
              <div className="guangdada-country-popover-grid">
                {cat.items.map((item) => (
                  <label
                    key={`${cat.title}-${item.value}-${item.label}`}
                    className="ant-checkbox-wrapper checkbox-custom popover-checkbox"
                  >
                    <Checkbox
                      checked={selectedSet.has(item.value)}
                      onChange={() => toggle(item.value)}
                      value={item.value}
                    />
                    <span>
                      <span className="guangdada-country-item-inner">
                        <span
                          className={`flag-icon ${item.flagIcon}`}
                          aria-hidden
                        />
                        <span className="guangdada-country-item-label">
                          {item.label}
                        </span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="guangdada-country-popover-footer">
        <div className="guangdada-country-popover-footer-left">
          <Switch
            checked={draftSwitch}
            onChange={setDraftSwitch}
            aria-checked={draftSwitch}
          />
          <span>仅在该国家地区投放</span>
        </div>
        <div className="guangdada-country-popover-footer-right">
          <Button onClick={onCancel}>取 消</Button>
          <Button type="primary" onClick={handleConfirm}>
            确 定
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GuangdadaCountryPopover;
