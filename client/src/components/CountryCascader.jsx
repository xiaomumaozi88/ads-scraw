import React, { useMemo } from 'react';
import { Cascader } from 'antd';
import countryData from '../data/type1.json';
import './CountryCascader.css';

// 中国内地区域 code（该区域及其子项不可选）
const CHINA_MAINLAND_REGION_CODE = '213_0_zgnd';

// 锁图标：表示不可选择
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="10" className="country-lock-icon" viewBox="0 0 8 10">
    <path d="M12 7a1 1 0 0 0-1-1h-.5V4.5a2.5 2.5 0 1 0-5 0V6H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1ZM6.72 4.5A1.168 1.168 0 0 1 8 3.2a1.214 1.214 0 0 1 1.267 1.3V6H6.72Z" transform="translate(-4 -2)" fill="rgb(148, 150, 166)" />
  </svg>
);

function CountryCascader({ value = [], onChange }) {
  // 将数据转换为 antd Cascader 需要的格式
  const options = useMemo(() => {
    const regions = [];
    const countriesByRegion = {};

    // 先收集所有地区和国家（注意：type1.json 中地区项在数组末尾，国家项在前，所以先遇到国家时建立 countriesByRegion，遇到地区时不要覆盖已有数组）
    countryData.data.forEach(item => {
      if (item.level === 2 && item.parentElementCode === null) {
        // 地区/大洲：只初始化空数组，不覆盖已收集的国家
        regions.push(item);
        if (!countriesByRegion[item.elementCode]) {
          countriesByRegion[item.elementCode] = [];
        }
      } else if (item.level === 3 && item.parentElementCode) {
        // 国家
        if (!countriesByRegion[item.parentElementCode]) {
          countriesByRegion[item.parentElementCode] = [];
        }
        countriesByRegion[item.parentElementCode].push(item);
      }
    });

    // 按 orderNum 排序
    regions.sort((a, b) => (b.orderNum || 0) - (a.orderNum || 0));
    Object.keys(countriesByRegion).forEach(key => {
      countriesByRegion[key].sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
    });

    // 转换为 antd Cascader 格式，国家项带国旗；中国内地及其子项带锁且不可选
    return regions.map(region => {
      const isChinaMainland = region.elementCode === CHINA_MAINLAND_REGION_CODE || region.nameCn === '中国内地';
      return {
        value: region.elementCode,
        searchLabel: region.nameCn,
        label: isChinaMainland ? (
          <span className="cascader-option-region cascader-option-region--locked">
            <LockIcon />
            <span>{region.nameCn}</span>
          </span>
        ) : region.nameCn,
        disabled: isChinaMainland,
        children: (countriesByRegion[region.elementCode] || []).map(country => ({
          value: country.ccode,
          searchLabel: country.nameCn,
          label: (
            <span className="cascader-option-country">
              {country.colorIcon ? (
                <img src={country.colorIcon} alt="" className="country-flag-icon" />
              ) : null}
              <span className="country-label-text">{country.nameCn}</span>
            </span>
          ),
          disabled: isChinaMainland
        }))
      };
    });
  }, []);

  // 建立国家代码到路径的映射
  const countryToPathMap = useMemo(() => {
    const map = {};
    countryData.data.forEach(item => {
      if (item.level === 3 && item.parentElementCode) {
        map[item.ccode] = [item.parentElementCode, item.ccode];
      }
    });
    return map;
  }, []);

  // 将 value (国家代码数组) 转换为 Cascader 需要的路径格式
  const cascaderValue = useMemo(() => {
    if (!value || value.length === 0) return [];
    
    // 为每个选中的国家代码找到对应的路径
    return value
      .map(countryCode => countryToPathMap[countryCode])
      .filter(Boolean);
  }, [value, countryToPathMap]);

  // 处理 Cascader 的变化
  const handleChange = (selectedPaths, selectedOptions) => {
    // selectedPaths 是二维数组，例如 [[regionCode1, countryCode1], [regionCode2, countryCode2]]
    // 我们需要提取所有的国家代码
    const countryCodes = selectedPaths.map(path => path[1]).filter(Boolean);
    onChange(countryCodes);
  };

  return (
    <Cascader
      options={options}
      value={cascaderValue}
      onChange={handleChange}
      multiple
      maxTagCount="responsive"
      expandTrigger="hover"
      placeholder="搜索国家/地区"
      showSearch={{
        filter: (inputValue, path) => {
          const keyword = inputValue.toLowerCase();
          return path.some(option => {
            const text = (option.searchLabel != null ? option.searchLabel : (typeof option.label === 'string' ? option.label : '')).toString().toLowerCase();
            return text.includes(keyword);
          });
        }
      }}
      className='country-cascader'
      style={{ width: '100%' }}
      popupClassName="country-cascader-popup"
      dropdownStyle={{ maxHeight: '500px', height: '500px' }}
      popupStyle={{ maxHeight: '500px' }}
    />
  );
}

export default CountryCascader;
