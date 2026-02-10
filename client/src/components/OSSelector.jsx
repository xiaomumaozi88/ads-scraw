import React, { useMemo } from 'react';
import { Select } from 'antd';
import androidIcon from '../../assets/android.svg';
import iosIcon from '../../assets/ios.svg';

const iconStyle = { width: 18, height: 18, verticalAlign: 'middle', marginRight: 6 };

// 选项用字符串 value，避免 Antd Select 对数组 value 匹配失败
// API 约定：iOS → device: ["2"]，Android → device: ["1"]（均为字符串数组）
const VAL_ALL = 'all';
const VAL_IOS = 'ios';   // 选 iOS 时传 ["2"]
const VAL_ANDROID = 'android'; // 选 Android 时传 ["1"]

function normalizeDeviceValue(val) {
  if (!val || !Array.isArray(val)) return [];
  return val.map((v) => (v === 1 || v === '1' ? '1' : v === 2 || v === '2' ? '2' : String(v)));
}

function OSSelector({ value = [], onChange }) {
  const options = useMemo(() => [
    { label: '全部 (默认)', value: VAL_ALL },
    {
      label: (
        <span className="os-option">
          <img src={iosIcon} alt="" style={iconStyle} />
          <span>iOS</span>
        </span>
      ),
      value: VAL_IOS,
    },
    {
      label: (
        <span className="os-option">
          <img src={androidIcon} alt="" style={iconStyle} />
          <span>Android</span>
        </span>
      ),
      value: VAL_ANDROID,
    },
  ], []);

  const selectValue = useMemo(() => {
    const arr = normalizeDeviceValue(value);
    if (arr.length === 0) return VAL_ALL;
    if (arr.length === 2) return VAL_ALL;
    if (arr[0] === '2') return VAL_IOS;   // iOS 对应 ["2"]
    if (arr[0] === '1') return VAL_ANDROID; // Android 对应 ["1"]
    return VAL_ALL;
  }, [value]);

  const handleChange = (selectedValue) => {
    if (selectedValue === VAL_ALL || selectedValue == null) {
      onChange([]);
      return;
    }
    if (selectedValue === VAL_IOS) {
      onChange(['2']); // iOS → device: ["2"]
      return;
    }
    if (selectedValue === VAL_ANDROID) {
      onChange(['1']); // Android → device: ["1"]
      return;
    }
    onChange([]);
  };

  return (
    <Select
      value={selectValue}
      onChange={handleChange}
      options={options}
      placeholder="操作系统"
      style={{ width: '100%' }}
    />
  );
}

export default OSSelector;
