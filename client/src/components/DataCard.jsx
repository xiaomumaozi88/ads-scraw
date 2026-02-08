import React, { useState, useCallback } from 'react';
import { message as antdMessage } from 'antd';
import dayjs from 'dayjs';
import { getTodayBeijingDayjs, getTodayBeijingStr } from '../utils/beijingDate';
import { searchData, getCount, getDistributeMedia, getDistributeApp, clearLogin, formatRequestError, guangdadaMultiModalSearch } from '../utils/api';
import { dateRangeToSeenParams } from '../utils/guangdadaApiBody';
import SearchForm from './SearchForm';
import DataDisplay from './DataDisplay';
import TimeFilter from './TimeFilter';
import SortDedupBar from './SortDedupBar';

/** 广大大 count 数值格式化为「万、百万、千万、亿」等 */
function formatGuangdadaCount(num) {
  if (num == null || num === '') return '—';
  const n = Number(num);
  if (!Number.isFinite(n) || n < 0) return '—';
  const fmt = (val) => (val % 1 === 0 ? String(val) : val.toFixed(1));
  if (n >= 1e8) return `${fmt(n / 1e8)}亿`;
  if (n >= 1e7) return `${fmt(n / 1e7)}千万`;
  if (n >= 1e6) return `${fmt(n / 1e6)}百万`;
  if (n >= 1e4) return `${fmt(n / 1e4)}万`;
  return `${n}`;
}

function DataCard({ platform, addLog, onRequireLogin, isLoggedIn, onBatchModeEnteredWithHint, refreshPlatformStatus }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [countData, setCountData] = useState(null);
  const [currentSearchParams, setCurrentSearchParams] = useState(null);
  const [mediaDistribute, setMediaDistribute] = useState({});
  const [appDistribute, setAppDistribute] = useState({});
  const [batchDownloadMode, setBatchDownloadMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  /** Insightrackr 顶部 Tab：图片和视频 | 试玩广告 */
  const [insightrackrSearchTab, setInsightrackrSearchTab] = useState('imagevideo');
  /** Insightrackr 双 Tab 各自维护：表单状态（切换 tab 时恢复） */
  const [insightrackrFormByTab, setInsightrackrFormByTab] = useState({ imagevideo: null, playable: null });
  /** Insightrackr 双 Tab 各自维护：搜索结果（data、countData、params、mediaDistribute、appDistribute） */
  const [insightrackrResultByTab, setInsightrackrResultByTab] = useState({
    imagevideo: { data: null, countData: null, params: null, mediaDistribute: {}, appDistribute: {} },
    playable: { data: null, countData: null, params: null, mediaDistribute: {}, appDistribute: {} },
  });

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
    const isInsightrackrTab = platform === 'insightrackr';
    const tab = isInsightrackrTab ? (searchParams.insightrackrSearchTab === 'playable' ? 'playable' : 'imagevideo') : null;

    if (!isInsightrackrTab) {
      setCurrentSearchParams(searchParams);
    } else {
      setInsightrackrResultByTab((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], data: null, countData: null, params: searchParams, mediaDistribute: {}, appDistribute: {} },
      }));
    }
    setLoading(true);
    if (!isInsightrackrTab) {
      setData(null);
      setCountData(null);
    }

    const keyword = platform === 'guangdada' ? (searchParams.keyword ?? searchParams.keyWord) : searchParams.keyWord;
    addLog(`开始查询数据 [${platform}]，关键词: ${keyword}`, 'info');

    let paramsToUse = searchParams;
    if (platform === 'guangdada' && (searchParams.guangdada_search_category || searchParams.guangdadaSearchCategory) === '素材内容') {
      const kw = searchParams.keyword ?? searchParams.keyWord;
      const kwStr = typeof kw === 'string' ? kw.trim() : (Array.isArray(kw) && kw.length > 0 ? String(kw[0]).trim() : '');
      if (kwStr) {
        try {
          const multiRes = await guangdadaMultiModalSearch(kwStr);
          if (multiRes.success && multiRes.data && multiRes.data.multimodal_md5) {
            paramsToUse = { ...searchParams, multimodal_md5: multiRes.data.multimodal_md5 };
            addLog('multi-modal-search 成功，已带入 list/count', 'info');
          } else if (!multiRes.success) {
            addLog(`multi-modal-search 失败: ${multiRes.message || '未返回 multimodal_md5'}`, 'warn');
          }
        } catch (err) {
          addLog(`multi-modal-search 请求异常: ${err.message}`, 'warn');
        }
      }
    }

    try {
      // 并行请求搜索数据和总数
      const [searchResult, countResult] = await Promise.all([
        searchData(platform, paramsToUse),
        (platform === 'insightrackr' || platform === 'guangdada')
          ? getCount(platform, paramsToUse).catch(err => {
              addLog(`获取总数失败: ${err.message}`, 'warn');
              return { success: false, data: null };
            })
          : Promise.resolve({ success: false, data: null })
      ]);

      if (searchResult.success) {
        addLog('数据查询成功', 'success');
        const countInner = countResult.success && countResult.data
          ? (platform === 'guangdada' ? countResult.data : (countResult.data.data || countResult.data))
          : null;

        if (isInsightrackrTab && tab) {
          setInsightrackrResultByTab((prev) => ({
            ...prev,
            [tab]: {
              ...prev[tab],
              data: searchResult.data,
              countData: countInner,
              params: searchParams,
              mediaDistribute: {},
              appDistribute: {},
            },
          }));

          // Insightrackr：用当前列表创意 id 拉取流量分布渠道与 App 信息
          if (searchResult.data) {
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
                setInsightrackrResultByTab((prev) => ({
                  ...prev,
                  [tab]: {
                    ...prev[tab],
                    mediaDistribute: mediaRes.data || {},
                    appDistribute: appRes.data || {},
                  },
                }));
              });
            }
          }
        } else {
          setData(searchResult.data);
          setCurrentSearchParams(searchParams);
          setMediaDistribute({});
          setAppDistribute({});
          setCountData(countInner);
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
        }
      } else {
        addLog(`查询失败: ${searchResult.message}`, 'error');
        antdMessage.error(formatRequestError(searchResult.message || '查询失败'));
      }
    } catch (error) {
      // 检查是否需要重新登录：直接弹出登录框，不显示错误文案
      if (error.requiresLogin) {
        addLog(`登录状态已失效: ${error.message}`, 'error');

        // 清除登录状态并刷新状态，使头部切换为未登录
        try {
          await clearLogin(platform);
          addLog('已清除登录状态', 'info');
          if (refreshPlatformStatus) {
            await refreshPlatformStatus(platform);
          }
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

  const todayBeijing = getTodayBeijingDayjs();
  const effectiveParams = platform === 'insightrackr' ? insightrackrResultByTab[insightrackrSearchTab]?.params : currentSearchParams;
  const effectiveData = platform === 'insightrackr' ? insightrackrResultByTab[insightrackrSearchTab]?.data : data;
  const effectiveCountData = platform === 'insightrackr' ? insightrackrResultByTab[insightrackrSearchTab]?.countData : countData;
  const effectiveMediaDistribute = platform === 'insightrackr' ? (insightrackrResultByTab[insightrackrSearchTab]?.mediaDistribute || {}) : mediaDistribute;
  const effectiveAppDistribute = platform === 'insightrackr' ? (insightrackrResultByTab[insightrackrSearchTab]?.appDistribute || {}) : appDistribute;

  const dateRangeValue = effectiveParams
    ? (platform === 'guangdada'
        ? {
            startTime: effectiveParams.startTime ?? (effectiveParams.seen_begin != null
              ? dayjs(effectiveParams.seen_begin * 1000).format('YYYY-MM-DD')
              : todayBeijing.subtract(1, 'year').format('YYYY-MM-DD')),
            endTime: effectiveParams.endTime ?? (effectiveParams.seen_end != null
              ? dayjs(effectiveParams.seen_end * 1000).format('YYYY-MM-DD')
              : todayBeijing.format('YYYY-MM-DD'))
          }
        : { startTime: effectiveParams.baseOption?.startTime, endTime: effectiveParams.baseOption?.endTime })
    : { startTime: todayBeijing.subtract(1, 'year').format('YYYY-MM-DD'), endTime: todayBeijing.format('YYYY-MM-DD') };

  const handleDateChange = (dateRange) => {
    if (!dateRange?.startTime || !dateRange?.endTime) return;
    if (effectiveParams) {
      const updatedParams =
        platform === 'guangdada'
          ? {
              ...effectiveParams,
              startTime: dateRange.startTime,
              endTime: dateRange.endTime,
              ...dateRangeToSeenParams(dateRange.startTime, dateRange.endTime)
            }
          : {
              ...effectiveParams,
              baseOption: {
                ...(effectiveParams.baseOption || {}),
                startTime: dateRange.startTime,
                endTime: dateRange.endTime
              }
            };
      handleSearch(updatedParams);
    }
  };

  const handleSortDedupChange = (updates) => {
    if (platform !== 'guangdada') return;
    if (effectiveParams) {
      handleSearch({ ...effectiveParams, ...updates });
    }
  };

  return (
    <div className="card data-card">
      {platform === 'insightrackr' && (
        <div className="insightrackr-search-tabs">
          <button
            type="button"
            className={`insightrackr-search-tab ${insightrackrSearchTab === 'imagevideo' ? 'active' : ''}`}
            onClick={() => setInsightrackrSearchTab('imagevideo')}
          >
            图片和视频
          </button>
          <button
            type="button"
            className={`insightrackr-search-tab ${insightrackrSearchTab === 'playable' ? 'active' : ''}`}
            onClick={() => setInsightrackrSearchTab('playable')}
          >
            试玩广告
          </button>
        </div>
      )}
      <SearchForm
        platform={platform}
        onSearch={handleSearch}
        loading={loading}
        guangdadaSortField={platform === 'guangdada' ? effectiveParams?.sort_field : undefined}
        guangdadaDedupType={platform === 'guangdada' ? effectiveParams?.duplicate_removal : undefined}
        guangdadaDateRange={platform === 'guangdada' ? dateRangeValue : undefined}
        insightrackrSearchTab={platform === 'insightrackr' ? insightrackrSearchTab : undefined}
        insightrackrInitialFormData={platform === 'insightrackr' ? insightrackrFormByTab[insightrackrSearchTab] : undefined}
        onInsightrackrFormDataChange={platform === 'insightrackr' ? (formData) => setInsightrackrFormByTab((prev) => ({ ...prev, [insightrackrSearchTab]: formData })) : undefined}
      />
      <div className="data-area">
        {platform === 'guangdada' && (
          <>
            <div className="time-filter-row">
              <TimeFilter value={dateRangeValue} onChange={handleDateChange} />
              {effectiveCountData?.data && (
                <div className="guangdada-count-info">
                  共找到{' '}{formatGuangdadaCount(effectiveCountData.data.all_total)}{' '}个相关广告，
                  <span className="guangdada-count-highlight">默认去重后</span>
                  {' '}{formatGuangdadaCount(effectiveCountData.data.default_total)}，
                  <span className="guangdada-count-highlight">按广告严格去重后</span>{' '}
                  {' '}{formatGuangdadaCount(effectiveCountData.data.result_total)}{' '}
                </div>
              )}
            </div>
            <SortDedupBar
            sortField={effectiveParams?.sort_field ?? '-first_seen'}
            dedupType={effectiveParams?.duplicate_removal ?? 0}
            hasKeyword={platform === 'guangdada'
              ? (() => {
                  const kw = effectiveParams?.keyword;
                  if (kw == null) return false;
                  if (typeof kw === 'string') return !!String(kw).trim();
                  return Array.isArray(kw) && kw.some((k) => String(k).trim());
                })()
              : !!(effectiveParams?.keyWord?.trim())}
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
        {!loading && !effectiveData && (
          <div className="data-container data-container--empty">
            <div className="data-placeholder">
              <p>{isLoggedIn ? '暂无数据' : '登录后查看数据'}</p>
            </div>
          </div>
        )}
        {!loading && effectiveData && (
          <DataDisplay
            data={effectiveData}
            platform={platform}
            onSortChange={handleSearch}
            currentSearchParams={effectiveParams}
            countData={effectiveCountData}
            mediaDistribute={effectiveMediaDistribute}
            appDistribute={effectiveAppDistribute}
            batchDownloadMode={batchDownloadMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAllPage={selectAllPage}
            onBatchDownloadCancel={exitBatchMode}
            onEnterBatchMode={() => setBatchDownloadMode(true)}
            onBatchModeEnteredWithHint={onBatchModeEnteredWithHint}
            onExitBatchMode={exitBatchMode}
            onPageChange={(page) => {
              if (effectiveParams) {
                const updatedParams = platform === 'guangdada'
                  ? { ...effectiveParams, page }
                  : {
                      ...effectiveParams,
                      baseOption: {
                        ...(effectiveParams.baseOption || {}),
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
