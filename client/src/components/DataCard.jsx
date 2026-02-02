import React, { useState, useCallback } from 'react';
import { message as antdMessage } from 'antd';
import dayjs from 'dayjs';
import { searchData, getCount, getDistributeMedia, getDistributeApp, clearLogin, formatRequestError } from '../utils/api';
import SearchForm from './SearchForm';
import DataDisplay from './DataDisplay';
import TimeFilter from './TimeFilter';
import SortDedupBar from './SortDedupBar';

function DataCard({ platform, addLog, onRequireLogin, isLoggedIn }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [countData, setCountData] = useState(null);
  const [currentSearchParams, setCurrentSearchParams] = useState(null);
  const [mediaDistribute, setMediaDistribute] = useState({});
  const [appDistribute, setAppDistribute] = useState({});
  const [batchDownloadMode, setBatchDownloadMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAllPage = useCallback((ids) => {
    setSelectedIds(new Set(ids));
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);
  const exitBatchMode = useCallback(() => {
    setBatchDownloadMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSearch = async (searchParams) => {
    // 保存当前搜索参数
    setCurrentSearchParams(searchParams);
    setLoading(true);
    setData(null);
    setCountData(null);

    const keyword = platform === 'guangdada' ? (searchParams.keyword ?? searchParams.keyWord) : searchParams.keyWord;
    addLog(`开始查询数据 [${platform}]，关键词: ${keyword}`, 'info');

    try {
      // 并行请求搜索数据和总数
      const [searchResult, countResult] = await Promise.all([
        searchData(platform, searchParams),
        (platform === 'insightrackr' || platform === 'guangdada')
          ? getCount(platform, searchParams).catch(err => {
              addLog(`获取总数失败: ${err.message}`, 'warn');
              return { success: false, data: null };
            })
          : Promise.resolve({ success: false, data: null })
      ]);

      if (searchResult.success) {
        addLog('数据查询成功', 'success');
        setData(searchResult.data);
        setMediaDistribute({});
        setAppDistribute({});

        // count 接口：Insightrackr 为 { data: { code, data: { totalSize, newNum, latestDate } } }；广大大为 { data: { id, data: { result_total, all_total, default_total } } }
        if (countResult.success && countResult.data) {
          const inner = platform === 'guangdada' ? countResult.data : (countResult.data.data || countResult.data);
          setCountData(inner);
        }

        // Insightrackr：用当前列表创意 id 拉取流量分布渠道与 App 信息
        if (platform === 'insightrackr' && searchResult.data) {
          const raw = searchResult.data;
          const list = raw?.list || raw?.data?.list || (Array.isArray(raw?.data) ? raw.data : []);
          const ids = list.map((item) => item.id || item.search_flag || item.ad_key || item.bizId || item.materialId).filter(Boolean);
          if (ids.length > 0) {
            const body = { ...searchParams, ids };
            Promise.all([
              getDistributeMedia(platform, body).catch((e) => {
                addLog(`流量分布渠道获取失败: ${e.message}`, 'warn');
                return { data: {} };
              }),
              getDistributeApp(platform, body).catch((e) => {
                addLog(`App 信息获取失败: ${e.message}`, 'warn');
                return { data: {} };
              }),
            ]).then(([mediaRes, appRes]) => {
              setMediaDistribute(mediaRes.data || {});
              setAppDistribute(appRes.data || {});
            });
          }
        }
      } else {
        addLog(`查询失败: ${searchResult.message}`, 'error');
        antdMessage.error(formatRequestError(searchResult.message || '查询失败'));
      }
    } catch (error) {
      // 检查是否需要重新登录：直接弹出登录框，不显示错误文案
      if (error.requiresLogin) {
        addLog(`登录状态已失效: ${error.message}`, 'error');

        // 清除登录状态
        try {
          await clearLogin(platform);
          addLog('已清除登录状态', 'info');
        } catch (clearError) {
          addLog(`清除登录状态失败: ${clearError.message}`, 'error');
        }

        // 直接弹出登录框
        if (onRequireLogin) {
          onRequireLogin();
        }
      } else {
        addLog(`查询请求失败: ${error.message}`, 'error');
        antdMessage.error(formatRequestError(error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const dateRangeValue = currentSearchParams
    ? (platform === 'guangdada'
        ? {
            startTime: currentSearchParams.seen_begin != null
              ? dayjs(currentSearchParams.seen_begin * 1000).format('YYYY-MM-DD')
              : dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
            endTime: currentSearchParams.seen_end != null
              ? dayjs(currentSearchParams.seen_end * 1000).format('YYYY-MM-DD')
              : dayjs().format('YYYY-MM-DD')
          }
        : { startTime: currentSearchParams.baseOption?.startTime, endTime: currentSearchParams.baseOption?.endTime })
    : { startTime: dayjs().subtract(1, 'year').format('YYYY-MM-DD'), endTime: dayjs().format('YYYY-MM-DD') };

  const handleDateChange = (dateRange) => {
    if (!dateRange?.startTime || !dateRange?.endTime) return;
    if (currentSearchParams) {
      const updatedParams =
        platform === 'guangdada'
          ? {
              ...currentSearchParams,
              seen_begin: Math.floor(new Date(dateRange.startTime).getTime() / 1000),
              seen_end: Math.floor(new Date(dateRange.endTime).getTime() / 1000)
            }
          : {
              ...currentSearchParams,
              baseOption: {
                ...(currentSearchParams.baseOption || {}),
                startTime: dateRange.startTime,
                endTime: dateRange.endTime
              }
            };
      handleSearch(updatedParams);
    }
  };

  const handleSortDedupChange = (updates) => {
    if (platform !== 'guangdada') return;
    if (currentSearchParams) {
      handleSearch({ ...currentSearchParams, ...updates });
    }
  };

  return (
    <div className="card data-card">
      <SearchForm
        platform={platform}
        onSearch={handleSearch}
        loading={loading}
        guangdadaSortField={platform === 'guangdada' ? currentSearchParams?.sort_field : undefined}
        guangdadaDedupType={platform === 'guangdada' ? currentSearchParams?.duplicate_removal : undefined}
      />
      <div className="data-area">
        {platform === 'guangdada' && (
          <>
            <TimeFilter value={dateRangeValue} onChange={handleDateChange} />
            <SortDedupBar
            sortField={currentSearchParams?.sort_field ?? '-first_seen'}
            dedupType={currentSearchParams?.duplicate_removal ?? 0}
            hasKeyword={!!(currentSearchParams?.keyWord?.trim())}
            onSortChange={(sort_field) => handleSortDedupChange({ sort_field })}
            onDedupChange={(duplicate_removal) => handleSortDedupChange({ duplicate_removal })}
            />
          </>
        )}
        {loading && (
          <div className="data-container data-container--loading">
            <div className="data-placeholder">
              <span className="data-loading-spinner" aria-hidden="true" />
              <p>加载中...</p>
            </div>
          </div>
        )}
        {!loading && !data && (
          <div className="data-container data-container--empty">
            <div className="data-placeholder">
              <p>{isLoggedIn ? '暂无数据' : '登录后查看数据'}</p>
            </div>
          </div>
        )}
        {!loading && data && (
          <DataDisplay
            data={data}
            platform={platform}
            onSortChange={handleSearch}
            currentSearchParams={currentSearchParams}
            countData={countData}
            mediaDistribute={mediaDistribute}
            appDistribute={appDistribute}
            batchDownloadMode={batchDownloadMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAllPage={selectAllPage}
            onBatchDownloadCancel={exitBatchMode}
            onEnterBatchMode={() => setBatchDownloadMode(true)}
            onExitBatchMode={exitBatchMode}
            onPageChange={(page) => {
              if (currentSearchParams) {
                const updatedParams = platform === 'guangdada'
                  ? { ...currentSearchParams, page }
                  : {
                      ...currentSearchParams,
                      baseOption: {
                        ...(currentSearchParams.baseOption || {}),
                        pageIndex: page
                      }
                    };
                handleSearch(updatedParams);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default DataCard;
