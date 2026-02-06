import React from 'react';
import { Select } from 'antd';
import './InsightrackrProductModelCheckbox.css';

// 与 Insightrackr 产品「产品模型」多选一致：非游戏(1)、休闲(5)、超休闲(2)、混合休闲(4)、娱乐场网赚(3)、中度(6)、重度(7)
const PRODUCT_MODEL_OPTIONS = [
  { label: '非游戏', value: '1' },
  { label: '休闲', value: '5' },
  { label: '超休闲', value: '2' },
  { label: '混合休闲', value: '4' },
  { label: '娱乐场网赚', value: '3' },
  { label: '中度', value: '6' },
  { label: '重度', value: '7' },
];

function InsightrackrProductModelCheckbox({ value = [], onChange }) {
  const selected = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];

  return (
    <Select
      mode="multiple"
      options={PRODUCT_MODEL_OPTIONS}
      value={selected}
      onChange={onChange}
      placeholder="请选择产品模型"
      maxTagCount="responsive"
      allowClear
      style={{ width: '100%' }}
      className="insightrackr-product-model-select"
      popupClassName="insightrackr-product-model-popup"
    />
  );
}

export default InsightrackrProductModelCheckbox;
