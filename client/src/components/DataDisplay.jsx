import React from 'react';
import CreativeCardInsightrackr from './CreativeCardInsightrackr';
import CreativeCardGuangdada from './CreativeCardGuangdada';
import SortSelector from './SortSelector';
import Pagination from './Pagination';
function DataDisplay({ data, platform, onSortChange, currentSearchParams, countData, mediaDistribute = {}, appDistribute = {}, onPageChange }) {
  if (!data) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
      </div>
    );
  }

  // 调试：输出数据结构
  console.log(`[${platform}] 数据提取 - 原始数据:`, data);
  console.log(`[${platform}] 数据提取 - data.data:`, data.data);
  if (data.data && data.data.data) {
    console.log(`[${platform}] 数据提取 - data.data.data:`, data.data.data);
    console.log(`[${platform}] 数据提取 - data.data.data.creative_list:`, data.data.data.creative_list);
  }

  // 检查是否有错误信息
  if (data.code && data.code !== 200 && data.message) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p className="error-message">{data.message}</p>
        </div>
      </div>
    );
  }

  // 提取列表数据
  let dataList = [];
  
  // 优先检查 creative_list 字段（广大大平台）
  // 注意：即使 platform 是 undefined，也要检查 creative_list
  if (data.data && data.data.creative_list && Array.isArray(data.data.creative_list)) {
    dataList = data.data.creative_list;
    console.log(`[${platform || 'guangdada'}] ✅ 从 data.data.creative_list 提取到 ${dataList.length} 条数据`);
  } else if (data.data && data.data.data && data.data.data.creative_list && Array.isArray(data.data.data.creative_list)) {
    dataList = data.data.data.creative_list;
    console.log(`[${platform || 'guangdada'}] ✅ 从 data.data.data.creative_list 提取到 ${dataList.length} 条数据`);
  } else if (data.creative_list && Array.isArray(data.creative_list)) {
    dataList = data.creative_list;
    console.log(`[${platform || 'guangdada'}] ✅ 从 data.creative_list 提取到 ${dataList.length} 条数据`);
  } else if (data.list && Array.isArray(data.list)) {
    // Insightrackr 平台：data.list
    dataList = data.list;
    console.log(`[${platform || 'insightrackr'}] ✅ 从 data.list 提取到 ${dataList.length} 条数据`);
  } else if (Array.isArray(data)) {
    dataList = data;
    console.log(`[${platform || 'unknown'}] ✅ 从 data (数组) 提取到 ${dataList.length} 条数据`);
  } else if (data.data) {
    if (Array.isArray(data.data)) {
      dataList = data.data;
      console.log(`[${platform || 'unknown'}] ✅ 从 data.data (数组) 提取到 ${dataList.length} 条数据`);
    } else if (data.data.list && Array.isArray(data.data.list)) {
      dataList = data.data.list;
      console.log(`[${platform || 'insightrackr'}] ✅ 从 data.data.list 提取到 ${dataList.length} 条数据`);
    } else if (data.data.data && Array.isArray(data.data.data)) {
      dataList = data.data.data;
      console.log(`[${platform || 'unknown'}] ✅ 从 data.data.data 提取到 ${dataList.length} 条数据`);
    } else if (data.data.items && Array.isArray(data.data.items)) {
      dataList = data.data.items;
      console.log(`[${platform || 'unknown'}] ✅ 从 data.data.items 提取到 ${dataList.length} 条数据`);
    }
  } else if (data.items && Array.isArray(data.items)) {
    dataList = data.items;
    console.log(`[${platform || 'unknown'}] ✅ 从 data.items 提取到 ${dataList.length} 条数据`);
  }
  
  console.log(`[${platform || 'unknown'}] 最终提取到的数据列表长度:`, dataList.length);
  
  // 如果还是没有找到数据，输出详细调试信息
  if (dataList.length === 0) {
    console.warn(`[${platform || 'unknown'}] ⚠️ 未找到数据，完整数据结构:`, {
      'data.data': data.data,
      'data.data.creative_list': data.data?.creative_list,
      'data.data.data': data.data?.data,
      'data.data.data.creative_list': data.data?.data?.creative_list,
      'data.list': data.list,
      'data.creative_list': data.creative_list,
      '完整数据': data
    });
  }

  if (dataList.length === 0) {
    return (
      <div className="data-container data-container--empty">
        <div className="data-placeholder">
          <p>暂无数据</p>
        </div>
      </div>
    );
  }

  // 处理排序变化
  const handleSortChange = (newSortParams) => {
    if (onSortChange && currentSearchParams) {
      // 更新搜索参数并重新搜索
      const updatedParams = {
        ...currentSearchParams,
        baseOption: {
          ...(currentSearchParams.baseOption || {}),
          sortField: newSortParams.sortField,
          sortRule: newSortParams.sortRule
        }
      };
      onSortChange(updatedParams);
    }
  };

  // 从currentSearchParams中获取排序信息
  const sortField = currentSearchParams?.baseOption?.sortField || '8';
  const sortRule = currentSearchParams?.baseOption?.sortRule || 'desc';
  
  // 分页信息：Insightrackr 用 countData，广大大用 data.data.total_count + currentSearchParams.page/pageSize
  const countInfo = countData?.data || countData;
  const totalSize = platform === 'guangdada'
    ? (data.data?.total_count ?? data.total_count ?? 0)
    : (countInfo?.totalSize ?? 0);
  const newNum = countInfo?.newNum ?? 0;
  const latestDate = countInfo?.latestDate ?? '';
  const currentPage = platform === 'guangdada'
    ? (currentSearchParams?.page ?? 1)
    : (currentSearchParams?.baseOption?.pageIndex || 1);
  const pageSize = platform === 'guangdada'
    ? (currentSearchParams?.pageSize ?? 60)
    : (currentSearchParams?.baseOption?.pageSize || 60);

  return (
    <div className="data-container">
      <div className="data-content">
        <div className="results-container">
          {dataList.map((item, index) => {
            const key = item.ad_key || item.id || item.search_flag || index;
            const creativeId = item.id || item.search_flag || item.ad_key || item.bizId || item.materialId;
            if (platform === 'guangdada') {
              return (
                <CreativeCardGuangdada 
                  key={key} 
                  item={item}
                />
              );
            } else {
              return (
                <CreativeCardInsightrackr 
                  key={key} 
                  item={item}
                  sortField={sortField}
                  sortRule={sortRule}
                  mediaChannels={creativeId ? (mediaDistribute[creativeId] || []) : []}
                  appList={creativeId ? (appDistribute[creativeId] || []) : []}
                />
              );
            }
          })}
        </div>
      </div>
      {totalSize > 0 && (
        <Pagination
          totalSize={totalSize}
          newNum={newNum}
          latestDate={latestDate}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

export default DataDisplay;
