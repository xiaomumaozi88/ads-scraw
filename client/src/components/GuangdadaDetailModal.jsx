import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal, Tabs, Button, Spin, Dropdown, Drawer, Tooltip as AntdTooltip } from 'antd';
import {
  ExportOutlined,
  FileTextOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
  ShareAltOutlined,
  StarOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  getGuangdadaCreativeDetail,
  getGuangdadaMaterialScriptAnalysis,
  getGuangdadaRankStatus,
  getGuangdadaRelatedAdvertisers,
  getGuangdadaRelatedAds,
  getGuangdadaRelatedDynamic,
  getGuangdadaSimilarAds,
  getGuangdadaDailyPopularity,
  getGuangdadaAdvRecList,
  getGuangdadaAdvertiserDetail,
  getProxiedMediaUrl,
} from '../utils/api';
import { GUANGDADA_COUNTRY_CODE_TO_CN } from '../data/guangdadaCountries';
import {
  formatGuangdadaChannel,
  formatGuangdadaLanguage,
  getGuangdadaAnalysisTagMeta,
  getGuangdadaAppCategoryLabel,
  getGuangdadaCategoryTagGroupLabel,
  getGuangdadaTagLabel,
} from '../data/guangdadaReferenceDictionaries';
import CopyTranslationModal from './CopyTranslationModal';
import './GuangdadaDetailModal.css';

/**
 * 从列表项解析缩略图/视频 URL（与 CreativeCardGuangdada 一致）
 */
function getMediaUrls(item) {
  let thumbnailUrl = '';
  let videoUrl = '';
  let htmlUrl = '';
  const resource = Array.isArray(item?.resource_urls) && item.resource_urls.length > 0 ? item.resource_urls[0] : null;
  const rawVideoUrl = resource?.video_url != null ? String(resource.video_url).trim() : '';
  const isVideo =
    Number(item?.ads_type) === 2 ||
    Number(resource?.type) === 2 ||
    rawVideoUrl !== '';
  if (resource) {
    const r = resource;
    if (r.type === 4 && r.html_url && String(r.html_url).trim() !== '') {
      htmlUrl = r.html_url.trim();
    }
    if (isVideo) {
      videoUrl = rawVideoUrl;
      thumbnailUrl = item.preview_img_url || r.image_url || '';
    } else {
      thumbnailUrl = r.image_url || item.preview_img_url || '';
    }
  } else {
    thumbnailUrl = item.preview_img_url || '';
  }
  return { thumbnailUrl, videoUrl, isVideo, hasPlayableVideo: Boolean(videoUrl), htmlUrl };
}

function toValueList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'object') return Object.values(value).flatMap(toValueList);
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const str = String(value ?? '').trim();
    if (!str || seen.has(str)) return;
    seen.add(str);
    result.push(str);
  });
  return result;
}

function getStoreCategoryLabels(raw, os) {
  const categoryIds = uniqueStrings([
    ...toValueList(raw?.category),
    ...toValueList(raw?.original_categories),
  ]);
  return categoryIds
    .map((id) => getGuangdadaAppCategoryLabel(id, os))
    .filter(Boolean);
}

function buildDetailTagGroups(raw) {
  if (!raw) return [];
  const groups = [];
  const pushGroup = (key, label, ids) => {
    const tags = uniqueStrings(toValueList(ids).map((id) => getGuangdadaTagLabel(id)));
    if (!tags.length) return;
    groups.push({ key, label, tags });
  };

  if (raw.category_tag && typeof raw.category_tag === 'object') {
    Object.entries(raw.category_tag).forEach(([catKey, ids]) => {
      const groupLabel = getGuangdadaCategoryTagGroupLabel(catKey);
      pushGroup(`category-${catKey}`, groupLabel, ids);
    });
  }
  pushGroup('game_core_track', '核心赛道', raw.game_core_track);
  pushGroup('game_play', '游戏玩法', raw.game_play);
  pushGroup('game_theme', '游戏主题', raw.game_theme);
  pushGroup('game_ip', 'IP', raw.game_ip ?? raw.ip);

  return groups;
}

/** 从详情接口返回中解析文案语言、地区、素材尺寸、material_id，并保留 raw 供标签/分类展示 */
function parseDetailData(detailRes) {
  const payload = detailRes?.data;
  const raw = payload?.data ?? payload ?? {};
  const language = formatGuangdadaLanguage(
    raw.language ?? raw.copy_language ?? raw.copy_lang ?? raw.languages
  );
  // 地区仅来自 countries 字段，转为中文展示
  let region = null;
  if (Array.isArray(raw.countries) && raw.countries.length) {
    const labels = raw.countries.map((code) => GUANGDADA_COUNTRY_CODE_TO_CN[code] ?? code);
    region = labels.join('、');
  }
  const materialId = raw.material_id ?? raw.materialId;
  const width = raw.width ?? raw.ad_width ?? raw.material_width;
  const height = raw.height ?? raw.ad_height ?? raw.material_height;
  const sizeLabel = raw.material_size ?? raw.preview_img_size ?? raw.size_label;
  let materialSize = sizeLabel;
  if (!materialSize && width != null && height != null) {
    const orient = width >= height ? '横版' : '竖版';
    materialSize = `${orient} ${width} x ${height}`;
  }
  return { language, region, materialSize, materialId, raw };
}

function formatCompactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(Math.round(n));
}

function formatCurrencyNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('zh-CN');
}

function formatFullDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts) * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeOffset(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(n / 60);
  const secs = String(n % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function normalizeDetailList(res) {
  const payload = res?.data?.data ?? res?.data ?? [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.creative_list)) return payload.creative_list;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getScriptAnalysisPayload(res) {
  const payload = res?.data?.data ?? res?.data ?? {};
  return payload?.material_script_analysis ?? payload ?? null;
}

function normalizeRelatedAd(ad) {
  if (!ad || typeof ad !== 'object') return ad;
  return {
    ...ad,
    first_seen: ad.first_seen ?? ad.frst_seen,
  };
}

function firstNonEmptyValue(value) {
  const values = toValueList(value);
  return values.find((item) => item != null && String(item).trim() !== '');
}

const STRATEGY_PARENT_KEYWORDS = [
  '受众',
  '功能',
  '痛点',
  '收益',
  '卖点',
  '诉求',
  '动机',
  '价值',
  '策略',
];

function buildAnalysisSections(raw) {
  const sourceTags = [
    ...(Array.isArray(raw?.material_ai_tag) ? raw.material_ai_tag : []),
    ...(Array.isArray(raw?.material_ai_search_word) ? raw.material_ai_search_word : []),
    ...(Array.isArray(raw?.material_ai_search_word_new) ? raw.material_ai_search_word_new : []),
    ...(Array.isArray(raw?.video_hook_type) ? raw.video_hook_type : []),
    ...(Array.isArray(raw?.video_ending) ? raw.video_ending : []),
  ];
  const sections = {
    content: { title: '创意内容', groups: new Map() },
    strategy: { title: '创意策略', groups: new Map() },
  };
  sourceTags.forEach((tag) => {
    const meta = getGuangdadaAnalysisTagMeta(tag);
    if (!meta.label) return;
    const parentLabel = meta.parentLabel || '其他';
    const target = STRATEGY_PARENT_KEYWORDS.some((keyword) => parentLabel.includes(keyword))
      ? sections.strategy
      : sections.content;
    if (!target.groups.has(parentLabel)) target.groups.set(parentLabel, []);
    const list = target.groups.get(parentLabel);
    if (!list.includes(meta.label)) list.push(meta.label);
  });
  return Object.values(sections)
    .map((section) => ({
      title: section.title,
      groups: Array.from(section.groups.entries()).map(([parentLabel, tags]) => ({ parentLabel, tags })),
    }))
    .filter((section) => section.groups.length > 0);
}

function ScriptAnalysisTimeline({ script, raw }) {
  if (!script) return <div className="guangdada-detail-placeholder">暂无素材脚本分析</div>;
  const totalDuration = Number(script.total_duration_sec) || Number(raw?.video_duration) || 0;
  const timeline = Array.isArray(script.timeline) ? script.timeline : [];
  const markers = [];
  const hook = Array.isArray(raw?.video_hook_type) ? raw.video_hook_type[0] : null;
  const ending = Array.isArray(raw?.video_ending) ? raw.video_ending[0] : null;
  if (hook?.cn_name) {
    markers.push({ key: 'hook', time: 0, label: `hook：${hook.cn_name}`, tone: 'blue', position: 'top' });
  }
  timeline.forEach((segment, index) => {
    if (!segment?.segment_type) return;
    markers.push({
      key: `segment-${index}`,
      time: Number(segment.start) || 0,
      label: segment.segment_type,
      tone: index % 2 === 0 ? 'purple' : 'orange',
      position: 'bottom',
      description: segment.segment_observations || '',
    });
  });
  if (ending?.cn_name) {
    markers.push({ key: 'ending', time: totalDuration || timeline[timeline.length - 1]?.end || 0, label: `ending：${ending.cn_name}`, tone: 'red', position: 'top' });
  }
  const duration = Math.max(totalDuration, ...markers.map((item) => item.time), 1);

  return (
    <div className="guangdada-detail-script">
      <div className="guangdada-detail-script-summary">
        <span>视频内容：</span>
        <strong>{script.video_summary || script.video_content || '—'}</strong>
      </div>
      {markers.length > 0 ? (
        <div className="guangdada-detail-script-timeline">
          <div className="guangdada-detail-script-rail" />
          {markers.map((marker) => {
            const left = Math.max(0, Math.min(100, (marker.time / duration) * 100));
            return (
              <AntdTooltip key={marker.key} title={marker.description || marker.label}>
                <div
                  className={`guangdada-detail-script-marker guangdada-detail-script-marker--${marker.position}`}
                  style={{ left: `${left}%` }}
                >
                  <span className={`guangdada-detail-script-tag guangdada-detail-script-tag--${marker.tone}`}>{marker.label}</span>
                  <i />
                  <small>{formatTimeOffset(marker.time)}</small>
                </div>
              </AntdTooltip>
            );
          })}
          <span className="guangdada-detail-script-end-time">{formatTimeOffset(duration)}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 广大大创意详情弹窗：打开时请求详情接口与相似广告主/关联广告
 */
function GuangdadaDetailModal({ item, open, onClose, onRequestDownload, onQuotaChanged }) {
  const [activeTab, setActiveTab] = useState('1');
  const [detailData, setDetailData] = useState(null);
  const [relatedAdvertisers, setRelatedAdvertisers] = useState([]);
  const [relatedAds, setRelatedAds] = useState([]);
  const [similarAds, setSimilarAds] = useState([]);
  const [creativeVersions, setCreativeVersions] = useState([]);
  const [rankStatus, setRankStatus] = useState(null);
  const [scriptAnalysis, setScriptAnalysis] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingSimilarAds, setLoadingSimilarAds] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingScriptAnalysis, setLoadingScriptAnalysis] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [trendError, setTrendError] = useState(null);
  const [advRecList, setAdvRecList] = useState([]);
  const [loadingAdvRec, setLoadingAdvRec] = useState(false);
  const [advertiserDrawerOpen, setAdvertiserDrawerOpen] = useState(false);
  const [advertiserDrawerDomain, setAdvertiserDrawerDomain] = useState(null);
  const [advertiserDrawerName, setAdvertiserDrawerName] = useState('');
  const [advertiserDrawerData, setAdvertiserDrawerData] = useState(null);
  const [loadingAdvertiserDrawer, setLoadingAdvertiserDrawer] = useState(false);
  const [advertiserDrawerError, setAdvertiserDrawerError] = useState(null);
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const [translateModalText, setTranslateModalText] = useState('');
  const [translateModalType, setTranslateModalType] = useState(''); // 'title' | 'description'
  const onQuotaChangedRef = useRef(onQuotaChanged);

  useEffect(() => {
    onQuotaChangedRef.current = onQuotaChanged;
  }, [onQuotaChanged]);

  const mergedItem = useMemo(() => {
    if (!item) return null;
    const raw = detailData?.raw;
    return raw ? { ...item, ...raw } : item;
  }, [detailData?.raw, item]);

  const { thumbnailUrl, videoUrl, isVideo, hasPlayableVideo, htmlUrl } = useMemo(
    () => (mergedItem ? getMediaUrls(mergedItem) : { thumbnailUrl: '', videoUrl: '', isVideo: false, hasPlayableVideo: false, htmlUrl: '' }),
    [mergedItem]
  );

  // 广告主详情 Drawer：打开时按 domain 拉取 agg-advertiser
  useEffect(() => {
    if (!advertiserDrawerOpen || !advertiserDrawerDomain) {
      setAdvertiserDrawerData(null);
      setAdvertiserDrawerError(null);
      return;
    }
    let cancelled = false;
    setLoadingAdvertiserDrawer(true);
    setAdvertiserDrawerError(null);
    getGuangdadaAdvertiserDetail({ domain: advertiserDrawerDomain })
      .then((res) => {
        if (cancelled) return;
        setLoadingAdvertiserDrawer(false);
        if (res.success && res.data != null) {
          setAdvertiserDrawerData(Array.isArray(res.data) ? res.data : [res.data]);
        } else {
          setAdvertiserDrawerData(null);
          setAdvertiserDrawerError(res?.message || '加载失败');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadingAdvertiserDrawer(false);
          setAdvertiserDrawerData(null);
          setAdvertiserDrawerError(err?.message || '加载失败');
        }
      });
    return () => { cancelled = true; };
  }, [advertiserDrawerOpen, advertiserDrawerDomain]);

  useEffect(() => {
    if (!open || !item?.ad_key) {
      setDetailData(null);
      setRelatedAdvertisers([]);
      setRelatedAds([]);
      setSimilarAds([]);
      setCreativeVersions([]);
      setRankStatus(null);
      setScriptAnalysis(null);
      setTrendData(null);
      setAdvRecList([]);
      setDetailError(null);
      setTrendError(null);
      setActiveTab('1');
      setLoadingDetail(false);
      setLoadingRelated(false);
      setLoadingSimilarAds(false);
      setLoadingVersions(false);
      setLoadingScriptAnalysis(false);
      setLoadingTrend(false);
      setLoadingAdvRec(false);
      return;
    }
    let cancelled = false;
    setActiveTab('1');
    setLoadingDetail(true);
    setLoadingRelated(false);
    setLoadingSimilarAds(false);
    setLoadingAdvRec(false);
    setDetailError(null);
    setTrendError(null);
    setTrendData(null);
    setRelatedAdvertisers([]);
    setRelatedAds([]);
    setSimilarAds([]);
    setAdvRecList([]);
    setCreativeVersions([]);
    setRankStatus(null);
    setScriptAnalysis(null);
    setLoadingVersions(false);
    setLoadingScriptAnalysis(false);
    setLoadingTrend(false);
    const platformStr = typeof item.platform === 'string' ? item.platform : (item.platform != null ? String(item.platform) : 'admob');
    getGuangdadaRankStatus({
      ad_key: item.ad_key,
      app_type: item.app_type ?? item.ads_type ?? 1,
    })
      .then((res) => {
        if (cancelled) return;
        setRankStatus(res?.success ? (res.data || null) : null);
      })
      .catch(() => {
        if (!cancelled) setRankStatus(null);
      });
    getGuangdadaCreativeDetail({
      ad_key: item.ad_key,
      app_type: item.app_type ?? item.ads_type ?? 1,
      search_flag: item.search_flag ?? item.search_fag,
    })
      .then((res) => {
        if (cancelled) return;
        setLoadingDetail(false);
        if (!res.success || !res.data) {
          setDetailData(null);
          setDetailError(res?.message || '加载详情失败');
          setLoadingRelated(false);
          setLoadingSimilarAds(false);
          setLoadingVersions(false);
          setLoadingScriptAnalysis(false);
          setLoadingTrend(false);
          setLoadingAdvRec(false);
          return;
        }
        const parsed = parseDetailData(res);
        setDetailData(parsed);
        const raw = res.data?.data ?? res.data ?? {};
        const effectiveItem = { ...item, ...raw };
        const embeddedDailyPopularity = Array.isArray(raw.daily_popularity) ? raw.daily_popularity : null;
        const embeddedTopLine = raw.top_line && typeof raw.top_line === 'object' ? raw.top_line : null;
        if (embeddedDailyPopularity || embeddedTopLine) {
          setTrendData({
            daily_popularity: embeddedDailyPopularity || [],
            top_line: embeddedTopLine || {},
            top_line_category: raw.top_line_category,
            top_line_platform: raw.top_line_platform,
          });
          setLoadingTrend(false);
        } else {
          setLoadingTrend(true);
          getGuangdadaDailyPopularity({
            creative_key: effectiveItem.ad_key,
            first_seen: effectiveItem.first_seen,
            last_seen: effectiveItem.last_seen,
            app_type: effectiveItem.app_type ?? effectiveItem.ads_type ?? 1,
            platform: platformStr,
            category: effectiveItem.category ?? effectiveItem.category_id,
          })
            .then((trendRes) => {
              if (cancelled) return;
              setLoadingTrend(false);
              if (trendRes.success && trendRes.data?.data) {
                setTrendData(trendRes.data.data);
              } else {
                setTrendData(null);
              }
            })
            .catch((err) => {
              if (!cancelled) {
                setLoadingTrend(false);
                setTrendError(err?.message || '加载数据趋势失败');
                setTrendData(null);
              }
            });
        }
        if (raw.material_script_analysis) {
          setScriptAnalysis(raw.material_script_analysis);
        } else if (Number(effectiveItem.ads_type) === 2 || effectiveItem.resource_urls?.[0]?.video_url) {
          setLoadingScriptAnalysis(true);
          getGuangdadaMaterialScriptAnalysis({
            ad_key: effectiveItem.ad_key,
            app_type: effectiveItem.app_type ?? 1,
            search_flag: effectiveItem.search_flag,
            ads_type: effectiveItem.ads_type,
          })
            .then((scriptRes) => {
              if (cancelled) return;
              setScriptAnalysis(scriptRes?.success ? getScriptAnalysisPayload(scriptRes) : null);
            })
            .catch(() => {
              if (!cancelled) setScriptAnalysis(null);
            })
            .finally(() => {
              if (!cancelled) setLoadingScriptAnalysis(false);
            });
        } else {
          setLoadingScriptAnalysis(false);
        }
        const dynamicNumber = firstNonEmptyValue(raw.dynamic_number);
        if (dynamicNumber) {
          setLoadingVersions(true);
          getGuangdadaRelatedDynamic({
            dynamic_number: dynamicNumber,
            app_type: effectiveItem.app_type ?? 1,
            creative_key: effectiveItem.ad_key,
            platform: effectiveItem.platform,
            created_at: effectiveItem.created_at,
          })
            .then((versionRes) => {
              if (cancelled) return;
              setCreativeVersions(versionRes?.success ? normalizeDetailList(versionRes) : []);
            })
            .catch(() => {
              if (!cancelled) setCreativeVersions([]);
            })
            .finally(() => {
              if (!cancelled) setLoadingVersions(false);
            });
        } else {
          setLoadingVersions(false);
        }
        const domain = raw.advertiser_id ?? item.advertiser_id ?? item.domain;
        const country = (Array.isArray(raw.countries) && raw.countries[0]) ? raw.countries[0] : (item.countries?.[0] ?? 'USA');
        if (domain) {
          setLoadingAdvRec(true);
          getGuangdadaAdvRecList({
            domain: String(domain),
            app_type: item.app_type ?? item.ads_type ?? 1,
            country: country || 'USA',
            page: 1,
            page_size: 8,
          })
            .then((advRecRes) => {
              if (cancelled) return;
              setLoadingAdvRec(false);
              const list = advRecRes?.data?.data ?? advRecRes?.data ?? [];
              setAdvRecList(Array.isArray(list) ? list : []);
            })
            .catch(() => {
              if (!cancelled) {
                setLoadingAdvRec(false);
                setAdvRecList([]);
              }
            });
        } else {
          setLoadingAdvRec(false);
          setAdvRecList([]);
        }
        const resourceUrl = effectiveItem.preview_img_url || effectiveItem.resource_urls?.[0]?.image_url || '';
        if (resourceUrl && effectiveItem.ad_key) {
          setLoadingSimilarAds(true);
          getGuangdadaSimilarAds({
            resource_url: resourceUrl,
            ad_key: effectiveItem.ad_key,
            app_type: effectiveItem.app_type ?? effectiveItem.ads_type ?? 1,
            created_at: effectiveItem.created_at,
            similar_ads_count: 8,
          })
            .then((similarRes) => {
              if (cancelled) return;
              setSimilarAds(Array.isArray(similarRes?.data) ? similarRes.data : []);
            })
            .catch(() => { if (!cancelled) setSimilarAds([]); })
            .finally(() => { if (!cancelled) setLoadingSimilarAds(false); });
        } else {
          setLoadingSimilarAds(false);
          setSimilarAds([]);
        }

        const materialId = parsed.materialId ?? effectiveItem.image_ahash_md5;
        const hasEmbeddedRelatedAdvertisers = Array.isArray(raw.related_advertisers);
        const hasEmbeddedRelatedAds = Array.isArray(raw.related_ads);
        if (hasEmbeddedRelatedAdvertisers) {
          setRelatedAdvertisers(raw.related_advertisers);
        }
        if (hasEmbeddedRelatedAds) {
          setRelatedAds(raw.related_ads.map(normalizeRelatedAd));
        }
        if (materialId && (!hasEmbeddedRelatedAdvertisers || !hasEmbeddedRelatedAds)) {
          setLoadingRelated(true);
          const relatedRequests = [
            hasEmbeddedRelatedAdvertisers
              ? Promise.resolve({ skipped: true, kind: 'advertisers' })
              : getGuangdadaRelatedAdvertisers({
                app_type: effectiveItem.app_type ?? effectiveItem.ads_type ?? 1,
                material_id: materialId,
                page: 1,
                created_at: effectiveItem.created_at != null ? String(effectiveItem.created_at) : undefined,
                page_size: 20,
              }),
            hasEmbeddedRelatedAds
              ? Promise.resolve({ skipped: true, kind: 'ads' })
              : getGuangdadaRelatedAds({
                app_type: effectiveItem.app_type ?? effectiveItem.ads_type ?? 1,
                material_id: materialId,
                page: 1,
                created_at: effectiveItem.created_at != null ? String(effectiveItem.created_at) : undefined,
                page_size: 5,
              }),
          ];
          Promise.allSettled(relatedRequests)
            .then(([advResult, adsResult]) => {
              if (cancelled) return;
              if (!hasEmbeddedRelatedAdvertisers) {
                const advRes = advResult.status === 'fulfilled' ? advResult.value : null;
                setRelatedAdvertisers(Array.isArray(advRes?.data) ? advRes.data : []);
              }
              if (!hasEmbeddedRelatedAds) {
                const adsRes = adsResult.status === 'fulfilled' ? adsResult.value : null;
                setRelatedAds(Array.isArray(adsRes?.data) ? adsRes.data.map(normalizeRelatedAd) : []);
              }
            })
            .finally(() => {
              if (!cancelled) setLoadingRelated(false);
            });
        } else {
          setLoadingRelated(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadingDetail(false);
          setLoadingRelated(false);
          setLoadingSimilarAds(false);
          setLoadingVersions(false);
          setLoadingScriptAnalysis(false);
          setLoadingTrend(false);
          setLoadingAdvRec(false);
          setDetailError(err?.message || '加载详情失败');
          setDetailData(null);
          setRelatedAdvertisers([]);
          setRelatedAds([]);
          setSimilarAds([]);
          setTrendData(null);
          setAdvRecList([]);
          setCreativeVersions([]);
          setRankStatus(null);
          setScriptAnalysis(null);
        }
      })
      .finally(() => {
        if (!cancelled) onQuotaChangedRef.current?.();
      });
    return () => { cancelled = true; };
  }, [open, item?.ad_key, item?.app_type, item?.ads_type, item?.search_flag, item?.search_fag, item?.created_at, item?.first_seen, item?.last_seen, item?.platform, item?.category, item?.category_id]);

  if (!item) return null;

  const displayItem = mergedItem || item;
  const rawDetail = detailData?.raw ?? null;
  const appName = displayItem.advertiser_name || displayItem.page_name || '—';
  const developerName = displayItem.app_developer || displayItem.advertiser_id || '—';
  const title = displayItem.title || displayItem.message || displayItem.body || '';
  const body = displayItem.body || displayItem.message || '';
  const platform = formatGuangdadaChannel(displayItem.platform);
  const impressionEstimate = displayItem.impression != null ? formatCompactNumber(displayItem.impression) : 'N/A';
  const exposureValue =
    displayItem.new_week_exposure_value != null || displayItem.all_exposure_value != null
      ? formatCompactNumber(displayItem.new_week_exposure_value ?? displayItem.all_exposure_value)
      : null;
  const daysCount = displayItem.days_count != null ? `${displayItem.days_count}天` : 'N/A';
  const dateRange =
    displayItem.first_seen != null && displayItem.last_seen != null
      ? `${formatFullDate(displayItem.first_seen)}~${formatFullDate(displayItem.last_seen)}`
      : 'N/A';
  const storeCategoryLabels = rawDetail ? getStoreCategoryLabels(rawDetail, displayItem?.os) : [];
  const detailTagGroups = rawDetail ? buildDetailTagGroups(rawDetail) : [];
  const analysisSections = rawDetail ? buildAnalysisSections(rawDetail) : [];
  const versionItems = creativeVersions.length > 0 ? creativeVersions : (displayItem ? [displayItem] : []);

  const detailPageUrl = `https://guangdada.net/modules/creative/display-ads/detail?channel=${encodeURIComponent(displayItem.platform || 'admob')}&id=${encodeURIComponent(displayItem.ad_key || '')}&type=${displayItem.app_type ?? displayItem.ads_type ?? 1}&created_at=${displayItem.created_at ?? ''}&fb_merge=false&search_flag=${displayItem.search_flag ?? displayItem.search_fag ?? ''}`;

  const handleDownload = (e) => {
    e.stopPropagation();
    const name = (title || appName || displayItem.ad_key || 'creative').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'creative';
    // HTML 类型：直接下载 .html，不走尺寸弹窗
    if (htmlUrl) {
      fetch(htmlUrl, { mode: 'cors', referrerPolicy: 'no-referrer' })
        .then((r) => r.text())
        .then((text) => {
          const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${name}_${Date.now()}.html`;
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch(() => window.open(htmlUrl, '_blank', 'noopener'));
      return;
    }
    const url = hasPlayableVideo ? videoUrl : thumbnailUrl;
    if (!url) return;
    const ext = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || (hasPlayableVideo ? 'mp4' : 'jpg');
    fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => window.open(url, '_blank', 'noopener'));
  };

  const overviewTab = (
    <div className="guangdada-detail-overview">
      <div className="guangdada-detail-advertiser">
        <div className="guangdada-detail-advertiser-main">
          {displayItem.logo_url && (
            <img
              src={getProxiedMediaUrl(displayItem.logo_url)}
              alt=""
              className="guangdada-detail-app-icon"
              referrerPolicy="no-referrer"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="guangdada-detail-advertiser-info">
            <div className="guangdada-detail-app-title-line">
              <div className="guangdada-detail-app-name">{appName}</div>
              <a href={detailPageUrl} target="_blank" rel="noreferrer" className="guangdada-detail-advertiser-search-link">
                <SearchOutlined /> 查看该广告主创意
              </a>
              {storeCategoryLabels.length > 0 ? (
                <div className="guangdada-detail-store-category">
                  <span>{Number(displayItem?.os) === 2 ? 'Google Play上架分类:' : Number(displayItem?.os) === 1 ? 'AppStore上架分类:' : '上架分类:'}</span>
                  <strong>{storeCategoryLabels.join('、')}</strong>
                </div>
              ) : null}
            </div>
            <div className="guangdada-detail-developer-line">
              <span className="guangdada-detail-developer">{developerName}</span>
              {detailTagGroups.slice(0, 2).flatMap((group) => group.tags.slice(0, 2)).map((label) => (
                <span key={label} className="guangdada-detail-soft-tag">{label}</span>
              ))}
            </div>
          </div>
        </div>
        {(loadingAdvRec || advRecList.length > 0) && (
          <div className="guangdada-detail-similar-advertisers">
            <div className="guangdada-detail-section-title">相似广告主</div>
            {loadingAdvRec ? (
              <Spin size="small" />
            ) : (
              <div className="guangdada-detail-advertiser-avatars">
                {advRecList.map((adv, idx) => {
                  const domain = adv.domain ?? adv.ads_data?.domain ?? adv.advertiser_key;
                  const name = adv.advertiser_name ?? adv.ads_data?.advertiser_name ?? adv.app_name ?? '';
                  const logoUrl = adv.logo_url ?? adv.ads_data?.logo_url ?? adv.app_logo;
                  const menuItems = [
                    {
                      key: 'detail',
                      icon: <FileTextOutlined />,
                      label: '查看该广告主详情',
                      onClick: () => {
                        setAdvertiserDrawerDomain(domain || null);
                        setAdvertiserDrawerName(name || '');
                        setAdvertiserDrawerOpen(true);
                      },
                    },
                    {
                      key: 'creative',
                      icon: <SearchOutlined />,
                      label: '查看该广告主创意（待实现）',
                      disabled: true,
                    },
                  ];
                  return (
                    <Dropdown
                      key={domain ?? idx}
                      menu={{ items: menuItems }}
                      trigger={['click']}
                    >
                      <div className="guangdada-detail-advertiser-avatar guangdada-detail-advertiser-avatar--clickable" title={`广告主: ${name || domain || ''}`}>
                        {logoUrl ? (
                          <img src={getProxiedMediaUrl(logoUrl)} alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <span className="guangdada-detail-avatar-placeholder">{name?.slice(0, 1) || '?'}</span>
                        )}
                      </div>
                    </Dropdown>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="guangdada-detail-meta-grid">
        <div><span>投放渠道</span><strong>{platform}</strong></div>
        <div><span>文案语言</span><strong>{loadingDetail ? '加载中…' : (detailData?.language ?? '—')}</strong></div>
        <div><span>地区</span><strong>{loadingDetail ? '加载中…' : (detailData?.region ?? '—')}</strong></div>
        <div><span>素材尺寸</span><strong>{loadingDetail ? '加载中…' : (detailData?.materialSize ?? '—')}</strong></div>
        <div><span>投放账号</span><strong>{displayItem.page_name || '—'}</strong></div>
      </div>

      <div className="guangdada-detail-metrics">
        {exposureValue != null && (
          <div className="guangdada-detail-metric-card">
            <div className="guangdada-detail-metric-label">
              人气值（本周）
              <AntdTooltip title="每个周一开始到现在的人气值总和">
                <span className="guangdada-detail-metric-label-icon" aria-label="说明">
                  <QuestionCircleOutlined />
                </span>
              </AntdTooltip>
            </div>
            <div className="guangdada-detail-metric-value">{exposureValue}</div>
            <div className="guangdada-detail-metric-extra">
              总人气值
              {' '}{formatCompactNumber(displayItem.all_exposure_value)}
              <AntdTooltip title="该广告所有历史人气值（包括重投）的总和，帮助判断广告创意的整体效果">
                <span className="guangdada-detail-metric-extra-icon" aria-label="说明">
                  <QuestionCircleOutlined />
                </span>
              </AntdTooltip>
            </div>
          </div>
        )}
        <div className="guangdada-detail-metric-card">
          <div className="guangdada-detail-metric-label">投放天数</div>
          <div className="guangdada-detail-metric-value">{daysCount}</div>
          <div className="guangdada-detail-metric-extra">(UTC+8) {dateRange}</div>
          {displayItem.first_seen != null && (
            <div className="guangdada-detail-metric-extra">首次发现 (UTC+8) {formatFullDate(displayItem.first_seen)}</div>
          )}
        </div>
        <div className="guangdada-detail-metric-card">
          <div className="guangdada-detail-metric-label">展示估值</div>
          <div className="guangdada-detail-metric-value">{impressionEstimate}</div>
          {displayItem.heat != null && <div className="guangdada-detail-metric-extra">热度 {displayItem.heat}</div>}
        </div>
        {displayItem.ad_cost != null ? (
          <div className="guangdada-detail-metric-card">
            <div className="guangdada-detail-metric-label">
              广告花费($)
              <AntdTooltip title="官方估算花费，供趋势判断参考">
                <span className="guangdada-detail-metric-label-icon" aria-label="说明"><QuestionCircleOutlined /></span>
              </AntdTooltip>
            </div>
            <div className="guangdada-detail-metric-value">{formatCurrencyNumber(displayItem.ad_cost)}</div>
          </div>
        ) : null}
        {rankStatus?.top_creative || rankStatus?.rising_creative || rankStatus?.new_creative ? (
          <div className="guangdada-detail-metric-card guangdada-detail-metric-card--rank">
            <div className="guangdada-detail-metric-label">榜单状态</div>
            <div className="guangdada-detail-rank-badges">
              {rankStatus.top_creative ? <span>Top创意</span> : null}
              {rankStatus.rising_creative ? <span>飙升创意</span> : null}
              {rankStatus.new_creative ? <span>新创意</span> : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="guangdada-detail-analysis">
        <div className="guangdada-detail-section-title">创意分析</div>
        {!rawDetail ? (
          loadingDetail ? (
            <div className="guangdada-detail-placeholder">加载中…</div>
          ) : (
            <div className="guangdada-detail-placeholder">暂无数据</div>
          )
        ) : analysisSections.length === 0 ? (
          <div className="guangdada-detail-placeholder">暂无创意分析标签</div>
        ) : (
          <div className="guangdada-detail-analysis-sections">
            {analysisSections.map((section) => (
              <div key={section.title} className="guangdada-detail-analysis-section">
                <span className="guangdada-detail-analysis-section-title">{section.title}</span>
                <div className="guangdada-detail-analysis-section-body">
                  {section.groups.map((group) => (
                    <div key={`${section.title}-${group.parentLabel}`} className="guangdada-detail-analysis-group">
                      <span className="guangdada-detail-analysis-group-title">{group.parentLabel}</span>
                      {group.tags.map((name, idx) => (
                        <span
                          key={`${section.title}-${group.parentLabel}-${name}-${idx}`}
                          className={`guangdada-detail-tag-pill ${section.title === '创意策略' ? 'guangdada-detail-tag-pill--purple' : 'guangdada-detail-tag-pill--gold'}`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="guangdada-detail-script-block">
        <div className="guangdada-detail-section-title">素材脚本分析</div>
        {loadingScriptAnalysis ? (
          <div className="guangdada-detail-loading-wrap"><Spin size="small" tip="加载素材脚本…" /></div>
        ) : (
          <ScriptAnalysisTimeline script={scriptAnalysis} raw={rawDetail || displayItem} />
        )}
      </div>
    </div>
  );

  const formatMetricDate = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts * 1000);
    const y = d.getFullYear().toString().slice(-2);
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${day}`;
  };
  const formatExposure = (v) => {
    if (v == null) return '--';
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
    return String(v);
  };
  const getPlatformIcon = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('facebook') && !p.includes('messenger')) return 'f';
    if (p.includes('messenger')) return 'm';
    if (p.includes('instagram')) return 'ig';
    if (p.includes('admob') || p.includes('google')) return 'ad';
    return platform || '—';
  };

  const relatedAdsTab = (
    <div className="guangdada-detail-related-ads-section">
      {(loadingRelated || relatedAdvertisers.length > 0) && (
        <div className="guangdada-detail-related-advertisers-block">
          <div className="guangdada-detail-section-title">使用相同素材其他广告主</div>
          {loadingRelated ? (
            <div className="guangdada-detail-related-advertisers-loading"><Spin size="small" /></div>
          ) : (
            <div className="guangdada-detail-related-advertisers-list">
              {relatedAdvertisers.map((adv, idx) => {
                const domain = adv.domain ?? adv.advertiser_key;
                const name = adv.advertiser_name ?? '';
                const menuItems = [
                  {
                    key: 'detail',
                    icon: <FileTextOutlined />,
                    label: '查看该广告主详情',
                    onClick: () => {
                      setAdvertiserDrawerDomain(domain || null);
                      setAdvertiserDrawerName(name || '');
                      setAdvertiserDrawerOpen(true);
                    },
                  },
                  {
                    key: 'creative',
                    icon: <SearchOutlined />,
                    label: '查看该广告主创意（待实现）',
                    disabled: true,
                  },
                ];
                return (
                  <Dropdown key={adv.domain ?? idx} menu={{ items: menuItems }} trigger={['click']}>
                    <div className="guangdada-detail-related-advertiser-item guangdada-detail-related-advertiser-item--clickable">
                      {adv.logo_url ? (
                        <img
                          src={adv.logo_url}
                          alt=""
                          className="guangdada-detail-related-advertiser-logo"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="guangdada-detail-related-advertiser-logo-placeholder">{adv.advertiser_name?.slice(0, 1) || '?'}</span>
                      )}
                      <span className="guangdada-detail-related-advertiser-name" title={adv.advertiser_name}>{adv.advertiser_name || '—'}</span>
                    </div>
                  </Dropdown>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="guangdada-detail-section-title">使用相同素材其他广告</div>
      {relatedAds.length > 0 ? (
        <div className="guangdada-detail-related-ads-table-wrap">
          <table className="guangdada-detail-related-ads-table">
            <thead>
              <tr>
                <th>广告主</th>
                <th>展示估值</th>
                <th>渠道</th>
                <th>广告文案</th>
                <th>落地页</th>
                <th>投放天数</th>
              </tr>
            </thead>
            <tbody>
              {relatedAds.map((ad, idx) => {
                const daysStr = ad.days_count != null ? `${ad.days_count}天` : '--';
                const dateRangeStr = ad.first_seen != null && ad.last_seen != null
                  ? `${formatMetricDate(ad.first_seen)}-${formatMetricDate(ad.last_seen)} (UTC+8)`
                  : '';
                const copyText = [ad.title, ad.body].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={ad.ad_key || idx}>
                    <td>
                      <div className="guangdada-detail-table-advertiser">
                        {ad.logo_url && (
                          <img src={ad.logo_url} alt="" className="guangdada-detail-table-logo" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                        <div className="guangdada-detail-table-advertiser-text">
                          <span className="guangdada-detail-table-advertiser-name">{ad.advertiser_name || '—'}</span>
                          <span className="guangdada-detail-table-developer">{ad.app_developer || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatExposure(ad.impression)}</td>
                    <td><span className="guangdada-detail-table-channel" title={ad.platform}>{getPlatformIcon(ad.platform)}</span></td>
                    <td className="guangdada-detail-table-copy" title={copyText}>{copyText.length > 30 ? copyText.slice(0, 28) + '…' : copyText}</td>
                    <td className="guangdada-detail-table-url" title={ad.store_url || ''}>
                      {ad.store_url ? (
                        <a href={ad.store_url} target="_blank" rel="noopener noreferrer" className="guangdada-detail-landing-link">
                          {ad.store_url.length > 24 ? ad.store_url.slice(0, 22) + '…' : ad.store_url}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="guangdada-detail-table-days">{daysStr}</div>
                      {dateRangeStr && <div className="guangdada-detail-table-daterange">{dateRangeStr}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="guangdada-detail-placeholder">暂无关联广告</div>
      )}
    </div>
  );

  const tabItems = [
    { key: '1', label: '概览', children: (
      <>
        {detailError && <div className="guangdada-detail-error">{detailError}</div>}
        {overviewTab}
      </>
    ) },
    { key: '2', label: '数据趋势', children: (() => {
      if (loadingTrend) {
        return <div className="guangdada-detail-loading-wrap"><Spin size="small" tip="加载数据趋势…" /></div>;
      }
      if (trendError) {
        return <div className="guangdada-detail-error">{trendError}</div>;
      }
      const dailyList = trendData?.daily_popularity || [];
      const topLine = trendData?.top_line && typeof trendData.top_line === 'object' ? trendData.top_line : {};
      const chartData = dailyList.map((d) => ({ date: d.date_str, 人气值: d.value ?? 0 }));
      const lastWeekKeys = Object.keys(topLine).sort();
      const lastWeek = lastWeekKeys.length ? topLine[lastWeekKeys[lastWeekKeys.length - 1]] : null;
      if (chartData.length === 0) {
        return <div className="guangdada-detail-placeholder">暂无趋势数据</div>;
      }
      return (
        <div className="guangdada-detail-trend-section">
          <div className="guangdada-detail-section-title">每日人气值</div>
          <div className="guangdada-detail-trend-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, '人气值']} labelFormatter={(l) => `日期: ${l}`} />
                <Legend />
                {lastWeek && lastWeek.top1 != null && <ReferenceLine y={lastWeek.top1} stroke="#ff4d4f" strokeDasharray="2 2" label={{ value: 'Top1', position: 'right' }} />}
                {lastWeek && lastWeek.top5 != null && <ReferenceLine y={lastWeek.top5} stroke="#faad14" strokeDasharray="2 2" label={{ value: 'Top5', position: 'right' }} />}
                {lastWeek && lastWeek.top10 != null && <ReferenceLine y={lastWeek.top10} stroke="#52c41a" strokeDasharray="2 2" label={{ value: 'Top10', position: 'right' }} />}
                {lastWeek && lastWeek.top50 != null && <ReferenceLine y={lastWeek.top50} stroke="#1890ff" strokeDasharray="2 2" label={{ value: 'Top50', position: 'right' }} />}
                <Line type="monotone" dataKey="人气值" stroke="#1677ff" strokeWidth={2} dot={{ r: 3 }} name="人气值" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    })() },
    { key: '3', label: '相似素材', children: (
      loadingSimilarAds ? (
        <div className="guangdada-detail-loading-wrap"><Spin size="small" tip="加载相似素材…" /></div>
      ) : similarAds.length > 0 ? (
        <div className="guangdada-detail-similar-ads-section">
          <div className="guangdada-detail-section-title">相似素材推荐</div>
          <div className="guangdada-detail-similar-ads-grid">
            {similarAds.map((ad, idx) => {
              const imgUrl = ad.preview_img_url || ad.resource_urls?.[0]?.image_url || '';
              const exposureStr = formatExposure(ad.all_exposure_value);
              const daysStr = ad.days_count != null ? `${ad.days_count}天` : '--';
              const lastSeenStr = formatMetricDate(ad.last_seen);
              return (
                <div key={ad.ad_key || idx} className="guangdada-detail-similar-card">
                  <div className="guangdada-detail-similar-card-header">
                    {ad.logo_url && (
                      <div className="guangdada-detail-similar-card-logo-wrap">
                        <img src={ad.logo_url} alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
                      </div>
                    )}
                    <div className="guangdada-detail-similar-card-meta">
                      <div className="guangdada-detail-similar-card-advertiser">{ad.advertiser_name || '—'}</div>
                      <div className="guangdada-detail-similar-card-developer">{ad.app_developer || ''}</div>
                    </div>
                  </div>
                  <div className="guangdada-detail-similar-card-image">
                    {imgUrl ? (
                      <img src={imgUrl} alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.style.background = '#eee'; e.target.alt = ''; }} />
                    ) : (
                      <div className="guangdada-detail-similar-card-image-placeholder">暂无素材</div>
                    )}
                  </div>
                  <div className="guangdada-detail-similar-card-footer">
                    <span className="guangdada-detail-similar-card-title">{ad.title || ad.body || '—'}</span>
                    <span className="guangdada-detail-similar-card-platform" title={ad.platform}>{getPlatformIcon(ad.platform)}</span>
                  </div>
                  <div className="guangdada-detail-similar-card-metrics">
                    <div className="guangdada-detail-similar-card-metric"><span className="guangdada-detail-similar-card-metric-label">人气值</span>{exposureStr}</div>
                    <div className="guangdada-detail-similar-card-metric"><span className="guangdada-detail-similar-card-metric-label">投放天数</span>{daysStr}</div>
                    <div className="guangdada-detail-similar-card-metric"><span className="guangdada-detail-similar-card-metric-label">最后看见</span>{lastSeenStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="guangdada-detail-placeholder">暂无相似素材或请前往广大大官网查看</div>
      )
    ) },
    { key: '4', label: '关联广告', children: relatedAdsTab },
  ];

  return (
    <>
    <Modal
      className="guangdada-detail-modal"
      title={
        <div className="guangdada-detail-modal-header">
          <span className="guangdada-detail-modal-title">创意详情</span>
          <div className="guangdada-detail-modal-actions">
            <Button size="small" icon={<StarOutlined />} disabled>收藏</Button>
            <Button
              size="small"
              icon={<ShareAltOutlined />}
              onClick={() => navigator.clipboard?.writeText(detailPageUrl)}
            >
              分享
            </Button>
            <a href={detailPageUrl} target="_blank" rel="noreferrer">
              <Button size="small" icon={<ExportOutlined />}>单页打开</Button>
            </a>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1500}
      destroyOnClose
    >
      <div className="guangdada-detail-body">
        <div className="guangdada-detail-left">
          <div className="guangdada-detail-radio-group">
            <span className="guangdada-detail-radio-item guangdada-detail-radio-item--active">创意</span>
          </div>
          <div className="guangdada-detail-creative-area">
            <div className="guangdada-detail-image-wrap">
              {htmlUrl ? (
                <div className="guangdada-detail-iframe-wrap">
                  <iframe
                    src={htmlUrl}
                    title="创意预览"
                    className="guangdada-detail-media guangdada-detail-iframe"
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin"
                    scrolling="no"
                  />
                </div>
              ) : hasPlayableVideo ? (
                <video
                  src={getProxiedMediaUrl(videoUrl)}
                  controls
                  className="guangdada-detail-media"
                  referrerPolicy="no-referrer"
                />
              ) : thumbnailUrl ? (
                <>
                  <img
                    src={getProxiedMediaUrl(thumbnailUrl)}
                    alt="创意素材"
                    className="guangdada-detail-media"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.target.onerror = null; e.target.style.background = '#f0f0f0'; e.target.alt = '加载失败'; }}
                  />
                  {isVideo ? <div className="guangdada-detail-media-no-source">暂无播放源</div> : null}
                </>
              ) : (
                <div className="guangdada-detail-media guangdada-detail-media--empty">{isVideo ? '暂无播放源' : '暂无素材'}</div>
              )}
            </div>
            <div className="guangdada-detail-creative-info">
              <div className="guangdada-detail-creative-title-row">
                <div className="guangdada-detail-creative-title">{title || '—'}</div>
                <button
                  type="button"
                  className="guangdada-detail-translate-btn"
                  onClick={() => {
                    setTranslateModalText(title || '');
                    setTranslateModalType('title');
                    setTranslateModalOpen(true);
                  }}
                >
                  翻译
                </button>
              </div>
              <div className="guangdada-detail-creative-actions">
                <Button
                  type="link"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (htmlUrl) {
                      handleDownload(e);
                    } else if (onRequestDownload && displayItem) {
                      // 视频、图片均走尺寸选择弹窗
                      onRequestDownload(displayItem);
                    } else {
                      handleDownload(e);
                    }
                  }}
                >
                  下载素材
                </Button>
                {(displayItem?.store_url || detailData?.raw?.store_url) && (
                  <AntdTooltip title={displayItem?.store_url || detailData?.raw?.store_url || ''}>
                    <a
                      href={displayItem?.store_url || detailData?.raw?.store_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guangdada-detail-store-link-btn"
                    >
                      <span className="guangdada-detail-store-link-icon" aria-hidden />
                      商店链接
                    </a>
                  </AntdTooltip>
                )}
              </div>
            </div>
            {body && (
              <div className="guangdada-detail-body-row">
                <div className="guangdada-detail-body-text">{body}</div>
                <button
                  type="button"
                  className="guangdada-detail-translate-btn"
                  onClick={() => {
                    setTranslateModalText(body || '');
                    setTranslateModalType('description');
                    setTranslateModalOpen(true);
                  }}
                >
                  翻译
                </button>
              </div>
            )}
            <div className="guangdada-detail-disclaimer">
              免责申明：素材来源于 Facebook/Google 等公开透明的数据库，仅用于数据挖掘和分析
            </div>
          </div>
          <div className="guangdada-detail-versions">
            <div className="guangdada-detail-versions-title">
              {loadingVersions ? '正在加载关联版本…' : `该广告有 ${Math.max(versionItems.length, 1)} 种版本`}
            </div>
            <div className="guangdada-detail-version-list">
              {versionItems.slice(0, 8).map((version, idx) => {
                const media = getMediaUrls(version);
                const thumb = media.thumbnailUrl || version.preview_img_url || version.logo_url || '';
                return (
                  <div key={version.ad_key || idx} className="guangdada-detail-version-thumb" title={version.advertiser_name || version.page_name || `版本 ${idx + 1}`}>
                    {thumb ? (
                      <img src={getProxiedMediaUrl(thumb)} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="guangdada-detail-right">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className="guangdada-detail-tabs"
          />
        </div>
      </div>
    </Modal>
    <CopyTranslationModal
      open={translateModalOpen}
      onClose={() => setTranslateModalOpen(false)}
      initialText={translateModalText}
      textType={translateModalType}
    />
    <Drawer
      title="广告主概览"
      placement="right"
      width={1080}
      open={advertiserDrawerOpen}
      onClose={() => {
        setAdvertiserDrawerOpen(false);
        setAdvertiserDrawerDomain(null);
        setAdvertiserDrawerName('');
        setAdvertiserDrawerData(null);
        setAdvertiserDrawerError(null);
      }}
      destroyOnClose
      className="guangdada-advertiser-drawer"
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button type="default" size="small" disabled>未订阅</Button>
          <a
            href={advertiserDrawerDomain ? `https://guangdada.net/modules/creative/display-ads?app_type=1&store=${encodeURIComponent(advertiserDrawerDomain)}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button type="primary" size="small">详情</Button>
          </a>
        </div>
      }
    >
      {loadingAdvertiserDrawer ? (
        <div className="guangdada-detail-loading-wrap"><Spin size="small" tip="加载广告主信息…" /></div>
      ) : advertiserDrawerError ? (
        <div className="guangdada-detail-error">{advertiserDrawerError}</div>
      ) : Array.isArray(advertiserDrawerData) && advertiserDrawerData.length > 0 ? (
        <div className="guangdada-advertiser-drawer-body">
          {advertiserDrawerData.map((app, idx) => {
            const adsData = app.ads_data || {};
            const logoUrl = app.app_logo ? `https://appcdn-global.zingfront.com/${app.app_logo}` : (adsData.logo_url || '');
            const appName = app.app_name || adsData.advertiser_name || advertiserDrawerName || '—';
            const developer = app.publisher_name || '';
            const adsCount = adsData.ads_count != null ? adsData.ads_count : app.ads_count;
            return (
              <div key={app.app_id ?? idx} className="guangdada-advertiser-drawer-card">
                <div className="guangdada-advertiser-drawer-header">
                  <div className="guangdada-advertiser-drawer-logo-wrap">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="guangdada-advertiser-drawer-logo" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="guangdada-advertiser-drawer-logo-placeholder">{appName?.slice(0, 1) || '?'}</div>
                    )}
                  </div>
                  <div className="guangdada-advertiser-drawer-info">
                    <div className="guangdada-advertiser-drawer-name">{appName}</div>
                    {developer && <div className="guangdada-advertiser-drawer-developer">{developer}</div>}
                    {adsCount != null && (
                      <div className="guangdada-advertiser-drawer-meta">近30天创意：{adsCount}</div>
                    )}
                  </div>
                </div>
                <a
                  href={advertiserDrawerDomain ? `https://guangdada.net/modules/creative/display-ads?app_type=1&store=${encodeURIComponent(advertiserDrawerDomain)}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 12, display: 'inline-block' }}
                >
                  <Button type="primary" size="small">在广大大查看该广告主</Button>
                </a>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="guangdada-detail-placeholder">暂无广告主数据</div>
      )}
    </Drawer>
  </>
  );
}

export default GuangdadaDetailModal;
