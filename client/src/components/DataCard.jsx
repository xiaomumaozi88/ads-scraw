import React, { useState, useCallback, useRef } from 'react';
import { message as antdMessage } from 'antd';
import dayjs from 'dayjs';
import { getTodayBeijingDayjs, getTodayBeijingStr } from '../utils/beijingDate';
import {
  searchData,
  getCount,
  getDistributeMedia,
  getDistributeApp,
  clearLogin,
  formatRequestError,
  guangdadaMultiModalSearch,
  getGuangdadaHiddenInfo,
  searchGuangdadaCnAdInfo,
} from '../utils/api';
import { dateRangeToSeenParams } from '../utils/guangdadaApiBody';
import { DOMESTIC_AD_INFO_PAGE_SIZE } from '../utils/guangdadaDomesticAdInfo';
import SearchForm from './SearchForm';
import GuangdadaDomesticSearchForm from './GuangdadaDomesticSearchForm';
import GuangdadaDomesticShortcutBar from './GuangdadaDomesticShortcutBar';
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function videoFileFirstFrameToDataUrl(file) {
  return new Promise((resolve) => {
    let objectUrl = null;
    try {
      const video = document.createElement('video');
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const cleanup = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      const captureFrame = () => {
        try {
          const w = video.videoWidth || 0;
          const h = video.videoHeight || 0;
          if (!w || !h) return '';
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return '';
          ctx.drawImage(video, 0, 0, w, h);
          return canvas.toDataURL('image/jpeg', 0.9);
        } catch (e) {
          return '';
        }
      };

      video.addEventListener('loadedmetadata', () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        // 避开 0 秒黑帧，优先取前段非首帧
        const targetTime = duration > 0 ? Math.min(1, Math.max(0.2, duration * 0.1)) : 0.2;

        const onSeeked = () => {
          const frame = captureFrame();
          cleanup();
          resolve(frame);
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        try {
          video.currentTime = targetTime;
        } catch (e) {
          video.removeEventListener('seeked', onSeeked);
          const frame = captureFrame();
          cleanup();
          resolve(frame);
        }
      }, { once: true });

      video.addEventListener('error', () => {
        cleanup();
        resolve('');
      }, { once: true });
    } catch (e) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve('');
    }
  });
}

function inferPreviewTypeFromUrl(url) {
  const u = String(url || '').toLowerCase();
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|#|$)/.test(u) ? 'video' : 'image';
}

async function resolveMultimodalPreview(mr, cdnUrl) {
  const result = {
    previewUrl: cdnUrl ? String(cdnUrl).trim() : '',
    previewType: 'image',
  };
  if (!mr || typeof mr !== 'object') return result;

  if (mr.mode === 'url') {
    result.previewType = inferPreviewTypeFromUrl(mr.url);
    return result;
  }

  if (mr.mode === 'file' && mr.file) {
    const isVideo = mr.media === 'video' || (mr.file.type && mr.file.type.startsWith('video/'));
    result.previewType = isVideo ? 'video' : 'image';
    if (isVideo) {
      const frame = await videoFileFirstFrameToDataUrl(mr.file);
      if (frame) result.previewUrl = frame;
    } else if (!result.previewUrl) {
      const imgDataUrl = await fileToDataUrl(mr.file);
      if (imgDataUrl) result.previewUrl = imgDataUrl;
    }
  }
  return result;
}

async function resolveMultimodalLocalPreview(mr) {
  if (!mr || typeof mr !== 'object') return { previewUrl: '', previewType: 'image' };
  if (mr.mode === 'url') {
    return { previewUrl: '', previewType: inferPreviewTypeFromUrl(mr.url) };
  }
  if (mr.mode === 'file' && mr.file) {
    const isVideo = mr.media === 'video' || (mr.file.type && mr.file.type.startsWith('video/'));
    if (isVideo) {
      const frame = await videoFileFirstFrameToDataUrl(mr.file);
      return { previewUrl: frame || '', previewType: 'video' };
    }
    const imgDataUrl = await fileToDataUrl(mr.file);
    return { previewUrl: imgDataUrl || '', previewType: 'image' };
  }
  return { previewUrl: '', previewType: 'image' };
}

function DataCard({
  platform,
  addLog,
  onRequireLogin,
  isLoggedIn,
  insightrackrStatusConfirmed = false,
  onBatchModeEnteredWithHint,
  refreshPlatformStatus,
}) {
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
  /** 广大大：已屏蔽的广告主（不看该广告主创意），用于 exclude_advertiser_key */
  const [blockedAdvertisers, setBlockedAdvertisers] = useState([]);
  /** 广大大：未查询前点击 time-filter（7天/30天等）时暂存的日期范围，用于与 SearchForm 同步，查询后由 currentSearchParams 接管 */
  const [guangdadaPendingDateRange, setGuangdadaPendingDateRange] = useState(null);
  /** 进入页面且已登录时请求 SearchForm 用默认参数发起一次查询（仅请求一次） */
  const [requestDefaultSearch, setRequestDefaultSearch] = useState(false);
  /** 广大大：国际版（现有）| 国内版（独立搜索栏，接口待接） */
  const [guangdadaEdition, setGuangdadaEdition] = useState('global');
  /** 国内版 BBA ad-info 最近一次响应（列表 UI 待接） */
  const [domesticAdInfoResult, setDomesticAdInfoResult] = useState(null);
  /** 国内版：上次完整请求参数（用于快捷栏改推荐/排序时复用） */
  const domesticLastPayloadRef = useRef(null);
  /** 国内版：快捷「推荐」对应 search_content，空字符串表示「全部」用主搜索框 keyword */
  const [domesticRecommendedKey, setDomesticRecommendedKey] = useState('');
  /** 国内版：sort，默认与官网一致 1=最后看见 */
  const [domesticSort, setDomesticSort] = useState(1);
  /** 国内版列表当前页（与 BBA ad-info 的 page 参数一致） */
  const [domesticListPage, setDomesticListPage] = useState(1);
  /** 国内版：最近一次请求完成时间（用于统计区「更新时间」兜底） */
  const [domesticFetchedAt, setDomesticFetchedAt] = useState(null);
  /** 国内版：切换到国内版且已登录时递增，触发搜索表单与手动「搜索」一致的一次提交 */
  const [domesticAutoSearchKey, setDomesticAutoSearchKey] = useState(0);
  const domesticAutoSearchPrevRef = useRef({ domestic: false, logged: false });
  /** 国内版搜索表单 ref：推荐/排序在无上次请求时也可 submit */
  const domesticFormRef = useRef(null);
  /** 与 state 同步，供 handleDomesticFormSearch 在同步 submit 前读到最新 sort / 推荐 */
  const domesticSortRef = useRef(domesticSort);
  const domesticRecommendedKeyRef = useRef(domesticRecommendedKey);
  domesticSortRef.current = domesticSort;
  domesticRecommendedKeyRef.current = domesticRecommendedKey;

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
    if (platform === 'guangdada') setGuangdadaPendingDateRange(null);
    let paramsToUse = searchParams;
    if (platform === 'guangdada' && blockedAdvertisers.length > 0 && searchParams.exclude_advertiser_key === undefined) {
      paramsToUse = { ...searchParams, exclude_advertiser_key: blockedAdvertisers.map((b) => b.advertiser_id) };
    }
    const isInsightrackrTab = platform === 'insightrackr';
    const tab = isInsightrackrTab ? (paramsToUse.insightrackrSearchTab === 'playable' ? 'playable' : 'imagevideo') : null;

    if (!isInsightrackrTab) {
      setCurrentSearchParams(paramsToUse);
    } else {
      setInsightrackrResultByTab((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], data: null, countData: null, params: paramsToUse, mediaDistribute: {}, appDistribute: {} },
      }));
    }
    setLoading(true);
    if (!isInsightrackrTab) {
      setData(null);
      setCountData(null);
    }

    const keyword = platform === 'guangdada' ? (paramsToUse.keyword ?? paramsToUse.keyWord) : paramsToUse.keyWord;
    const keywordLog =
      typeof keyword === 'string' && keyword.length > 180
        ? `${keyword.slice(0, 120)}…（共 ${keyword.length} 字符）`
        : keyword;
    addLog(`开始查询数据 [${platform}]，关键词: ${keywordLog}`, 'info');

    if (platform === 'guangdada' && (paramsToUse.guangdada_search_category || paramsToUse.guangdadaSearchCategory) === '素材内容') {
      const mr = paramsToUse.guangdadaMultimodalRequest;
      const canMulti =
        (mr && mr.mode === 'url' && String(mr.url || '').trim()) ||
        (mr && mr.mode === 'file' && mr.file);
      if (canMulti) {
        try {
          const localPreview = await resolveMultimodalLocalPreview(mr);
          if (localPreview.previewUrl) {
            paramsToUse = {
              ...paramsToUse,
              multimodal_preview_url: localPreview.previewUrl,
              multimodal_preview_type: localPreview.previewType,
              ...(mr?.mode === 'url' && String(mr?.url || '').trim()
                ? { multimodal_resource_link: String(mr.url).trim() }
                : {}),
            };
            setCurrentSearchParams(paramsToUse);
          } else if (localPreview.previewType === 'video') {
            paramsToUse = {
              ...paramsToUse,
              multimodal_preview_type: 'video',
              ...(mr?.mode === 'url' && String(mr?.url || '').trim()
                ? { multimodal_resource_link: String(mr.url).trim() }
                : {}),
            };
          } else if (mr?.mode === 'url' && String(mr?.url || '').trim()) {
            paramsToUse = {
              ...paramsToUse,
              multimodal_resource_link: String(mr.url).trim(),
            };
          }

          let multiRes;
          if (mr && mr.mode === 'url') {
            multiRes = await guangdadaMultiModalSearch(mr);
          } else if (mr && mr.mode === 'file' && mr.file) {
            multiRes = await guangdadaMultiModalSearch(mr);
          }
          if (multiRes && multiRes.success && multiRes.data && multiRes.data.multimodal_md5) {
            const cdn = multiRes.data.multi_modal_file_cdn_url;
            const preview = await resolveMultimodalPreview(mr, cdn);
            paramsToUse = {
              ...paramsToUse,
              multimodal_md5: multiRes.data.multimodal_md5,
              ...(cdn != null && String(cdn).trim() ? { multi_modal_file_cdn_url: String(cdn).trim() } : {}),
              multimodal_preview_url: preview.previewUrl || null,
              multimodal_preview_type: preview.previewType || 'image',
              ...(mr?.mode === 'url' && String(mr?.url || '').trim()
                ? { multimodal_resource_link: String(mr.url).trim() }
                : {}),
              keyword: '',
              keyWord: '',
              guangdadaMultimodalRequest: null,
            };
            setCurrentSearchParams(paramsToUse);
            addLog('multi-modal-search 成功，已带入 list/count', 'info');
          } else if (multiRes && !multiRes.success) {
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
          ? getCount(platform, paramsToUse).catch((err) => {
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
          setCurrentSearchParams(paramsToUse);
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

  // 进入广大大/Insightrackr 页面且已登录时，用默认参数自动发起一次查询；Insightrackr 必须等 status 返回「已登录」后再请求
  React.useEffect(() => {
    if (platform !== 'guangdada' && platform !== 'insightrackr') return;
    if (platform === 'guangdada' && guangdadaEdition === 'domestic') return;
    if (platform === 'insightrackr' && !insightrackrStatusConfirmed) return;
    if (platform === 'guangdada' && !isLoggedIn) return;
    if (platform === 'insightrackr' && !isLoggedIn) return;
    if (effectiveParams != null) return;
    setRequestDefaultSearch(true);
  }, [platform, isLoggedIn, insightrackrStatusConfirmed, effectiveParams, guangdadaEdition]);

  React.useEffect(() => {
    if (platform !== 'guangdada' || guangdadaEdition !== 'domestic') {
      setDomesticAdInfoResult(null);
      domesticLastPayloadRef.current = null;
      setDomesticRecommendedKey('');
      setDomesticFetchedAt(null);
      setDomesticListPage(1);
    }
  }, [platform, guangdadaEdition]);

  React.useEffect(() => {
    const isDomestic = platform === 'guangdada' && guangdadaEdition === 'domestic';
    const shouldAutoSearch = isDomestic && isLoggedIn;
    const prev = domesticAutoSearchPrevRef.current;
    if (shouldAutoSearch && (!prev.domestic || !prev.logged)) {
      setDomesticAutoSearchKey((k) => k + 1);
    }
    domesticAutoSearchPrevRef.current = { domestic: isDomestic, logged: !!isLoggedIn };
  }, [platform, guangdadaEdition, isLoggedIn]);

  const runDomesticSearch = useCallback(
    async (payload) => {
      domesticLastPayloadRef.current = payload;
      const dr = payload?.dateRange;
      const timeStr = dr ? `${dr.startTime} ~ ${dr.endTime}` : '';
      const sc =
        payload.recommendedSearch != null && String(payload.recommendedSearch).trim() !== ''
          ? payload.recommendedSearch
          : payload.keyword || '(空)';
      addLog(
        `[国内版] ad-info sort=${payload.sort ?? 1} position=${payload.position} accurate_search=${payload.exactSearch ? 1 : 0} search_content=${sc} exclude_keyword=${payload.excludeKeyword || '(空)'} 行业=${payload.industry} 时间=${timeStr}`,
        'info'
      );
      setLoading(true);
      try {
        const data = await searchGuangdadaCnAdInfo(payload);
        setDomesticAdInfoResult(data);
        setDomesticFetchedAt(new Date());
        if (data && typeof data.status === 'number' && data.status === 20000) {
          addLog('[国内版] ad-info 请求成功', 'success');
        } else {
          addLog(
            `[国内版] ad-info 已返回，业务 status=${data?.status ?? '?'} ${data?.message != null ? String(data.message) : ''}`,
            'warn'
          );
        }
      } catch (err) {
        if (err?.requiresLogin) {
          addLog(`[国内版] ad-info: ${err.message || '请先登录'}`, 'info');
          if (onRequireLogin) onRequireLogin();
          else antdMessage.info(err.message || '请先登录');
        } else {
          addLog(`[国内版] ad-info 请求失败: ${err.message}`, 'error');
          antdMessage.error(formatRequestError(err.message));
        }
        setDomesticAdInfoResult(null);
      } finally {
        setLoading(false);
      }
    },
    [addLog, onRequireLogin]
  );

  const handleDomesticFormSearch = useCallback(
    (formPayload) => {
      setDomesticListPage(1);
      const next = { ...formPayload, sort: domesticSortRef.current, page: 1 };
      const rec = domesticRecommendedKeyRef.current;
      if (rec) next.recommendedSearch = rec;
      else delete next.recommendedSearch;
      runDomesticSearch(next);
    },
    [runDomesticSearch]
  );

  const handleDomesticRecommendedSelect = useCallback((tagLabel) => {
    const key = tagLabel === '全部' ? '' : tagLabel;
    domesticRecommendedKeyRef.current = key;
    setDomesticRecommendedKey(key);
    domesticFormRef.current?.submitSearch();
  }, []);

  const handleDomesticSortChange = useCallback((sortVal) => {
    domesticSortRef.current = sortVal;
    setDomesticSort(sortVal);
    domesticFormRef.current?.submitSearch();
  }, []);
  const effectiveData = platform === 'insightrackr' ? insightrackrResultByTab[insightrackrSearchTab]?.data : data;
  const effectiveCountData = platform === 'insightrackr' ? insightrackrResultByTab[insightrackrSearchTab]?.countData : countData;
  const effectiveMediaDistribute = platform === 'insightrackr' ? (insightrackrResultByTab[insightrackrSearchTab]?.mediaDistribute || {}) : mediaDistribute;
  const effectiveAppDistribute = platform === 'insightrackr' ? (insightrackrResultByTab[insightrackrSearchTab]?.appDistribute || {}) : appDistribute;

  const defaultDateRange = { startTime: todayBeijing.subtract(1, 'year').format('YYYY-MM-DD'), endTime: todayBeijing.format('YYYY-MM-DD') };
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
    : (platform === 'guangdada' && guangdadaPendingDateRange)
      ? guangdadaPendingDateRange
      : defaultDateRange;

  const guangdadaMaterialContentMode =
    platform === 'guangdada' &&
    (effectiveParams?.guangdadaSearchCategory || effectiveParams?.guangdada_search_category) === '素材内容';
  const guangdadaSortFieldForBar =
    platform === 'guangdada'
      ? (() => {
          const raw = effectiveParams?.sort_field ?? '-first_seen';
          if (!guangdadaMaterialContentMode && raw === '-multimodal_similarity') return '-first_seen';
          return raw;
        })()
      : (effectiveParams?.sort_field ?? '-first_seen');

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
    } else if (platform === 'guangdada') {
      // 首次进入页面尚未查询时，点击 7天/30天 等只更新待选日期，与 SearchForm 的日期选择器同步，用户点「查询」时会使用该范围
      setGuangdadaPendingDateRange({ startTime: dateRange.startTime, endTime: dateRange.endTime });
    }
  };

  const handleSortDedupChange = (updates) => {
    if (platform !== 'guangdada') return;
    if (effectiveParams) {
      handleSearch({ ...effectiveParams, ...updates });
    }
  };

  const handleClearGuangdadaMultimodalSelected = useCallback(() => {
    if (platform !== 'guangdada' || !effectiveParams) return;
    const {
      multimodal_md5: _mm,
      multi_modal_file_cdn_url: _cdn,
      multimodal_preview_url: _preview,
      multimodal_preview_type: _previewType,
      multimodal_resource_link: _resourceLink,
      guangdadaMultimodalRequest: _mr,
      ...rest
    } = effectiveParams;
    setCurrentSearchParams(rest);
  }, [platform, effectiveParams]);

  /** 广大大：点击「不看该广告主创意」后请求 hidden-info，加入屏蔽列表并立即 refetch */
  const handleBlockAdvertiser = useCallback(async (item) => {
    if (platform !== 'guangdada' || !item?.ad_key) return;
    try {
      const res = await getGuangdadaHiddenInfo({
        ad_key: item.ad_key,
        app_type: item.app_type ?? 1,
        created_at: item.created_at,
      });
      const hid = res?.data?.hidden_info;
      const advertiser_id = hid?.advertiser_id;
      if (!advertiser_id) {
        addLog('获取广告主信息失败，无法屏蔽', 'warn');
        return;
      }
      setBlockedAdvertisers((prev) => {
        const next = [...prev, { advertiser_id, logo_url: item.logo_url, advertiser_name: item.advertiser_name }];
        if (effectiveParams) {
          handleSearch({ ...effectiveParams, exclude_advertiser_key: next.map((b) => b.advertiser_id) });
        }
        return next;
      });
      addLog(`已屏蔽广告主: ${advertiser_id}`, 'info');
    } catch (err) {
      addLog(`屏蔽广告主失败: ${err?.message || err}`, 'warn');
      if (err?.requiresLogin && onRequireLogin) onRequireLogin();
    }
  }, [platform, effectiveParams, addLog, onRequireLogin]);

  const handleUnblockAdvertiser = useCallback((advertiser_id) => {
    setBlockedAdvertisers((prev) => {
      const next = prev.filter((b) => b.advertiser_id !== advertiser_id);
      if (effectiveParams && next.length === 0) {
        const { exclude_advertiser_key, ...rest } = effectiveParams;
        handleSearch(rest);
      } else if (effectiveParams) {
        handleSearch({ ...effectiveParams, exclude_advertiser_key: next.map((b) => b.advertiser_id) });
      }
      return next;
    });
  }, [effectiveParams]);

  const showGlobalData = platform !== 'guangdada' || guangdadaEdition === 'global';
  const showDomesticPanel = platform === 'guangdada' && guangdadaEdition === 'domestic';

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
      {platform === 'guangdada' && (
        <div className="insightrackr-search-tabs guangdada-edition-tabs">
          <button
            type="button"
            className={`insightrackr-search-tab ${guangdadaEdition === 'global' ? 'active' : ''}`}
            onClick={() => setGuangdadaEdition('global')}
          >
            国际版
          </button>
          <button
            type="button"
            className={`insightrackr-search-tab ${guangdadaEdition === 'domestic' ? 'active' : ''}`}
            onClick={() => setGuangdadaEdition('domestic')}
          >
            国内版
          </button>
        </div>
      )}
      {platform === 'guangdada' && guangdadaEdition === 'domestic' ? (
        <>
          <GuangdadaDomesticSearchForm
            ref={domesticFormRef}
            loading={loading}
            onSearch={handleDomesticFormSearch}
            autoSearchKey={domesticAutoSearchKey}
          />
          <GuangdadaDomesticShortcutBar
            recommendedKey={domesticRecommendedKey}
            onRecommendedSelect={handleDomesticRecommendedSelect}
            sort={domesticSort}
            onSortChange={handleDomesticSortChange}
            result={domesticAdInfoResult}
            fetchedAt={domesticFetchedAt}
            loading={loading}
            formatCount={formatGuangdadaCount}
          />
        </>
      ) : (
        <SearchForm
          platform={platform}
          onSearch={handleSearch}
          loading={loading}
          guangdadaSortField={platform === 'guangdada' ? effectiveParams?.sort_field : undefined}
          guangdadaDedupType={platform === 'guangdada' ? effectiveParams?.duplicate_removal : undefined}
          guangdadaDateRange={platform === 'guangdada' ? dateRangeValue : undefined}
          guangdadaMultimodalPreviewUrl={platform === 'guangdada' ? effectiveParams?.multimodal_preview_url : undefined}
          guangdadaMultimodalPreviewType={platform === 'guangdada' ? effectiveParams?.multimodal_preview_type : undefined}
          guangdadaMultimodalResourceLink={platform === 'guangdada' ? effectiveParams?.multimodal_resource_link : undefined}
          onClearGuangdadaMultimodalSelected={platform === 'guangdada' ? handleClearGuangdadaMultimodalSelected : undefined}
          guangdadaLastSearchCategory={
            platform === 'guangdada'
              ? (effectiveParams?.guangdadaSearchCategory ?? effectiveParams?.guangdada_search_category ?? null)
              : null
          }
          insightrackrSearchTab={platform === 'insightrackr' ? insightrackrSearchTab : undefined}
          insightrackrInitialFormData={platform === 'insightrackr' ? insightrackrFormByTab[insightrackrSearchTab] : undefined}
          onInsightrackrFormDataChange={platform === 'insightrackr' ? (formData) => setInsightrackrFormByTab((prev) => ({ ...prev, [insightrackrSearchTab]: formData })) : undefined}
          guangdadaBlockedAdvertisers={platform === 'guangdada' ? blockedAdvertisers : []}
          onGuangdadaUnblockAdvertiser={platform === 'guangdada' ? handleUnblockAdvertiser : undefined}
          requestDefaultSearch={requestDefaultSearch}
          onDefaultSearchTriggered={() => setRequestDefaultSearch(false)}
        />
      )}
      <div className="data-area">
        {platform === 'guangdada' && guangdadaEdition === 'global' && (
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
            sortField={guangdadaSortFieldForBar}
            dedupType={effectiveParams?.duplicate_removal ?? 0}
            materialContentMode={guangdadaMaterialContentMode}
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
        {showDomesticPanel && !loading && domesticAdInfoResult && (
          <DataDisplay
            domesticAdInfoResult={domesticAdInfoResult}
            data={null}
            platform="guangdada"
            onSortChange={handleSearch}
            currentSearchParams={{ page: domesticListPage, pageSize: DOMESTIC_AD_INFO_PAGE_SIZE }}
            countData={null}
            mediaDistribute={{}}
            appDistribute={{}}
            batchDownloadMode={batchDownloadMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAllPage={selectAllPage}
            onBatchDownloadCancel={exitBatchMode}
            onEnterBatchMode={() => setBatchDownloadMode(true)}
            onBatchModeEnteredWithHint={onBatchModeEnteredWithHint}
            onExitBatchMode={exitBatchMode}
            onPageChange={(page) => {
              window.scrollTo(0, 0);
              const scrollEl = document.querySelector('.data-card');
              if (scrollEl) scrollEl.scrollTop = 0;
              const base = domesticLastPayloadRef.current;
              if (!base) return;
              setDomesticListPage(page);
              runDomesticSearch({ ...base, page });
            }}
          />
        )}
        {showDomesticPanel && !loading && !domesticAdInfoResult && (
          <div className="data-container data-container--empty">
            <div className="data-placeholder">
              <p>{isLoggedIn ? '暂无数据' : '登录后查看数据'}</p>
            </div>
          </div>
        )}
        {showGlobalData && !loading && !effectiveData && (
          <div className="data-container data-container--empty">
            <div className="data-placeholder">
              <p>{isLoggedIn ? '暂无数据' : '登录后查看数据'}</p>
            </div>
          </div>
        )}
        {showGlobalData && !loading && effectiveData && (
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
            onBlockAdvertiser={platform === 'guangdada' ? handleBlockAdvertiser : undefined}
            onPageChange={(page) => {
              window.scrollTo(0, 0);
              const scrollEl = document.querySelector('.data-card');
              if (scrollEl) scrollEl.scrollTop = 0;
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
