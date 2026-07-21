import React, { useCallback, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Select,
  Spin,
  Tabs,
} from 'antd';
import {
  AndroidFilled,
  AppleFilled,
  InfoCircleFilled,
  PlayCircleFilled,
  ReloadOutlined,
  SearchOutlined,
  StarOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { getGuangdadaCreativeRankList, getProxiedMediaUrl, formatRequestError } from '../../utils/api';
import GuangdadaDetailModal from '../../components/GuangdadaDetailModal';
import { GUANGDADA_GAME_CATEGORIES_TREE } from '../../data/guangdadaGameCategoriesTree';
import { GUANGDADA_TOOL_CATEGORIES_TREE } from '../../data/guangdadaToolCategoriesTree';
import { CHANNEL_VALUE_MAP } from '../../data/guangdadaChannels';
import './GuangdadaCreativeRankPage.css';

const RANK_TABS = [
  {
    key: '3',
    label: '每周热门榜',
    hint: '每周打上Top1%、Top10%标签的创意，按照人气值进行排序，帮助您定位每周表现最佳创意',
    metricLabel: '周人气值总量',
  },
  {
    key: '1',
    label: '每周飙升榜',
    hint: '筛选近期人气增长明显的创意，适合观察本周快速放量的素材方向',
    metricLabel: '周人气增长',
  },
  {
    key: '2',
    label: '新创意榜',
    hint: '聚焦近期新出现且表现较好的创意，适合跟进最新素材趋势',
    metricLabel: '新创意人气',
  },
];

const RANK_TAB_MAP = Object.fromEntries(RANK_TABS.map((item) => [item.key, item]));

const CHANNEL_FILTERS = [
  { value: 'meta', label: 'Facebook系', platforms: ['facebook', 'instagram', 'audience_network', 'messenger'] },
  { value: 'google', label: 'Google系', platforms: ['youtube', 'admob', 'adsense'] },
  { value: 'tiktok', label: 'TikTok', platforms: ['tiktok'] },
  { value: 'twitter', label: 'X(Twitter)', platforms: ['twitter'] },
  { value: 'unity_ads', label: 'UnityAds', platforms: ['unity_ads'] },
  { value: 'applovin', label: 'AppLovin', platforms: ['applovin'] },
  { value: 'vungle', label: 'Liftoff', platforms: ['vungle'] },
  { value: 'ironsource', label: 'ironSource', platforms: ['ironsource'] },
  { value: 'chartboost', label: 'Chartboost', platforms: ['chartboost'] },
  { value: 'topbuzz', label: 'TopBuzz', platforms: ['topbuzz'] },
  { value: 'pinterest', label: 'Pinterest', platforms: ['pinterest'] },
];

const COUNTRY_OPTIONS = [
  { value: 'USA', label: '美国' },
  { value: 'JPN', label: '日本' },
  { value: 'KOR', label: '韩国' },
  { value: 'GBR', label: '英国' },
  { value: 'CAN', label: '加拿大' },
  { value: 'AUS', label: '澳大利亚' },
  { value: 'DEU', label: '德国' },
  { value: 'FRA', label: '法国' },
  { value: 'BRA', label: '巴西' },
];

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'de', label: '德语' },
  { value: 'fr', label: '法语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'es', label: '西班牙语' },
];

const TOP_TYPE_OPTIONS = [
  { value: '', label: '全部Top创意' },
  { value: 'top1', label: 'Top1%' },
  { value: 'top10', label: 'Top10%' },
];

const ADS_TYPE_OPTIONS = [
  { value: '', label: '图片&视频' },
  { value: '1', label: '图片' },
  { value: '2', label: '视频' },
];

const RANK_CACHE_LIMIT = 60;

function normalizeCacheValue(value) {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeCacheValue(item));
    const sortable = normalized.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item));
    return sortable ? [...normalized].sort((a, b) => String(a).localeCompare(String(b))) : normalized;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = normalizeCacheValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableCacheKey(value) {
  return JSON.stringify(normalizeCacheValue(value));
}

function getLastFullWeekRange() {
  const today = dayjs();
  const daysSinceMonday = (today.day() + 6) % 7;
  const currentMonday = today.subtract(daysSinceMonday, 'day').startOf('day');
  return [currentMonday.subtract(7, 'day'), currentMonday.subtract(1, 'day')];
}

function formatDate(ts) {
  if (!ts) return '—';
  const n = Number(ts);
  if (!Number.isFinite(n)) return '—';
  return dayjs.unix(n).format('YYYY-MM-DD');
}

function formatDuration(seconds) {
  const n = parseInt(seconds, 10);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 60) return `${Math.floor(n / 60)}m ${n % 60}s`;
  return `${n}s`;
}

function formatCompactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (Math.abs(n) >= 10000) return `${Math.round(n / 10000)}万`;
  return String(Math.round(n));
}

function getMetricValue(item, chartType) {
  if (chartType === '3') return item.exposure_sum ?? item.all_exposure_value ?? item.impression ?? item.heat;
  if (chartType === '1') return item.exposure_diff ?? item.exposure_growth ?? item.new_week_exposure_value ?? item.exposure_sum;
  return item.new_week_exposure_value ?? item.exposure_sum ?? item.heat;
}

function getMediaInfo(item) {
  const resource = Array.isArray(item?.resource_urls) ? item.resource_urls[0] : null;
  const rawVideoUrl = resource?.video_url != null ? String(resource.video_url).trim() : '';
  const isVideo = Number(item?.ads_type) === 2 || Number(resource?.type) === 2 || Boolean(rawVideoUrl);
  const imageUrl = item?.preview_img_url || resource?.image_url || item?.logo_url || '';
  return {
    isVideo,
    hasPlayableVideo: Boolean(rawVideoUrl),
    imageUrl: imageUrl ? getProxiedMediaUrl(imageUrl) : '',
    videoUrl: rawVideoUrl ? getProxiedMediaUrl(rawVideoUrl) : '',
    videoDuration: formatDuration(item?.video_duration),
  };
}

function flattenCategoryMap(tree) {
  const map = {};
  tree.forEach((group) => {
    group.children?.forEach((child) => {
      map[String(child.value)] = child.label;
    });
  });
  return map;
}

const GAME_CATEGORY_LABELS = flattenCategoryMap(GUANGDADA_GAME_CATEGORIES_TREE);
const TOOL_CATEGORY_LABELS = flattenCategoryMap(GUANGDADA_TOOL_CATEGORIES_TREE);

function buildCategoryTags(item, appType) {
  const source = item?.category_tag || {};
  const labelMap = appType === 2 ? TOOL_CATEGORY_LABELS : GAME_CATEGORY_LABELS;
  return Object.values(source)
    .flat()
    .map((value) => labelMap[String(value)] || String(value))
    .filter(Boolean)
    .slice(0, 2);
}

function getAiTags(item) {
  if (Array.isArray(item?.material_ai_tag)) {
    return item.material_ai_tag.map((tag) => tag?.cn_name || tag?.name || '').filter(Boolean).slice(0, 6);
  }
  return [];
}

function getPlatformLabel(platform) {
  const p = Array.isArray(platform) ? platform[0] : platform;
  if (!p) return '—';
  return CHANNEL_VALUE_MAP[p]?.label || String(p);
}

function buildRankRequestBody(filters, weekRange) {
  const tagIds = filters.tagIds.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
  const platform = filters.channels.flatMap((value) => {
    const item = CHANNEL_FILTERS.find((option) => option.value === value);
    return item?.platforms || [value];
  });
  const [start] = weekRange;
  const body = {
    app_type: String(filters.appType),
    chart_type: String(filters.chartType),
    date: start.format('YYYYMMDD'),
    sort_type: '1',
  };
  if (tagIds.length > 0) body.tag_ids = tagIds;
  if (platform.length > 0) body.platform = [...new Set(platform)];
  if (Array.isArray(filters.geo) && filters.geo.length > 0) body.geo = filters.geo;
  if (Array.isArray(filters.language) && filters.language.length > 0) body.language = filters.language;
  if (filters.os != null && filters.os !== '') body.os = String(filters.os);
  if (filters.topType) body.top_type = filters.topType;
  if (filters.adsType) body.ads_type = filters.adsType;
  if (filters.excludeRetargeting) body.is_new_ads = true;
  return body;
}

function RankingMedal({ rank }) {
  const className = rank <= 3 ? `gdd-rank-medal gdd-rank-medal--${rank}` : 'gdd-rank-medal';
  return (
    <div className={className}>
      {rank <= 3 ? <TrophyOutlined /> : null}
      <span>{rank}</span>
    </div>
  );
}

function CreativeRankRow({ item, rank, chartType, appType, onOpenDetail }) {
  const media = getMediaInfo(item);
  const [mediaHovering, setMediaHovering] = useState(false);
  const metricLabel = RANK_TAB_MAP[chartType]?.metricLabel || '人气值';
  const metricValue = formatCompactNumber(getMetricValue(item, chartType));
  const title = item?.advertiser_name || item?.page_name || '—';
  const developer = item?.app_developer || item?.ecom_advertiser_id || '';
  const categoryTags = buildCategoryTags(item, appType);
  const aiTags = getAiTags(item);
  const detailUrl = item?.ad_key
    ? `https://guangdada.net/modules/creative/display-ads/detail?channel=${encodeURIComponent(item.platform || '')}&id=${encodeURIComponent(item.ad_key)}&type=${item.app_type || appType}&created_at=${item.created_at || ''}&fb_merge=false&search_flag=${item.search_flag || ''}`
    : '';

  return (
    <div
      className="gdd-rank-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail?.(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpenDetail?.(item);
      }}
    >
      <RankingMedal rank={rank} />
      <button
        type="button"
        className="gdd-rank-media"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetail?.(item);
        }}
        onMouseEnter={() => setMediaHovering(true)}
        onMouseLeave={() => setMediaHovering(false)}
        aria-label="预览素材"
      >
        {media.imageUrl ? (
          <img src={media.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="gdd-rank-media__empty">暂无素材</div>
        )}
        {mediaHovering && media.hasPlayableVideo ? (
          <video
            className="gdd-rank-media__video"
            src={media.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : null}
        {media.hasPlayableVideo ? (
          <span className="gdd-rank-media__play">
            <PlayCircleFilled />
            {media.videoDuration}
          </span>
        ) : media.isVideo ? (
          <span className="gdd-rank-media__no-source">暂无播放源</span>
        ) : null}
      </button>
      <div className="gdd-rank-main">
        <div className="gdd-rank-advertiser">
          {item.logo_url ? (
            <img src={getProxiedMediaUrl(item.logo_url)} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span>{String(title).slice(0, 1)}</span>
          )}
          <div>
            <div className="gdd-rank-title" title={title}>{title}</div>
            {developer ? <div className="gdd-rank-developer" title={developer}>{developer}</div> : null}
          </div>
        </div>
        <div className="gdd-rank-meta-line">
          <span className="gdd-rank-os">{Number(item.os) === 2 ? <AndroidFilled /> : <AppleFilled />}</span>
          <span>{getPlatformLabel(item.platform)}</span>
          {categoryTags.map((tag) => <span key={tag} className="gdd-rank-category-tag">{tag}</span>)}
        </div>
        <div className="gdd-rank-actions">
          <span>落地页</span>
          <span>收藏</span>
          {detailUrl ? (
            <a href={detailUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>查看官网详情</a>
          ) : null}
        </div>
      </div>
      <div className="gdd-rank-metric">
        <strong>{metricValue}</strong>
        <span>{metricLabel}</span>
      </div>
      <div className="gdd-rank-tags">
        {aiTags.length > 0 ? aiTags.map((tag) => <span key={tag}>{tag}</span>) : <em>暂无标签</em>}
        <small>创意AI标签</small>
      </div>
      <div className="gdd-rank-days">
        <strong>{item.days_count != null ? `${item.days_count} 天` : '—'}</strong>
        <span>{formatDate(item.first_seen)}</span>
        <span>~</span>
        <span>{formatDate(item.last_seen)}</span>
        <small>投放时间</small>
      </div>
    </div>
  );
}

export default function GuangdadaCreativeRankPage({
  isLoggedIn,
  onRequireLogin,
  addLog,
  onQuotaChanged,
}) {
  const [weekRange] = useState(() => getLastFullWeekRange());
  const [filters, setFilters] = useState({
    chartType: '3',
    appType: 1,
    tagIds: [],
    channels: [],
    os: '',
    geo: [],
    language: [],
    topType: '',
    adsType: '',
    excludeRetargeting: false,
  });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const requestSeqRef = useRef(0);
  const rankCacheRef = useRef(new Map());

  const categoryTree = filters.appType === 2 ? GUANGDADA_TOOL_CATEGORIES_TREE : GUANGDADA_GAME_CATEGORIES_TREE;
  const activeTab = RANK_TAB_MAP[filters.chartType] || RANK_TABS[0];
  const showTopTypeFilter = filters.chartType === '3';
  const showExcludeRetargetingFilter = filters.chartType !== '2';
  const categorySearchOptions = categoryTree.flatMap((group) => (
    (group.children || []).map((child) => ({
      value: String(child.value),
      label: `${group.name} / ${child.label}`,
    }))
  ));

  const updateFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const fetchRankList = useCallback(async ({ silent = false } = {}) => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    const body = buildRankRequestBody(filters, weekRange);
    const cacheKey = stableCacheKey(body);
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    const cached = rankCacheRef.current.get(cacheKey);
    if (cached) {
      setLoading(false);
      setError('');
      setItems(cached.items);
      setTotal(cached.total);
      setFetchedAt(cached.fetchedAt);
      setQuotaStatus(cached.quotaStatus || null);
      if (!silent) addLog?.(`创意排行榜已从缓存加载 ${cached.items.length} 条`, 'success');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await getGuangdadaCreativeRankList(body);
      if (requestSeqRef.current !== seq) return;
      if (!result.success) {
        throw new Error(result.message || '创意排行榜请求失败');
      }
      const payload = result.data?.data || result.data || {};
      const creatives = Array.isArray(payload.creatives)
        ? payload.creatives
        : Array.isArray(payload.list)
          ? payload.list
          : Array.isArray(payload.rows)
            ? payload.rows
            : [];
      const nextTotal = Number(payload.total) || creatives.length;
      const nextFetchedAt = dayjs();
      const nextQuotaStatus = result.quotaStatus || null;
      const cacheEntry = {
        items: creatives,
        total: nextTotal,
        fetchedAt: nextFetchedAt,
        quotaStatus: nextQuotaStatus,
      };
      rankCacheRef.current.set(cacheKey, cacheEntry);
      if (rankCacheRef.current.size > RANK_CACHE_LIMIT) {
        const oldestKey = rankCacheRef.current.keys().next().value;
        rankCacheRef.current.delete(oldestKey);
      }
      setItems(creatives);
      setTotal(nextTotal);
      setFetchedAt(nextFetchedAt);
      setQuotaStatus(nextQuotaStatus);
      onQuotaChanged?.(result.quotaStatus);
      if (!silent) addLog?.(`创意排行榜已加载 ${creatives.length} 条`, 'success');
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      if (err?.requiresLogin) onRequireLogin?.();
      const message = formatRequestError(err?.message || '创意排行榜请求失败');
      setError(message);
      addLog?.(message, 'error');
    } finally {
      if (requestSeqRef.current === seq) setLoading(false);
    }
  }, [addLog, filters, isLoggedIn, onQuotaChanged, onRequireLogin, weekRange]);

  const handleTabChange = (key) => {
    const patch = { chartType: key };
    if (key !== '3') patch.topType = '';
    if (key === '2') patch.excludeRetargeting = false;
    updateFilter(patch);
  };

  const handleAppTypeChange = (key) => {
    updateFilter({ appType: Number(key), tagIds: [] });
  };

  const toggleCategory = (group) => {
    const values = (group.children || []).map((child) => String(child.value));
    const current = new Set(filters.tagIds);
    const allSelected = values.length > 0 && values.every((value) => current.has(value));
    values.forEach((value) => {
      if (allSelected) current.delete(value);
      else current.add(value);
    });
    updateFilter({ tagIds: Array.from(current) });
  };

  const toggleChannel = (value) => {
    const current = new Set(filters.channels);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    updateFilter({ channels: Array.from(current) });
  };

  const hasFetched = Boolean(fetchedAt);

  return (
    <div className="gdd-rank-page">
      <section className="gdd-rank-filter">
        <div className="gdd-rank-title-row">
          <h1><TrophyOutlined /> 创意排行榜</h1>
          <Button icon={<ReloadOutlined />} onClick={() => fetchRankList()} loading={loading}>
            刷新榜单
          </Button>
        </div>

        <Tabs
          className="gdd-rank-tabs"
          activeKey={filters.chartType}
          items={RANK_TABS.map(({ key, label }) => ({ key, label }))}
          onChange={handleTabChange}
        />

        <Alert
          className="gdd-rank-hint"
          type="info"
          showIcon
          icon={<InfoCircleFilled />}
          message={activeTab.hint}
        />

        <Tabs
          className="gdd-rank-app-tabs"
          activeKey={String(filters.appType)}
          items={[
            { key: '1', label: '游戏' },
            { key: '2', label: '工具' },
          ]}
          onChange={handleAppTypeChange}
        />

        <div className="gdd-rank-filter-row">
          <span className="gdd-rank-filter-label">{filters.appType === 2 ? '工具分类' : '游戏分类'}</span>
          <div className="gdd-rank-pill-list">
            <button
              type="button"
              className={(filters.tagIds || []).length === 0 ? 'is-active' : ''}
              onClick={() => updateFilter({ tagIds: [] })}
            >
              全部
            </button>
            {categoryTree.slice(0, 18).map((group) => {
              const values = (group.children || []).map((child) => String(child.value));
              const selected = values.length > 0 && values.every((value) => filters.tagIds.includes(value));
              return (
                <button
                  type="button"
                  key={group.name}
                  className={selected ? 'is-active' : ''}
                  onClick={() => toggleCategory(group)}
                >
                  {group.name}
                </button>
              );
            })}
            <Select
              showSearch
              allowClear
              value={undefined}
              placeholder="快速检索一级或二级分类"
              suffixIcon={<SearchOutlined />}
              options={categorySearchOptions}
              optionFilterProp="label"
              className="gdd-rank-category-select"
              onChange={(value) => {
                if (!value) return;
                const next = new Set(filters.tagIds);
                next.add(String(value));
                updateFilter({ tagIds: Array.from(next) });
              }}
            />
          </div>
        </div>

        <div className="gdd-rank-filter-row">
          <span className="gdd-rank-filter-label">投放渠道</span>
          <div className="gdd-rank-pill-list">
            <button
              type="button"
              className={filters.channels.length === 0 ? 'is-active' : ''}
              onClick={() => updateFilter({ channels: [] })}
            >
              全部
            </button>
            {CHANNEL_FILTERS.map((item) => (
              <button
                type="button"
                key={item.value}
                className={filters.channels.includes(item.value) ? 'is-active' : ''}
                onClick={() => toggleChannel(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="gdd-rank-filter-row gdd-rank-filter-row--compact">
          <span className="gdd-rank-filter-label">其他</span>
          <div className="gdd-rank-field-list">
            <Select
              value={filters.os}
              onChange={(value) => updateFilter({ os: value })}
              options={[
                { value: '', label: '全部系统' },
                { value: 1, label: 'iOS' },
                { value: 2, label: 'Android' },
              ]}
              className="gdd-rank-select"
            />
            <Select
              mode="multiple"
              maxTagCount="responsive"
              placeholder="国家/地区"
              value={filters.geo}
              onChange={(value) => updateFilter({ geo: value })}
              options={COUNTRY_OPTIONS}
              className="gdd-rank-select gdd-rank-select--wide"
            />
            <Select
              mode="multiple"
              maxTagCount="responsive"
              placeholder="语言"
              value={filters.language}
              onChange={(value) => updateFilter({ language: value })}
              options={LANGUAGE_OPTIONS}
              className="gdd-rank-select gdd-rank-select--wide"
            />
            {showTopTypeFilter ? (
              <Select
                value={filters.topType}
                onChange={(value) => updateFilter({ topType: value })}
                options={TOP_TYPE_OPTIONS}
                className="gdd-rank-select"
              />
            ) : null}
            <Select
              value={filters.adsType}
              onChange={(value) => updateFilter({ adsType: value })}
              options={ADS_TYPE_OPTIONS}
              className="gdd-rank-select"
            />
            {showExcludeRetargetingFilter ? (
              <Checkbox
                checked={filters.excludeRetargeting}
                onChange={(event) => updateFilter({ excludeRetargeting: event.target.checked })}
              >
                去掉重投广告
              </Checkbox>
            ) : null}
          </div>
        </div>
        <div className="gdd-rank-query-row">
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            onClick={() => fetchRankList()}
            loading={loading}
            className="gdd-rank-query-button"
          >
            查询榜单
          </Button>
        </div>
      </section>

      <section className="gdd-rank-results">
        <div className="gdd-rank-toolbar">
          <div className="gdd-rank-toolbar-left">
            <Button type="primary" ghost>周榜</Button>
            <span className="gdd-rank-week">
              {weekRange[0].format('YYYY-MM-DD')} ~ {weekRange[1].format('YYYY-MM-DD')}
            </span>
            <span className="gdd-rank-count">共找到 <strong>{total}</strong> 个结果</span>
          </div>
          <div className="gdd-rank-toolbar-right">
            {quotaStatus?.quotas?.search ? (
              <span>搜索额度剩余 {quotaStatus.quotas.search.remaining ?? '—'}</span>
            ) : null}
            {fetchedAt ? <span>更新于 {fetchedAt.format('HH:mm:ss')}</span> : null}
          </div>
        </div>

        <div className="gdd-rank-sort-line">
          <span>排序</span>
          <strong>{activeTab.metricLabel}</strong>
          <StarOutlined />
          <span>数据说明</span>
        </div>

        {error ? <Alert type="error" showIcon message={error} className="gdd-rank-error" /> : null}

        <Spin spinning={loading}>
          {items.length > 0 ? (
            <div className="gdd-rank-list">
              {items.map((item, index) => (
                <CreativeRankRow
                  key={item.ad_key || index}
                  item={item}
                  rank={index + 1}
                  chartType={filters.chartType}
                  appType={filters.appType}
                  onOpenDetail={setDetailItem}
                />
              ))}
            </div>
          ) : (
            <div className="gdd-rank-empty">
              <Empty
                description={
                  !isLoggedIn
                    ? '请先登录后查看创意排行榜'
                    : hasFetched
                      ? '暂无榜单数据'
                      : '请选择筛选条件后查询'
                }
              />
              {!isLoggedIn ? (
                <Button type="primary" onClick={onRequireLogin}>去登录</Button>
              ) : null}
            </div>
          )}
        </Spin>
      </section>

      <GuangdadaDetailModal
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onQuotaChanged={onQuotaChanged}
      />
    </div>
  );
}
