import React, { useMemo, useState, useEffect } from 'react';
import { Tree, Input, Button, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import countryData from '../data/type1.json';
import './CountryCascader.css';

const CHINA_MAINLAND_REGION_CODE = '213_0_zgnd';

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="10" className="country-lock-icon" viewBox="0 0 8 10">
    <path d="M12 7a1 1 0 0 0-1-1h-.5V4.5a2.5 2.5 0 1 0-5 0V6H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1ZM6.72 4.5A1.168 1.168 0 0 1 8 3.2a1.214 1.214 0 0 1 1.267 1.3V6H6.72Z" transform="translate(-4 -2)" fill="rgb(148, 150, 166)" />
  </svg>
);

function CountryCascader({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const { treeData, allCountryCodes, regionToCountries } = useMemo(() => {
    const regions = [];
    const countriesByRegion = {};
    const regionToCountriesMap = {};
    const allCountryCodesSet = new Set();

    countryData.data.forEach(item => {
      if (item.level === 2 && item.parentElementCode === null) {
        regions.push(item);
        if (!countriesByRegion[item.elementCode]) countriesByRegion[item.elementCode] = [];
      } else if (item.level === 3 && item.parentElementCode) {
        if (!countriesByRegion[item.parentElementCode]) countriesByRegion[item.parentElementCode] = [];
        countriesByRegion[item.parentElementCode].push(item);
        allCountryCodesSet.add(item.ccode);
      }
    });

    regions.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    Object.keys(countriesByRegion).forEach(key => {
      countriesByRegion[key].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
      regionToCountriesMap[key] = (countriesByRegion[key] || []).map(c => c.ccode);
    });

    const isChinaMainland = (code) => code === CHINA_MAINLAND_REGION_CODE;

    const treeData = regions.map(region => {
      const locked = isChinaMainland(region.elementCode) || region.nameCn === '中国内地';
      return {
        key: region.elementCode,
        title: locked ? (
          <span className="cascader-option-region cascader-option-region--locked">
            <LockIcon />
            <span>{region.nameCn}</span>
          </span>
        ) : region.nameCn,
        searchLabel: region.nameCn,
        disabled: locked,
        children: (countriesByRegion[region.elementCode] || []).map(country => ({
          key: country.ccode,
          title: (
            <span className="cascader-option-country">
              {country.colorIcon ? (
                <img src={country.colorIcon} alt="" className="country-flag-icon" />
              ) : null}
              <span className="country-label-text">{country.nameCn}</span>
            </span>
          ),
          searchLabel: country.nameCn,
          disabled: locked,
        })),
      };
    });

    return {
      treeData,
      allCountryCodes: allCountryCodesSet,
      regionToCountries: regionToCountriesMap,
    };
  }, []);

  // 从 value（仅国家代码）计算 Tree 的 checkedKeys：若某地区下所有国家都选中，则勾选该地区
  const checkedKeys = useMemo(() => {
    const keys = [...(value || [])];
    Object.keys(regionToCountries).forEach(regionCode => {
      const children = regionToCountries[regionCode] || [];
      if (children.length > 0 && children.every(c => (value || []).includes(c))) {
        keys.push(regionCode);
      }
    });
    return keys;
  }, [value, regionToCountries]);

  const onCheck = (checkedKeysValue) => {
    const keys = Array.isArray(checkedKeysValue) ? checkedKeysValue : (checkedKeysValue.checked || []);
    const leafOnly = keys.filter(k => allCountryCodes.has(k));
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
    if (!value || value.length === 0) return '搜索国家/地区';
    if (value.length <= 3) {
      const names = value.map(cc => {
        const c = countryData.data.find(item => item.level === 3 && item.ccode === cc);
        return c ? c.nameCn : cc;
      });
      return names.join(', ');
    }
    return `已选择 ${value.length} 个国家/地区`;
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
    <div className="country-cascader-dropdown">
      <div className="country-cascader-dropdown-header">
        <Input
          placeholder="搜索国家/地区"
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
      <div className="country-cascader-dropdown-content">
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={onCheck}
          expandedKeys={expandedKeys}
          autoExpandParent={autoExpandParent}
          onExpand={onExpand}
          treeData={filteredTreeData}
          className="country-cascader-tree"
          blockNode
        />
      </div>
      <div className="country-cascader-dropdown-footer">
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
      <div className="country-cascader-trigger">
        <span className={!value?.length ? 'country-cascader-placeholder' : ''}>
          {displayText}
        </span>
        <span className="country-cascader-arrow">▼</span>
      </div>
    </Dropdown>
  );
}

export default CountryCascader;
