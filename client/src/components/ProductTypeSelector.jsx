import React, { useMemo } from 'react';
import { Select } from 'antd';
import productTypeData from '../data/productType.json';
import androidIcon from '../../assets/android.svg';
import iosIcon from '../../assets/ios.svg';
import websiteIcon from '../../assets/website.svg';
import pcgameIcon from '../../assets/端游.svg';

const iconStyle = { width: 18, height: 18, verticalAlign: 'middle', marginRight: 6 };

function ProductTypeSelector({ value, onChange }) {
  // 处理数据：添加"全部 (默认)"选项，并按 orderNum 排序
  const options = useMemo(() => {
    const types = [
      {
        label: '全部 (默认)',
        value: '',
      },
      ...productTypeData.data.map(item => {
        let label = item.nameCn;
        if (item.nameCn === 'App') {
          label = (
            <span className="product-type-option">
              <img src={androidIcon} alt="" style={iconStyle} />
              <img src={iosIcon} alt="" style={{ ...iconStyle, marginRight: 2 }} />
              <span>App</span>
            </span>
          );
        } else if (item.nameCn === '端游') {
          label = (
            <span className="product-type-option">
              <img src={pcgameIcon} alt="" style={iconStyle} />
              <span>端游</span>
            </span>
          );
        } else if (item.nameCn === 'Website') {
          label = (
            <span className="product-type-option">
              <img src={websiteIcon} alt="" style={iconStyle} />
              <span>Website</span>
            </span>
          );
        }
        return {
          label,
          value: item.ccode,
          searchLabel: item.nameCn,
        };
      })
    ].sort((a, b) => {
      if (a.value === '') return 1;
      if (b.value === '') return -1;
      const aItem = productTypeData.data.find(d => d.ccode === a.value);
      const bItem = productTypeData.data.find(d => d.ccode === b.value);
      return (bItem?.orderNum || 0) - (aItem?.orderNum || 0);
    });
    return types;
  }, []);

  return (
    <Select
      value={value || ''}
      onChange={onChange}
      options={options}
      placeholder="产品类型"
      showSearch
      filterOption={(input, option) => {
        const text = (option?.searchLabel ?? option?.label ?? '');
        return (typeof text === 'string' ? text : '').toLowerCase().includes(input.toLowerCase());
      }}
      style={{ width: '100%' }}
    />
  );
}

export default ProductTypeSelector;
