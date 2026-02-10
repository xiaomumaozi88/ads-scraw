import React, { useMemo, useState, useEffect } from 'react';
import { Tree, Input, Button, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type5Data from '../data/type5.json';
import './ProductCascader.css';

function ProductCascader({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  // 三级结构：level2(行业一级) -> level3(如「消除」) -> level4(如「经营消除、经典消除、策略消除」)，API 的 tradeLevel3 为 level4 的 ccode
  const { treeData, allProductCodes, categoryToProducts } = useMemo(() => {
    const level2Items = [];
    const level3ByParent = {};
    const level4ByParent = {};
    const allProductCodesSet = new Set();

    type5Data.data.forEach(item => {
      if (item.level === 2 && (item.parentElementCode === '' || item.parentElementCode == null)) {
        level2Items.push(item);
      } else if (item.level === 3 && item.parentElementCode) {
        if (!level3ByParent[item.parentElementCode]) level3ByParent[item.parentElementCode] = [];
        level3ByParent[item.parentElementCode].push(item);
      } else if (item.level === 4 && item.parentElementCode) {
        if (!level4ByParent[item.parentElementCode]) level4ByParent[item.parentElementCode] = [];
        level4ByParent[item.parentElementCode].push(item);
        allProductCodesSet.add(item.ccode);
      }
    });

    level2Items.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    Object.keys(level3ByParent).forEach(k => { level3ByParent[k].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0)); });
    Object.keys(level4ByParent).forEach(k => { level4ByParent[k].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0)); });

    // 每个节点（level2/level3）下所有 leaf 的 ccode 集合，用于「全选该节点」时勾选子节点
    const categoryToProductsMap = {};
    level2Items.forEach(l2 => {
      const leaves = [];
      (level3ByParent[l2.elementCode] || []).forEach(l3 => {
        (level4ByParent[l3.elementCode] || []).forEach(l4 => leaves.push(l4.ccode));
      });
      categoryToProductsMap[l2.elementCode] = leaves;
    });
    Object.keys(level3ByParent).forEach(parentCode => {
      categoryToProductsMap[parentCode] = (level4ByParent[parentCode] || []).map(l4 => l4.ccode);
    });

    const treeData = level2Items.map(l2 => ({
      key: l2.elementCode,
      title: l2.nameCn,
      searchLabel: l2.nameCn,
      children: (level3ByParent[l2.elementCode] || []).map(l3 => ({
        key: l3.elementCode,
        title: l3.nameCn,
        searchLabel: l3.nameCn,
        children: (level4ByParent[l3.elementCode] || []).map(l4 => ({
          key: l4.ccode,
          title: l4.nameCn,
          searchLabel: l4.nameCn,
        })),
      })),
    }));

    return {
      treeData,
      allProductCodes: allProductCodesSet,
      categoryToProducts: categoryToProductsMap,
    };
  }, []);

  const checkedKeys = useMemo(() => {
    const keys = [...(value || [])];
    Object.keys(categoryToProducts).forEach(catCode => {
      const children = categoryToProducts[catCode] || [];
      if (children.length > 0 && children.every(c => (value || []).includes(c))) {
        keys.push(catCode);
      }
    });
    return keys;
  }, [value, categoryToProducts]);

  const onCheck = (checkedKeysValue) => {
    const keys = Array.isArray(checkedKeysValue) ? checkedKeysValue : (checkedKeysValue.checked || []);
    const leafOnly = keys.filter(k => allProductCodes.has(k));
    onChange(leafOnly);
  };

  const filteredTreeData = useMemo(() => {
    if (!searchValue.trim()) return treeData;
    const kw = searchValue.toLowerCase();
    const filter = (nodes) =>
      nodes
        .map(node => {
          const text = (node.searchLabel != null ? node.searchLabel : (typeof node.title === 'string' ? node.title : '')).toString().toLowerCase();
          const match = text.includes(kw);
          const children = node.children ? filter(node.children) : undefined;
          const hasChild = children && children.length > 0;
          if (match || hasChild) {
            return { ...node, children: hasChild ? children : node.children };
          }
          return null;
        })
        .filter(Boolean);
    return filter(treeData);
  }, [treeData, searchValue]);

  const onExpand = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
    setAutoExpandParent(false);
  };

  useEffect(() => {
    if (open) {
      setExpandedKeys(treeData.map(n => n.key));
    }
  }, [open, treeData]);

  const displayText = useMemo(() => {
    if (!value || value.length === 0) return '搜索行业类型';
    if (value.length <= 3) {
      const names = value.map(cc => {
        const p = type5Data.data.find(item => item.level === 4 && item.ccode === cc);
        return p ? p.nameCn : cc;
      });
      return names.join(', ');
    }
    return `已选择 ${value.length} 项`;
  }, [value]);

  const handleReset = () => {
    onChange([]);
    setSearchValue('');
  };

  const handleConfirm = () => {
    setOpen(false);
    setSearchValue('');
  };

  const dropdownContent = (
    <div className="product-cascader-dropdown">
      <div className="product-cascader-dropdown-header">
        <Input
          placeholder="搜索行业类型"
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            if (e.target.value) {
              setExpandedKeys(treeData.map(n => n.key));
              setAutoExpandParent(true);
            }
          }}
          prefix={<SearchOutlined />}
          allowClear
        />
      </div>
      <div className="product-cascader-dropdown-content">
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={onCheck}
          expandedKeys={expandedKeys}
          autoExpandParent={autoExpandParent}
          onExpand={onExpand}
          treeData={filteredTreeData}
          className="product-cascader-tree"
          blockNode
        />
      </div>
      <div className="product-cascader-dropdown-footer">
        <Button size="small" onClick={handleReset}>重置</Button>
        <Button type="primary" size="small" onClick={handleConfirm}>确定</Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
      getPopupContainer={(node) => node?.parentElement || document.body}
    >
      <div className="product-cascader-trigger">
        <span className={!value?.length ? 'product-cascader-placeholder' : ''}>
          {displayText}
        </span>
        <span className="product-cascader-arrow">▼</span>
      </div>
    </Dropdown>
  );
}

export default ProductCascader;
