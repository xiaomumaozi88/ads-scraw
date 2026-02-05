import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Tabs, Button, Spin, Dropdown, Drawer, Tooltip as AntdTooltip } from 'antd';
import { FileTextOutlined, SearchOutlined, QuestionCircleOutlined } from '@ant-design/icons';
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
  getGuangdadaRelatedAdvertisers,
  getGuangdadaRelatedAds,
  getGuangdadaSimilarAds,
  getGuangdadaDailyPopularity,
  getGuangdadaAdvRecList,
  getGuangdadaAdvertiserDetail,
  getProxiedMediaUrl,
} from '../utils/api';
import { GUANGDADA_COUNTRY_CODE_TO_CN } from '../data/guangdadaCountries';
import { GUANGDADA_GAME_CATEGORIES_TREE, GUANGDADA_GAME_CODE_TO_LABEL } from '../data/guangdadaGameCategoriesTree';
import { GUANGDADA_CORE_TRACK_CODE_TO_LABEL, GUANGDADA_CATEGORY_TAG_KEY_TO_LABEL } from '../data/guangdadaCoreTrack';
import './GuangdadaDetailModal.css';

/**
 * 从列表项解析缩略图/视频 URL（与 CreativeCardGuangdada 一致）
 */
function getMediaUrls(item) {
  let thumbnailUrl = '';
  let videoUrl = '';
  let htmlUrl = '';
  const isVideo =
    item.ads_type === 2 ||
    (item.resource_urls?.[0]?.type === 2) ||
    !!(item.resource_urls?.[0]?.video_url?.trim?.());
  if (item.resource_urls?.length) {
    const r = item.resource_urls[0];
    if (r.type === 4 && r.html_url && String(r.html_url).trim() !== '') {
      htmlUrl = r.html_url.trim();
    }
    if (isVideo) {
      videoUrl = r.video_url || '';
      thumbnailUrl = item.preview_img_url || r.image_url || '';
    } else {
      thumbnailUrl = r.image_url || item.preview_img_url || '';
    }
  } else {
    thumbnailUrl = item.preview_img_url || '';
  }
  return { thumbnailUrl, videoUrl, isVideo, htmlUrl };
}

/** AppStore 分类 ID -> 中文名（常见，可扩展） */
const APPSTORE_CATEGORY_NAMES = {
  5009: '娱乐场',
  6014: '娱乐',
  6001: '商业',
  6016: '教育',
  6022: '财务',
  6018: '游戏',
  7006: '赌场',
};

/** 从详情接口返回中解析文案语言、地区、素材尺寸、material_id，并保留 raw 供标签/分类展示 */
function parseDetailData(detailRes) {
  const payload = detailRes?.data;
  const raw = payload?.data ?? payload ?? {};
  let language = raw.language ?? raw.copy_language ?? raw.copy_lang ?? (Array.isArray(raw.languages) ? raw.languages[0] : null);
  if (language == null || String(language).trim() === '') {
    language = '其他';
  }
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

/**
 * 广大大创意详情弹窗：打开时请求详情接口与相似广告主/关联广告
 */
function GuangdadaDetailModal({ item, open, onClose, onRequestDownload }) {
  const [activeTab, setActiveTab] = useState('1');
  const [detailData, setDetailData] = useState(null);
  const [relatedAdvertisers, setRelatedAdvertisers] = useState([]);
  const [relatedAds, setRelatedAds] = useState([]);
  const [similarAds, setSimilarAds] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingSimilarAds, setLoadingSimilarAds] = useState(false);
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

  const { thumbnailUrl, videoUrl, isVideo, htmlUrl } = useMemo(
    () => (item ? getMediaUrls(item) : { thumbnailUrl: '', videoUrl: '', isVideo: false, htmlUrl: '' }),
    [item]
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
      setTrendData(null);
      setAdvRecList([]);
      setDetailError(null);
      setTrendError(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    setTrendError(null);
    setTrendData(null);
    setLoadingTrend(true);
    const platformStr = typeof item.platform === 'string' ? item.platform : (item.platform != null ? String(item.platform) : 'admob');
    getGuangdadaDailyPopularity({
      creative_key: item.ad_key,
      first_seen: item.first_seen,
      last_seen: item.last_seen,
      app_type: item.app_type ?? item.ads_type ?? 1,
      platform: platformStr,
      category: item.category ?? item.category_id,
    })
      .then((res) => {
        if (cancelled) return;
        setLoadingTrend(false);
        if (res.success && res.data?.data) {
          setTrendData(res.data.data);
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
    getGuangdadaCreativeDetail({
      ad_key: item.ad_key,
      app_type: item.app_type ?? item.ads_type ?? 1,
      search_flag: item.search_flag,
    })
      .then((res) => {
        if (cancelled) return;
        setLoadingDetail(false);
        if (!res.success || !res.data) {
          setDetailData(null);
          return;
        }
        const parsed = parseDetailData(res);
        setDetailData(parsed);
        const raw = res.data?.data ?? res.data ?? {};
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
        }
        const resourceUrl = item.preview_img_url || item.resource_urls?.[0]?.image_url || '';
        setLoadingSimilarAds(true);
        getGuangdadaSimilarAds({
          resource_url: resourceUrl,
          ad_key: item.ad_key,
          app_type: item.app_type ?? item.ads_type ?? 1,
          created_at: item.created_at,
          similar_ads_count: 8,
        })
          .then((res) => {
            if (cancelled) return;
            setSimilarAds(Array.isArray(res?.data) ? res.data : []);
          })
          .catch(() => { if (!cancelled) setSimilarAds([]); })
          .finally(() => { if (!cancelled) setLoadingSimilarAds(false); });

        const materialId = parsed.materialId ?? item.image_ahash_md5;
        if (materialId) {
          setLoadingRelated(true);
          Promise.all([
            getGuangdadaRelatedAdvertisers({
              app_type: item.app_type ?? item.ads_type ?? 1,
              material_id: materialId,
              page: 1,
              created_at: item.created_at != null ? String(item.created_at) : undefined,
              page_size: 20,
            }),
            getGuangdadaRelatedAds({
              app_type: item.app_type ?? item.ads_type ?? 1,
              material_id: materialId,
              page: 1,
              created_at: item.created_at != null ? String(item.created_at) : undefined,
              page_size: 5,
            }),
          ])
            .then(([advRes, adsRes]) => {
              if (cancelled) return;
              setRelatedAdvertisers(Array.isArray(advRes?.data) ? advRes.data : []);
              setRelatedAds(Array.isArray(adsRes?.data) ? adsRes.data : []);
            })
            .catch(() => {
              if (!cancelled) setRelatedAdvertisers([]);
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
          setLoadingTrend(false);
          setDetailError(err?.message || '加载详情失败');
          setDetailData(null);
          setRelatedAdvertisers([]);
          setRelatedAds([]);
          setTrendData(null);
          setAdvRecList([]);
        }
      });
    return () => { cancelled = true; };
  }, [open, item?.ad_key, item?.app_type, item?.ads_type, item?.search_flag, item?.created_at, item?.first_seen, item?.last_seen, item?.platform, item?.category, item?.category_id]);

  if (!item) return null;

  const appName = item.advertiser_name || '—';
  const developerName = item.app_developer || item.advertiser_id || '—';
  const title = item.title || item.message || item.body || '';
  const body = item.body || item.message || '';
  const callToAction = item.call_to_action || '';
  const platform = item.platform != null ? (Array.isArray(item.platform) ? item.platform.join(', ') : String(item.platform)) : '—';
  const impressionEstimate = item.impression != null ? String(item.impression) : 'N/A';
  const exposureValue =
    item.all_exposure_value != null
      ? item.all_exposure_value >= 10000
        ? `${(item.all_exposure_value / 10000).toFixed(1)}万`
        : item.all_exposure_value
      : null;
  const daysCount = item.days_count != null ? `${item.days_count}天` : 'N/A';
  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const d = new Date(ts * 1000);
    const y = d.getFullYear().toString().slice(-2);
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${day}`;
  };
  const dateRange =
    item.first_seen != null && item.last_seen != null
      ? `${formatDate(item.first_seen)}-${formatDate(item.last_seen)}`
      : 'N/A';

  const detailPageUrl = `https://guangdada.net/modules/creative/display-ads/detail?channel=${encodeURIComponent(item.platform || 'admob')}&id=${encodeURIComponent(item.ad_key || '')}&type=${item.app_type ?? item.ads_type ?? 1}&created_at=${item.created_at ?? ''}&fb_merge=false&search_flag=${item.search_flag ?? ''}`;

  const handleDownload = (e) => {
    e.stopPropagation();
    const name = (title || appName || item.ad_key || 'creative').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'creative';
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
    const url = isVideo ? videoUrl : thumbnailUrl;
    if (!url) return;
    const ext = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
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
          {item.logo_url && (
            <img
              src={item.logo_url}
              alt=""
              className="guangdada-detail-app-icon"
              referrerPolicy="no-referrer"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="guangdada-detail-advertiser-info">
            <div className="guangdada-detail-app-name">{appName}</div>
            <div className="guangdada-detail-developer">{developerName}</div>
          </div>
        </div>
        <div className="guangdada-detail-meta-row">
          <span className="guangdada-detail-meta-label">投放渠道</span>
          <span className="guangdada-detail-meta-value">{platform}</span>
        </div>
        <div className="guangdada-detail-meta-row">
          <span className="guangdada-detail-meta-label">文案语言</span>
          <span className="guangdada-detail-meta-value">{loadingDetail ? '加载中…' : (detailData?.language ?? '—')}</span>
        </div>
        <div className="guangdada-detail-meta-row">
          <span className="guangdada-detail-meta-label">地区</span>
          <span className="guangdada-detail-meta-value">{loadingDetail ? '加载中…' : (detailData?.region ?? '—')}</span>
        </div>
        <div className="guangdada-detail-meta-row">
          <span className="guangdada-detail-meta-label">素材尺寸</span>
          <span className="guangdada-detail-meta-value">{loadingDetail ? '加载中…' : (detailData?.materialSize ?? '—')}</span>
        </div>
        {/* {detailData?.raw && (detailData.raw.category?.length || detailData.raw.original_categories?.length) && (
          <div className="guangdada-detail-meta-row">
            <span className="guangdada-detail-meta-label">
              {Number(item?.os) === 2 ? 'Google Play上架分类' : Number(item?.os) === 1 ? 'AppStore上架分类' : '上架分类'}
            </span>
            <span className="guangdada-detail-meta-value">
              {[
                ...(detailData.raw.category || []),
                ...(detailData.raw.original_categories || []),
              ]
                .filter((id, i, arr) => arr.indexOf(id) === i)
                .map((id) => APPSTORE_CATEGORY_NAMES[id] ?? `分类 ${id}`)
                .join('、') || '—'}
            </span>
          </div>
        )} */}
        {detailData?.raw && (detailData.raw.category_tag && Object.keys(detailData.raw.category_tag).length || (detailData.raw.game_play?.length || detailData.raw.game_core_track?.length) || (detailData.raw.game_theme?.length)) && (
          <div className="guangdada-detail-tags-block">
            <div className="guangdada-detail-tag-list">
              {detailData.raw.category_tag && typeof detailData.raw.category_tag === 'object' && Object.entries(detailData.raw.category_tag).flatMap(([catKey, ids]) =>
                (Array.isArray(ids) ? ids : []).map((tid) => {
                  const tidLabel = GUANGDADA_CORE_TRACK_CODE_TO_LABEL[String(tid)] ?? GUANGDADA_GAME_CODE_TO_LABEL[String(tid)] ?? tid;
                  const catLabel = GUANGDADA_GAME_CATEGORIES_TREE.find(item => item.children.find(child => child.label === tidLabel))?.name || '';
                  return (
                    <span key={`ct-${catKey}-${tid}`} className="guangdada-detail-tag-pill">{catLabel}:{tidLabel}</span>
                  );
                })
              )}
              {(detailData.raw.game_core_track || []).map((id) => {
                const label = GUANGDADA_CORE_TRACK_CODE_TO_LABEL[String(id)] ?? GUANGDADA_GAME_CODE_TO_LABEL[String(id)] ?? id;
                return <span key={`gc-${id}`} className="guangdada-detail-tag-pill">{label}</span>;
              })}
              {(detailData.raw.game_play || []).length > 0 && (
                <>
                  <span className="guangdada-detail-tag-prefix">玩法</span>
                  {(detailData.raw.game_play || []).map((id) => {
                    const label = GUANGDADA_CORE_TRACK_CODE_TO_LABEL[String(id)] ?? GUANGDADA_GAME_CODE_TO_LABEL[String(id)] ?? id;
                    return <span key={`gp-${id}`} className="guangdada-detail-tag-pill">{label}</span>;
                  })}
                </>
              )}
              {(detailData.raw.game_theme || []).length > 0 && (
                <>
                  <span className="guangdada-detail-tag-prefix">主题</span>
                  {(detailData.raw.game_theme || []).map((id) => {
                    const label = GUANGDADA_CORE_TRACK_CODE_TO_LABEL[String(id)] ?? GUANGDADA_GAME_CODE_TO_LABEL[String(id)] ?? id;
                    return <span key={`gt-${id}`} className="guangdada-detail-tag-pill">{label}</span>;
                  })}
                </>
              )}
            </div>
          </div>
        )}
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
                        <img src={logoUrl} alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
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
            
              {' '}{item.all_exposure_value ?? '—'}
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
          {item.first_seen != null && (
            <div className="guangdada-detail-metric-extra">首次发现 (UTC+8) {formatDate(item.first_seen)}</div>
          )}
        </div>
        <div className="guangdada-detail-metric-card">
          <div className="guangdada-detail-metric-label">展示估值</div>
          <div className="guangdada-detail-metric-value">{impressionEstimate}</div>
          {item.heat != null && <div className="guangdada-detail-metric-extra">热度 {item.heat}</div>}
        </div>
      </div>
      <div className="guangdada-detail-analysis">
        <div className="guangdada-detail-section-title">创意分析</div>
        {!detailData?.raw ? (
          loadingDetail ? (
            <div className="guangdada-detail-placeholder">加载中…</div>
          ) : (
            <div className="guangdada-detail-placeholder">暂无数据</div>
          )
        ) : (() => {
          const raw = detailData.raw;
          const aiTags = Array.isArray(raw.material_ai_tag) ? raw.material_ai_tag : [];
          const searchWords = Array.isArray(raw.material_ai_search_word) ? raw.material_ai_search_word : [];
          const byParent = {};
          aiTags.forEach((t) => {
            const p = t.parent_cn_name || t.parent_en_name || '其他';
            if (!byParent[p]) byParent[p] = [];
            byParent[p].push(t.cn_name || t.en_name || String(t.id));
          });
          searchWords.forEach((t) => {
            const p = t.parent_cn_name || t.parent_en_name || '其他';
            if (!byParent[p]) byParent[p] = [];
            byParent[p].push(t.cn_name || t.en_name || String(t.id));
          });
          const groups = Object.entries(byParent);
          if (groups.length === 0) {
            return <div className="guangdada-detail-placeholder">暂无创意分析标签</div>;
          }
          return (
            <div className="guangdada-detail-analysis-groups">
              {groups.map(([parentName, tags]) => (
                <div key={parentName} className="guangdada-detail-analysis-group">
                  <div className="guangdada-detail-analysis-group-title">{parentName}</div>
                  <div className="guangdada-detail-tag-list">
                    {tags.map((name, idx) => (
                      <span key={`${parentName}-${idx}`} className="guangdada-detail-tag-pill">{name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
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
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {relatedAds.map((ad, idx) => {
                const viewUrl = `https://guangdada.net/modules/creative/display-ads/detail?channel=${encodeURIComponent(ad.platform || 'admob')}&id=${encodeURIComponent(ad.ad_key || '')}&type=${ad.app_type ?? 1}&created_at=${ad.created_at ?? ''}&fb_merge=false&search_flag=${ad.search_flag ?? ''}`;
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
                    <td>
                      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="guangdada-detail-table-view-btn">查看</a>
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
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1400}
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
              ) : isVideo && videoUrl ? (
                <video
                  src={getProxiedMediaUrl(videoUrl)}
                  controls
                  className="guangdada-detail-media"
                  referrerPolicy="no-referrer"
                />
              ) : thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="创意素材"
                  className="guangdada-detail-media"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.style.background = '#f0f0f0'; e.target.alt = '加载失败'; }}
                />
              ) : (
                <div className="guangdada-detail-media guangdada-detail-media--empty">暂无素材</div>
              )}
            </div>
            <div className="guangdada-detail-creative-info">
              <div className="guangdada-detail-creative-title">{title || '—'}</div>
              <div className="guangdada-detail-creative-actions">
                <Button
                  type="link"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (htmlUrl) {
                      handleDownload(e);
                    } else if (isVideo && onRequestDownload && item) {
                      onRequestDownload(item);
                    } else {
                      handleDownload(e);
                    }
                  }}
                >
                  下载素材
                </Button>
              </div>
            </div>
            {body && (
              <div className="guangdada-detail-body-text">{body}</div>
            )}
            <div className="guangdada-detail-disclaimer">
              免责申明：素材来源于 Facebook/Google 等公开透明的数据库，仅用于数据挖掘和分析
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
