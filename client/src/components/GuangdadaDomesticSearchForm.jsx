import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Button,
  Cascader,
  Checkbox,
  DatePicker,
  Input,
  Popover,
  Select,
  Tag,
  Tooltip,
} from 'antd';
import { CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { getTodayBeijingDayjs } from '../utils/beijingDate';
import { DOMESTIC_POSITION_OPTIONS, DOMESTIC_EXACT_SEARCH_TOOLTIP } from '../utils/guangdadaDomesticAdInfo';
import {
  getDomesticCategoryOptionsByIndustry,
  domesticCategoryLabelsFromValues,
} from '../data/domesticCnGameClassifications';
import {
  DOMESTIC_CHANNEL_MEDIA_LABEL_MAP,
  DOMESTIC_CHANNEL_MEDIA_GROUPS,
} from '../data/guangdadaDomesticChannelMedia';
import {
  DOMESTIC_PLACEMENT_LABEL_MAP,
  DOMESTIC_PLACEMENT_BY_CHANNEL,
  getDomesticPlacementOptionsByChannelMedia,
} from '../data/guangdadaDomesticPlacementByChannel';
import {
  DOMESTIC_CREATIVE_TYPE_CASCADER_OPTIONS,
  DOMESTIC_CREATIVE_TYPE_PARENT_IMAGE,
  cascaderPathToDomesticCreativeType,
  domesticCreativeTypeDisplayLabel,
  domesticCreativeTypeToCascaderPath,
} from '../data/guangdadaDomesticCreativeType';
import { DOMESTIC_AD_SIZE_GROUPS, DOMESTIC_AD_SIZE_LABEL_MAP } from '../data/guangdadaDomesticAdSizes';
import { DOMESTIC_GAME_THEME_LABEL_MAP, DOMESTIC_GAME_THEME_OPTIONS } from '../data/guangdadaDomesticGameThemes';
import DomesticChannelIcon from './DomesticChannelIcon';
import './GuangdadaDomesticSearchForm.css';

const { RangePicker } = DatePicker;

const INDUSTRY_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'game', label: '游戏' },
  { value: 'tool', label: '工具' },
  { value: 'ecommerce', label: '电商/品牌' },
];

const TIME_PRESETS = [
  { key: '7', label: '近7天', days: 7 },
  { key: '30', label: '近30天', days: 30 },
  { key: '90', label: '近90天', days: 90 },
  { key: '365', label: '近1年', days: 365 },
  { key: 'all', label: '全部', days: null },
];

const BASIC_SELECTS = [
  { key: 'channelMedia', placeholder: '所有渠道&媒体' },
  { key: 'placement', placeholder: '所有广告位' },
  { key: 'creativeType', placeholder: '所有创意类型' },
];

const ADVANCED_SELECTS = [
  { key: 'topic', placeholder: '所有主题' },
  { key: 'size', placeholder: '所有尺寸' },
  { key: 'system', placeholder: '所有系统' },
  { key: 'cta', placeholder: '所有CTA' },
];

const DOMESTIC_PLACEMENT_GROUP_ORDER = [
  '113',
  '7',
  '106',
  '102',
  '103',
  '114',
  '140',
  '132',
  '131',
  '129',
  '130',
  '100',
  '137',
  '134',
  '117',
  '115',
  '116',
  '133',
  '111',
  '12',
  '11',
  '120',
  '128',
  '127',
  '13',
  '15',
  '118',
  '112',
  '119',
  '105',
  '126',
  '4',
  '104',
  '30',
  '136',
  '107',
  '17',
  '108',
  '109',
  '122',
  '125',
  '101',
  '121',
  '110',
];

/** 与接口一致：选「所有系统」时请求里 system 传 0（表单内仍用空值表示该项） */
const DOMESTIC_SYSTEM_ALL_VALUE = '';

const DOMESTIC_SYSTEM_OPTIONS = [
  { value: DOMESTIC_SYSTEM_ALL_VALUE, label: '所有系统' },
  { value: 1, label: 'iOS' },
  { value: 2, label: '安卓' },
  { value: 22, label: '微信小游戏' },
  { value: 21, label: '微信小程序' },
];

const DOMESTIC_SYSTEM_LABEL_MAP = DOMESTIC_SYSTEM_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const DOMESTIC_CTA_OPTIONS = [
  {
    label: '详情',
    options: [
      { value: '查看详情', label: '查看详情' },
      { value: '立即查看', label: '立即查看' },
      { value: '了解详情', label: '了解详情' },
      { value: '详情', label: '详情' },
      { value: '了解更多', label: '了解更多' },
      { value: '更多精彩', label: '更多精彩' },
    ],
  },
  {
    label: '引导下载',
    options: [
      { value: '立即下载', label: '立即下载' },
      { value: '下载应用', label: '下载应用' },
      { value: '下载', label: '下载' },
      { value: '免费下载', label: '免费下载' },
      { value: '官方下载', label: '官方下载' },
      { value: '极速下载', label: '极速下载' },
    ],
  },
  {
    label: '引导购买',
    options: [
      { value: '立即购买', label: '立即购买' },
      { value: '立即抢购', label: '立即抢购' },
      { value: '立即下单', label: '立即下单' },
      { value: '点击抢购', label: '点击抢购' },
    ],
  },
  {
    label: '表单填写',
    options: [
      { value: '抢先报名', label: '抢先报名' },
      { value: '立即咨询', label: '立即咨询' },
      { value: '电视咨询', label: '电视咨询' },
      { value: '立即预约', label: '立即预约' },
    ],
  },
];

/** 已选标签前缀：去掉占位里的「所有」（如「所有广告位」→「广告位」） */
function domesticSearchTagCategoryLabel(placeholder) {
  return String(placeholder || '').replace(/^所有/, '');
}

/** 排除关键词：按逗号切条（支持英文 , 与中文 ，）；请求里用英文逗号拼接为 exclude_keyword */
function parseExcludeKeywordSegments(raw) {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function excludeSegmentsToApiKeyword(parts) {
  return parts.join(',');
}

/** 从已选标签列表中替换所有 exclude:i 为新的多条标签 */
function replaceExcludeTagsInDisplayTags(prev, parts) {
  const out = [];
  let i = 0;
  while (i < prev.length) {
    const t = prev[i];
    if (String(t.id).startsWith('exclude:')) {
      parts.forEach((p, j) => out.push({ id: `exclude:${j}`, text: `排除：${p}` }));
      while (i < prev.length && String(prev[i].id).startsWith('exclude:')) i++;
      continue;
    }
    out.push(t);
    i++;
  }
  return out;
}

/** 广告位：某渠道下子项全选时只展示渠道名（如「优量广告」），否则列出所选广告位 */
function buildDomesticPlacementTagDisplay(placementValues, placementGroups) {
  const placementSet = new Set((Array.isArray(placementValues) ? placementValues : []).map(String));
  if (placementSet.size === 0) return null;
  const consumed = new Set();
  const parts = [];
  for (const group of placementGroups || []) {
    const opts = group.options || [];
    const inGroup = opts.filter((o) => placementSet.has(String(o.value)));
    if (inGroup.length === 0) continue;
    if (inGroup.length === opts.length) {
      parts.push(group.title);
      inGroup.forEach((o) => consumed.add(String(o.value)));
    } else {
      inGroup.forEach((o) => {
        const id = String(o.value);
        parts.push(DOMESTIC_PLACEMENT_LABEL_MAP[id] ?? o.label);
        consumed.add(id);
      });
    }
  }
  for (const v of placementSet) {
    if (!consumed.has(v)) parts.push(DOMESTIC_PLACEMENT_LABEL_MAP[v] ?? v);
  }
  return parts.join('、');
}

/** 尺寸：某一尺寸组全选时只展示组名（如「高清(宽度>700)」），否则列出所选尺寸 */
function buildDomesticSizeTagDisplay(sizeValues) {
  const sizeSet = new Set(Array.isArray(sizeValues) ? sizeValues : []);
  if (sizeSet.size === 0) return null;
  const consumed = new Set();
  const parts = [];
  for (const group of DOMESTIC_AD_SIZE_GROUPS) {
    const opts = group.options || [];
    const inGroup = opts.filter((o) => sizeSet.has(o.value));
    if (inGroup.length === 0) continue;
    if (inGroup.length === opts.length) {
      parts.push(group.label);
      inGroup.forEach((o) => consumed.add(o.value));
    } else {
      inGroup.forEach((o) => {
        parts.push(DOMESTIC_AD_SIZE_LABEL_MAP[o.value] ?? o.label);
        consumed.add(o.value);
      });
    }
  }
  for (const v of sizeSet) {
    if (!consumed.has(v)) parts.push(DOMESTIC_AD_SIZE_LABEL_MAP[v] ?? v);
  }
  return parts.join('、');
}

/** CTA：某一 CTA 分组全选时只展示分组名（如「详情」），否则列出所选文案 */
function buildDomesticCtaTagDisplay(ctaValues) {
  const ctaSet = new Set(Array.isArray(ctaValues) ? ctaValues : []);
  if (ctaSet.size === 0) return null;
  const consumed = new Set();
  const parts = [];
  for (const group of DOMESTIC_CTA_OPTIONS) {
    const opts = group.options || [];
    const inGroup = opts.filter((o) => ctaSet.has(o.value));
    if (inGroup.length === 0) continue;
    if (inGroup.length === opts.length) {
      parts.push(group.label);
      inGroup.forEach((o) => consumed.add(o.value));
    } else {
      inGroup.forEach((o) => {
        parts.push(o.label);
        consumed.add(o.value);
      });
    }
  }
  for (const v of ctaSet) {
    if (!consumed.has(v)) parts.push(v);
  }
  return parts.join('、');
}

function domesticChannelMediaValueToIdSet(value) {
  return new Set(
    String(value ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  );
}

function domesticIdSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** 渠道&媒体触发器：与「全部平台」某交叉项完全一致时只展示系名；多系组合则逐项折叠后拼接 */
function buildDomesticChannelMediaTriggerDisplay(channelMediaValues) {
  const raw = Array.isArray(channelMediaValues) ? channelMediaValues : [];
  if (raw.length === 0) return null;
  const idSet = new Set();
  raw.forEach((value) => {
    domesticChannelMediaValueToIdSet(value).forEach((id) => idSet.add(id));
  });
  const crossOptions = DOMESTIC_CHANNEL_MEDIA_GROUPS[0]?.options ?? [];
  const sorted = [...crossOptions].sort(
    (a, b) => domesticChannelMediaValueToIdSet(b.value).size - domesticChannelMediaValueToIdSet(a.value).size
  );
  for (const opt of sorted) {
    const optSet = domesticChannelMediaValueToIdSet(opt.value);
    if (optSet.size === 0) continue;
    if (domesticIdSetsEqual(optSet, idSet)) return opt.zh;
  }
  const parts = [];
  const remaining = new Set(idSet);
  for (const opt of sorted) {
    const optSet = domesticChannelMediaValueToIdSet(opt.value);
    if (optSet.size === 0) continue;
    let subset = true;
    for (const id of optSet) {
      if (!remaining.has(id)) {
        subset = false;
        break;
      }
    }
    if (!subset) continue;
    parts.push(opt.zh);
    optSet.forEach((id) => remaining.delete(id));
  }
  for (const id of remaining) {
    parts.push(DOMESTIC_CHANNEL_MEDIA_LABEL_MAP[id] ?? id);
  }
  return parts.join('、');
}

/** 创意类型级联：选图片下某一子类型时，输入框仅展示父级「图片」 */
function domesticCreativeTypeCascaderDisplayRender(labels, selectedOptions) {
  const vals = (selectedOptions ?? []).map((o) => o?.value);
  const last = vals[vals.length - 1];
  if (last === '2') return '视频';
  if (vals[0] === DOMESTIC_CREATIVE_TYPE_PARENT_IMAGE && vals.length > 1) return '图片';
  return labels.join(' / ');
}

function rangeForPreset(today, presetKey) {
  const end = today.clone().startOf('day');
  if (presetKey === 'all') {
    return [end.clone().subtract(10, 'year'), end];
  }
  const p = TIME_PRESETS.find((x) => x.key === presetKey);
  const days = p?.days ?? 90;
  const offset = Math.max(0, days - 1);
  return [end.clone().subtract(offset, 'day'), end];
}

function detectPresetFromRange(start, end) {
  const today = getTodayBeijingDayjs().startOf('day');
  if (!start || !end) return null;
  const e = end.startOf('day');
  const s = start.startOf('day');
  if (!e.isSame(today, 'day')) return null;
  const daySpan = e.diff(s, 'day');
  for (const { key, days } of TIME_PRESETS) {
    if (key === 'all' || days == null) continue;
    if (daySpan + 1 === days) return key;
  }
  if (daySpan >= 365 * 8) return 'all';
  return null;
}

/**
 * 广大大「国内版」搜索栏：与 BBA ad-info 字段对齐（position、search_content、exclude_keyword、accurate_search 等）。
 */
const GuangdadaDomesticSearchForm = forwardRef(function GuangdadaDomesticSearchForm(
  { loading, onSearch, autoSearchKey = 0 },
  ref
) {
  /** 与 BBA ad-info 一致：0 广告信息、1 广告文案、2 广告主、3 落地页 */
  /** 与 BBA 默认/官网示例一致：0 广告信息 */
  const [position, setPosition] = useState(0);
  const [keyword, setKeyword] = useState('');
  /** 与官网默认 ad-info 一致：accurate_search=1（精确搜索） */
  const [exactSearch, setExactSearch] = useState(true);
  const [excludeDraft, setExcludeDraft] = useState('');
  const [excludeOpen, setExcludeOpen] = useState(false);
  const [excludeApplied, setExcludeApplied] = useState('');

  const [industry, setIndustry] = useState('all');
  const [basic, setBasic] = useState({ category: [], channelMedia: [], placement: [], creativeType: undefined });
  const [advanced, setAdvanced] = useState({ topic: [], size: [], system: DOMESTIC_SYSTEM_ALL_VALUE, cta: [] });
  const [newMaterialOnly, setNewMaterialOnly] = useState(false);
  const [recentActiveOnly, setRecentActiveOnly] = useState(false);

  const [timePreset, setTimePreset] = useState('90');
  const [dateRange, setDateRange] = useState(() => {
    const [s, e] = rangeForPreset(getTodayBeijingDayjs(), '90');
    return [s, e];
  });

  const mainPlaceholder = useMemo(() => {
    const opt = DOMESTIC_POSITION_OPTIONS.find((o) => o.value === position);
    return opt?.placeholder ?? '请输入关键词';
  }, [position]);
  const categoryOptions = useMemo(() => getDomesticCategoryOptionsByIndustry(industry), [industry]);
  const visibleAdvancedSelects = useMemo(
    () => ADVANCED_SELECTS.filter(({ key }) => (key === 'topic' ? industry === 'game' : true)),
    [industry]
  );
  const advancedFieldsSplit = useMemo(() => {
    const list = visibleAdvancedSelects;
    return {
      main: list.filter(({ key }) => key !== 'cta'),
      cta: list.find(({ key }) => key === 'cta'),
    };
  }, [visibleAdvancedSelects]);

  const renderOptionWithCheckbox = useCallback(
    (currentValue) => (option) => {
      const isGroupLabel = Array.isArray(option?.data?.options);
      if (isGroupLabel) {
        return <span>{option.label}</span>;
      }
      const values = Array.isArray(currentValue) ? currentValue : [currentValue];
      const checked = values.some((v) => String(v) === String(option.value));
      return (
        <div className="gdd-domestic-option-with-check">
          <Checkbox checked={checked} />
          <span>{option.label}</span>
        </div>
      );
    },
    []
  );

  const applyPreset = useCallback((key) => {
    setTimePreset(key);
    const [s, e] = rangeForPreset(getTodayBeijingDayjs(), key);
    setDateRange([s, e]);
  }, []);

  const onRangePickerChange = (dates) => {
    if (dates?.[0] && dates?.[1]) {
      setDateRange(dates);
      const detected = detectPresetFromRange(dates[0], dates[1]);
      setTimePreset(detected ?? 'custom');
    }
  };

  const buildPayload = useCallback(() => {
    const [start, end] = dateRange || [];
    return {
      edition: 'domestic',
      position,
      keyword: keyword.trim(),
      exactSearch,
      excludeKeyword: excludeApplied.trim(),
      industry,
      basic,
      advanced,
      flags: {
        newMaterialOnly,
        recentActiveOnly,
      },
      timePreset,
      dateRange:
        start && end
          ? { startTime: start.format('YYYY-MM-DD'), endTime: end.format('YYYY-MM-DD') }
          : null,
    };
  }, [
    position,
    keyword,
    exactSearch,
    excludeApplied,
    industry,
    basic,
    advanced,
    newMaterialOnly,
    recentActiveOnly,
    timePreset,
    dateRange,
  ]);

  const [displayTags, setDisplayTags] = useState([]);
  const [channelPanelOpen, setChannelPanelOpen] = useState(false);
  const [channelPanelDraft, setChannelPanelDraft] = useState([]);
  const [placementPanelOpen, setPlacementPanelOpen] = useState(false);
  const [placementPanelDraft, setPlacementPanelDraft] = useState([]);
  const [sizePanelOpen, setSizePanelOpen] = useState(false);
  const [sizePanelDraft, setSizePanelDraft] = useState([]);
  const [ctaPanelOpen, setCtaPanelOpen] = useState(false);
  const [ctaPanelDraft, setCtaPanelDraft] = useState([]);
  const [topicPanelOpen, setTopicPanelOpen] = useState(false);
  const [topicPanelDraft, setTopicPanelDraft] = useState([]);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [categoryPanelDraft, setCategoryPanelDraft] = useState([]);

  const selectedChannelIds = useMemo(() => {
    const values = Array.isArray(basic.channelMedia) ? basic.channelMedia : [];
    const ids = new Set();
    values.forEach((value) => {
      String(value)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [basic.channelMedia]);

  const placementGroups = useMemo(() => {
    const sourceIds = selectedChannelIds.length > 0 ? selectedChannelIds : Object.keys(DOMESTIC_PLACEMENT_BY_CHANNEL);
    const sortedIds = [...sourceIds].sort((a, b) => {
      const ai = DOMESTIC_PLACEMENT_GROUP_ORDER.indexOf(String(a));
      const bi = DOMESTIC_PLACEMENT_GROUP_ORDER.indexOf(String(b));
      const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (av !== bv) return av - bv;
      return Number(a) - Number(b);
    });
    return sortedIds
      .map((id) => {
        const options = (DOMESTIC_PLACEMENT_BY_CHANNEL[id] || []).map((item) => ({
          value: String(item.key),
          label: item.zh,
        }));
        if (options.length === 0) return null;
        return {
          channelId: id,
          title: DOMESTIC_CHANNEL_MEDIA_LABEL_MAP[id] || id,
          options,
        };
      })
      .filter(Boolean);
  }, [selectedChannelIds]);

  const categoryPanelGroups = useMemo(() => {
    const opts = categoryOptions;
    if (!opts.length) return [];
    const title =
      industry === 'game' ? '游戏分类' : industry === 'tool' ? '工具分类' : '电商/品牌分类';
    return [
      {
        groupId: industry,
        title,
        options: opts.map((o) => ({ value: o.value, label: o.label })),
      },
    ];
  }, [industry, categoryOptions]);

  const allPlacementChecked = (placementPanelDraft?.length ?? 0) === 0;
  const allChannelChecked = (channelPanelDraft?.length ?? 0) === 0;
  const allSizeChecked = (sizePanelDraft?.length ?? 0) === 0;
  const allCtaChecked = (ctaPanelDraft?.length ?? 0) === 0;
  const allTopicChecked = (topicPanelDraft?.length ?? 0) === 0;
  const allCategoryChecked = (categoryPanelDraft?.length ?? 0) === 0;

  const handleSearch = () => {
    const rawDraft = excludeDraft.trim();
    let excludeParts;
    let appliedExclude;
    if (rawDraft) {
      excludeParts = parseExcludeKeywordSegments(excludeDraft);
      appliedExclude = excludeSegmentsToApiKeyword(excludeParts);
      setExcludeApplied(appliedExclude);
      setExcludeDraft('');
    } else {
      excludeParts = parseExcludeKeywordSegments(excludeApplied);
      appliedExclude = excludeSegmentsToApiKeyword(excludeParts);
    }
    const tags = [];
    const kw = keyword.trim();
    if (kw) {
      const label = DOMESTIC_POSITION_OPTIONS.find((o) => o.value === position)?.label ?? String(position);
      tags.push({ id: 'main', text: `${label}: ${kw}` });
    }
    if (exactSearch) {
      tags.push({ id: 'exact', text: '精确搜索' });
    }
    excludeParts.forEach((segment, ei) => {
      tags.push({ id: `exclude:${ei}`, text: `排除：${segment}` });
    });
    if (industry !== 'all') {
      const il = INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? industry;
      tags.push({ id: 'industry', text: `行业: ${il}` });
    }
    const catVals = Array.isArray(basic.category) ? basic.category : [];
    if (catVals.length > 0) {
      tags.push({
        id: 'b-category',
        text: `分类: ${domesticCategoryLabelsFromValues(catVals).join('、')}`,
      });
    }
    const catLabel = (placeholder) => domesticSearchTagCategoryLabel(placeholder);
    BASIC_SELECTS.forEach(({ key, placeholder }) => {
      const v = basic[key];
      if (Array.isArray(v) ? v.length > 0 : v != null && v !== '') {
        let displayValue = Array.isArray(v) ? v.join(',') : v;
        if (key === 'channelMedia') {
          const values = Array.isArray(v) ? v : [v];
          displayValue = values.map((val) => DOMESTIC_CHANNEL_MEDIA_LABEL_MAP[val] ?? val).join('、');
        } else if (key === 'placement') {
          displayValue = buildDomesticPlacementTagDisplay(v, placementGroups);
        } else if (key === 'creativeType') {
          displayValue = domesticCreativeTypeDisplayLabel(v);
        }
        tags.push({ id: `b-${key}`, text: `${catLabel(placeholder)}: ${displayValue}` });
      }
    });
    ADVANCED_SELECTS.forEach(({ key, placeholder }) => {
      const v = advanced[key];
      if (Array.isArray(v) ? v.length > 0 : v != null && v !== '') {
        let displayValue = Array.isArray(v) ? v.join(',') : v;
        if (key === 'topic') {
          const values = Array.isArray(v) ? v : [v];
          displayValue = values.map((x) => DOMESTIC_GAME_THEME_LABEL_MAP[x] ?? x).join('、');
        } else if (key === 'size') {
          displayValue = buildDomesticSizeTagDisplay(v);
        } else if (key === 'system') {
          displayValue = DOMESTIC_SYSTEM_LABEL_MAP[v] ?? v;
        } else if (key === 'cta') {
          displayValue = buildDomesticCtaTagDisplay(v);
        }
        tags.push({ id: `a-${key}`, text: `${catLabel(placeholder)}: ${displayValue}` });
      }
    });
    if (newMaterialOnly) tags.push({ id: 'newMat', text: '新上素材' });
    if (recentActiveOnly) tags.push({ id: 'recent', text: '近期活跃' });
    setDisplayTags(tags);

    onSearch?.({
      ...buildPayload(),
      excludeKeyword: appliedExclude,
    });
  };

  const handleSearchRef = useRef(handleSearch);
  handleSearchRef.current = handleSearch;

  useImperativeHandle(ref, () => ({
    submitSearch: () => {
      handleSearchRef.current();
    },
  }));

  const filterAutoSearchSkipRef = useRef(true);
  useEffect(() => {
    if (filterAutoSearchSkipRef.current) {
      filterAutoSearchSkipRef.current = false;
      return;
    }
    handleSearchRef.current();
  }, [
    industry,
    basic,
    advanced,
    position,
    exactSearch,
    newMaterialOnly,
    recentActiveOnly,
    timePreset,
    dateRange,
    excludeApplied,
  ]);

  useEffect(() => {
    if (!autoSearchKey) return;
    handleSearchRef.current();
  }, [autoSearchKey]);

  useEffect(() => {
    setDisplayTags((prev) =>
      prev.filter((t) => {
        if (t.id === 'exact' && !exactSearch) return false;
        if (t.id === 'newMat' && !newMaterialOnly) return false;
        if (t.id === 'recent' && !recentActiveOnly) return false;
        return true;
      })
    );
  }, [exactSearch, newMaterialOnly, recentActiveOnly]);

  useEffect(() => {
    setCategoryPanelOpen(false);
  }, [industry]);

  const removeTag = (id) => {
    if (String(id).startsWith('exclude:')) {
      const idx = Number(String(id).split(':')[1]);
      const parts = parseExcludeKeywordSegments(excludeApplied);
      if (Number.isInteger(idx) && idx >= 0 && idx < parts.length) {
        parts.splice(idx, 1);
        setExcludeApplied(excludeSegmentsToApiKeyword(parts));
        setDisplayTags((prev) => replaceExcludeTagsInDisplayTags(prev, parts));
      } else {
        setDisplayTags((prev) => prev.filter((t) => t.id !== id));
      }
      return;
    }
    if (id === 'main') {
      setKeyword('');
    } else if (id === 'industry') {
      setIndustry('all');
    } else if (id === 'b-category') {
      setBasic((prev) => ({ ...prev, category: [] }));
    } else if (id.startsWith('b-')) {
      const key = id.slice(2);
      setBasic((prev) => ({ ...prev, [key]: key === 'channelMedia' || key === 'placement' ? [] : undefined }));
    } else if (id.startsWith('a-')) {
      const key = id.slice(2);
      setAdvanced((prev) => ({
        ...prev,
        [key]:
          key === 'topic' || key === 'size' || key === 'cta' ? [] : key === 'system' ? DOMESTIC_SYSTEM_ALL_VALUE : undefined,
      }));
    } else if (id === 'exact') {
      setExactSearch(false);
    } else if (id === 'newMat') {
      setNewMaterialOnly(false);
    } else if (id === 'recent') {
      setRecentActiveOnly(false);
    }
    setDisplayTags((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAllTags = () => {
    setPosition(3);
    setKeyword('');
    setExcludeDraft('');
    setExcludeApplied('');
    setIndustry('all');
    setBasic({ category: [], channelMedia: [], placement: [], creativeType: undefined });
    setAdvanced({ topic: [], size: [], system: DOMESTIC_SYSTEM_ALL_VALUE, cta: [] });
    setNewMaterialOnly(false);
    setRecentActiveOnly(false);
    setDisplayTags([]);
  };

  const openChannelPanel = () => {
    setChannelPanelDraft(Array.isArray(basic.channelMedia) ? basic.channelMedia : []);
    setChannelPanelOpen(true);
  };

  const cancelChannelPanel = () => {
    setChannelPanelOpen(false);
  };

  const confirmChannelPanel = () => {
    setBasic((prev) => {
      const nextChannelMedia = channelPanelDraft ?? [];
      const nextPlacementOptions = getDomesticPlacementOptionsByChannelMedia(nextChannelMedia);
      const allowedPlacementSet = new Set(nextPlacementOptions.map((opt) => String(opt.value)));
      const nextPlacement = (Array.isArray(prev.placement) ? prev.placement : []).filter((v) =>
        allowedPlacementSet.has(String(v))
      );
      return {
        ...prev,
        channelMedia: nextChannelMedia,
        placement: nextPlacement,
      };
    });
    setChannelPanelOpen(false);
  };

  const openPlacementPanel = () => {
    setPlacementPanelDraft(Array.isArray(basic.placement) ? basic.placement : []);
    setPlacementPanelOpen(true);
  };

  const openCategoryPanel = () => {
    if (industry !== 'game' && industry !== 'tool' && industry !== 'ecommerce') return;
    setCategoryPanelDraft(Array.isArray(basic.category) ? [...basic.category] : []);
    setCategoryPanelOpen(true);
  };

  const cancelCategoryPanel = () => {
    setCategoryPanelOpen(false);
  };

  const confirmCategoryPanel = () => {
    setBasic((prev) => ({ ...prev, category: categoryPanelDraft ?? [] }));
    setCategoryPanelOpen(false);
  };

  const toggleCategoryValue = (value, checked) => {
    setCategoryPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const key = String(value);
      if (checked) {
        if (current.some((x) => String(x) === key)) return current;
        return [...current, value];
      }
      return current.filter((x) => String(x) !== key);
    });
  };

  const toggleCategoryGroup = (groupOptions, checked) => {
    const groupValues = groupOptions.map((o) => o.value);
    const groupKeySet = new Set(groupValues.map(String));
    setCategoryPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (checked) {
        const keys = new Set(current.map(String));
        const merged = [...current];
        for (const v of groupValues) {
          const k = String(v);
          if (!keys.has(k)) {
            keys.add(k);
            merged.push(v);
          }
        }
        return merged;
      }
      return current.filter((x) => !groupKeySet.has(String(x)));
    });
  };

  const toggleAllCategory = () => {
    setCategoryPanelDraft([]);
    setBasic((prev) => ({ ...prev, category: [] }));
    setCategoryPanelOpen(false);
  };

  const cancelPlacementPanel = () => {
    setPlacementPanelOpen(false);
  };

  const togglePlacementValue = (value, checked) => {
    const s = String(value);
    setPlacementPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (checked) return current.includes(s) ? current : [...current, s];
      return current.filter((x) => x !== s);
    });
  };

  const togglePlacementGroup = (groupOptions, checked) => {
    const groupValues = groupOptions.map((o) => String(o.value));
    setPlacementPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (checked) return Array.from(new Set([...current, ...groupValues]));
      return current.filter((x) => !groupValues.includes(x));
    });
  };

  const confirmPlacementPanel = () => {
    setBasic((prev) => ({ ...prev, placement: placementPanelDraft ?? [] }));
    setPlacementPanelOpen(false);
  };
  const toggleAllPlacement = () => {
    setPlacementPanelDraft([]);
    setBasic((prev) => ({ ...prev, placement: [] }));
    setPlacementPanelOpen(false);
  };

  const toggleChannelValue = (value, checked) => {
    const s = String(value);
    setChannelPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (checked) {
        return current.includes(s) ? current : [...current, s];
      }
      return current.filter((x) => x !== s);
    });
  };

  const toggleChannelGroup = (groupOptions, checked) => {
    const groupValues = groupOptions.map((o) => String(o.value));
    setChannelPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (checked) {
        return Array.from(new Set([...current, ...groupValues]));
      }
      return current.filter((x) => !groupValues.includes(x));
    });
  };
  const toggleAllChannel = () => {
    setChannelPanelDraft([]);
    setBasic((prev) => ({ ...prev, channelMedia: [], placement: [] }));
    setChannelPanelOpen(false);
  };

  const openSizePanel = () => {
    setSizePanelDraft(Array.isArray(advanced.size) ? advanced.size : []);
    setSizePanelOpen(true);
  };

  const cancelSizePanel = () => {
    setSizePanelOpen(false);
  };

  const confirmSizePanel = () => {
    setAdvanced((prev) => ({ ...prev, size: sizePanelDraft ?? [] }));
    setSizePanelOpen(false);
  };

  const toggleSizeValue = (value, checked) => {
    const s = String(value);
    setSizePanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      if (checked) return current.includes(s) ? current : [...current, s];
      return current.filter((x) => x !== s);
    });
  };

  const toggleSizeGroup = (groupOptions, checked) => {
    const vals = groupOptions.map((o) => String(o.value));
    setSizePanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      if (checked) return Array.from(new Set([...current, ...vals]));
      return current.filter((x) => !vals.includes(x));
    });
  };

  const toggleAllSize = () => {
    setSizePanelDraft([]);
    setAdvanced((prev) => ({ ...prev, size: [] }));
    setSizePanelOpen(false);
  };

  const openCtaPanel = () => {
    setCtaPanelDraft(Array.isArray(advanced.cta) ? advanced.cta : []);
    setCtaPanelOpen(true);
  };

  const cancelCtaPanel = () => {
    setCtaPanelOpen(false);
  };

  const confirmCtaPanel = () => {
    setAdvanced((prev) => ({ ...prev, cta: ctaPanelDraft ?? [] }));
    setCtaPanelOpen(false);
  };

  const toggleCtaValue = (value, checked) => {
    const s = String(value);
    setCtaPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      if (checked) return current.includes(s) ? current : [...current, s];
      return current.filter((x) => x !== s);
    });
  };

  const toggleCtaGroup = (groupOptions, checked) => {
    const vals = groupOptions.map((o) => String(o.value));
    setCtaPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      if (checked) return Array.from(new Set([...current, ...vals]));
      return current.filter((x) => !vals.includes(x));
    });
  };

  const toggleAllCta = () => {
    setCtaPanelDraft([]);
    setAdvanced((prev) => ({ ...prev, cta: [] }));
    setCtaPanelOpen(false);
  };

  const openTopicPanel = () => {
    setTopicPanelDraft(Array.isArray(advanced.topic) ? advanced.topic : []);
    setTopicPanelOpen(true);
  };

  const cancelTopicPanel = () => {
    setTopicPanelOpen(false);
  };

  const confirmTopicPanel = () => {
    setAdvanced((prev) => ({ ...prev, topic: topicPanelDraft ?? [] }));
    setTopicPanelOpen(false);
  };

  const toggleTopicValue = (value, checked) => {
    const s = String(value);
    setTopicPanelDraft((prev) => {
      const current = Array.isArray(prev) ? prev.map(String) : [];
      if (checked) return current.includes(s) ? current : [...current, s];
      return current.filter((x) => x !== s);
    });
  };

  const toggleAllTopic = () => {
    setTopicPanelDraft([]);
    setAdvanced((prev) => ({ ...prev, topic: [] }));
    setTopicPanelOpen(false);
  };

  const channelMediaPanel = (
    <div className="gdd-domestic-channel-panel">
      <div className="gdd-domestic-channel-panel__head">
        <div className="gdd-domestic-channel-panel__head-title">渠道&amp;平台</div>
        <div className="gdd-domestic-channel-panel__head-actions">
          <button
            type="button"
            className={`gdd-domestic-channel-panel__head-tag${allChannelChecked ? ' is-active' : ''}`}
            onClick={toggleAllChannel}
          >
            全部
          </button>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__divider" />
      <div className="gdd-domestic-channel-panel__body">
        {DOMESTIC_CHANNEL_MEDIA_GROUPS.map((group) => {
          const groupValues = group.options.map((o) => String(o.value));
          const selectedCount = groupValues.filter((v) => channelPanelDraft.includes(v)).length;
          const allChecked = groupValues.length > 0 && selectedCount === groupValues.length;
          const indeterminate = selectedCount > 0 && selectedCount < groupValues.length;
          return (
            <div className="gdd-domestic-channel-panel__group" key={group.name}>
              <div>
                <Checkbox
                  checked={allChecked}
                  indeterminate={indeterminate}
                  onChange={(e) => toggleChannelGroup(group.options, e.target.checked)}
                />
                <span>{group.zh}</span>
              </div>
              <div className="gdd-domestic-channel-panel__options">
                {group.options.map((item) => {
                  const value = String(item.value);
                  const checked = channelPanelDraft.includes(value);
                  const showIcon = !value.includes(',');
                  return (
                    <label key={value} className="gdd-domestic-channel-panel__option">
                      <Checkbox checked={checked} onChange={(e) => toggleChannelValue(value, e.target.checked)} />
                      {showIcon ? <DomesticChannelIcon channelId={value} size={16} title={item.zh} /> : null}
                      <span>{item.zh}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gdd-domestic-channel-panel__footer">
        <Button onClick={cancelChannelPanel}>取消</Button>
        <Button type="primary" onClick={confirmChannelPanel}>
          确认
        </Button>
      </div>
    </div>
  );

  const categoryPanel = (
    <div className="gdd-domestic-channel-panel">
      <div className="gdd-domestic-channel-panel__head">
        <div className="gdd-domestic-channel-panel__head-title">分类</div>
        <div className="gdd-domestic-channel-panel__head-actions">
          <button
            type="button"
            className={`gdd-domestic-channel-panel__head-tag${allCategoryChecked ? ' is-active' : ''}`}
            onClick={toggleAllCategory}
          >
            全部
          </button>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__divider" />
      <div className="gdd-domestic-channel-panel__body">
        {categoryPanelGroups.length === 0 ? (
          <p className="gdd-domestic-category-panel__empty">请先选择行业「游戏」「工具」或「电商/品牌」</p>
        ) : (
          categoryPanelGroups.map((group) => {
            const groupValues = group.options.map((o) => String(o.value));
            const selectedCount = groupValues.filter((v) => categoryPanelDraft.some((x) => String(x) === v)).length;
            const allChecked = groupValues.length > 0 && selectedCount === groupValues.length;
            const indeterminate = selectedCount > 0 && selectedCount < groupValues.length;
            return (
              <div className="gdd-domestic-channel-panel__group" key={group.groupId}>
                <div>
                  <Checkbox
                    checked={allChecked}
                    indeterminate={indeterminate}
                    onChange={(e) => toggleCategoryGroup(group.options, e.target.checked)}
                  />
                  <span>{group.title}</span>
                </div>
                <div className="gdd-domestic-channel-panel__options">
                  {group.options.map((item) => {
                    const value = item.value;
                    const checked = categoryPanelDraft.some((x) => String(x) === String(value));
                    return (
                      <label key={String(value)} className="gdd-domestic-channel-panel__option">
                        <Checkbox checked={checked} onChange={(e) => toggleCategoryValue(value, e.target.checked)} />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="gdd-domestic-channel-panel__footer">
        <Button onClick={cancelCategoryPanel}>取消</Button>
        <Button type="primary" onClick={confirmCategoryPanel}>
          确认
        </Button>
      </div>
    </div>
  );

  const placementPanel = (
    <div className="gdd-domestic-channel-panel">
      <div className="gdd-domestic-channel-panel__head">
        <div className="gdd-domestic-channel-panel__head-title">广告位</div>
        <div className="gdd-domestic-channel-panel__head-actions">
          <button
            type="button"
            className={`gdd-domestic-channel-panel__head-tag${allPlacementChecked ? ' is-active' : ''}`}
            onClick={toggleAllPlacement}
          >
            全部
          </button>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__divider" />
      <div className="gdd-domestic-channel-panel__body">
        {placementGroups.map((group) => {
          const groupValues = group.options.map((o) => String(o.value));
          const selectedCount = groupValues.filter((v) => placementPanelDraft.includes(v)).length;
          const allChecked = groupValues.length > 0 && selectedCount === groupValues.length;
          const indeterminate = selectedCount > 0 && selectedCount < groupValues.length;
          return (
            <div className="gdd-domestic-channel-panel__group" key={group.channelId}>
              <div>
                <Checkbox
                  checked={allChecked}
                  indeterminate={indeterminate}
                  onChange={(e) => togglePlacementGroup(group.options, e.target.checked)}
                />
                <span>{group.title}</span>
              </div>
              <div className="gdd-domestic-channel-panel__options">
                {group.options.map((item) => {
                  const value = String(item.value);
                  const checked = placementPanelDraft.includes(value);
                  return (
                    <label key={value} className="gdd-domestic-channel-panel__option">
                      <Checkbox checked={checked} onChange={(e) => togglePlacementValue(value, e.target.checked)} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gdd-domestic-channel-panel__footer">
        <Button onClick={cancelPlacementPanel}>取消</Button>
        <Button type="primary" onClick={confirmPlacementPanel}>
          确认
        </Button>
      </div>
    </div>
  );

  const sizePanel = (
    <div className="gdd-domestic-channel-panel">
      <div className="gdd-domestic-channel-panel__head">
        <div className="gdd-domestic-channel-panel__head-title">尺寸</div>
        <div className="gdd-domestic-channel-panel__head-actions">
          <button
            type="button"
            className={`gdd-domestic-channel-panel__head-tag${allSizeChecked ? ' is-active' : ''}`}
            onClick={toggleAllSize}
          >
            全部
          </button>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__divider" />
      <div className="gdd-domestic-channel-panel__body">
        {DOMESTIC_AD_SIZE_GROUPS.map((group) => {
          const options = group.options || [];
          const vals = options.map((o) => String(o.value));
          const count = vals.filter((v) => sizePanelDraft.map(String).includes(v)).length;
          return (
            <div className="gdd-domestic-channel-panel__group" key={group.label}>
              <div>
                <Checkbox
                  checked={vals.length > 0 && count === vals.length}
                  indeterminate={count > 0 && count < vals.length}
                  onChange={(e) => toggleSizeGroup(options, e.target.checked)}
                />
                <span>{group.label}</span>
              </div>
              <div className="gdd-domestic-channel-panel__options">
                {options.map((item) => {
                  const value = String(item.value);
                  const checked = sizePanelDraft.map(String).includes(value);
                  return (
                    <label key={value} className="gdd-domestic-channel-panel__option">
                      <Checkbox checked={checked} onChange={(e) => toggleSizeValue(value, e.target.checked)} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gdd-domestic-channel-panel__footer">
        <Button onClick={cancelSizePanel}>取消</Button>
        <Button type="primary" onClick={confirmSizePanel}>
          确认
        </Button>
      </div>
    </div>
  );

  const ctaPanel = (
    <div className="gdd-domestic-channel-panel">
      <div className="gdd-domestic-channel-panel__head">
        <div className="gdd-domestic-channel-panel__head-title">CTA</div>
        <div className="gdd-domestic-channel-panel__head-actions">
          <button
            type="button"
            className={`gdd-domestic-channel-panel__head-tag${allCtaChecked ? ' is-active' : ''}`}
            onClick={toggleAllCta}
          >
            全部
          </button>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__divider" />
      <div className="gdd-domestic-channel-panel__body">
        {DOMESTIC_CTA_OPTIONS.map((group) => {
          const options = group.options || [];
          const vals = options.map((o) => String(o.value));
          const count = vals.filter((v) => ctaPanelDraft.map(String).includes(v)).length;
          return (
            <div className="gdd-domestic-channel-panel__group" key={group.label}>
              <div>
                <Checkbox
                  checked={vals.length > 0 && count === vals.length}
                  indeterminate={count > 0 && count < vals.length}
                  onChange={(e) => toggleCtaGroup(options, e.target.checked)}
                />
                <span>{group.label}</span>
              </div>
              <div className="gdd-domestic-channel-panel__options">
                {options.map((item) => {
                  const value = String(item.value);
                  const checked = ctaPanelDraft.map(String).includes(value);
                  return (
                    <label key={value} className="gdd-domestic-channel-panel__option">
                      <Checkbox checked={checked} onChange={(e) => toggleCtaValue(value, e.target.checked)} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gdd-domestic-channel-panel__footer">
        <Button onClick={cancelCtaPanel}>取消</Button>
        <Button type="primary" onClick={confirmCtaPanel}>
          确认
        </Button>
      </div>
    </div>
  );

  const topicPanel = (
    <div className="gdd-domestic-channel-panel">
      <div className="gdd-domestic-channel-panel__head">
        <div className="gdd-domestic-channel-panel__head-title">主题</div>
        <div className="gdd-domestic-channel-panel__head-actions">
          <button
            type="button"
            className={`gdd-domestic-channel-panel__head-tag${allTopicChecked ? ' is-active' : ''}`}
            onClick={toggleAllTopic}
          >
            全部
          </button>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__divider" />
      <div className="gdd-domestic-channel-panel__body">
        <div className="gdd-domestic-channel-panel__group">
          <div>
            <span>主题</span>
          </div>
          <div className="gdd-domestic-channel-panel__options">
            {DOMESTIC_GAME_THEME_OPTIONS.map((item) => {
              const value = String(item.value);
              const checked = topicPanelDraft.map(String).includes(value);
              return (
                <label key={value} className="gdd-domestic-channel-panel__option">
                  <Checkbox checked={checked} onChange={(e) => toggleTopicValue(value, e.target.checked)} />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div className="gdd-domestic-channel-panel__footer">
        <Button onClick={cancelTopicPanel}>取消</Button>
        <Button type="primary" onClick={confirmTopicPanel}>
          确认
        </Button>
      </div>
    </div>
  );

  const excludePopover = (
    <div className="gdd-domestic-exclude-popover">
      <p className="gdd-domestic-exclude-popover__hint">
        多条请用逗号分隔（英文「,」或中文「，」均可）
      </p>
      <Input.TextArea
        rows={3}
        value={excludeDraft}
        onChange={(e) => setExcludeDraft(e.target.value)}
        placeholder="请输入"
      />
      <Button
        type="primary"
        size="small"
        block
        style={{ marginTop: 8 }}
        onClick={() => {
          setExcludeOpen(false);
          handleSearchRef.current();
        }}
      >
        确定
      </Button>
    </div>
  );

  const categorySelectedLabels = domesticCategoryLabelsFromValues(
    Array.isArray(basic.category) ? basic.category : []
  );
  const categoryTriggerDisabled =
    industry !== 'game' && industry !== 'tool' && industry !== 'ecommerce';
  const categoryTriggerPlaceholder = categoryTriggerDisabled
    ? '分类'
    : '所有分类';

  return (
    <div className="gdd-domestic-search">
      <div className="gdd-domestic-row gdd-domestic-row--main">
        <div className="gdd-domestic-search-row">
          <div className="gdd-domestic-search-bar">
            <Select
              className="gdd-domestic-search-type"
              value={position}
              onChange={setPosition}
              options={DOMESTIC_POSITION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              popupMatchSelectWidth={false}
              suffixIcon={<span className="gdd-domestic-search-type-arrow" aria-hidden>▼</span>}
              getPopupContainer={(n) => n?.parentElement ?? document.body}
              popupClassName="gdd-domestic-search-type-dropdown"
            />
            <div className="gdd-domestic-keyword-input-wrap">
              <input
                type="text"
                className="gdd-domestic-search-input"
                autoComplete="off"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={mainPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                aria-label="搜索关键词"
              />
            </div>
          </div>
          <Button type="primary" className="gdd-domestic-query-btn" loading={loading} onClick={handleSearch}>
            搜索
          </Button>
          <div className="gdd-domestic-search-options">
            <Popover
              content={excludePopover}
              trigger="click"
              open={excludeOpen}
              onOpenChange={setExcludeOpen}
              placement="bottomLeft"
            >
              <button type="button" className="gdd-domestic-option-btn">
                <span className="gdd-domestic-option-icon" aria-hidden>
                  ▼
                </span>
                排除
              </button>
            </Popover>
            <label className="gdd-domestic-exact-checkbox">
              <input
                type="checkbox"
                checked={exactSearch}
                onChange={(e) => setExactSearch(e.target.checked)}
              />
              <span>精确搜索</span>
            </label>
            <Tooltip title={DOMESTIC_EXACT_SEARCH_TOOLTIP} overlayStyle={{ maxWidth: 400 }}>
              <span className="gdd-domestic-help-icon-wrap">
                <QuestionCircleOutlined className="gdd-domestic-help-icon" />
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="gdd-domestic-row gdd-domestic-row--tags">
        <span className="gdd-domestic-label">已选:</span>
        <div className="gdd-domestic-tags">
          {displayTags.map((t) => (
            <Tag key={t.id} closable onClose={() => removeTag(t.id)}>
              {t.text}
            </Tag>
          ))}
        </div>
        {displayTags.length > 0 && (
          <button type="button" className="gdd-domestic-clear-all" aria-label="清除全部已选" onClick={clearAllTags}>
            <CloseOutlined />
          </button>
        )}
      </div>

      <div className="gdd-domestic-row">
        <span className="gdd-domestic-label">行业:</span>
        <div className="gdd-domestic-industry">
          {INDUSTRY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`gdd-domestic-industry-item${industry === o.value ? ' is-active' : ''}`}
              onClick={() => {
                setIndustry((prev) => {
                  if (prev !== o.value) {
                    setBasic((p) => ({ ...p, category: [] }));
                    if (o.value !== 'game') {
                      setAdvanced((p) => ({ ...p, topic: [] }));
                    }
                  }
                  return o.value;
                });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gdd-domestic-row">
        <span className="gdd-domestic-label">基础:</span>
        <div className="gdd-domestic-selects-4">
          <Popover
            trigger="click"
            placement="bottomLeft"
            open={categoryPanelOpen}
            onOpenChange={(open) => (open ? openCategoryPanel() : cancelCategoryPanel())}
            content={categoryPanel}
            overlayClassName="gdd-domestic-channel-panel-popover"
          >
            <button
              type="button"
              className="gdd-domestic-select gdd-domestic-channel-trigger"
              disabled={categoryTriggerDisabled}
            >
              <span
                className={
                  categorySelectedLabels.length > 0 ? 'gdd-domestic-select-value' : 'is-placeholder'
                }
              >
                {categorySelectedLabels.length > 0
                  ? categorySelectedLabels.join('、')
                  : categoryTriggerPlaceholder}
              </span>
            </button>
          </Popover>
          {BASIC_SELECTS.map(({ key, placeholder }) => {
            if (key === 'channelMedia') {
              const hasChannel = Array.isArray(basic.channelMedia) && basic.channelMedia.length > 0;
              const channelSummary = hasChannel
                ? buildDomesticChannelMediaTriggerDisplay(basic.channelMedia)
                : '';
              return (
                <Popover
                  key={key}
                  trigger="click"
                  placement="bottomLeft"
                  open={channelPanelOpen}
                  onOpenChange={(open) => (open ? openChannelPanel() : cancelChannelPanel())}
                  content={channelMediaPanel}
                  overlayClassName="gdd-domestic-channel-panel-popover"
                >
                  <button type="button" className="gdd-domestic-select gdd-domestic-channel-trigger">
                    <span className={hasChannel ? 'gdd-domestic-select-value' : 'is-placeholder'}>
                      {hasChannel ? channelSummary : placeholder}
                    </span>
                  </button>
                </Popover>
              );
            }
            if (key === 'placement') {
              const hasPlacement = Array.isArray(basic.placement) && basic.placement.length > 0;
              const placementSummary = hasPlacement
                ? buildDomesticPlacementTagDisplay(basic.placement, placementGroups)
                : '';
              return (
                <Popover
                  key={key}
                  trigger="click"
                  placement="bottomLeft"
                  open={placementPanelOpen}
                  onOpenChange={(open) => (open ? openPlacementPanel() : cancelPlacementPanel())}
                  content={placementPanel}
                  overlayClassName="gdd-domestic-channel-panel-popover"
                >
                  <button type="button" className="gdd-domestic-select gdd-domestic-channel-trigger">
                    <span className={hasPlacement ? 'gdd-domestic-select-value' : 'is-placeholder'}>
                      {hasPlacement ? placementSummary : placeholder}
                    </span>
                  </button>
                </Popover>
              );
            }
            if (key === 'creativeType') {
              return (
                <Cascader
                  key={key}
                  className="gdd-domestic-select gdd-domestic-creative-cascader"
                  allowClear
                  expandTrigger="hover"
                  placeholder={placeholder}
                  options={DOMESTIC_CREATIVE_TYPE_CASCADER_OPTIONS}
                  value={domesticCreativeTypeToCascaderPath(basic.creativeType)}
                  onChange={(path) =>
                    setBasic((prev) => ({
                      ...prev,
                      creativeType: cascaderPathToDomesticCreativeType(path),
                    }))
                  }
                  displayRender={domesticCreativeTypeCascaderDisplayRender}
                  popupClassName="gdd-domestic-creative-cascader-popup"
                />
              );
            }
            return (
              <Select
                key={key}
                className="gdd-domestic-select"
                allowClear
                placeholder={placeholder}
                value={basic[key]}
                onChange={(v) => setBasic((prev) => ({ ...prev, [key]: v }))}
                options={[]}
              />
            );
          })}
        </div>
      </div>

      <div className="gdd-domestic-row">
        <span className="gdd-domestic-label">高级:</span>
        <div className="gdd-domestic-advanced">
          <div className="gdd-domestic-selects-3">
            {advancedFieldsSplit.main.map(({ key, placeholder }) =>
              key === 'topic' ? (
                <Popover
                  key={key}
                  trigger="click"
                  placement="bottomLeft"
                  open={topicPanelOpen}
                  onOpenChange={(open) => (open ? openTopicPanel() : cancelTopicPanel())}
                  content={topicPanel}
                  overlayClassName="gdd-domestic-channel-panel-popover"
                >
                  <button type="button" className="gdd-domestic-select gdd-domestic-channel-trigger">
                    <span
                      className={
                        Array.isArray(advanced.topic) && advanced.topic.length > 0
                          ? 'gdd-domestic-select-value'
                          : 'is-placeholder'
                      }
                    >
                      {Array.isArray(advanced.topic) && advanced.topic.length > 0
                        ? advanced.topic.map((x) => DOMESTIC_GAME_THEME_LABEL_MAP[x] ?? x).join('、')
                        : placeholder}
                    </span>
                  </button>
                </Popover>
              ) : key === 'size' ? (
                <Popover
                  key={key}
                  trigger="click"
                  placement="bottomLeft"
                  open={sizePanelOpen}
                  onOpenChange={(open) => (open ? openSizePanel() : cancelSizePanel())}
                  content={sizePanel}
                  overlayClassName="gdd-domestic-channel-panel-popover"
                >
                  <button type="button" className="gdd-domestic-select gdd-domestic-channel-trigger">
                    <span
                      className={
                        Array.isArray(advanced.size) && advanced.size.length > 0
                          ? 'gdd-domestic-select-value'
                          : 'is-placeholder'
                      }
                    >
                      {Array.isArray(advanced.size) && advanced.size.length > 0
                        ? buildDomesticSizeTagDisplay(advanced.size)
                        : placeholder}
                    </span>
                  </button>
                </Popover>
              ) : (
                <Select
                  key={key}
                  className="gdd-domestic-select"
                  allowClear={key !== 'system'}
                  placeholder={placeholder}
                  value={key === 'system' ? (advanced.system ?? DOMESTIC_SYSTEM_ALL_VALUE) : advanced[key]}
                  onChange={(v) =>
                    setAdvanced((prev) => ({
                      ...prev,
                      [key]: key === 'system' && (v === undefined || v === null) ? DOMESTIC_SYSTEM_ALL_VALUE : v,
                    }))
                  }
                  options={key === 'system' ? DOMESTIC_SYSTEM_OPTIONS : []}
                  optionRender={key === 'system' ? undefined : renderOptionWithCheckbox(advanced[key])}
                />
              )
            )}
            {advancedFieldsSplit.cta ? (
              <div className="gdd-domestic-advanced-cta-group">
                <Popover
                  trigger="click"
                  placement="bottomLeft"
                  open={ctaPanelOpen}
                  onOpenChange={(open) => (open ? openCtaPanel() : cancelCtaPanel())}
                  content={ctaPanel}
                  overlayClassName="gdd-domestic-channel-panel-popover"
                >
                  <button type="button" className="gdd-domestic-select gdd-domestic-channel-trigger">
                    <span
                      className={
                        Array.isArray(advanced.cta) && advanced.cta.length > 0
                          ? 'gdd-domestic-select-value'
                          : 'is-placeholder'
                      }
                    >
                      {Array.isArray(advanced.cta) && advanced.cta.length > 0
                        ? buildDomesticCtaTagDisplay(advanced.cta)
                        : advancedFieldsSplit.cta.placeholder}
                    </span>
                  </button>
                </Popover>
                <Checkbox checked={newMaterialOnly} onChange={(e) => setNewMaterialOnly(e.target.checked)}>
                  新上素材
                </Checkbox>
                <Checkbox checked={recentActiveOnly} onChange={(e) => setRecentActiveOnly(e.target.checked)}>
                  近期活跃
                </Checkbox>
              </div>
            ) : (
              <>
                <Checkbox checked={newMaterialOnly} onChange={(e) => setNewMaterialOnly(e.target.checked)}>
                  新上素材
                </Checkbox>
                <Checkbox checked={recentActiveOnly} onChange={(e) => setRecentActiveOnly(e.target.checked)}>
                  近期活跃
                </Checkbox>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="gdd-domestic-row gdd-domestic-row--time">
        <span className="gdd-domestic-label">时间:</span>
        <div className="gdd-domestic-time">
          <div className="gdd-domestic-time-presets">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`gdd-domestic-preset${timePreset === p.key ? ' is-active' : ''}`}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <RangePicker
            className="gdd-domestic-range"
            value={dateRange}
            onChange={onRangePickerChange}
            allowClear={false}
            format="YYYY-MM-DD"
          />
        </div>
      </div>
    </div>
  );
});

GuangdadaDomesticSearchForm.displayName = 'GuangdadaDomesticSearchForm';

export default GuangdadaDomesticSearchForm;
