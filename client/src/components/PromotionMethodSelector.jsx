import React, { useMemo, useState, useEffect } from 'react';
import { Tree, Input, Button, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import promotionMethodData from '../data/promotionMethod.json';
import './PromotionMethodSelector.css';

function PromotionMethodSelector({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const { treeData, allSubCodes, mainToSubs } = useMemo(() => {
    const mainOptions = [];
    const subOptionsByMain = {};
    const mainToSubsMap = {};
    const allSubCodesSet = new Set();

    promotionMethodData.data.forEach(item => {
      if (item.level === 1 && !item.parentElementCode) {
        mainOptions.push(item);
        subOptionsByMain[item.elementCode] = [];
      } else if (item.level === 2 && item.parentElementCode) {
        if (!subOptionsByMain[item.parentElementCode]) {
          subOptionsByMain[item.parentElementCode] = [];
        }
        subOptionsByMain[item.parentElementCode].push(item);
        allSubCodesSet.add(item.ccode);
      }
    });

    mainOptions.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    Object.keys(subOptionsByMain).forEach(key => {
      subOptionsByMain[key].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
      mainToSubsMap[key] = (subOptionsByMain[key] || []).map(s => s.ccode);
    });

    const treeData = mainOptions.map(main => ({
      key: main.elementCode,
      title: main.nameCn,
      children: (subOptionsByMain[main.elementCode] || []).map(sub => ({
        key: sub.ccode,
        title: sub.nameCn,
      })),
    }));

    return {
      treeData,
      allSubCodes: allSubCodesSet,
      mainToSubs: mainToSubsMap,
    };
  }, []);

  const checkedKeys = useMemo(() => {
    const keys = [...(value || [])];
    Object.keys(mainToSubs).forEach(mainCode => {
      const children = mainToSubs[mainCode] || [];
      if (children.length > 0 && children.every(c => (value || []).includes(c))) {
        keys.push(mainCode);
      }
    });
    return keys;
  }, [value, mainToSubs]);

  const onCheck = (checkedKeysValue) => {
    const keys = Array.isArray(checkedKeysValue) ? checkedKeysValue : (checkedKeysValue.checked || []);
    const leafOnly = keys.filter(k => allSubCodes.has(k));
    onChange(leafOnly);
  };

  const filteredTreeData = useMemo(() => {
    if (!searchValue.trim()) return treeData;
    const kw = searchValue.toLowerCase();
    const filter = (nodes) =>
      nodes
        .map(node => {
          const title = typeof node.title === 'string' ? node.title : '';
          const match = title.toLowerCase().includes(kw);
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
    if (!value || value.length === 0) return '搜索推广方式';
    if (value.length <= 3) {
      const names = value.map(cc => {
        const s = promotionMethodData.data.find(item => item.level === 2 && item.ccode === cc);
        return s ? s.nameCn : cc;
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
    <div className="promotion-method-dropdown">
      <div className="promotion-method-dropdown-header">
        <Input
          placeholder="搜索推广方式"
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
      <div className="promotion-method-dropdown-content">
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={onCheck}
          expandedKeys={expandedKeys}
          autoExpandParent={autoExpandParent}
          onExpand={onExpand}
          treeData={filteredTreeData}
          className="promotion-method-tree"
          blockNode
        />
      </div>
      <div className="promotion-method-dropdown-footer">
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
      <div className="promotion-method-trigger">
        <span className={!value?.length ? 'promotion-method-placeholder' : ''}>
          {displayText}
        </span>
        <span className="promotion-method-arrow">▼</span>
      </div>
    </Dropdown>
  );
}

export default PromotionMethodSelector;
