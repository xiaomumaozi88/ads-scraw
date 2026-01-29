import React, { useMemo } from 'react';
import { Select } from 'antd';
import materialTagData from '../data/materialTag.json';

function MaterialTagSelector({ value = [], onChange }) {
  // 处理数据：按 orderNum 排序
  const options = useMemo(() => {
    return [...materialTagData.data]
      .sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0))
      .map(item => ({
        label: item.nameCn,
        value: item.ccode,
      }));
  }, []);

  return (
    <Select
      mode="multiple"
      value={value || []}
      onChange={onChange}
      options={options}
      placeholder="搜索素材标签"
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      maxTagCount="responsive"
      style={{ width: '100%' }}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
    />
  );
}

export default MaterialTagSelector;
