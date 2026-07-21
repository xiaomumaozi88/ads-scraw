import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Input } from 'antd';

function normalizeIdList(id) {
  const raw = Array.isArray(id) ? id : String(id ?? '').split(',');
  return raw
    .map((v) => parseInt(String(v).trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

function selectionKey(item) {
  const ids = normalizeIdList(item?.id ?? item?.ids);
  return `${item?.key || ''}:${ids.join(',')}`;
}

function buildSelection(category, tag) {
  const ids = normalizeIdList(tag.id ?? tag.ids);
  const label = tag.cn_name || tag.label || tag.en_name || ids.join(',');
  return {
    key: category.key,
    id: ids,
    label,
    parentLabel: category.cn_name || category.title || category.en_name || category.key,
  };
}

function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : [])
    .map((category) => ({
      ...category,
      title: category.cn_name || category.title || category.en_name || category.key,
      items: Array.isArray(category.sub_tags) ? category.sub_tags : (category.items || []),
    }))
    .filter((category) => category.key && category.items.length > 0);
}

function GuangdadaContentAttributesPopover({
  value = [],
  categories = [],
  loading = false,
  error = '',
  onChange,
  onConfirm,
  onCancel,
  onRetry,
  open,
}) {
  const [draft, setDraft] = useState(() => [...(value || [])]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraft([...(value || [])]);
      setSearch('');
    }
  }, [open, value]);

  const normalizedCategories = useMemo(() => normalizeCategories(categories), [categories]);
  const selectedSet = useMemo(() => new Set((draft || []).map(selectionKey)), [draft]);

  const filteredCategories = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return normalizedCategories;
    return normalizedCategories
      .map((category) => {
        const categoryHit =
          String(category.title || '').toLowerCase().includes(q) ||
          String(category.en_name || '').toLowerCase().includes(q) ||
          String(category.key || '').toLowerCase().includes(q);
        const items = category.items.filter((item) => {
          const ids = normalizeIdList(item.id ?? item.ids).join(',');
          return (
            categoryHit ||
            String(item.cn_name || item.label || '').toLowerCase().includes(q) ||
            String(item.en_name || '').toLowerCase().includes(q) ||
            ids.includes(q)
          );
        });
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [normalizedCategories, search]);

  const toggle = (category, tag) => {
    const nextItem = buildSelection(category, tag);
    const key = selectionKey(nextItem);
    const next = selectedSet.has(key)
      ? draft.filter((item) => selectionKey(item) !== key)
      : [...draft, nextItem];
    setDraft(next);
  };

  const selectAllVisible = () => {
    const nextByKey = new Map((draft || []).map((item) => [selectionKey(item), item]));
    filteredCategories.forEach((category) => {
      category.items.forEach((tag) => {
        const item = buildSelection(category, tag);
        nextByKey.set(selectionKey(item), item);
      });
    });
    setDraft(Array.from(nextByKey.values()));
  };

  const handleConfirm = () => {
    onChange(draft);
    onConfirm?.();
  };

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
        <Button type="text" onClick={selectAllVisible} disabled={loading || filteredCategories.length === 0}>
          全部
        </Button>
      </div>
      <div className="guangdada-image-analysis-popover-content">
        <div className="guangdada-image-analysis-popover-scroll">
          {loading && (
            <div className="guangdada-content-attributes-popover-empty">加载中...</div>
          )}
          {!loading && error && (
            <div className="guangdada-content-attributes-popover-empty">
              <span>{error}</span>
              {onRetry && (
                <Button size="small" type="link" onClick={onRetry}>
                  重试
                </Button>
              )}
            </div>
          )}
          {!loading && !error && filteredCategories.length === 0 && (
            <div className="guangdada-content-attributes-popover-empty">暂无选项</div>
          )}
          {!loading && !error && filteredCategories.map((category) => (
            <div key={category.key} className="guangdada-image-analysis-popover-section">
              <div className="guangdada-image-analysis-popover-section-header">
                <div className="guangdada-image-analysis-popover-section-title">
                  {category.title}
                </div>
              </div>
              <div className="guangdada-image-analysis-popover-grid">
                {category.items.map((tag) => {
                  const item = buildSelection(category, tag);
                  const key = selectionKey(item);
                  return (
                    <label
                      key={key}
                      className="ant-checkbox-wrapper checkbox-custom popover-checkbox"
                    >
                      <Checkbox
                        checked={selectedSet.has(key)}
                        onChange={() => toggle(category, tag)}
                        value={key}
                      />
                      <span>
                        <span className="guangdada-image-analysis-item-label">
                          {item.label}
                        </span>
                      </span>
                    </label>
                  );
                })}
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

export default GuangdadaContentAttributesPopover;
