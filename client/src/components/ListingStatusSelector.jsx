import React, { useMemo } from 'react';
import { Select } from 'antd';
import listingStatusData from '../data/listingStatus.json';

function ListingStatusSelector({ value, onChange }) {
  // 处理数据：添加"全部 (默认)"选项，并按 orderNum 排序
  const options = useMemo(() => {
    const statuses = [
      {
        label: '全部 (默认)',
        value: '',
      },
      ...listingStatusData.data.map(item => ({
        label: item.nameCn,
        value: item.ccode,
      }))
    ].sort((a, b) => {
      if (a.value === '') return 1;
      if (b.value === '') return -1;
      const aItem = listingStatusData.data.find(d => d.ccode === a.value);
      const bItem = listingStatusData.data.find(d => d.ccode === b.value);
      return (bItem?.orderNum || 0) - (aItem?.orderNum || 0);
    });
    return statuses;
  }, []);

  return (
    <Select
      value={value || ''}
      onChange={onChange}
      options={options}
      placeholder="上架状态"
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      style={{ width: '100%' }}
    />
  );
}

export default ListingStatusSelector;
