import React, { useMemo } from 'react';
import { Select } from 'antd';
import androidIcon from '../../assets/android.svg';
import iosIcon from '../../assets/ios.svg';

const iconStyle = { width: 18, height: 18, verticalAlign: 'middle', marginRight: 6 };

function OSSelector({ value = [], onChange }) {
  // 操作系统选项（使用 client/assets 中的平台 icon）
  const options = useMemo(() => [
    {
      label: '全部 (默认)',
      value: [],
    },
    {
      label: (
        <span className="os-option">
          <img src={iosIcon} alt="" style={iconStyle} />
          <span>iOS</span>
        </span>
      ),
      value: [1],
    },
    {
      label: (
        <span className="os-option">
          <img src={androidIcon} alt="" style={iconStyle} />
          <span>Android</span>
        </span>
      ),
      value: [2],
    }
  ], []);

  const handleChange = (selectedValue) => {
    onChange(selectedValue || []);
  };

  const currentValue = useMemo(() => {
    return options.find(opt => 
      JSON.stringify(opt.value) === JSON.stringify(value)
    )?.value || [];
  }, [value, options]);

  return (
    <Select
      value={currentValue}
      onChange={handleChange}
      options={options}
      placeholder="操作系统"
      style={{ width: '100%' }}
    />
  );
}

export default OSSelector;
