import React, { useState, useEffect, useRef } from 'react';
import { DatePicker, Cascader, Checkbox, Dropdown, Popover, Select, Tag, Tooltip, Button, Input } from 'antd';
import dayjs from 'dayjs';
import { getTodayBeijingDayjs } from '../utils/beijingDate';
import CountryCascader from './CountryCascader';
import TrafficChannelSelector from './TrafficChannelSelector';
import GuangdadaChannelPopover from './GuangdadaChannelPopover';
import { FACEBOOK_FAMILY_ITEMS, GOOGLE_FAMILY_ITEMS } from '../data/guangdadaChannels';
import GuangdadaCountryPopover from './GuangdadaCountryPopover';
import GuangdadaCopyLangPopover from './GuangdadaCopyLangPopover';
import GuangdadaMaterialAttrPopover, { DEFAULT_ATTR as GUANGDADA_CREATIVE_ATTR_DEFAULT } from './GuangdadaMaterialAttrPopover';
import GuangdadaContentAttributesPopover from './GuangdadaContentAttributesPopover';
import GuangdadaCoreTrackPopover from './GuangdadaCoreTrackPopover';
import GuangdadaFbAudiencePopover from './GuangdadaFbAudiencePopover';
import GuangdadaFbSpendPopover, { getFbSpendDisplayText } from './GuangdadaFbSpendPopover';
import GuangdadaSocialEngagementPopover, { hasSocialEngagementSet } from './GuangdadaSocialEngagementPopover';
import GuangdadaCpiPopover, { getCpiSelectedCount } from './GuangdadaCpiPopover';
import { GUANGDADA_TOOL_CATEGORIES, GUANGDADA_TOOL_CATEGORIES_TREE } from '../data/guangdadaToolCategories';
import { GUANGDADA_GAME_CATEGORIES_TREE } from '../data/guangdadaGameCategoriesTree';
import { GUANGDADA_WEBSITE_TYPE_TREE, GUANGDADA_INDEPENDENT_WEBSITE_PILLS } from '../data/guangdadaWebsiteTypeTree';
import { GUANGDADA_PLACEMENT_ADMOB, GUANGDADA_PLACEMENT_YOUTUBE } from '../data/guangdadaPlacementOptions';
import AdTypeSelector from './AdTypeSelector';
import OSSelector from './OSSelector';
import ProductCascader from './ProductCascader';
import ProductTypeSelector from './ProductTypeSelector';
import InsightrackrProductModelCheckbox from './InsightrackrProductModelCheckbox';
import PromotionMethodSelector from './PromotionMethodSelector';
import GameThemeSelector from './GameThemeSelector';
import ProductThemeSelector from './ProductThemeSelector';
import MonetizationTypeSelector from './MonetizationTypeSelector';
import PayTypeSelector from './PayTypeSelector';
import ListingStatusSelector from './ListingStatusSelector';
import CreativeTypeSelector from './CreativeTypeSelector';
import CreativeSpecSelector from './CreativeSpecSelector';
import LanguageSelector from './LanguageSelector';
import CallToActionSelector from './CallToActionSelector';
import MaterialTagSelector from './MaterialTagSelector';
import AudienceAnalysisSelector from './AudienceAnalysisSelector';
import ExposureEstimateRangeSelector from './ExposureEstimateRangeSelector';
import InteractionMetricsSelector from './InteractionMetricsSelector';
import SortSelector from './SortSelector';
import { buildGuangdadaApiBody } from '../utils/guangdadaApiBody';
import { getGuangdadaAdvertiserAssociation, getGuangdadaAiTagsV2 } from '../utils/api';
import InsightrackrGlobalSearch from './InsightrackrGlobalSearch';
import GuangdadaAiFileSearchModal from './GuangdadaAiFileSearchModal';
import { GUANGDADA_COUNTRY_CODE_TO_CN } from '../data/guangdadaCountries';
import { CHANNEL_VALUE_MAP } from '../data/guangdadaChannels';
import { GUANGDADA_COPY_LANG_OPTIONS } from '../data/guangdadaCopyLangs';
import { GUANGDADA_CORE_TRACK_CATEGORIES } from '../data/guangdadaCoreTrack';
import {
  GUANGDADA_VIDEO_DURATION_OPTIONS,
  GUANGDADA_SIZE_OPTIONS,
  GUANGDADA_QUALITY_OPTIONS,
} from '../data/guangdadaMaterialAttr';

const { RangePicker } = DatePicker;

const VIDEO_DURATION_VALUE_TO_LABEL = Object.fromEntries(
  (GUANGDADA_VIDEO_DURATION_OPTIONS || []).filter((o) => !o.isCustom).map((o) => [o.value || '', o.label])
);
const SIZE_VALUE_TO_LABEL = Object.fromEntries((GUANGDADA_SIZE_OPTIONS || []).map((o) => [o.value, o.label]));
const QUALITY_VALUE_TO_LABEL = Object.fromEntries((GUANGDADA_QUALITY_OPTIONS || []).map((o) => [o.value, o.label]));

const COPY_LANG_VALUE_TO_LABEL = Object.fromEntries(GUANGDADA_COPY_LANG_OPTIONS.map((o) => [o.value, o.label]));
const GUANGDADA_CREATIVE_FORM_LABELS = { '1': '广告原帖', '2': '动态广告', '3': '试玩广告' };
const GUANGDADA_CTA_LABELS = { conversion: '转化', traffic: '流量获取', leads: '潜在客户', engagement: '互动', app_download: '应用下载', app_preorder: '应用预约', other: '其它' };
const GUANGDADA_MONETIZATION_LABELS = { iap: '内购', non_iap: '非内购' };
const GUANGDADA_RETARGETING_LABELS = { first: '初次投放', repeat: '重复投放' };
const GUANGDADA_ADVERTISER_SYSTEM_LABELS = { ios_android: 'iOS & Android', ios: 'iOS', android: 'Android', fb_mini_game: 'FB小游戏', pwa: 'PWA', pc: 'PC', pc_steam: 'PC-Steam', playstation: 'PlayStation游戏', xbox: 'Xbox游戏', ea: 'EA游戏' };

function flattenCategoriesToMap(categories) {
  const m = {};
  (categories || []).forEach((cat) => {
    (cat.items || []).forEach((item) => { m[item.value] = item.label; });
  });
  return m;
}
function flattenTreeToMap(tree) {
  const m = {};
  (tree || []).forEach((cat) => {
    (cat.children || []).forEach((ch) => { m[ch.value] = ch.label; });
  });
  return m;
}
function flattenGameToolTreeToMap(tree) {
  const m = {};
  (tree || []).forEach((cat) => {
    (cat.children || []).forEach((ch) => { m[ch.value] = ch.label; });
  });
  return m;
}
function getCascaderLabel(options, valuePath) {
  if (!Array.isArray(valuePath) || valuePath.length === 0) return '';
  const parts = [];
  let current = options || [];
  for (const v of valuePath) {
    const item = current.find((o) => o.value === v);
    if (!item) return valuePath.join(' / ');
    parts.push(item.label);
    current = item.children || [];
  }
  return parts.join(' / ');
}

/**
 * 按父级分组：返回已选中的大类名称列表，以及 hover 全文（每行一个大类名，下一行该大类的全部子项）
 * @returns {{ parentNames: string[], fullText: string }}
 */
function getTreeCategoryByParent(tree, selectedCodes, valueToLabel) {
  if (!selectedCodes?.length || !tree?.length) return { parentNames: [], fullText: '' };
  const parentNames = [];
  const lines = [];
  for (const parent of tree) {
    const children = parent.children || [];
    const selected = selectedCodes.filter((c) => children.some((ch) => ch.value === c));
    if (selected.length === 0) continue;
    parentNames.push(parent.name);
    const labels = selected.map((c) => (valueToLabel && valueToLabel[c]) ?? c);
    lines.push(parent.name);
    lines.push(labels.join('、'));
  }
  return { parentNames, fullText: lines.join('\n') };
}

/** 素材规格：将 creativeAttr 转为 Tag 展示的 summary 与 hover 全文 */
function getCreativeAttrDisplayText(attr) {
  if (!attr) return { summaryText: '', fullText: '' };
  const parts = [];
  const summaryParts = [];
  // 视频时长
  const vd = attr.videoDuration;
  if (vd && vd !== '-') {
    const vdLabel = VIDEO_DURATION_VALUE_TO_LABEL[vd] ?? vd;
    parts.push(`视频时长：${vdLabel}`);
    summaryParts.push(vdLabel);
  } else if (vd === '-' && (attr.videoDurationMin != null || attr.videoDurationMax != null)) {
    const min = attr.videoDurationMin ?? '';
    const max = attr.videoDurationMax ?? '';
    const range = `${min}~${max}秒`;
    parts.push(`视频时长：自定义 ${range}`);
    summaryParts.push(`自定义${range}`);
  }
  // 尺寸
  const sizeArr = attr.size || [];
  if (sizeArr.length > 0) {
    const labels = sizeArr.map((v) => SIZE_VALUE_TO_LABEL[v] ?? v);
    parts.push(`尺寸：${labels.join('、')}`);
    summaryParts.push(labels.length === 1 ? labels[0] : `${labels[0]}等${labels.length}项`);
  }
  // 画质
  const qualityArr = attr.quality || [];
  if (qualityArr.length > 0) {
    const labels = qualityArr.map((v) => QUALITY_VALUE_TO_LABEL[v] ?? v);
    parts.push(`画质：${labels.join('、')}`);
    summaryParts.push(labels.join('、'));
  }
  // 分辨率
  const resArr = attr.resolution || [];
  if (resArr.length > 0) {
    parts.push(`分辨率：${resArr.join('、')}`);
    summaryParts.push(resArr.length === 1 ? resArr[0] : `${resArr[0]}等${resArr.length}项`);
  }
  const fullText = parts.join('\n');
  const summaryText = summaryParts.join('，');
  return { summaryText, fullText };
}

const CORE_TRACK_VALUE_TO_LABEL = flattenCategoriesToMap(GUANGDADA_CORE_TRACK_CATEGORIES);
const GAME_CATEGORY_VALUE_TO_LABEL = flattenGameToolTreeToMap(GUANGDADA_GAME_CATEGORIES_TREE);
const TOOL_CATEGORY_VALUE_TO_LABEL = flattenGameToolTreeToMap(GUANGDADA_TOOL_CATEGORIES_TREE);
const WEBSITE_TYPE_VALUE_TO_LABEL = flattenTreeToMap(GUANGDADA_WEBSITE_TYPE_TREE);

// 预约广告 / 落地页类型 / 链接类型：级联选项，getGuangdadaFilterTags 需在模块级访问
const GUANGDADA_PREORDER_CASCADER_OPTIONS = [
  { value: '1', label: '预约广告', children: [{ value: '1-1', label: '全部' }] },
  { value: '2', label: '非预约广告' },
];
const GUANGDADA_LANDING_PAGE_CASCADER_OPTIONS = [
  { value: '1', label: '游戏APP' },
  { value: '2', label: '游戏网站(W2A)', children: [{ value: '2-1', label: '应用商店' }, { value: '2-2', label: 'APK' }] },
  { value: '3', label: '游戏社交账号' },
  { value: '-1', label: '其他' },
];
const GUANGDADA_LINK_TYPE_CASCADER_OPTIONS = [
  { value: '1', label: '重定向链接' },
  { value: '2', label: 'DSP分发平台', children: [{ value: '2-1', label: '有DSP平台分发' }, { value: '2-2', label: '无DSP平台分发' }] },
];

/**
 * 从广大大表单数据生成「查询」按钮上方展示的筛选 Tag 列表；每项可删除，hover 展示全部选项
 * @returns {Array<{ fieldKey: string, label: string, summaryText: string, fullText: string, defaultValue: any }>}
 */
function getGuangdadaFilterTags(formData) {
  const tags = [];
  const country = formData.guangdadaCountry || [];
  if (country.length > 0) {
    const labels = country.map((c) => GUANGDADA_COUNTRY_CODE_TO_CN[c] ?? c);
    const summary = labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`;
    tags.push({
      fieldKey: 'guangdadaCountry',
      label: '国家/地区',
      summaryText: summary,
      fullText: labels.join('、'),
      defaultValue: [],
    });
  }
  const channels = formData.guangdadaChannels || [];
  if (channels.length > 0) {
    const labels = channels.map((c) => CHANNEL_VALUE_MAP[c]?.label ?? c);
    const summary = labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`;
    tags.push({
      fieldKey: 'guangdadaChannels',
      label: '渠道',
      summaryText: summary,
      fullText: labels.join('、'),
      defaultValue: [],
    });
  }
  const copyLangs = formData.guangdadaCopyLangs || [];
  if (copyLangs.length > 0) {
    const labels = copyLangs.map((v) => COPY_LANG_VALUE_TO_LABEL[v] ?? v);
    const summary = labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`;
    tags.push({
      fieldKey: 'guangdadaCopyLangs',
      label: '文案语言',
      summaryText: summary,
      fullText: labels.join('、'),
      defaultValue: [],
    });
  }
  const creativeForm = formData.guangdadaCreativeForm || '';
  if (creativeForm) {
    const label = GUANGDADA_CREATIVE_FORM_LABELS[creativeForm] ?? creativeForm;
    tags.push({
      fieldKey: 'guangdadaCreativeForm',
      label: '创意形式',
      summaryText: label,
      fullText: label,
      defaultValue: '',
    });
  }
  const placement = Array.isArray(formData.guangdadaPlacement) ? formData.guangdadaPlacement : [];
  if (placement.length > 0) {
    const ch = formData.guangdadaChannels || [];
    const admobMap = Object.fromEntries((GUANGDADA_PLACEMENT_ADMOB || []).map((o) => [o.value, o.label]));
    const ytMap = Object.fromEntries((GUANGDADA_PLACEMENT_YOUTUBE || []).map((o) => [o.value, o.label]));
    const placementLabels = placement.map((v) => (ch.includes('admob') ? admobMap[v] : ch.includes('youtube') ? ytMap[v] : null) ?? v);
    const summary = placementLabels.length === 1 ? placementLabels[0] : (placementLabels[0] ? `${placementLabels[0]}等 ${placement.length} 项` : `${placement.length} 项`);
    tags.push({ fieldKey: 'guangdadaPlacement', label: '广告版位', summaryText: summary, fullText: placementLabels.join('、'), defaultValue: [] });
  }
  // 排除关键词
  const excludeKeyword = formData.guangdadaExcludeKeyword || [];
  if (excludeKeyword.length > 0) {
    const summary = excludeKeyword.length === 1 ? excludeKeyword[0] : `${excludeKeyword[0]}等 ${excludeKeyword.length} 项`;
    tags.push({ fieldKey: 'guangdadaExcludeKeyword', label: '排除关键词', summaryText: summary, fullText: excludeKeyword.join('、'), defaultValue: [] });
  }
  // 精确搜索
  if (formData.guangdadaExactSearch === false) {
    tags.push({ fieldKey: 'guangdadaExactSearch', label: '精确搜索', summaryText: '否', fullText: '否', defaultValue: true });
  }
  // 只看新增
  if (formData.guangdadaNewAds === true) {
    tags.push({ fieldKey: 'guangdadaNewAds', label: '只看新增', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 新广告主
  if (formData.guangdadaNewAdvertiserFlag === true) {
    tags.push({ fieldKey: 'guangdadaNewAdvertiserFlag', label: '新广告主', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 媒体类型
  const mediaType = formData.guangdadaMediaType || '';
  if (mediaType) {
    tags.push({ fieldKey: 'guangdadaMediaType', label: '媒体类型', summaryText: mediaType, fullText: mediaType, defaultValue: '' });
  }
  // Top创意
  const topCreative = formData.guangdadaTopCreative || '';
  if (topCreative) {
    tags.push({ fieldKey: 'guangdadaTopCreative', label: 'Top创意', summaryText: topCreative, fullText: topCreative, defaultValue: '' });
  }
  // 短剧 / AI App
  if (formData.guangdadaIsTheater === true) {
    tags.push({ fieldKey: 'guangdadaIsTheater', label: '短剧', summaryText: '是', fullText: '是', defaultValue: false });
  }
  if (formData.guangdadaIsAiApp === true) {
    tags.push({ fieldKey: 'guangdadaIsAiApp', label: 'AI App', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 游戏分类：Tag 展示大类名（策略、益智），hover 先显示大类再换行显示该大类下全部子项
  const gameCodes = formData.guangdadaGameCategoryCodes || [];
  if (gameCodes.length > 0) {
    const { parentNames, fullText } = getTreeCategoryByParent(GUANGDADA_GAME_CATEGORIES_TREE, gameCodes, GAME_CATEGORY_VALUE_TO_LABEL);
    const summary = parentNames.length === 0
      ? (() => { const labels = gameCodes.map((v) => GAME_CATEGORY_VALUE_TO_LABEL[v] ?? v); return labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`; })()
      : (parentNames.length === 1 ? parentNames[0] : `${parentNames.join('、')}`);
    const hoverText = fullText || gameCodes.map((v) => GAME_CATEGORY_VALUE_TO_LABEL[v] ?? v).join('、');
    tags.push({ fieldKey: 'guangdadaGameCategoryCodes', label: '游戏分类', summaryText: summary, fullText: hoverText, defaultValue: [] });
  }
  // 工具分类
  const toolCodes = formData.guangdadaToolCategoryCodes || [];
  if (toolCodes.length > 0) {
    const labels = toolCodes.map((v) => TOOL_CATEGORY_VALUE_TO_LABEL[v] ?? v);
    const summary = labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`;
    tags.push({ fieldKey: 'guangdadaToolCategoryCodes', label: '工具分类', summaryText: summary, fullText: labels.join('、'), defaultValue: [] });
  }
  // 网站类型（电商/品牌）
  const websiteCodes = formData.guangdadaWebsiteTypeCodes || [];
  if (websiteCodes.length > 0) {
    const labels = websiteCodes.map((v) => WEBSITE_TYPE_VALUE_TO_LABEL[v] ?? v);
    const summary = labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`;
    tags.push({ fieldKey: 'guangdadaWebsiteTypeCodes', label: '网站类型', summaryText: summary, fullText: labels.join('、'), defaultValue: [] });
  }
  // 仅在该国家地区投放
  if (formData.guangdadaOnlyInSelectedRegion === true) {
    tags.push({ fieldKey: 'guangdadaOnlyInSelectedRegion', label: '仅在该国家地区投放', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 素材规格（creativeAttr）：展示所选视频时长、尺寸、画质、分辨率
  const attr = formData.guangdadaCreativeAttr || {};
  const hasAttr = (attr.size && attr.size.length > 0) || (attr.quality && attr.quality.length > 0) || (attr.resolution && attr.resolution.length > 0) || (attr.videoDuration && attr.videoDuration !== '' && attr.videoDuration !== '-') || (attr.videoDuration === '-' && (attr.videoDurationMin != null || attr.videoDurationMax != null));
  if (hasAttr) {
    const { summaryText: attrSummary, fullText: attrFull } = getCreativeAttrDisplayText(attr);
    tags.push({ fieldKey: 'guangdadaCreativeAttr', label: '素材规格', summaryText: attrSummary, fullText: attrFull, defaultValue: { ...GUANGDADA_CREATIVE_ATTR_DEFAULT, size: [], quality: [], resolution: [], resolutionCustom: [] } });
  }
  // 素材内容属性
  const contentAttributes = formData.guangdadaContentAttributes || [];
  if (contentAttributes.length > 0) {
    const labels = contentAttributes.map((item) => item?.label || item?.cn_name || item?.value || item?.key || '');
    const safeLabels = labels.filter(Boolean);
    const summary = safeLabels.length === 0
      ? `已选 ${contentAttributes.length} 项`
      : safeLabels.length === 1
        ? safeLabels[0]
        : `${safeLabels[0]}等 ${contentAttributes.length} 项`;
    tags.push({ fieldKey: 'guangdadaContentAttributes', label: '素材内容属性', summaryText: summary, fullText: safeLabels.join('、'), defaultValue: [] });
  }
  // 创意规格（文案）
  const creativeSpec = formData.guangdadaCreativeSpec || '';
  if (creativeSpec.trim()) {
    tags.push({ fieldKey: 'guangdadaCreativeSpec', label: '创意规格', summaryText: creativeSpec.trim(), fullText: creativeSpec.trim(), defaultValue: '' });
  }
  // 广告主体系
  const advertiserSystem = formData.guangdadaAdvertiserSystem || '';
  if (advertiserSystem) {
    const label = GUANGDADA_ADVERTISER_SYSTEM_LABELS[advertiserSystem] ?? advertiserSystem;
    tags.push({ fieldKey: 'guangdadaAdvertiserSystem', label: '广告主体系', summaryText: label, fullText: label, defaultValue: '' });
  }
  // 核心赛道/玩法/主题/IP
  const coreTrack = formData.guangdadaCoreTrack || [];
  if (coreTrack.length > 0) {
    const labels = coreTrack.map((v) => CORE_TRACK_VALUE_TO_LABEL[v] ?? v);
    const summary = labels.length === 1 ? labels[0] : `${labels[0]}等 ${labels.length} 项`;
    tags.push({ fieldKey: 'guangdadaCoreTrack', label: '核心赛道/玩法/主题/IP', summaryText: summary, fullText: labels.join('、'), defaultValue: [] });
  }
  // 预约广告
  const preorderAd = formData.guangdadaPreorderAd || [];
  if (preorderAd.length > 0) {
    const label = getCascaderLabel(GUANGDADA_PREORDER_CASCADER_OPTIONS, preorderAd);
    tags.push({ fieldKey: 'guangdadaPreorderAd', label: '预约广告', summaryText: label, fullText: label, defaultValue: [] });
  }
  // 内购/非内购
  const monetizationType = formData.guangdadaMonetizationType || '';
  if (monetizationType) {
    const label = GUANGDADA_MONETIZATION_LABELS[monetizationType] ?? monetizationType;
    tags.push({ fieldKey: 'guangdadaMonetizationType', label: '内购/非内购', summaryText: label, fullText: label, defaultValue: '' });
  }
  // FB受众画像
  const fbAudience = formData.guangdadaFbAudience || { gender: [], age: [] };
  const fbAudienceCount = (fbAudience.gender?.length || 0) + (fbAudience.age?.length || 0);
  if (fbAudienceCount > 0) {
    tags.push({ fieldKey: 'guangdadaFbAudience', label: 'FB受众画像', summaryText: `已选 ${fbAudienceCount} 项`, fullText: `已选 ${fbAudienceCount} 项`, defaultValue: { gender: [], age: [] } });
  }
  // 营销目标(CTA)
  const cta = formData.guangdadaCta || '';
  if (cta) {
    const label = GUANGDADA_CTA_LABELS[cta] ?? cta;
    tags.push({ fieldKey: 'guangdadaCta', label: '营销目标(CTA)', summaryText: label, fullText: label, defaultValue: '' });
  }
  // FB广告花费
  const fbSpend = formData.guangdadaFbSpend || {};
  if (getFbSpendDisplayText(fbSpend)) {
    tags.push({ fieldKey: 'guangdadaFbSpend', label: 'FB广告花费', summaryText: getFbSpendDisplayText(fbSpend), fullText: getFbSpendDisplayText(fbSpend), defaultValue: { value: '', min: undefined, max: undefined } });
  }
  // 社媒互动
  if (hasSocialEngagementSet(formData.guangdadaSocialEngagement)) {
    tags.push({ fieldKey: 'guangdadaSocialEngagement', label: '社媒互动', summaryText: '已设置', fullText: '已设置', defaultValue: { like: { value: '', min: undefined, max: undefined }, comment: { value: '', min: undefined, max: undefined }, share: { value: '', min: undefined, max: undefined } } });
  }
  // CPI信息
  const cpiCount = getCpiSelectedCount(formData.guangdadaCpi);
  if (cpiCount > 0) {
    tags.push({ fieldKey: 'guangdadaCpi', label: 'CPI信息', summaryText: `已选 ${cpiCount} 项`, fullText: `已选 ${cpiCount} 项`, defaultValue: { cpiRange: [], currency: [] } });
  }
  // 落地页类型
  const landingPageType = formData.guangdadaLandingPageType || [];
  if (landingPageType.length > 0) {
    const label = getCascaderLabel(GUANGDADA_LANDING_PAGE_CASCADER_OPTIONS, landingPageType);
    tags.push({ fieldKey: 'guangdadaLandingPageType', label: '落地页类型', summaryText: label, fullText: label, defaultValue: [] });
  }
  // 链接类型
  const linkType = formData.guangdadaLinkType || [];
  if (linkType.length > 0) {
    const label = getCascaderLabel(GUANGDADA_LINK_TYPE_CASCADER_OPTIONS, linkType);
    tags.push({ fieldKey: 'guangdadaLinkType', label: '链接类型', summaryText: label, fullText: label, defaultValue: [] });
  }
  // 重投广告
  const retargeting = formData.guangdadaRetargeting || '';
  if (retargeting) {
    const label = GUANGDADA_RETARGETING_LABELS[retargeting] ?? retargeting;
    tags.push({ fieldKey: 'guangdadaRetargeting', label: '重投广告', summaryText: label, fullText: label, defaultValue: '' });
  }
  // 包含页面信息
  if (formData.guangdadaIncludePageInfo === true) {
    tags.push({ fieldKey: 'guangdadaIncludePageInfo', label: '包含页面信息', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 违规广告
  if (formData.guangdadaViolationAd === true) {
    tags.push({ fieldKey: 'guangdadaViolationAd', label: '违规广告', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 尾卡
  if (formData.guangdadaEndCard === true) {
    tags.push({ fieldKey: 'guangdadaEndCard', label: '尾卡', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // 自定义商店页
  if (formData.guangdadaHasCustomStorePage === true) {
    tags.push({ fieldKey: 'guangdadaHasCustomStorePage', label: '自定义商店页', summaryText: '是', fullText: '是', defaultValue: false });
  }
  // COD
  if (formData.guangdadaCodFlag != null && Number(formData.guangdadaCodFlag) !== 0) {
    tags.push({ fieldKey: 'guangdadaCodFlag', label: 'COD', summaryText: `已选(${formData.guangdadaCodFlag})`, fullText: String(formData.guangdadaCodFlag), defaultValue: 0 });
  }
  // 套利
  if (formData.guangdadaSearchArbitrageFlag != null && Number(formData.guangdadaSearchArbitrageFlag) !== 0) {
    tags.push({ fieldKey: 'guangdadaSearchArbitrageFlag', label: '套利', summaryText: `已选(${formData.guangdadaSearchArbitrageFlag})`, fullText: String(formData.guangdadaSearchArbitrageFlag), defaultValue: 0 });
  }
  return tags;
}

function getDefaultInsightrackrFormState() {
  return {
    keyWord: '',
    dateRange: [dayjs().subtract(1, 'year'), dayjs()],
    sortField: '15',
    sortRule: 'desc',
    isNew: false,
    countryLevel2: [],
    mediaIds: [],
    adMediaType: '',
    device: [],
    productType: [],
    productModel: [],
    selling: [],
    classIds: [],
    seelTargets: [],
    monetization: '',
    payType: '',
    listingStatus: '',
    creativeType: '',
    creativeSpec: {},
    languages: '',
    appealTypeList: [],
    interactionList: [],
    audienceAnalysis: {},
    exposureEstimateRange: '',
    interactionMetrics: {},
    insightrackrProductIds: [],
    guangdadaPrimaryTab: '游戏',
    guangdadaSearchCategory: '广告信息',
    guangdadaSearchType: '综合',
    guangdadaExactSearch: true,
    guangdadaExcludeKeyword: [],
    sort_field: '-first_seen',
    duplicate_removal: 0,
    guangdadaNewAds: false,
    guangdadaNewAdvertiserFlag: false,
    guangdadaIsTheater: false,
    guangdadaIsAiApp: false,
    guangdadaMediaType: '',
    guangdadaTopCreative: '',
    guangdadaGameCategories: [],
    guangdadaGameCategoryCodes: [],
    guangdadaGameCategorySearch: '',
    guangdadaToolCategories: [],
    guangdadaToolCategoryCodes: [],
    guangdadaToolCategorySearch: '',
    guangdadaChannels: [],
    guangdadaCountry: [],
    guangdadaOnlyInSelectedRegion: false,
    guangdadaCopyLangs: [],
    guangdadaCreativeAttr: { ...GUANGDADA_CREATIVE_ATTR_DEFAULT, size: [], quality: [], resolution: [], resolutionCustom: [] },
    guangdadaContentAttributes: [],
    guangdadaCreativeSpec: '',
    guangdadaAdvertiserSystem: '',
    guangdadaCoreTrack: [],
    guangdadaPreorderAd: [],
    guangdadaMonetizationType: '',
    guangdadaFbAudience: { gender: [], age: [] },
    guangdadaCta: '',
    guangdadaFbSpend: { value: '', min: undefined, max: undefined },
    guangdadaSocialEngagement: { like: { value: '', min: undefined, max: undefined }, comment: { value: '', min: undefined, max: undefined }, share: { value: '', min: undefined, max: undefined } },
    guangdadaCpi: { cpiRange: [], currency: [] },
    guangdadaLandingPageType: [],
    guangdadaCreativeForm: '',
    guangdadaPlacement: [], // 广告版位多选：存选中项 value 字符串数组，仅渠道单选 Admob/YouTube 时可用
    guangdadaLinkType: [],
    guangdadaRetargeting: '',
    guangdadaIncludePageInfo: false,
    guangdadaViolationAd: false,
    guangdadaEndCard: false,
    guangdadaHasCustomStorePage: false,
    guangdadaCodFlag: 0,
    guangdadaSearchArbitrageFlag: 0,
    guangdadaWebsiteTypeCodes: [],
    guangdadaMultimodalRequest: null,
  };
}

function SearchForm({
  platform,
  onSearch,
  loading,
  guangdadaSortField,
  guangdadaDedupType,
  guangdadaDateRange,
  guangdadaMultimodalPreviewUrl,
  guangdadaMultimodalPreviewType,
  guangdadaMultimodalResourceLink,
  onClearGuangdadaMultimodalSelected,
  guangdadaLastSearchCategory,
  insightrackrSearchTab = 'imagevideo',
  insightrackrInitialFormData,
  onInsightrackrFormDataChange,
  guangdadaBlockedAdvertisers = [],
  onGuangdadaUnblockAdvertiser,
  requestDefaultSearch = false,
  onDefaultSearchTriggered,
}) {
  const [formData, setFormData] = useState(() =>
    platform === 'insightrackr' && insightrackrInitialFormData != null
      ? insightrackrInitialFormData
      : getDefaultInsightrackrFormState()
  );
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const [excludePopoverOpen, setExcludePopoverOpen] = useState(false);
  const [excludeKeywordDraft, setExcludeKeywordDraft] = useState([]);

  // Insightrackr 双 Tab：切换 tab 时恢复该 tab 的表单状态
  useEffect(() => {
    if (platform === 'insightrackr' && (insightrackrInitialFormData !== undefined || insightrackrSearchTab != null)) {
      setFormData(insightrackrInitialFormData != null ? insightrackrInitialFormData : getDefaultInsightrackrFormState());
    }
  }, [platform, insightrackrSearchTab, insightrackrInitialFormData]);

  useEffect(() => {
    if (excludePopoverOpen) {
      setExcludeKeywordDraft([...(formData.guangdadaExcludeKeyword || [])]);
    }
  }, [excludePopoverOpen]);

  // 排序条改排序后会更新 effectiveParams；仅当「当前表单搜索分类」与「上次请求的分类」一致时同步到表单，避免切到「素材内容」后被旧排序覆盖
  useEffect(() => {
    if (platform !== 'guangdada') return;
    if (guangdadaSortField == null || guangdadaLastSearchCategory == null) return;
    setFormData((prev) => {
      if (prev.guangdadaSearchCategory !== guangdadaLastSearchCategory) return prev;
      if (prev.sort_field === guangdadaSortField) return prev;
      return { ...prev, sort_field: guangdadaSortField };
    });
  }, [platform, guangdadaSortField, guangdadaLastSearchCategory]);

  // 广大大：TimeFilter 切换时间后，同步 formData.dateRange，以便点击「查询」时使用正确的时间范围
  useEffect(() => {
    if (platform === 'guangdada' && guangdadaDateRange?.startTime && guangdadaDateRange?.endTime) {
      setFormData((prev) => ({
        ...prev,
        dateRange: [dayjs(guangdadaDateRange.startTime), dayjs(guangdadaDateRange.endTime)],
      }));
    }
  }, [platform, guangdadaDateRange?.startTime, guangdadaDateRange?.endTime]);

  // 搜索目标下拉选项（仅在选择「广告信息」时显示），与产品一致；position 对应：综合 0、广告文案 1、广告主 2、投放主页 4、落地页域名 6
  const GUANGDADA_SEARCH_TYPE_OPTIONS = [
    { value: '综合', label: '综合', placeholder: '搜索广告主、文案、包名等关键词' },
    { value: '广告文案', label: '广告文案', placeholder: '搜索 广告标题/文案' },
    { value: '广告主', label: '广告主', placeholder: '搜索 广告主名称/包名/开发者/多语言名称' },
    { value: '投放主页', label: '投放主页', placeholder: '搜索 主页名称/ID/帖子ID' },
    { value: '落地页域名', label: '落地页域名', placeholder: '搜索 关键词/域名' },
  ];
  // 电商/品牌 tab 下搜索类型仅此 4 项，value 为接口 position：综合'0'、投放主页'4'、落地页域名'6'、广告文案'1'，默认综合
  const GUANGDADA_SEARCH_TYPE_OPTIONS_ECOMMERCE = [
    { value: '0', label: '综合', placeholder: '搜索广告主、文案、包名等关键词' },
    { value: '4', label: '投放主页', placeholder: '搜索 主页名称/ID/帖子ID' },
    { value: '6', label: '落地页域名', placeholder: '搜索 关键词/域名' },
    { value: '1', label: '广告文案', placeholder: '搜索 广告标题/文案' },
  ];
  const ECOM_SEARCH_TYPE_VALUES = ['0', '4', '6', '1'];
  // 游戏分类选项见 GUANGDADA_GAME_CATEGORIES_TREE（一级名称用于药丸，二级 value/label 用于下拉勾选）
  // 渠道行快捷标签：展示名 -> API value；Facebook系 为 hover 子渠道下拉
  const FACEBOOK_FAMILY_VALUES = FACEBOOK_FAMILY_ITEMS.map((i) => i.value);
  const GOOGLE_FAMILY_VALUES = GOOGLE_FAMILY_ITEMS.map((i) => i.value);
  const GUANGDADA_CHANNEL_TAGS = [
    { label: 'Facebook系', value: '__fb_family__', isFacebookFamily: true },
    { label: 'Google系', value: '__google_family__', isGoogleFamily: true },
    { label: 'TikTok', value: 'tiktok' },
    { label: 'X', value: 'twitter' },
    { label: 'UnityAds', value: 'unity_ads' },
    { label: 'AppLovin', value: 'applovin' },
    { label: 'Liftoff', value: 'vungle' },
    { label: 'ironSource', value: 'ironsource' },
    { label: 'Chartboost', value: 'chartboost' },
    { label: 'TopBuzz', value: 'topbuzz' },
    { label: 'Pinterest', value: 'pinterest' },
    { label: 'Yahoo!', value: 'yahoo' },
    { label: 'Tapjoy', value: 'tapjoy' },
  ];

  const [channelPopoverOpen, setChannelPopoverOpen] = useState(false);
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const [copyLangPopoverOpen, setCopyLangPopoverOpen] = useState(false);
  const [materialAttrPopoverOpen, setMaterialAttrPopoverOpen] = useState(false);
  const [contentAttributesPopoverOpen, setContentAttributesPopoverOpen] = useState(false);
  const [contentAttributeCategories, setContentAttributeCategories] = useState([]);
  const [contentAttributeLoading, setContentAttributeLoading] = useState(false);
  const [contentAttributeError, setContentAttributeError] = useState('');
  const contentAttributeRequestRef = useRef(0);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [coreTrackPopoverOpen, setCoreTrackPopoverOpen] = useState(false);
  const [fbAudiencePopoverOpen, setFbAudiencePopoverOpen] = useState(false);
  const [fbSpendPopoverOpen, setFbSpendPopoverOpen] = useState(false);
  const [socialEngagementPopoverOpen, setSocialEngagementPopoverOpen] = useState(false);
  const [cpiPopoverOpen, setCpiPopoverOpen] = useState(false);
  const [toolCategoryDropdownOpen, setToolCategoryDropdownOpen] = useState(null);
  const [toolCategoryLocalCodes, setToolCategoryLocalCodes] = useState([]);
  const [gameCategoryDropdownOpen, setGameCategoryDropdownOpen] = useState(null);
  const [gameCategoryLocalCodes, setGameCategoryLocalCodes] = useState([]);
  const [channelFacebookDropdownOpen, setChannelFacebookDropdownOpen] = useState(false);
  const [channelFacebookLocalValues, setChannelFacebookLocalValues] = useState([]);
  const [channelGoogleDropdownOpen, setChannelGoogleDropdownOpen] = useState(false);
  const [channelGoogleLocalValues, setChannelGoogleLocalValues] = useState([]);
  const [gameCategorySearchFocused, setGameCategorySearchFocused] = useState(false);
  const [toolCategorySearchFocused, setToolCategorySearchFocused] = useState(false);
  const [websiteTypePopoverOpen, setWebsiteTypePopoverOpen] = useState(false);
  const [websiteTypeLocalCodes, setWebsiteTypeLocalCodes] = useState([]);
  const [websiteTypeSearch, setWebsiteTypeSearch] = useState('');
  const [placementPopoverOpen, setPlacementPopoverOpen] = useState(false);
  const [placementLocalValues, setPlacementLocalValues] = useState([]);
  const [placementSearch, setPlacementSearch] = useState('');
  const [associationList, setAssociationList] = useState([]);
  const [associationLoading, setAssociationLoading] = useState(false);
  const [associationOpen, setAssociationOpen] = useState(false);
  const [selectedAdvertisers, setSelectedAdvertisers] = useState([]);
  const associationTimerRef = useRef(null);
  const associationBlurTimerRef = useRef(null);
  const keywordInputWrapRef = useRef(null);
  const [aiFileModalOpen, setAiFileModalOpen] = useState(false);

  const sameAdvertiser = (a, b) =>
    (a.domain && b.domain && a.domain === b.domain && a.advertiser_name === b.advertiser_name) ||
    (a.cross_app_id && b.cross_app_id && a.cross_app_id === b.cross_app_id) ||
    (a.advertiser_name === b.advertiser_name && String(a.domain || '') === String(b.domain || ''));

  const isAdvertiserSelected = (item) => selectedAdvertisers.some((s) => sameAdvertiser(s, item));

  const toggleAdvertiserSelection = (item) => {
    setSelectedAdvertisers((prev) => {
      const exists = prev.some((s) => sameAdvertiser(s, item));
      if (exists) return prev.filter((s) => !sameAdvertiser(s, item));
      return [...prev, item];
    });
  };

  const removeSelectedAdvertiser = (item) => {
    setSelectedAdvertisers((prev) => prev.filter((s) => !sameAdvertiser(s, item)));
  };

  // 广大大广告主联想：输入关键词防抖请求，展示下拉列表；电商/品牌下不展示联想
  useEffect(() => {
    if (platform !== 'guangdada' || formData.guangdadaSearchCategory !== '广告信息' || formData.guangdadaPrimaryTab === '电商/品牌') {
      setAssociationOpen(false);
      setAssociationList([]);
      return;
    }
    const kw = (formData.keyWord || '').trim();
    if (associationTimerRef.current) clearTimeout(associationTimerRef.current);
    if (!kw) {
      setAssociationList([]);
      setAssociationOpen(false);
      return;
    }
    const appType = formData.guangdadaPrimaryTab === '工具' ? 2 : 1; // 游戏 -> 1，工具 -> 2，与 /napi/v1/advertiser/association 一致
    associationTimerRef.current = setTimeout(() => {
      associationTimerRef.current = null;
      setAssociationLoading(true);
      getGuangdadaAdvertiserAssociation(kw, appType)
        .then((res) => {
          const list = res.success && res.data && Array.isArray(res.data.advertiser_list)
            ? res.data.advertiser_list
            : [];
          setAssociationList(list);
          setAssociationOpen(true);
        })
        .catch(() => {
          setAssociationList([]);
          setAssociationOpen(false);
        })
        .finally(() => setAssociationLoading(false));
    }, 300);
    return () => {
      if (associationTimerRef.current) clearTimeout(associationTimerRef.current);
    };
  }, [platform, formData.guangdadaSearchCategory, formData.keyWord, formData.guangdadaPrimaryTab]);

  const fetchGuangdadaContentAttributes = (force = false) => {
    if (contentAttributeLoading) return;
    if (!force && contentAttributeCategories.length > 0) return;
    const requestId = contentAttributeRequestRef.current + 1;
    contentAttributeRequestRef.current = requestId;
    setContentAttributeLoading(true);
    setContentAttributeError('');
    getGuangdadaAiTagsV2(1)
      .then((res) => {
        if (contentAttributeRequestRef.current !== requestId) return;
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];
        if (res?.success && Array.isArray(list)) {
          setContentAttributeCategories(list);
          return;
        }
        setContentAttributeCategories([]);
        setContentAttributeError(res?.message || '素材内容属性加载失败');
      })
      .catch((error) => {
        if (contentAttributeRequestRef.current !== requestId) return;
        setContentAttributeCategories([]);
        setContentAttributeError(error?.message || '素材内容属性加载失败');
      })
      .finally(() => {
        if (contentAttributeRequestRef.current === requestId) {
          setContentAttributeLoading(false);
        }
      });
  };

  useEffect(() => {
    if (platform !== 'guangdada' || formData.guangdadaPrimaryTab !== '游戏' || !contentAttributesPopoverOpen) return;
    fetchGuangdadaContentAttributes(false);
  }, [platform, formData.guangdadaPrimaryTab, contentAttributesPopoverOpen]);

  // 仅切换平台时清空已选广告主；在 广告信息 / 素材内容 之间切换时保留，切回 广告信息 时恢复显示
  useEffect(() => {
    if (platform !== 'guangdada') setSelectedAdvertisers([]);
  }, [platform]);

  // 广大大广告主联想下拉：点击输入框+下拉区域外时关闭，避免焦点移出仍不关闭
  useEffect(() => {
    if (platform !== 'guangdada' || formData.guangdadaSearchCategory !== '广告信息' || !associationOpen) return;
    const wrap = keywordInputWrapRef.current;
    if (!wrap) return;
    const handleMouseDown = (e) => {
      if (wrap.contains(e.target)) return;
      setAssociationOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => document.removeEventListener('mousedown', handleMouseDown, true);
  }, [platform, formData.guangdadaSearchCategory, associationOpen]);

  // 游戏分类：父项药丸点击全选/取消后，若下拉仍打开，同步下拉内勾选状态，避免移出再 hover 才更新
  useEffect(() => {
    if (!gameCategoryDropdownOpen) return;
    const category = GUANGDADA_GAME_CATEGORIES_TREE.find((c) => c.name === gameCategoryDropdownOpen);
    if (!category) return;
    const childValues = (category.children || []).map((ch) => ch.value);
    setGameCategoryLocalCodes((formData.guangdadaGameCategoryCodes || []).filter((c) => childValues.includes(c)));
  }, [gameCategoryDropdownOpen, formData.guangdadaGameCategoryCodes]);

  // 工具分类：同上
  useEffect(() => {
    if (!toolCategoryDropdownOpen) return;
    const category = GUANGDADA_TOOL_CATEGORIES_TREE.find((c) => c.name === toolCategoryDropdownOpen);
    if (!category) return;
    const childValues = (category.children || []).map((ch) => ch.value);
    setToolCategoryLocalCodes((formData.guangdadaToolCategoryCodes || []).filter((c) => childValues.includes(c)));
  }, [toolCategoryDropdownOpen, formData.guangdadaToolCategoryCodes]);

  // 渠道 Facebook 系：父项药丸点击全选/取消后，若下拉仍打开，同步下拉内勾选状态
  useEffect(() => {
    if (!channelFacebookDropdownOpen) return;
    setChannelFacebookLocalValues((formData.guangdadaChannels || []).filter((c) => FACEBOOK_FAMILY_VALUES.includes(c) || c === 'merge_facebook'));
  }, [channelFacebookDropdownOpen, formData.guangdadaChannels]);

  // 渠道 Google 系：同上
  useEffect(() => {
    if (!channelGoogleDropdownOpen) return;
    setChannelGoogleLocalValues((formData.guangdadaChannels || []).filter((c) => GOOGLE_FAMILY_VALUES.includes(c)));
  }, [channelGoogleDropdownOpen, formData.guangdadaChannels]);

  // 网站类型（电商/品牌）：打开「更多」时同步已选
  useEffect(() => {
    if (websiteTypePopoverOpen) {
      setWebsiteTypeLocalCodes(formData.guangdadaWebsiteTypeCodes || []);
    }
  }, [websiteTypePopoverOpen, formData.guangdadaWebsiteTypeCodes]);

  // 广告版位：打开 Popover 时同步已选
  useEffect(() => {
    if (placementPopoverOpen) {
      const raw = formData.guangdadaPlacement;
      setPlacementLocalValues(Array.isArray(raw) ? raw : raw ? [String(raw)] : []);
    }
  }, [placementPopoverOpen, formData.guangdadaPlacement]);

  // 广告版位：仅渠道单选 Admob/YouTube 时可用，渠道变化时清空
  useEffect(() => {
    const ch = formData.guangdadaChannels || [];
    const placementEnabled = ch.length === 1 && (ch[0] === 'admob' || ch[0] === 'youtube');
    if (!placementEnabled) {
      setFormData((prev) => {
        const cur = prev.guangdadaPlacement;
        const has = Array.isArray(cur) ? cur.length > 0 : !!cur;
        if (!has) return prev;
        return { ...prev, guangdadaPlacement: [] };
      });
    }
  }, [formData.guangdadaChannels]);

  // 电商/品牌 tab：搜索类型 value 为 '0'/'4'/'6'/'1'，切换过来时若当前不在该列表则重置为「综合」'0'
  useEffect(() => {
    if (formData.guangdadaPrimaryTab !== '电商/品牌') return;
    const current = formData.guangdadaSearchType ?? '0';
    if (!ECOM_SEARCH_TYPE_VALUES.includes(String(current))) {
      handleChange('guangdadaSearchType', '0');
    }
  }, [formData.guangdadaPrimaryTab]);

  /** 根据关键词从分类树生成搜索建议：一级分类 或 一级/二级 子项 */
  const getCategorySearchSuggestions = (tree, searchTrimmed) => {
    if (!searchTrimmed || !Array.isArray(tree)) return [];
    const q = searchTrimmed.toLowerCase();
    const out = [];
    tree.forEach((cat) => {
      const nameMatch = (cat.name || '').toLowerCase().includes(q);
      if (nameMatch) out.push({ type: 'category', categoryName: cat.name, displayName: cat.name });
      (cat.children || []).forEach((ch) => {
        if ((ch.label || '').toLowerCase().includes(q)) {
          out.push({ type: 'sub', categoryName: cat.name, displayName: `${cat.name}/${ch.label}`, value: ch.value, label: ch.label });
        }
      });
    });
    return out;
  };

  // 广告主系统选项（仅从产品 HTML 提取，单选）
  const GUANGDADA_ADVERTISER_SYSTEM_OPTIONS = [
    { value: 'ios_android', label: 'iOS & Android' },
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
    { value: 'fb_mini_game', label: 'FB小游戏' },
    { value: 'pwa', label: 'PWA' },
    { value: 'pc', label: 'PC' },
    { value: 'pc_steam', label: 'PC-Steam' },
    { value: 'playstation', label: 'PlayStation游戏' },
    { value: 'xbox', label: 'Xbox游戏' },
    { value: 'ea', label: 'EA游戏' },
  ];

  // 高级筛选下拉选项（占位，后续可从产品 HTML 提取替换）
  // 内购/非内购：仅两项（从产品 HTML 提取）
  const GUANGDADA_MONETIZATION_OPTIONS = [
    { value: 'iap', label: '内购' },
    { value: 'non_iap', label: '非内购' },
  ];
  // 营销目标(CTA)：从产品 HTML 提取的 7 项
  const GUANGDADA_CTA_OPTIONS = [
    { value: 'conversion', label: '转化' },
    { value: 'traffic', label: '流量获取' },
    { value: 'leads', label: '潜在客户' },
    { value: 'engagement', label: '互动' },
    { value: 'app_download', label: '应用下载' },
    { value: 'app_preorder', label: '应用预约' },
    { value: 'other', label: '其它' },
  ];
  // 创意形式：从产品 HTML 提取的 3 项
  const GUANGDADA_CREATIVE_FORM_OPTIONS = [
    { value: '1', label: '广告原帖' },
    { value: '2', label: '动态广告' },
    { value: '3', label: '试玩广告' },
  ];
  // 重投广告：从产品 HTML 提取的 2 项
  const GUANGDADA_RETARGETING_OPTIONS = [
    { value: 'first', label: '初次投放' },
    { value: 'repeat', label: '重复投放' },
  ];

  // 根据表单数据构建搜索参数（供提交与排序变更时复用）
  const buildSearchParams = (data) => {
    const formDataToUse = data ?? formData;
    // 不要直接复制 formData，因为有些字段应该在 baseOption 或 productOption 中，不在顶层
    // 只保留顶层需要的字段
    const searchParams = {
      // 顶层字段：这些字段应该在顶层
      keyWord: formDataToUse.keyWord || '',
      keyWordType: "0,1,2,3,4,6,8",
      keyWordList: [],
      keyWordListType: true,
      isNew: formDataToUse.isNew || false,
      creativeList: [],
      appealTypeList: [],
      interactionList: [],
      languages: [],
      productIds: [],
      classIds: [],
      seelTargets: [],
      webTools: [],
      demoadFormats: [],
      adMediaType: [],
      materialRemovalRepeat: false,
      materialType: "",
      creativeTeam: [],
      materialTag: []
    };

    // 构建 API 请求参数（针对 Insightrackr）
    if (platform === 'insightrackr') {
      // ========== 关键词相关 ==========
      // 已在顶层初始化，这里不需要再设置

      // 处理日期范围 - 转换为 baseOption 中的 startTime 和 endTime
      const startTime = formDataToUse.dateRange && formDataToUse.dateRange[0] 
        ? formDataToUse.dateRange[0].format('YYYY-MM-DD')
        : dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      const endTime = formDataToUse.dateRange && formDataToUse.dateRange[1]
        ? formDataToUse.dateRange[1].format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
      
      // ========== baseOption：基础选项 ==========
      // 注意：countryLevel2, mediaIds, device, productModel, sortField, sortRule 都应该在 baseOption 中，不在顶层
      searchParams.baseOption = {
        permission: false, // 权限（固定值）
        putOverseaInland: null, // 海外/国内（未使用）
        tradeLevel1: [], // 行业一级分类（未使用）
        tradeLevel2: [], // 行业二级分类（未使用）
        tradeLevel3: Array.isArray(formDataToUse.productType) ? formDataToUse.productType.map(String) : [], // 行业三级/四级：与「行业类型」级联选择器一致，传 level4 的 ccode 数组
        subjectType: [], // 主题类型（未使用）
        countryLevel2: formDataToUse.countryLevel2 || [], // 国家/地区（对应：国家/地区级联选择器）- 在 baseOption 中
        adfactionIds: [], // 广告行动号召ID（未使用）
        mediaIds: formDataToUse.mediaIds || [], // 流量渠道（对应：流量渠道选择器）- 在 baseOption 中
        device: Array.isArray(formDataToUse.device) ? formDataToUse.device.map(String) : [], // 操作系统：iOS→["2"]，Android→["1"]，字符串数组
        topicType: [], // 主题类型（未使用）
        dayMode: "DY", // 日期模式（固定值："DY"）
        productModel: Array.isArray(formDataToUse.productModel) ? formDataToUse.productModel.map(String) : (formDataToUse.productModel ? [String(formDataToUse.productModel)] : []), // 产品模型多选 - 在 baseOption 中，数组格式
        startTime: startTime, // 开始时间（从 dateRange 转换）- 在 baseOption 中
        endTime: endTime, // 结束时间（从 dateRange 转换）- 在 baseOption 中
        compareEndDate: "", // 对比结束日期（未使用）
        compareStartDate: "", // 对比开始日期（未使用）
        pageIndex: 1, // 页码（固定值：1）
        pageSize: 60, // 每页数量（固定值：60）
        sortField: formDataToUse.sortField || '15', // 排序字段（对应：排序选择器的排序字段，默认：15-曝光预估）- 在 baseOption 中
        sortRule: formDataToUse.sortRule || 'desc', // 排序规则（对应：排序选择器的排序规则，"desc"降序或"asc"升序）- 在 baseOption 中
        gptSearch: false, // GPT搜索（固定值：false）
        globalSearch: true, // 全局搜索（固定值：true）
        materialTopLimit: "", // 曝光预估（对应：曝光预估选择器，如"500"表示top500）
        szfxList: [] // 受众分析（对应：受众分析选择器，格式：[{szfxKey, szfxValue}]）
      };
      
      // ========== 创意相关参数 ==========
      searchParams.adMediaType = formDataToUse.adMediaType 
        ? [formDataToUse.adMediaType] 
        : []; // 广告类型（对应：广告类型选择器）
      
      searchParams.classIds = formDataToUse.classIds || []; // 游戏题材（对应：游戏题材选择器）
      searchParams.seelTargets = formDataToUse.seelTargets || []; // 产品主题（对应：产品主题选择器）
      // 顶部 Tab「试玩广告」时走 preplay 接口，请求体与官方示例一致：materialType ""、demoadFormats []、dayMode "DD"、gptSearch true，且每页 4 条
      if (insightrackrSearchTab === 'playable') {
        searchParams.demoadFormats = [];
        searchParams.materialType = '';
        searchParams.baseOption.dayMode = 'DD';
        searchParams.baseOption.gptSearch = true;
        searchParams.baseOption.pageIndex = 1;
        searchParams.baseOption.pageSize = 4;
      } else {
        // 图片/视频 Tab：与官方 imagevideo 请求一致，materialType 筛选才生效；排序使用表单所选（曝光预估=15、首次发现时间=3 等）
        searchParams.demoadFormats = [];
        searchParams.baseOption.dayMode = 'DD';
        searchParams.baseOption.gptSearch = true;
        searchParams.baseOption.globalSearch = false; // 官方请求无此字段，传 false 与官方行为一致
        // sortField/sortRule 已在上面从 formDataToUse 写入，不覆盖（用户选「曝光预估」则 sortField=15，选「首次发现时间」则 sortField=3）
        searchParams.baseOption.pageSize = 40;      // 官方 imagevideo 默认 pageSize 40
      }
      searchParams.insightrackrSearchTab = insightrackrSearchTab; // 服务端据此切换 preplay / imagevideo 接口
      searchParams.webTools = []; // 未使用
      
      // 创意规格：转换为 creativeList 格式 [{creativeKey, creativeValue}]
      // creativeKey: "sz"(尺寸), "spsc"(视频时长), "qxd"(清晰度), "gs"(格式)
      const creativeList = [];
      if (formDataToUse.creativeSpec) {
        const spec = formDataToUse.creativeSpec;
        
        // 尺寸：sz
        if (spec.size) {
          creativeList.push({ creativeKey: "sz", creativeValue: spec.size });
        } else if (spec.customWidth && spec.customHeight) {
          // 自定义尺寸
          creativeList.push({ creativeKey: "sz", creativeValue: `${spec.customWidth},${spec.customHeight}` });
        }
        
        // 视频时长：spsc
        if (spec.videoDuration) {
          creativeList.push({ creativeKey: "spsc", creativeValue: spec.videoDuration });
        }
        
        // 清晰度：qxd
        if (spec.clarity) {
          creativeList.push({ creativeKey: "qxd", creativeValue: spec.clarity });
        }
        
        // 格式：gs（多选，需要分别添加）
        if (spec.format && spec.format.length > 0) {
          spec.format.forEach(formatCode => {
            creativeList.push({ creativeKey: "gs", creativeValue: formatCode });
          });
        }
      }
      searchParams.creativeList = creativeList;
      
      searchParams.languages = formDataToUse.languages ? [formDataToUse.languages] : []; // 标题语言（对应：标题语言选择器）
      searchParams.appealTypeList = formDataToUse.appealTypeList || []; // 行动号召（对应：行动号召选择器）
      
      // 互动指标：转换为 interactionList 格式 [{interactionKey, interactionValue}]
      // interactionKey: "share"(分享), "comment"(评论), "like"(点赞)
      // interactionValue格式：
      //   - "1001," 表示 >1000（注意末尾有逗号）
      //   - "101,1000" 表示 101-1000
      //   - "1,100" 表示 1-100
      const interactionList = [];
      if (formDataToUse.interactionMetrics && Object.keys(formDataToUse.interactionMetrics).length > 0) {
        ['share', 'comment', 'like'].forEach(metricCode => {
          const metric = formDataToUse.interactionMetrics[metricCode];
          if (!metric) return;
          
          let interactionValue = null;
          if (metric.preset) {
            // 使用预定义范围（ccode格式）
            // "1001-" -> "1001," (注意：>1000需要加逗号)
            // "101-1000" -> "101,1000"
            // "1-100" -> "1,100"
            if (metric.preset === '1001-') {
              interactionValue = '1001,';
            } else if (metric.preset.includes('-')) {
              interactionValue = metric.preset.replace('-', ',');
            } else {
              interactionValue = metric.preset;
            }
          } else if (metric.customMin || metric.customMax) {
            // 使用自定义范围
            const min = metric.customMin || '';
            const max = metric.customMax || '';
            if (max) {
              interactionValue = `${min},${max}`;
            } else if (min) {
              interactionValue = `${min},`; // 只有最小值时，末尾加逗号表示大于等于
            }
          }
          
          if (interactionValue !== null) {
            interactionList.push({
              interactionKey: metricCode,
              interactionValue: interactionValue
            });
          }
        });
      }
      searchParams.interactionList = interactionList;
      
      // 素材标签：materialTag（数组）
      searchParams.materialTag = formDataToUse.interactionList || []; // 素材标签（对应：素材标签选择器）
      
      // ========== 产品相关参数 ==========
      // 全局搜索选中 Apps/开发者旗下APP 某一项时，将对应 productId（pkg）传入列表查询
      searchParams.productIds = Array.isArray(formDataToUse.insightrackrProductIds) ? formDataToUse.insightrackrProductIds : [];
      // 注意：productType 应该在 productOption 中，不在顶层
      searchParams.productOption = {
        productType: Array.isArray(formDataToUse.productType) && formDataToUse.productType.length > 0
          ? formDataToUse.productType.map(String)
          : [], // 产品类型/行业类型（level4 ccode 数组，与 baseOption.tradeLevel3 一致）
        selling: formDataToUse.selling || [], // 搜索推广方式（对应：推广方式级联选择器）
        monetization: formDataToUse.monetization ? [formDataToUse.monetization] : [], // 变现类型（对应：变现类型选择器）
        payType: formDataToUse.payType ? [formDataToUse.payType] : [], // 下载类型（对应：下载类型选择器）
        companyLocation: [], // 公司位置（未使用）
        campaignList: [] // 活动列表（未使用，但示例中有值：["retargeting","app store","google play","direct market"]）
      };
      
      // ========== 其他参数 ==========
      // 素材类型（对应：创意类型选择器；试玩广告 Tab 时已在上面设为 '3'）
      if (insightrackrSearchTab !== 'playable') {
        searchParams.materialType = formDataToUse.creativeType || "";
      }
      
      searchParams.creativeTeam = []; // 创意团队（未使用）
      searchParams.materialRemovalRepeat = false; // 素材去重（固定值：false，但示例中是true）
      
      // ========== 曝光预估 ==========
      // 映射到 baseOption.materialTopLimit（字符串格式，如"500"表示top500）
      // exposureEstimateRange的值是ccode，如"100", "500", "2000"
      if (formDataToUse.exposureEstimateRange) {
        searchParams.baseOption.materialTopLimit = formDataToUse.exposureEstimateRange;
      }
      
      // ========== 受众分析 ==========
      // 映射到 baseOption.szfxList 格式：[{szfxKey, szfxValue}]
      // szfxKey: "gender"(性别占比), "Age"(年龄段)
      const szfxList = [];
      if (formDataToUse.audienceAnalysis && Object.keys(formDataToUse.audienceAnalysis).length > 0) {
        const analysis = formDataToUse.audienceAnalysis;
        
        // 性别占比
        if (analysis.gender) {
          szfxList.push({
            szfxKey: "gender",
            szfxValue: [analysis.gender] // 如：["F50"]
          });
        }
        
        // 年龄段
        if (analysis.ageGroups && analysis.ageGroups.length > 0) {
          szfxList.push({
            szfxKey: "Age",
            szfxValue: analysis.ageGroups // 如：["18-24", "25-34"]
          });
        }
      }
      searchParams.baseOption.szfxList = szfxList;
      
      // 上架状态（对应：上架状态选择器）
      // 注意：API中未找到对应字段，可能需要特殊处理或映射到其他字段
      // 示例中未出现此字段，暂时保留但不发送
    }

    // 广大大：napi/v1/creative/list 参数（与 API 文档 2.1.1 请求体对齐）
    if (platform === 'guangdada') {
      const todayBeijing = getTodayBeijingDayjs();
      const startTime = formDataToUse.dateRange && formDataToUse.dateRange[0]
        ? formDataToUse.dateRange[0].format('YYYY-MM-DD')
        : todayBeijing.subtract(1, 'year').format('YYYY-MM-DD');
      const endTime = formDataToUse.dateRange && formDataToUse.dateRange[1]
        ? formDataToUse.dateRange[1].format('YYYY-MM-DD')
        : todayBeijing.format('YYYY-MM-DD');
      searchParams.keyWord = formDataToUse.keyWord || '';
      searchParams.exclude_keyword = formDataToUse.guangdadaExcludeKeyword || [];
      searchParams.page = formDataToUse.page ?? 1;
      searchParams.pageSize = formDataToUse.pageSize ?? 60;
      searchParams.startTime = startTime;
      searchParams.endTime = endTime;
      // 电商/品牌下有关键词时默认选中「相关性」排序；素材内容默认「素材相关性」
      if (formDataToUse.guangdadaPrimaryTab === '电商/品牌' && (formDataToUse.keyWord || '').trim()) {
        searchParams.sort_field = '-correlation';
      } else if (formDataToUse.guangdadaSearchCategory === '素材内容') {
        searchParams.sort_field = formDataToUse.sort_field ?? guangdadaSortField ?? '-multimodal_similarity';
      } else {
        searchParams.sort_field = guangdadaSortField ?? formDataToUse.sort_field ?? '-first_seen';
      }
      searchParams.duplicate_removal = guangdadaDedupType ?? formDataToUse.duplicate_removal ?? 0;
      // 广告主类型：1-游戏 2-工具 3-电商
      searchParams.guangdadaPrimaryTab = formDataToUse.guangdadaPrimaryTab || '游戏';
      searchParams.guangdadaSearchCategory = formDataToUse.guangdadaSearchCategory || '广告信息';
      // 搜索目标 position：0-综合 1-广告文案 2-广告主 4-投放主页 6-落地页域名（暂无 UI 传 0）
      searchParams.guangdadaSearchType = formDataToUse.guangdadaSearchType || '综合';
      searchParams.guangdadaExactSearch = formDataToUse.guangdadaExactSearch !== false;
      searchParams.guangdadaNewAds = !!formDataToUse.guangdadaNewAds;
      searchParams.guangdadaNewAdvertiserFlag = !!formDataToUse.guangdadaNewAdvertiserFlag;
      searchParams.guangdadaIsTheater = !!formDataToUse.guangdadaIsTheater;
      searchParams.guangdadaIsAiApp = !!formDataToUse.guangdadaIsAiApp;
      searchParams.guangdadaMediaType = formDataToUse.guangdadaMediaType || '';
      searchParams.guangdadaTopCreative = formDataToUse.guangdadaTopCreative || '';
      searchParams.guangdadaGameCategories = formDataToUse.guangdadaGameCategories || [];
      searchParams.guangdadaGameCategoryCodes = formDataToUse.guangdadaGameCategoryCodes || [];
      searchParams.guangdadaGameCategorySearch = formDataToUse.guangdadaGameCategorySearch || '';
      searchParams.guangdadaToolCategories = formDataToUse.guangdadaToolCategories || [];
      searchParams.guangdadaToolCategoryCodes = formDataToUse.guangdadaToolCategoryCodes || [];
      searchParams.guangdadaWebsiteTypeCodes = formDataToUse.guangdadaWebsiteTypeCodes || [];
      searchParams.guangdadaToolCategorySearch = formDataToUse.guangdadaToolCategorySearch || '';
      searchParams.guangdadaChannels = formDataToUse.guangdadaChannels || [];
      searchParams.guangdadaCountry = formDataToUse.guangdadaCountry || [];
      searchParams.guangdadaOnlyInSelectedRegion = !!formDataToUse.guangdadaOnlyInSelectedRegion;
      searchParams.guangdadaCopyLangs = formDataToUse.guangdadaCopyLangs || [];
      searchParams.guangdadaCreativeAttr = formDataToUse.guangdadaCreativeAttr || {};
      searchParams.guangdadaContentAttributes = formDataToUse.guangdadaContentAttributes || [];
      searchParams.guangdadaAdvertiserSystem = formDataToUse.guangdadaAdvertiserSystem || '';
      searchParams.guangdadaCoreTrack = formDataToUse.guangdadaCoreTrack || [];
      searchParams.guangdadaPreorderAd = formDataToUse.guangdadaPreorderAd || [];
      searchParams.guangdadaMonetizationType = formDataToUse.guangdadaMonetizationType || '';
      searchParams.guangdadaFbAudience = formDataToUse.guangdadaFbAudience || { gender: [], age: [] };
      searchParams.guangdadaCta = formDataToUse.guangdadaCta || '';
      searchParams.guangdadaFbSpend = formDataToUse.guangdadaFbSpend || { value: '', min: undefined, max: undefined };
      searchParams.guangdadaSocialEngagement = formDataToUse.guangdadaSocialEngagement || { like: {}, comment: {}, share: {} };
      searchParams.guangdadaCpi = formDataToUse.guangdadaCpi || { cpiRange: [], currency: [] };
      searchParams.guangdadaLandingPageType = formDataToUse.guangdadaLandingPageType || [];
      searchParams.guangdadaCreativeForm = formDataToUse.guangdadaCreativeForm || '';
      searchParams.guangdadaPlacement = Array.isArray(formDataToUse.guangdadaPlacement) ? formDataToUse.guangdadaPlacement : (formDataToUse.guangdadaPlacement ? [String(formDataToUse.guangdadaPlacement)] : []);
      searchParams.guangdadaLinkType = formDataToUse.guangdadaLinkType || [];
      searchParams.guangdadaRetargeting = formDataToUse.guangdadaRetargeting || '';
      searchParams.guangdadaIncludePageInfo = !!formDataToUse.guangdadaIncludePageInfo;
      searchParams.guangdadaViolationAd = !!formDataToUse.guangdadaViolationAd;
      searchParams.guangdadaEndCard = !!formDataToUse.guangdadaEndCard;
      searchParams.guangdadaHasCustomStorePage = !!formDataToUse.guangdadaHasCustomStorePage;
      searchParams.guangdadaCodFlag = formDataToUse.guangdadaCodFlag != null ? Number(formDataToUse.guangdadaCodFlag) : 0;
      searchParams.guangdadaSearchArbitrageFlag = formDataToUse.guangdadaSearchArbitrageFlag != null ? Number(formDataToUse.guangdadaSearchArbitrageFlag) : 0;
      // 已选广告主：请求 creative/list 时带上 advertiser_key（选中的 id 数组）。联想返回里 id 取 domain，cross_app_id 常为空
      const getAdvertiserId = (a) => {
        const v = (a.domain != null && a.domain !== '') ? a.domain : (a.cross_app_id ?? a.advertiser_key ?? a.id ?? a.advertiser_id);
        return v != null ? String(v).trim() : '';
      };
      const advertiserKeys = (selectedAdvertisers || []).map(getAdvertiserId).filter(Boolean);
      if (advertiserKeys.length > 0) {
        searchParams.advertiser_key = advertiserKeys;
        // 素材内容模式下需保留 keyWord 供 multi-modal-search；电商/品牌下搜索框内容始终作为 keyword 传入，不清空
        if (formDataToUse.guangdadaSearchCategory !== '素材内容' && formDataToUse.guangdadaPrimaryTab !== '电商/品牌') {
          searchParams.keyWord = '';
        }
      }
      // 广大大：直接返回与 guangdada.net 标准请求一致的 API body，便于在 Network 中核对参数
      const body = buildGuangdadaApiBody(searchParams);
      if (formDataToUse.guangdadaMultimodalRequest != null) {
        return { ...body, guangdadaMultimodalRequest: formDataToUse.guangdadaMultimodalRequest };
      }
      return body;
    }

    return searchParams;
  };

  const handleGuangdadaAiFileConfirm = (payload) => {
    const merged = {
      ...formDataRef.current,
      keyWord: '',
      guangdadaMultimodalRequest: payload,
      sort_field: '-multimodal_similarity',
    };
    setFormData(merged);
    if (platform === 'insightrackr' && onInsightrackrFormDataChange) onInsightrackrFormDataChange(merged);
    setAiFileModalOpen(false);
    onSearch(buildSearchParams(merged));
  };

  // 进入页面且已登录时，用当前（默认）表单参数发起一次查询，仅执行一次
  const defaultSearchTriggeredRef = React.useRef(false);
  React.useEffect(() => {
    if (!requestDefaultSearch || !platform || defaultSearchTriggeredRef.current) return;
    defaultSearchTriggeredRef.current = true;
    onSearch(buildSearchParams(formData));
    onDefaultSearchTriggered?.();
  }, [requestDefaultSearch, platform]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(buildSearchParams(formData));
  };

  const handleChange = (field, value) => {
    const shouldClearMultimodalByCategorySwitch =
      platform === 'guangdada' &&
      field === 'guangdadaSearchCategory' &&
      value === '广告信息' &&
      formData.guangdadaSearchCategory === '素材内容';
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (platform === 'guangdada' && field === 'guangdadaSearchCategory') {
        if (value === '素材内容') {
          next.sort_field = '-multimodal_similarity';
        } else if (value === '广告信息' && prev.sort_field === '-multimodal_similarity') {
          next.sort_field = '-first_seen';
          next.guangdadaMultimodalRequest = null;
        }
      }
      if (platform === 'guangdada' && field === 'keyWord' && prev.guangdadaSearchCategory === '素材内容') {
        next.guangdadaMultimodalRequest = null;
      }
      if (platform === 'insightrackr' && onInsightrackrFormDataChange) onInsightrackrFormDataChange(next);
      return next;
    });
    if (shouldClearMultimodalByCategorySwitch) {
      onClearGuangdadaMultimodalSelected?.();
    }
  };

  return (
    <form id="searchFormContainer" onSubmit={handleSubmit} className={platform === 'guangdada' ? 'search-form search-form--guangdada' : 'search-form'}>
      {platform === 'guangdada' ? (
        <>
        <div className="guangdada-search-top">
          <div className="guangdada-search-top-content">
{/* 一级分类：游戏 / 工具 / 电商/品牌 */}
<div className="guangdada-primary-tabs">
            <button
              type="button"
              className={`guangdada-tab ${formData.guangdadaPrimaryTab === '游戏' ? 'active' : ''}`}
              onClick={() => handleChange('guangdadaPrimaryTab', '游戏')}
            >
              游戏
            </button>
            <button
              type="button"
              className={`guangdada-tab ${formData.guangdadaPrimaryTab === '工具' ? 'active' : ''}`}
              onClick={() => handleChange('guangdadaPrimaryTab', '工具')}
            >
              工具
            </button>
            <button
              type="button"
              className={`guangdada-tab ${formData.guangdadaPrimaryTab === '电商/品牌' ? 'active' : ''}`}
              onClick={() => {
                handleChange('guangdadaPrimaryTab', '电商/品牌');
                if (formData.guangdadaSearchCategory === '素材内容') handleChange('guangdadaSearchCategory', '广告信息');
              }}
            >
              电商/品牌
            </button>
          </div>
          {/* 二级分类与关键词提示同一行：tabs 左，hint 右 */}
          <div className="guangdada-category-row">
            <div className="guangdada-category-tabs">
              <button
                type="button"
                className={`guangdada-category-tab ${formData.guangdadaSearchCategory === '广告信息' ? 'active' : ''}`}
                onClick={() => handleChange('guangdadaSearchCategory', '广告信息')}
              >
                广告信息
              </button>
              {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                <button
                  type="button"
                  className={`guangdada-category-tab ${formData.guangdadaSearchCategory === '素材内容' ? 'active' : ''}`}
                  onClick={() => handleChange('guangdadaSearchCategory', '素材内容')}
                >
                  素材内容
                </button>
              )}
            </div>
            <p className="guangdada-keyword-hint">
              可使用
              <button
                type="button"
                className="guangdada-keyword-sep-btn"
                onClick={() => handleChange('keyWord', (formData.keyWord || '') + '\\;')}
                title="在关键词末尾追加 \\; 分隔符"
              >
                \;
              </button>
              分割添加关键词, 最多7个可使用
            </p>
          </div>
          {/* 搜索栏与右侧选项同一行：下拉（仅广告信息时显示）+ 输入框 + 搜索按钮 | 排除 + 精确搜索 */}
          <div className="guangdada-search-row">
            <div className="guangdada-search-bar">
              {formData.guangdadaSearchCategory === '广告信息' && (
                <Select
                  className="guangdada-search-type"
                  value={formData.guangdadaPrimaryTab === '电商/品牌' ? (formData.guangdadaSearchType ?? '0') : (formData.guangdadaSearchType || '综合')}
                  onChange={(v) => handleChange('guangdadaSearchType', v)}
                  options={(formData.guangdadaPrimaryTab === '电商/品牌' ? GUANGDADA_SEARCH_TYPE_OPTIONS_ECOMMERCE : GUANGDADA_SEARCH_TYPE_OPTIONS).map(({ value, label }) => ({ value, label }))}
                  suffixIcon={<span className="guangdada-search-type-arrow" aria-hidden>▼</span>}
                  getPopupContainer={(n) => n?.parentElement ?? document.body}
                  popupClassName="guangdada-search-type-dropdown"
                />
              )}
              <div
                className={`guangdada-keyword-input-wrap${
                  formData.guangdadaSearchCategory === '素材内容' && formData.guangdadaPrimaryTab !== '电商/品牌'
                    ? ' guangdada-keyword-input-wrap--with-ai'
                    : ''
                }`}
                ref={keywordInputWrapRef}
              >
                <div className="guangdada-keyword-input-inner">
                  <input
                    type="text"
                    id="searchKeyword"
                    name="keyword"
                    className="guangdada-search-input"
                    autoComplete="off"
                    placeholder={
                      formData.guangdadaSearchCategory === '广告信息'
                        ? (() => {
                            const opts = formData.guangdadaPrimaryTab === '电商/品牌' ? GUANGDADA_SEARCH_TYPE_OPTIONS_ECOMMERCE : GUANGDADA_SEARCH_TYPE_OPTIONS;
                            const current = formData.guangdadaPrimaryTab === '电商/品牌' ? (formData.guangdadaSearchType ?? '0') : (formData.guangdadaSearchType || '综合');
                            return opts.find((o) => o.value === current)?.placeholder ?? opts[0].placeholder;
                          })()
                        : '搜索广告主、文案、包名等关键词'
                    }
                    value={formData.keyWord}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleChange('keyWord', v);
                      // 清空关键词时只清空联想下拉列表，已选广告主保留
                      if (!(v && v.trim())) setAssociationList([]);
                    }}
                    onFocus={() => {
                      if (associationBlurTimerRef.current) {
                        clearTimeout(associationBlurTimerRef.current);
                        associationBlurTimerRef.current = null;
                      }
                      if (formData.guangdadaPrimaryTab !== '电商/品牌' && (associationList.length > 0 || associationLoading)) setAssociationOpen(true);
                    }}
                    onBlur={() => {
                      // 短延时以便点击下拉项时 onMouseDown(preventDefault) 先于 blur 生效；关闭主要依赖「点击外部」监听
                      associationBlurTimerRef.current = setTimeout(() => {
                        associationBlurTimerRef.current = null;
                        setAssociationOpen(false);
                      }, 120);
                    }}
                  />
                  {formData.guangdadaSearchCategory === '广告信息' && formData.guangdadaPrimaryTab !== '电商/品牌' && associationOpen && (associationList.length > 0 || associationLoading) && (
                    <div className="guangdada-association-dropdown">
                      <div className="guangdada-association-header">
                        <span className="guangdada-association-header-label">广告主</span>
                        <span className="guangdada-association-header-col">近90天创意</span>
                        <span className="guangdada-association-header-col">上月下载</span>
                      </div>
                      {associationLoading ? (
                        <div className="guangdada-association-loading">加载中...</div>
                      ) : (
                        <ul className="guangdada-association-list">
                          {associationList.map((item, i) => {
                            const isSelected = isAdvertiserSelected(item);
                            return (
                              <li
                                key={item.domain || item.cross_app_id || i}
                                className={`guangdada-association-item${isSelected ? ' guangdada-association-item--selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  toggleAdvertiserSelection(item);
                                }}
                              >
                                <div className="guangdada-association-item-main">
                                  {item.logo_url ? (
                                    <img src={item.logo_url} alt="" className="guangdada-association-logo" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="guangdada-association-logo guangdada-association-logo--placeholder" />
                                  )}
                                  <div className="guangdada-association-info">
                                    <div className="guangdada-association-name">
                                      {item.advertiser_name || '—'}
                                      {isSelected && <span className="guangdada-association-item-selected-badge">已选</span>}
                                    </div>
                                    <div className="guangdada-association-meta">{item.domain || item.cross_app_id || '—'}</div>
                                    {item.developer && <div className="guangdada-association-developer">{item.developer}</div>}
                                  </div>
                                </div>
                                <span className="guangdada-association-creative">{item.ads_count_last_90_days != null ? item.ads_count_last_90_days : '—'}</span>
                                <span className="guangdada-association-download">
                                  {item.download != null
                                    ? (item.download >= 10000 ? `${(item.download / 10000).toFixed(0)}万` : item.download)
                                    : '—'}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                {formData.guangdadaSearchCategory === '素材内容' && formData.guangdadaPrimaryTab !== '电商/品牌' && (
                  <button
                    type="button"
                    className="guangdada-ai-file-trigger-btn"
                    onClick={() => setAiFileModalOpen(true)}
                  >
                    AI文件搜索
                  </button>
                )}
              </div>
            </div>
            {(formData.guangdadaSearchCategory === '广告信息' || formData.guangdadaSearchCategory === '素材内容') && (
              <div className="guangdada-search-options">
                <Popover
                  open={excludePopoverOpen}
                  onOpenChange={setExcludePopoverOpen}
                  trigger="click"
                  placement="bottomRight"
                  title={null}
                  content={
                    <div className="guangdada-exclude-popover-content">
                      <div className="guangdada-exclude-popover-desc">可以输入需要排除的字符串</div>
                      <Select
                        mode="tags"
                        allowClear
                        showSearch
                        placeholder="输入后回车添加，最多7个"
                        value={excludeKeywordDraft}
                        onChange={(vals) => setExcludeKeywordDraft((vals || []).slice(0, 7))}
                        maxTagCount={7}
                        className="guangdada-exclude-select"
                        style={{ width: 360 }}
                      />
                      <div className="guangdada-exclude-popover-btns">
                        <Button size="small" onClick={() => setExcludePopoverOpen(false)}>
                          取 消
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            handleChange('guangdadaExcludeKeyword', excludeKeywordDraft.slice(0, 7));
                            setExcludePopoverOpen(false);
                          }}
                        >
                          确 定
                        </Button>
                      </div>
                    </div>
                  }
                  overlayClassName="guangdada-exclude-popover-overlay"
                  getPopupContainer={(node) => node?.parentElement ?? document.body}
                >
                  <Tooltip
                    title={(formData.guangdadaExcludeKeyword || []).length > 0 ? (formData.guangdadaExcludeKeyword || []).join('、') : null}
                  >
                    <button
                      type="button"
                      className={`guangdada-option-btn${(formData.guangdadaExcludeKeyword || []).length > 0 ? ' guangdada-option-btn--has-exclude' : ''}`}
                    >
                      <span className="guangdada-option-icon">▼</span>
                      排除{(formData.guangdadaExcludeKeyword || []).length > 0 ? `(${(formData.guangdadaExcludeKeyword || []).length})` : ''}
                    </button>
                  </Tooltip>
                </Popover>
                <label className="guangdada-exact-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.guangdadaExactSearch}
                    onChange={(e) => handleChange('guangdadaExactSearch', e.target.checked)}
                  />
                  <span>精确搜索</span>
                </label>
              </div>
            )}
          </div>
          </div>
          

          {/* 游戏 / 工具共用同一套筛选项，仅分类行在「游戏分类」与「工具分类」间切换 */}
          <div className="guangdada-filters">
              {/* 热门筛选 */}
              <div className="guangdada-filter-row guangdada-filter-row--hot">
                <span className="guangdada-filter-label">热门筛选</span>
                <label className="guangdada-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.guangdadaNewAds}
                    onChange={(e) => handleChange('guangdadaNewAds', e.target.checked)}
                  />
                  <span>新广告</span>
                </label>
                <label className="guangdada-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.guangdadaNewAdvertiserFlag}
                    onChange={(e) => handleChange('guangdadaNewAdvertiserFlag', e.target.checked)}
                  />
                  <span>新广告主</span>
                </label>
                <div className="guangdada-filter-dropdown-wrap">
                  <select
                    value={formData.guangdadaMediaType}
                    onChange={(e) => handleChange('guangdadaMediaType', e.target.value)}
                    className="guangdada-filter-select"
                    aria-label="图片&视频"
                  >
                    <option value="">图片&amp;视频</option>
                    <option value="图片">图片</option>
                    <option value="视频">视频</option>
                    <option value="轮播">轮播</option>
                    <option value="HTML">HTML</option>
                  </select>
                </div>
                {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                  <div className="guangdada-filter-dropdown-wrap">
                    <select
                      value={formData.guangdadaTopCreative}
                      onChange={(e) => handleChange('guangdadaTopCreative', e.target.value)}
                      className="guangdada-filter-select"
                      aria-label="Top创意"
                    >
                      <option value="">Top创意</option>
                      <option value="人气值Top1%">人气值Top1%</option>
                      <option value="人气值Top10%">人气值Top10%</option>
                    </select>
                  </div>
                )}
                {/* 短剧、AI App 仅工具 tab 显示；电商/品牌与游戏一致不显示 */}
                {formData.guangdadaPrimaryTab === '工具' && (
                  <>
                    <label className="guangdada-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.guangdadaIsTheater}
                        onChange={(e) => handleChange('guangdadaIsTheater', e.target.checked)}
                      />
                      <span>短剧</span>
                    </label>
                    <label className="guangdada-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.guangdadaIsAiApp}
                        onChange={(e) => handleChange('guangdadaIsAiApp', e.target.checked)}
                      />
                      <span>AI App</span>
                    </label>
                  </>
                )}
              </div>

              {/* 游戏 / 工具分类：按主 Tab 切换，全部按钮 + 多选复选框 + 快速检索 */}
              {formData.guangdadaPrimaryTab === '游戏' && (
                <div className="guangdada-filter-row guangdada-filter-row--game">
                  <span className="guangdada-filter-label">游戏分类</span>
                  <div className="guangdada-tool-category-pills">
                    <button
                      type="button"
                      className={`guangdada-pill guangdada-pill-all ${(formData.guangdadaGameCategoryCodes || []).length === 0 ? 'active' : ''}`}
                      onClick={() => {
                        handleChange('guangdadaGameCategoryCodes', []);
                        handleChange('guangdadaGameCategories', []);
                      }}
                    >
                      <span>全 部</span>
                    </button>
                    {(() => {
                      const list = GUANGDADA_GAME_CATEGORIES_TREE;
                      return list.map((category) => {
                        const childValues = (category.children || []).map((ch) => ch.value);
                        const selectedCodes = (formData.guangdadaGameCategoryCodes || []).filter((c) => childValues.includes(c));
                        const hasSelected = selectedCodes.length > 0;
                        const selectedCount = selectedCodes.length;
                        const isOpen = gameCategoryDropdownOpen === category.name;
                        return (
                          <Dropdown
                            key={category.name}
                            trigger={['hover']}
                            open={isOpen}
                            onOpenChange={(open) => {
                              if (open) {
                                setGameCategoryDropdownOpen(category.name);
                                setGameCategoryLocalCodes((formData.guangdadaGameCategoryCodes || []).filter((c) => childValues.includes(c)));
                              } else {
                                setGameCategoryDropdownOpen(null);
                              }
                            }}
                            dropdownRender={() => {
                              const allSelected = childValues.length > 0 && childValues.every((v) => gameCategoryLocalCodes.includes(v));
                              const indeterminate = gameCategoryLocalCodes.some((c) => childValues.includes(c)) && !allSelected;
                              return (
                                <div className="guangdada-tool-category-dropdown">
                                  <div className="guangdada-tool-category-dropdown-title">
                                    <Checkbox
                                      checked={allSelected}
                                      indeterminate={indeterminate}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setGameCategoryLocalCodes((prev) => [...new Set([...prev, ...childValues])]);
                                        } else {
                                          setGameCategoryLocalCodes((prev) => prev.filter((c) => !childValues.includes(c)));
                                        }
                                      }}
                                    />
                                    <span>{category.name}</span>
                                  </div>
                                  <div className="guangdada-tool-category-dropdown-content">
                                    <Checkbox.Group
                                      value={gameCategoryLocalCodes}
                                      onChange={(vals) => setGameCategoryLocalCodes(vals || [])}
                                      options={(category.children || []).map((ch) => ({ value: ch.value, label: ch.label }))}
                                      className="guangdada-tool-category-checkbox-group"
                                    />
                                  </div>
                                  <div className="guangdada-tool-category-dropdown-footer">
                                    <Button size="small" onClick={() => setGameCategoryDropdownOpen(null)}>取 消</Button>
                                    <Button
                                      type="primary"
                                      size="small"
                                      onClick={() => {
                                        const rest = (formData.guangdadaGameCategoryCodes || []).filter((c) => !childValues.includes(c));
                                        handleChange('guangdadaGameCategoryCodes', [...rest, ...gameCategoryLocalCodes]);
                                        setGameCategoryDropdownOpen(null);
                                      }}
                                    >
                                      确 定
                                    </Button>
                                  </div>
                                </div>
                              );
                            }}
                          >
                            <button
                              type="button"
                              className={`guangdada-pill ${hasSelected ? 'active' : ''}`}
                              onClick={(e) => {
                                e.preventDefault();
                                const allSelectedForCategory = childValues.length > 0 && childValues.every((v) => (formData.guangdadaGameCategoryCodes || []).includes(v));
                                const rest = (formData.guangdadaGameCategoryCodes || []).filter((c) => !childValues.includes(c));
                                handleChange('guangdadaGameCategoryCodes', allSelectedForCategory ? rest : [...rest, ...childValues]);
                              }}
                            >
                              <span>{category.name}{(selectedCount > 0 && selectedCount < childValues.length) ? `(${selectedCount})` : ''}</span>
                            </button>
                          </Dropdown>
                        );
                      });
                    })()}
                    <div className="guangdada-category-search-wrap guangdada-category-search-pill">
                      <span className="guangdada-filter-search-icon" aria-hidden="true">🔍</span>
                      <input
                        type="search"
                        className="guangdada-filter-search guangdada-category-search-input"
                        placeholder="快速检索一级或二级分类"
                        value={formData.guangdadaGameCategorySearch}
                        onChange={(e) => handleChange('guangdadaGameCategorySearch', e.target.value)}
                        onFocus={() => setGameCategorySearchFocused(true)}
                        onBlur={() => setTimeout(() => setGameCategorySearchFocused(false), 150)}
                        autoComplete="off"
                      />
                      {(gameCategorySearchFocused || (formData.guangdadaGameCategorySearch || '').trim()) && (() => {
                        const searchTrimmed = (formData.guangdadaGameCategorySearch || '').trim();
                        const suggestions = getCategorySearchSuggestions(GUANGDADA_GAME_CATEGORIES_TREE, searchTrimmed);
                        if (suggestions.length === 0) return null;
                        return (
                          <ul className="guangdada-category-search-dropdown" onMouseDown={(e) => e.preventDefault()}>
                            {suggestions.map((item, idx) => (
                              <li
                                key={item.type === 'sub' ? item.value : item.categoryName + idx}
                                className="guangdada-category-search-item"
                                onMouseDown={() => {
                                  if (item.type === 'category') {
                                    const cat = GUANGDADA_GAME_CATEGORIES_TREE.find((x) => x.name === item.categoryName);
                                    const childValues = (cat && cat.children) ? cat.children.map((ch) => ch.value) : [];
                                    const rest = (formData.guangdadaGameCategoryCodes || []).filter((c) => !childValues.includes(c));
                                    handleChange('guangdadaGameCategoryCodes', [...rest, ...childValues]);
                                    handleChange('guangdadaGameCategorySearch', '');
                                  } else {
                                    const next = [...(formData.guangdadaGameCategoryCodes || [])];
                                    if (!next.includes(item.value)) next.push(item.value);
                                    handleChange('guangdadaGameCategoryCodes', next);
                                    handleChange('guangdadaGameCategorySearch', '');
                                  }
                                }}
                              >
                                {item.displayName}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
              {formData.guangdadaPrimaryTab === '工具' && (
                <div className="guangdada-filter-row guangdada-filter-row--game">
                  <span className="guangdada-filter-label">工具分类</span>
                  <div className="guangdada-tool-category-pills">
                    <button
                      type="button"
                      className={`guangdada-pill guangdada-pill-all ${(formData.guangdadaToolCategoryCodes || []).length === 0 ? 'active' : ''}`}
                      onClick={() => {
                        handleChange('guangdadaToolCategoryCodes', []);
                        handleChange('guangdadaToolCategories', []);
                      }}
                    >
                      <span>全 部</span>
                    </button>
                    {(() => {
                      const list = GUANGDADA_TOOL_CATEGORIES_TREE;
                      return list.map((category) => {
                      const childValues = (category.children || []).map((ch) => ch.value);
                      const selectedCodes = (formData.guangdadaToolCategoryCodes || []).filter((c) => childValues.includes(c));
                      const hasSelected = selectedCodes.length > 0;
                      const selectedCount = selectedCodes.length;
                      const isOpen = toolCategoryDropdownOpen === category.name;
                      return (
                        <Dropdown
                          key={category.name}
                          trigger={['hover']}
                          open={isOpen}
                          onOpenChange={(open) => {
                            if (open) {
                              setToolCategoryDropdownOpen(category.name);
                              setToolCategoryLocalCodes((formData.guangdadaToolCategoryCodes || []).filter((c) => childValues.includes(c)));
                            } else {
                              setToolCategoryDropdownOpen(null);
                            }
                          }}
                          dropdownRender={() => {
                            const allSelected = childValues.length > 0 && childValues.every((v) => toolCategoryLocalCodes.includes(v));
                            const indeterminate = toolCategoryLocalCodes.some((c) => childValues.includes(c)) && !allSelected;
                            return (
                              <div className="guangdada-tool-category-dropdown">
                                <div className="guangdada-tool-category-dropdown-title">
                                  <Checkbox
                                    checked={allSelected}
                                    indeterminate={indeterminate}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setToolCategoryLocalCodes((prev) => [...new Set([...prev, ...childValues])]);
                                      } else {
                                        setToolCategoryLocalCodes((prev) => prev.filter((c) => !childValues.includes(c)));
                                      }
                                    }}
                                  />
                                  <span>{category.name}</span>
                                </div>
                                <div className="guangdada-tool-category-dropdown-content">
                                  <Checkbox.Group
                                    value={toolCategoryLocalCodes}
                                    onChange={(vals) => setToolCategoryLocalCodes(vals || [])}
                                    options={(category.children || []).map((ch) => ({ value: ch.value, label: ch.label }))}
                                    className="guangdada-tool-category-checkbox-group"
                                  />
                                </div>
                                <div className="guangdada-tool-category-dropdown-footer">
                                  <Button size="small" onClick={() => setToolCategoryDropdownOpen(null)}>取 消</Button>
                                  <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => {
                                      const rest = (formData.guangdadaToolCategoryCodes || []).filter((c) => !childValues.includes(c));
                                      handleChange('guangdadaToolCategoryCodes', [...rest, ...toolCategoryLocalCodes]);
                                      setToolCategoryDropdownOpen(null);
                                    }}
                                  >
                                    确 定
                                  </Button>
                                </div>
                              </div>
                            );
                          }}
                        >
                          <button
                            type="button"
                            className={`guangdada-pill ${hasSelected ? 'active' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              const allSelectedForCategory = childValues.length > 0 && childValues.every((v) => (formData.guangdadaToolCategoryCodes || []).includes(v));
                              const rest = (formData.guangdadaToolCategoryCodes || []).filter((c) => !childValues.includes(c));
                              handleChange('guangdadaToolCategoryCodes', allSelectedForCategory ? rest : [...rest, ...childValues]);
                            }}
                          >
                            <span>{category.name}{(selectedCount > 0 && selectedCount < childValues.length) ? `(${selectedCount})` : ''}</span>
                          </button>
                        </Dropdown>
                      );
                    });
                    })()}
                    <div className="guangdada-category-search-wrap guangdada-category-search-pill">
                      <span className="guangdada-filter-search-icon" aria-hidden="true">🔍</span>
                      <input
                        type="search"
                        className="guangdada-filter-search guangdada-category-search-input"
                        placeholder="快速检索一级或二级分类"
                        value={formData.guangdadaToolCategorySearch}
                        onChange={(e) => handleChange('guangdadaToolCategorySearch', e.target.value)}
                        onFocus={() => setToolCategorySearchFocused(true)}
                        onBlur={() => setTimeout(() => setToolCategorySearchFocused(false), 150)}
                        autoComplete="off"
                      />
                      {(toolCategorySearchFocused || (formData.guangdadaToolCategorySearch || '').trim()) && (() => {
                        const searchTrimmed = (formData.guangdadaToolCategorySearch || '').trim();
                        const suggestions = getCategorySearchSuggestions(GUANGDADA_TOOL_CATEGORIES_TREE, searchTrimmed);
                        if (suggestions.length === 0) return null;
                        return (
                          <ul className="guangdada-category-search-dropdown" onMouseDown={(e) => e.preventDefault()}>
                            {suggestions.map((item, idx) => (
                              <li
                                key={item.type === 'sub' ? item.value : item.categoryName + idx}
                                className="guangdada-category-search-item"
                                onMouseDown={() => {
                                  if (item.type === 'category') {
                                    const cat = GUANGDADA_TOOL_CATEGORIES_TREE.find((x) => x.name === item.categoryName);
                                    const childValues = (cat && cat.children) ? cat.children.map((ch) => ch.value) : [];
                                    const rest = (formData.guangdadaToolCategoryCodes || []).filter((c) => !childValues.includes(c));
                                    handleChange('guangdadaToolCategoryCodes', [...rest, ...childValues]);
                                    handleChange('guangdadaToolCategorySearch', '');
                                  } else {
                                    const next = [...(formData.guangdadaToolCategoryCodes || [])];
                                    if (!next.includes(item.value)) next.push(item.value);
                                    handleChange('guangdadaToolCategoryCodes', next);
                                    handleChange('guangdadaToolCategorySearch', '');
                                  }
                                }}
                              >
                                {item.displayName}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* 电商/品牌：网站类型（在渠道上方），交互类似工具分类 + 更多弹层 */}
              {formData.guangdadaPrimaryTab === '电商/品牌' && (
                <div className="guangdada-filter-row guangdada-filter-row--game guangdada-website-type-row">
                  <span className="guangdada-filter-label">网站类型</span>
                  <div className="guangdada-tool-category-pills">
                    <button
                      type="button"
                      className={`guangdada-pill guangdada-pill-all ${(formData.guangdadaWebsiteTypeCodes || []).length === 0 ? 'active' : ''}`}
                      onClick={() => handleChange('guangdadaWebsiteTypeCodes', [])}
                    >
                      <span>全 部</span>
                    </button>
                    {GUANGDADA_INDEPENDENT_WEBSITE_PILLS.map(({ value: pillValue, label: pillLabel }) => {
                      const selected = formData.guangdadaWebsiteTypeCodes || [];
                      const isActive = selected.includes(pillValue);
                      return (
                        <button
                          key={pillValue}
                          type="button"
                          className={`guangdada-pill ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            if (isActive) {
                              handleChange('guangdadaWebsiteTypeCodes', selected.filter((c) => c !== pillValue));
                            } else {
                              handleChange('guangdadaWebsiteTypeCodes', [...selected, pillValue]);
                            }
                          }}
                        >
                          <span>{pillLabel}</span>
                        </button>
                      );
                    })}
                    <Popover
                      open={websiteTypePopoverOpen}
                      onOpenChange={setWebsiteTypePopoverOpen}
                      trigger="click"
                      placement="bottom"
                      title={
                        <div className="guangdada-website-type-popover-title">
                          <Input
                            placeholder="快速检索网站类型"
                            value={websiteTypeSearch}
                            onChange={(e) => setWebsiteTypeSearch(e.target.value)}
                            allowClear
                            className="guangdada-website-type-search"
                          />
                          <Button type="text" onClick={() => setWebsiteTypeLocalCodes(GUANGDADA_WEBSITE_TYPE_TREE.flatMap((c) => (c.children || []).map((ch) => ch.value)))}>
                            全部
                          </Button>
                        </div>
                      }
                      content={
                        <div className="guangdada-website-type-popover-inner" style={{ width: 800 }}>
                          <div className="guangdada-website-type-popover-body">
                            {GUANGDADA_WEBSITE_TYPE_TREE.map((category) => {
                              const q = (websiteTypeSearch || '').trim().toLowerCase();
                              const filtered = q
                                ? (category.children || []).filter((ch) => (ch.label || '').toLowerCase().includes(q) || (ch.value || '').toLowerCase().includes(q))
                                : (category.children || []);
                              if (filtered.length === 0) return null;
                              const allSelected = filtered.length > 0 && filtered.every((ch) => websiteTypeLocalCodes.includes(ch.value));
                              const indeterminate = filtered.some((ch) => websiteTypeLocalCodes.includes(ch.value)) && !allSelected;
                              return (
                                <div key={category.name} className="guangdada-website-type-category">
                                  <div className="guangdada-website-type-category-title">
                                    <label className="ant-checkbox-wrapper guangdada-website-type-category-label">
                                      <Checkbox
                                        checked={allSelected}
                                        indeterminate={indeterminate}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setWebsiteTypeLocalCodes((prev) => [...new Set([...prev, ...filtered.map((ch) => ch.value)])]);
                                          } else {
                                            setWebsiteTypeLocalCodes((prev) => prev.filter((c) => !filtered.some((ch) => ch.value === c)));
                                          }
                                        }}
                                      />
                                      <span>{category.name}</span>
                                    </label>
                                  </div>
                                  <Checkbox.Group
                                    value={websiteTypeLocalCodes}
                                    onChange={(vals) => setWebsiteTypeLocalCodes(vals || [])}
                                    className="guangdada-website-type-checkbox-group"
                                  >
                                    {filtered.map((ch) => (
                                      <label key={ch.value} className="ant-checkbox-wrapper checkbox-custom popover-checkbox guangdada-website-type-checkbox-item">
                                        <Checkbox value={ch.value} />
                                        <span>{ch.label}</span>
                                      </label>
                                    ))}
                                  </Checkbox.Group>
                                </div>
                              );
                            })}
                          </div>
                          <div className="guangdada-website-type-popover-footer">
                            <Button size="small" onClick={() => setWebsiteTypePopoverOpen(false)} className="guangdada-website-type-footer-btn">
                              取 消
                            </Button>
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => {
                                handleChange('guangdadaWebsiteTypeCodes', websiteTypeLocalCodes);
                                setWebsiteTypePopoverOpen(false);
                              }}
                              className="guangdada-website-type-footer-btn"
                            >
                              确 定
                            </Button>
                          </div>
                        </div>
                      }
                      overlayClassName="guangdada-website-type-popover-overlay"
                      getPopupContainer={(node) => node?.parentElement ?? document.body}
                    >
                      <button type="button" className="guangdada-filter-more guangdada-website-type-more">
                        {(formData.guangdadaWebsiteTypeCodes || []).length === 0
                          ? '更多'
                          : `已选 ${(formData.guangdadaWebsiteTypeCodes || []).length} 项`}
                        <span className="guangdada-search-type-arrow" aria-hidden>▼</span>
                      </button>
                    </Popover>
                  </div>
                </div>
              )}

              {/* 渠道（药丸形状，有子项的药丸交互同分类药丸） */}
              <div className="guangdada-filter-row guangdada-channel-pills-row">
                <span className="guangdada-filter-label">渠道</span>
                <div className="guangdada-filter-tags guangdada-channel-pills">
                  <button
                    type="button"
                    className={`guangdada-channel-pill guangdada-channel-pill-all ${(formData.guangdadaChannels || []).length === 0 ? 'active' : ''}`}
                    onClick={() => handleChange('guangdadaChannels', [])}
                  >
                    <span>全部</span>
                  </button>
                  {GUANGDADA_CHANNEL_TAGS.map(({ label, value, isFacebookFamily, isGoogleFamily }) => {
                    if (isGoogleFamily) {
                      const selectedChannels = (formData.guangdadaChannels || []).filter((c) => GOOGLE_FAMILY_VALUES.includes(c));
                      const hasSelected = selectedChannels.length > 0;
                      const selectedCount = selectedChannels.length;
                      const allSelectedForFamily = GOOGLE_FAMILY_VALUES.length > 0 && selectedCount === GOOGLE_FAMILY_VALUES.length;
                      return (
                        <Dropdown
                          key={value}
                          trigger={['hover']}
                          open={channelGoogleDropdownOpen}
                          onOpenChange={(open) => {
                            if (open) {
                              setChannelGoogleDropdownOpen(true);
                              setChannelGoogleLocalValues((formData.guangdadaChannels || []).filter((c) => GOOGLE_FAMILY_VALUES.includes(c)));
                            } else {
                              setChannelGoogleDropdownOpen(false);
                            }
                          }}
                          dropdownRender={() => {
                            const allSelected = GOOGLE_FAMILY_VALUES.length > 0 && GOOGLE_FAMILY_VALUES.every((v) => channelGoogleLocalValues.includes(v));
                            const indeterminate = channelGoogleLocalValues.some((c) => GOOGLE_FAMILY_VALUES.includes(c)) && !allSelected;
                            return (
                              <div className="guangdada-channel-google-dropdown guangdada-tool-category-dropdown">
                                <div className="guangdada-channel-google-dropdown-title">
                                  <label className="ant-checkbox-wrapper guangdada-channel-google-title-item">
                                    <Checkbox
                                      checked={allSelected}
                                      indeterminate={indeterminate}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setChannelGoogleLocalValues([...GOOGLE_FAMILY_VALUES]);
                                        } else {
                                          setChannelGoogleLocalValues([]);
                                        }
                                      }}
                                    />
                                    <span className="guangdada-channel-item-inner">
                                      <span className="net-icon net-icon-google" />
                                      <span>Google系</span>
                                    </span>
                                  </label>
                                </div>
                                <div className="guangdada-tool-category-dropdown-content">
                                  <Checkbox.Group
                                    value={channelGoogleLocalValues}
                                    onChange={(vals) => setChannelGoogleLocalValues(vals || [])}
                                    className="guangdada-tool-category-checkbox-group guangdada-channel-google-grid"
                                  >
                                    {GOOGLE_FAMILY_ITEMS.map((item) => (
                                      <label key={item.value} className="ant-checkbox-wrapper checkbox-custom popover-checkbox">
                                        <Checkbox value={item.value} />
                                        <span>
                                          <span className="guangdada-channel-item-inner">
                                            <span className={`net-icon ${item.iconClass}`} />
                                            <span className="guangdada-channel-item-label" title={item.label}>{item.label}</span>
                                          </span>
                                        </span>
                                      </label>
                                    ))}
                                  </Checkbox.Group>
                                </div>
                                <div className="guangdada-tool-category-dropdown-footer">
                                  <Button size="small" onClick={() => setChannelGoogleDropdownOpen(false)}>取 消</Button>
                                  <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => {
                                      const rest = (formData.guangdadaChannels || []).filter((c) => !GOOGLE_FAMILY_VALUES.includes(c));
                                      handleChange('guangdadaChannels', [...rest, ...channelGoogleLocalValues]);
                                      setChannelGoogleDropdownOpen(false);
                                    }}
                                  >
                                    确 定
                                  </Button>
                                </div>
                              </div>
                            );
                          }}
                        >
                          <button
                            type="button"
                            className={`guangdada-channel-pill ${hasSelected ? 'active' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              const allSelectedForCategory = GOOGLE_FAMILY_VALUES.length > 0 && GOOGLE_FAMILY_VALUES.every((v) => (formData.guangdadaChannels || []).includes(v));
                              const rest = (formData.guangdadaChannels || []).filter((c) => !GOOGLE_FAMILY_VALUES.includes(c));
                              handleChange('guangdadaChannels', allSelectedForCategory ? rest : [...rest, ...GOOGLE_FAMILY_VALUES]);
                            }}
                          >
                            <span>{label}{(selectedCount > 0 && selectedCount < GOOGLE_FAMILY_VALUES.length) ? `(${selectedCount})` : ''}</span>
                          </button>
                        </Dropdown>
                      );
                    }
                    if (isFacebookFamily) {
                      const selectedChannels = (formData.guangdadaChannels || []).filter((c) => FACEBOOK_FAMILY_VALUES.includes(c));
                      const hasSelected = selectedChannels.length > 0 || (formData.guangdadaChannels || []).includes('merge_facebook');
                      const selectedCount = selectedChannels.length;
                      return (
                        <Dropdown
                          key={value}
                          trigger={['hover']}
                          open={channelFacebookDropdownOpen}
                          onOpenChange={(open) => {
                            if (open) {
                              setChannelFacebookDropdownOpen(true);
                              setChannelFacebookLocalValues((formData.guangdadaChannels || []).filter((c) => FACEBOOK_FAMILY_VALUES.includes(c) || c === 'merge_facebook'));
                            } else {
                              setChannelFacebookDropdownOpen(false);
                            }
                          }}
                          dropdownRender={() => {
                            const allSelected = FACEBOOK_FAMILY_VALUES.length > 0 && FACEBOOK_FAMILY_VALUES.every((v) => channelFacebookLocalValues.includes(v));
                            const indeterminate = channelFacebookLocalValues.some((c) => FACEBOOK_FAMILY_VALUES.includes(c)) && !allSelected;
                            const isMergeChecked = channelFacebookLocalValues.includes('merge_facebook');
                            return (
                              <div className="guangdada-channel-facebook-dropdown guangdada-tool-category-dropdown">
                                <div className="guangdada-channel-facebook-dropdown-title">
                                  <label className={`ant-checkbox-wrapper guangdada-channel-facebook-title-item ${isMergeChecked ? 'guangdada-channel-facebook-item-disabled' : ''}`}>
                                    <Checkbox
                                      checked={allSelected}
                                      indeterminate={!isMergeChecked && indeterminate}
                                      disabled={isMergeChecked}
                                      onChange={(e) => {
                                        if (isMergeChecked) return;
                                        if (e.target.checked) {
                                          setChannelFacebookLocalValues([...FACEBOOK_FAMILY_VALUES]);
                                        } else {
                                          setChannelFacebookLocalValues([]);
                                        }
                                      }}
                                    />
                                    <span className="guangdada-channel-item-inner">
                                      <span className="net-icon net-icon-meta" />
                                      <span>Facebook系</span>
                                    </span>
                                  </label>
                                  <label className="ant-checkbox-wrapper guangdada-channel-facebook-title-item">
                                    <Checkbox
                                      checked={channelFacebookLocalValues.includes('merge_facebook')}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setChannelFacebookLocalValues([...FACEBOOK_FAMILY_VALUES, 'merge_facebook']);
                                        } else {
                                          setChannelFacebookLocalValues((prev) => prev.filter((c) => c !== 'merge_facebook'));
                                        }
                                      }}
                                    />
                                    <span>合并Facebook系</span>
                                  </label>
                                </div>
                                <div className="guangdada-tool-category-dropdown-content">
                                  <Checkbox.Group
                                    value={channelFacebookLocalValues.filter((c) => c !== 'merge_facebook')}
                                    onChange={(vals) => {
                                      if (channelFacebookLocalValues.includes('merge_facebook')) return;
                                      setChannelFacebookLocalValues(vals || []);
                                    }}
                                    className="guangdada-tool-category-checkbox-group guangdada-channel-facebook-grid"
                                  >
                                    {FACEBOOK_FAMILY_ITEMS.map((item) => (
                                      <label key={item.value} className={`ant-checkbox-wrapper checkbox-custom popover-checkbox ${isMergeChecked ? 'guangdada-channel-facebook-item-disabled' : ''}`}>
                                        <Checkbox value={item.value} disabled={isMergeChecked} />
                                        <span>
                                          <span className="guangdada-channel-item-inner">
                                            <span className={`net-icon ${item.iconClass}`} />
                                            <span className="guangdada-channel-item-label" title={item.label}>{item.label}</span>
                                          </span>
                                        </span>
                                      </label>
                                    ))}
                                  </Checkbox.Group>
                                </div>
                                <div className="guangdada-tool-category-dropdown-footer">
                                  <Button size="small" onClick={() => setChannelFacebookDropdownOpen(false)}>取 消</Button>
                                  <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => {
                                      const rest = (formData.guangdadaChannels || []).filter((c) => !FACEBOOK_FAMILY_VALUES.includes(c) && c !== 'merge_facebook');
                                      handleChange('guangdadaChannels', [...rest, ...channelFacebookLocalValues]);
                                      setChannelFacebookDropdownOpen(false);
                                    }}
                                  >
                                    确 定
                                  </Button>
                                </div>
                              </div>
                            );
                          }}
                        >
                          <button
                            type="button"
                            className={`guangdada-channel-pill ${hasSelected ? 'active' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              const allSelectedForCategory = FACEBOOK_FAMILY_VALUES.length > 0 && FACEBOOK_FAMILY_VALUES.every((v) => (formData.guangdadaChannels || []).includes(v));
                              const rest = (formData.guangdadaChannels || []).filter((c) => !FACEBOOK_FAMILY_VALUES.includes(c) && c !== 'merge_facebook');
                              handleChange('guangdadaChannels', allSelectedForCategory ? rest : [...rest, ...FACEBOOK_FAMILY_VALUES]);
                            }}
                          >
                            <span>{label}{(selectedCount > 0 && selectedCount < FACEBOOK_FAMILY_VALUES.length) ? `(${selectedCount})` : ''}</span>
                          </button>
                        </Dropdown>
                      );
                    }
                    const channels = formData.guangdadaChannels || [];
                    const isSelected = channels.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`guangdada-channel-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          if (isSelected) {
                            handleChange('guangdadaChannels', channels.filter((c) => c !== value));
                          } else {
                            handleChange('guangdadaChannels', [...channels, value]);
                          }
                        }}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                <Popover
                  open={channelPopoverOpen}
                  onOpenChange={setChannelPopoverOpen}
                  trigger="click"
                  placement="bottomLeft"
                  title={null}
                  content={
                    <GuangdadaChannelPopover
                      open={channelPopoverOpen}
                      value={formData.guangdadaChannels || []}
                      onChange={(arr) => handleChange('guangdadaChannels', arr)}
                      onConfirm={() => setChannelPopoverOpen(false)}
                      onCancel={() => setChannelPopoverOpen(false)}
                    />
                  }
                  overlayClassName="guangdada-channel-popover-overlay"
                  getPopupContainer={(node) => node?.parentElement ?? document.body}
                >
                  <button type="button" className="guangdada-filter-more">更多</button>
                </Popover>
              </div>

              {/* 广告信息：国家/地区、文案语言 */}
              <div className="guangdada-filter-row">
                <span className="guangdada-filter-label">广告信息</span>
                <div className="guangdada-filter-fields">
                  <Popover
                    open={countryPopoverOpen}
                    onOpenChange={setCountryPopoverOpen}
                    trigger="click"
                    placement="bottomLeft"
                    title={null}
                    content={
                      <GuangdadaCountryPopover
                        open={countryPopoverOpen}
                        value={formData.guangdadaCountry || []}
                        onChange={(arr) => handleChange('guangdadaCountry', arr)}
                        onlyInSelectedRegion={!!formData.guangdadaOnlyInSelectedRegion}
                        onOnlyInSelectedRegionChange={(v) => handleChange('guangdadaOnlyInSelectedRegion', v)}
                        onConfirm={() => setCountryPopoverOpen(false)}
                        onCancel={() => setCountryPopoverOpen(false)}
                      />
                    }
                    overlayClassName="guangdada-country-popover-overlay"
                    getPopupContainer={(node) => node?.parentElement ?? document.body}
                  >
                    <button
                      type="button"
                      className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                    >
                      {(formData.guangdadaCountry || []).length === 0
                        ? '国家/地区'
                        : `国家/地区（已选 ${formData.guangdadaCountry.length} 项）`}
                    </button>
                  </Popover>
                  <Popover
                    open={copyLangPopoverOpen}
                    onOpenChange={setCopyLangPopoverOpen}
                    trigger="click"
                    placement="bottomLeft"
                    title={null}
                    content={
                      <GuangdadaCopyLangPopover
                        open={copyLangPopoverOpen}
                        value={formData.guangdadaCopyLangs || []}
                        onChange={(arr) => handleChange('guangdadaCopyLangs', arr)}
                        onConfirm={() => setCopyLangPopoverOpen(false)}
                        onCancel={() => setCopyLangPopoverOpen(false)}
                      />
                    }
                    overlayClassName="guangdada-copy-lang-popover-overlay"
                    getPopupContainer={(node) => node?.parentElement ?? document.body}
                  >
                    <button
                      type="button"
                      className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                    >
                      {(formData.guangdadaCopyLangs || []).length === 0
                        ? '文案语言'
                        : `文案语言（已选 ${formData.guangdadaCopyLangs.length} 项）`}
                    </button>
                  </Popover>
                  <span className="guangdada-filter-inline-label">素材属性</span>
                  <Popover
                    open={materialAttrPopoverOpen}
                    onOpenChange={setMaterialAttrPopoverOpen}
                    trigger="click"
                    placement="bottomLeft"
                    title={null}
                    content={
                      <GuangdadaMaterialAttrPopover
                        open={materialAttrPopoverOpen}
                        value={formData.guangdadaCreativeAttr}
                        onChange={(v) => handleChange('guangdadaCreativeAttr', v)}
                        onConfirm={() => setMaterialAttrPopoverOpen(false)}
                        onCancel={() => setMaterialAttrPopoverOpen(false)}
                      />
                    }
                    overlayClassName="guangdada-material-attr-popover-overlay"
                    getPopupContainer={(node) => node?.parentElement ?? document.body}
                  >
                    <button
                      type="button"
                      className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                    >
                      {(() => {
                        const a = formData.guangdadaCreativeAttr || {};
                        const has =
                          (a.videoDuration && a.videoDuration !== '') ||
                          (a.size && a.size.length > 0) ||
                          (a.quality && a.quality.length > 0) ||
                          (a.resolution && a.resolution.length > 0) ||
                          (a.videoDuration === '-' && (a.videoDurationMin != null || a.videoDurationMax != null));
                        return has ? '素材规格（已设置）' : '素材规格';
                      })()}
                    </button>
                  </Popover>
                  {formData.guangdadaPrimaryTab === '游戏' && (
                    <div className="guangdada-filter-select-wrap">
                      <Popover
                        open={contentAttributesPopoverOpen}
                        onOpenChange={setContentAttributesPopoverOpen}
                        trigger="click"
                        placement="bottomLeft"
                        title={null}
                        content={
                          <GuangdadaContentAttributesPopover
                            open={contentAttributesPopoverOpen}
                            value={formData.guangdadaContentAttributes || []}
                            categories={contentAttributeCategories}
                            loading={contentAttributeLoading}
                            error={contentAttributeError}
                            onRetry={() => fetchGuangdadaContentAttributes(true)}
                            onChange={(arr) => handleChange('guangdadaContentAttributes', arr)}
                            onConfirm={() => setContentAttributesPopoverOpen(false)}
                            onCancel={() => setContentAttributesPopoverOpen(false)}
                          />
                        }
                        overlayClassName="guangdada-image-analysis-popover-overlay"
                        getPopupContainer={(node) => node?.parentElement ?? document.body}
                      >
                        <button
                          type="button"
                          className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                        >
                          {(formData.guangdadaContentAttributes || []).length === 0
                            ? '素材内容属性'
                            : `素材内容属性（已选 ${formData.guangdadaContentAttributes.length} 项）`}
                        </button>
                      </Popover>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={`guangdada-filter-advanced ${advancedFilterOpen ? 'active' : ''}`}
                  onClick={() => setAdvancedFilterOpen((v) => !v)}
                >
                  高级筛选
                </button>
              </div>

              {/* 高级筛选项：点击高级筛选后在下方展示；选择「工具」时不重复广告信息/素材属性（已在上一行） */}
              {advancedFilterOpen && (
                <div className="guangdada-advanced-filters-panel">
                  <div className={`guangdada-advanced-row${formData.guangdadaPrimaryTab === '电商/品牌' ? ' guangdada-advanced-row--ecom' : ''}`}>
                    <div className="guangdada-advanced-group">
                      <span className="guangdada-advanced-label">广告主</span>
                      <div className="guangdada-advanced-fields">
                        {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                        <Select
                          placeholder="广告主系统"
                          allowClear
                          value={formData.guangdadaAdvertiserSystem || undefined}
                          onChange={(v) => handleChange('guangdadaAdvertiserSystem', v ?? '')}
                          options={GUANGDADA_ADVERTISER_SYSTEM_OPTIONS}
                          className="guangdada-advanced-select"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        />
                        )}
                        {formData.guangdadaPrimaryTab === '游戏' && (
                          <>
                            <div className="guangdada-filter-select-wrap">
                              <Popover
                                open={coreTrackPopoverOpen}
                                onOpenChange={setCoreTrackPopoverOpen}
                                trigger="click"
                                placement="bottomLeft"
                                title={null}
                                content={
                                  <GuangdadaCoreTrackPopover
                                    open={coreTrackPopoverOpen}
                                    value={formData.guangdadaCoreTrack || []}
                                    onChange={(arr) => handleChange('guangdadaCoreTrack', arr)}
                                    onConfirm={() => setCoreTrackPopoverOpen(false)}
                                    onCancel={() => setCoreTrackPopoverOpen(false)}
                                  />
                                }
                                overlayClassName="guangdada-core-track-popover-overlay"
                                getPopupContainer={(node) => node?.parentElement ?? document.body}
                              >
                                <button
                                  type="button"
                                  className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                                >
                                  {(formData.guangdadaCoreTrack || []).length === 0
                                    ? '核心赛道/玩法/主题/IP'
                                    : `核心赛道/玩法/主题/IP（已选 ${formData.guangdadaCoreTrack.length} 项）`}
                                </button>
                              </Popover>
                            </div>
                            <Cascader
                              placeholder="预约广告"
                              allowClear
                              value={(formData.guangdadaPreorderAd || []).length ? formData.guangdadaPreorderAd : undefined}
                              onChange={(v) => handleChange('guangdadaPreorderAd', v ?? [])}
                              options={GUANGDADA_PREORDER_CASCADER_OPTIONS}
                              className="guangdada-advanced-select guangdada-advanced-cascader"
                              getPopupContainer={(node) => node?.parentElement ?? document.body}
                              displayRender={(labels) => labels.join(' / ')}
                            />
                          </>
                        )}
                        {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                          <Select
                            placeholder="内购/非内购"
                            allowClear
                            value={formData.guangdadaMonetizationType || undefined}
                            onChange={(v) => handleChange('guangdadaMonetizationType', v ?? '')}
                            options={GUANGDADA_MONETIZATION_OPTIONS}
                            className="guangdada-advanced-select"
                            getPopupContainer={(node) => node?.parentElement ?? document.body}
                          />
                        )}
                      </div>
                    </div>
                    <div className="guangdada-advanced-group">
                      <span className="guangdada-advanced-label">受众目标</span>
                      <div className="guangdada-advanced-fields">
                        {(() => {
                          const fbChannels = (formData.guangdadaChannels || []).filter((c) =>
                            ['facebook', 'fb_mini_game'].includes(c)
                          );
                          const fbAudienceEnabled = fbChannels.length > 0;
                          const fbAudienceValue = formData.guangdadaFbAudience || { gender: [], age: [] };
                          const fbAudienceCount =
                            (fbAudienceValue.gender?.length || 0) + (fbAudienceValue.age?.length || 0);
                          const triggerBtn = (
                            <button
                              type="button"
                              className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                              disabled={!fbAudienceEnabled}
                            >
                              {fbAudienceCount === 0
                                ? 'FB受众画像'
                                : `FB受众画像（已选 ${fbAudienceCount} 项）`}
                            </button>
                          );
                          if (!fbAudienceEnabled) {
                            return (
                              <Tooltip
                                title="仅选择Facebook系平台时可用，且仅对投放至欧盟地区的创意生效"
                                getPopupContainer={(node) => node?.parentElement ?? document.body}
                              >
                                <span className="guangdada-filter-trigger-disabled" style={{ display: 'inline-block' }}>{triggerBtn}</span>
                              </Tooltip>
                            );
                          }
                          return (
                            <Popover
                              open={fbAudiencePopoverOpen}
                              onOpenChange={setFbAudiencePopoverOpen}
                              trigger="click"
                              placement="bottomLeft"
                              title="FB受众画像"
                              content={
                                <GuangdadaFbAudiencePopover
                                  open={fbAudiencePopoverOpen}
                                  value={fbAudienceValue}
                                  onChange={(v) =>
                                    handleChange('guangdadaFbAudience', {
                                      gender: v?.gender || [],
                                      age: v?.age || [],
                                    })
                                  }
                                  onConfirm={() => setFbAudiencePopoverOpen(false)}
                                  onCancel={() => setFbAudiencePopoverOpen(false)}
                                />
                              }
                              overlayClassName="guangdada-fb-audience-popover-overlay"
                              getPopupContainer={(node) => node?.parentElement ?? document.body}
                            >
                              {triggerBtn}
                            </Popover>
                          );
                        })()}
                        <Select
                          placeholder="营销目标(CTA)"
                          allowClear
                          value={formData.guangdadaCta || undefined}
                          onChange={(v) => handleChange('guangdadaCta', v ?? '')}
                          options={GUANGDADA_CTA_OPTIONS}
                          className="guangdada-advanced-select"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="guangdada-advanced-row">
                    <div className="guangdada-advanced-group">
                      <span className="guangdada-advanced-label">数据指标</span>
                      <div className="guangdada-advanced-fields">
                        {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                        <Popover
                          open={fbSpendPopoverOpen}
                          onOpenChange={setFbSpendPopoverOpen}
                          trigger="click"
                          placement="bottomLeft"
                          title={null}
                          content={
                            <GuangdadaFbSpendPopover
                              open={fbSpendPopoverOpen}
                              value={formData.guangdadaFbSpend || { value: '', min: undefined, max: undefined }}
                              onChange={(v) =>
                                handleChange('guangdadaFbSpend', {
                                  value: v?.value ?? '',
                                  min: v?.min,
                                  max: v?.max,
                                })
                              }
                              onConfirm={() => setFbSpendPopoverOpen(false)}
                              onCancel={() => setFbSpendPopoverOpen(false)}
                            />
                          }
                          overlayClassName="guangdada-fb-spend-popover-overlay"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        >
                          <button
                            type="button"
                            className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                          >
                            {getFbSpendDisplayText(formData.guangdadaFbSpend) || 'FB广告花费'}
                          </button>
                        </Popover>
                        )}
                        <Popover
                          open={socialEngagementPopoverOpen}
                          onOpenChange={setSocialEngagementPopoverOpen}
                          trigger="click"
                          placement="bottomLeft"
                          title={null}
                          content={
                            <GuangdadaSocialEngagementPopover
                              open={socialEngagementPopoverOpen}
                              value={formData.guangdadaSocialEngagement || { like: { value: '', min: undefined, max: undefined }, comment: { value: '', min: undefined, max: undefined }, share: { value: '', min: undefined, max: undefined } }}
                              onChange={(v) =>
                                handleChange('guangdadaSocialEngagement', {
                                  like: v?.like ?? { value: '', min: undefined, max: undefined },
                                  comment: v?.comment ?? { value: '', min: undefined, max: undefined },
                                  share: v?.share ?? { value: '', min: undefined, max: undefined },
                                })
                              }
                              onConfirm={() => setSocialEngagementPopoverOpen(false)}
                              onCancel={() => setSocialEngagementPopoverOpen(false)}
                            />
                          }
                          overlayClassName="guangdada-social-engagement-popover-overlay"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        >
                          <button
                            type="button"
                            className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                          >
                            {hasSocialEngagementSet(formData.guangdadaSocialEngagement) ? '社媒互动（已设置）' : '社媒互动'}
                          </button>
                        </Popover>
                        {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                        <Popover
                          open={cpiPopoverOpen}
                          onOpenChange={setCpiPopoverOpen}
                          trigger="click"
                          placement="bottomLeft"
                          title="CPI信息"
                          content={
                            <GuangdadaCpiPopover
                              open={cpiPopoverOpen}
                              value={formData.guangdadaCpi || { cpiRange: [], currency: [] }}
                              onChange={(v) =>
                                handleChange('guangdadaCpi', {
                                  cpiRange: v?.cpiRange ?? [],
                                  currency: v?.currency ?? [],
                                })
                              }
                              onConfirm={() => setCpiPopoverOpen(false)}
                              onCancel={() => setCpiPopoverOpen(false)}
                            />
                          }
                          overlayClassName="guangdada-cpi-popover-overlay"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        >
                          <button
                            type="button"
                            className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                          >
                            {(() => {
                              const n = getCpiSelectedCount(formData.guangdadaCpi);
                              return n === 0 ? 'CPI信息' : `CPI信息（已选 ${n} 项）`;
                            })()}
                          </button>
                        </Popover>
                        )}
                      </div>
                    </div>
                    <div className="guangdada-advanced-group">
                      <span className="guangdada-advanced-label">投放属性</span>
                      <div className="guangdada-advanced-fields">
                        <Cascader
                          placeholder="落地页类型"
                          allowClear
                          value={(formData.guangdadaLandingPageType || []).length ? formData.guangdadaLandingPageType : undefined}
                          onChange={(v) => handleChange('guangdadaLandingPageType', v ?? [])}
                          options={GUANGDADA_LANDING_PAGE_CASCADER_OPTIONS}
                          className="guangdada-advanced-select guangdada-advanced-cascader"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                          displayRender={(labels) => labels.join(' / ')}
                        />
                        <Select
                          placeholder="创意形式"
                          allowClear
                          value={formData.guangdadaCreativeForm || undefined}
                          onChange={(v) => handleChange('guangdadaCreativeForm', v ?? '')}
                          options={GUANGDADA_CREATIVE_FORM_OPTIONS}
                          className="guangdada-advanced-select"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        />
                        {(() => {
                          const channels = formData.guangdadaChannels || [];
                          const placementEnabled = channels.length === 1 && (channels[0] === 'admob' || channels[0] === 'youtube');
                          const placementOptions = channels[0] === 'youtube' ? GUANGDADA_PLACEMENT_YOUTUBE : GUANGDADA_PLACEMENT_ADMOB;
                          const placementPlatformName = channels[0] === 'youtube' ? 'Youtube' : 'Admob';
                          const placementCols = channels[0] === 'youtube' ? 6 : 5;
                          const placementContentWidth = channels[0] === 'youtube' ? 800 : 666;
                          const placementSelected = Array.isArray(formData.guangdadaPlacement) ? formData.guangdadaPlacement : (formData.guangdadaPlacement ? [String(formData.guangdadaPlacement)] : []);
                          const placementCount = placementSelected.length;
                          const triggerBtn = (
                            <button
                              type="button"
                              className="guangdada-filter-select guangdada-filter-select--field guangdada-filter-select-trigger"
                              disabled={!placementEnabled}
                            >
                              {placementCount === 0 ? '广告版位' : `广告版位（已选 ${placementCount} 项）`}
                            </button>
                          );
                          if (!placementEnabled) {
                            return (
                              <Tooltip
                                title="仅在选择一个渠道且为 Admob 或 YouTube 时可用"
                                getPopupContainer={(node) => node?.parentElement ?? document.body}
                              >
                                <span className="guangdada-filter-trigger-disabled" style={{ display: 'inline-block' }}>{triggerBtn}</span>
                              </Tooltip>
                            );
                          }
                          const filteredPlacementOptions = (placementSearch || '').trim()
                            ? placementOptions.filter((o) => (o.label || '').toLowerCase().includes((placementSearch || '').trim().toLowerCase()))
                            : placementOptions;
                          const allPlacementSelected = filteredPlacementOptions.length > 0 && filteredPlacementOptions.every((o) => placementLocalValues.includes(o.value));
                          const placementIndeterminate = filteredPlacementOptions.some((o) => placementLocalValues.includes(o.value)) && !allPlacementSelected;
                          return (
                            <Popover
                              open={placementPopoverOpen}
                              onOpenChange={(open) => {
                                setPlacementPopoverOpen(open);
                                if (!open) setPlacementSearch('');
                              }}
                              trigger="click"
                              placement="bottom"
                              title={
                                <div className="guangdada-placement-popover-title">
                                  <Input
                                    placeholder="检索广告版位"
                                    value={placementSearch}
                                    onChange={(e) => setPlacementSearch(e.target.value)}
                                    allowClear
                                    className="guangdada-placement-popover-search"
                                  />
                                  <Button type="text" onClick={() => setPlacementLocalValues(placementOptions.map((o) => o.value))}>
                                    全部
                                  </Button>
                                </div>
                              }
                              content={
                                <div className="guangdada-placement-popover-inner" style={{ width: placementContentWidth }}>
                                  <div className="guangdada-placement-popover-body">
                                    <div className="guangdada-placement-popover-category">
                                      <div className="guangdada-placement-popover-category-header">
                                        <label className="ant-checkbox-wrapper guangdada-placement-popover-category-label">
                                          <Checkbox
                                            checked={allPlacementSelected}
                                            indeterminate={placementIndeterminate}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setPlacementLocalValues((prev) => [...new Set([...prev, ...filteredPlacementOptions.map((o) => o.value)])]);
                                              } else {
                                                setPlacementLocalValues((prev) => prev.filter((v) => !filteredPlacementOptions.some((o) => o.value === v)));
                                              }
                                            }}
                                          />
                                          <span>{placementPlatformName}</span>
                                        </label>
                                      </div>
                                      <Checkbox.Group
                                        value={placementLocalValues}
                                        onChange={(vals) => setPlacementLocalValues(vals || [])}
                                        className={`guangdada-placement-popover-grid guangdada-placement-popover-grid--cols-${placementCols}`}
                                      >
                                        {filteredPlacementOptions.map((o) => (
                                          <label key={o.value} className="ant-checkbox-wrapper checkbox-custom popover-checkbox guangdada-placement-popover-item">
                                            <Checkbox value={o.value} />
                                            <span className="guangdada-placement-popover-item-label">{o.label}</span>
                                          </label>
                                        ))}
                                      </Checkbox.Group>
                                    </div>
                                  </div>
                                  <div className="guangdada-placement-popover-footer">
                                    <Button size="small" onClick={() => setPlacementPopoverOpen(false)} className="guangdada-placement-popover-footer-btn">
                                      取 消
                                    </Button>
                                    <Button
                                      type="primary"
                                      size="small"
                                      className="guangdada-placement-popover-footer-btn"
                                      onClick={() => {
                                        handleChange('guangdadaPlacement', placementLocalValues);
                                        setPlacementPopoverOpen(false);
                                      }}
                                    >
                                      确 定
                                    </Button>
                                  </div>
                                </div>
                              }
                              overlayClassName="guangdada-placement-popover-overlay"
                              getPopupContainer={(node) => node?.parentElement ?? document.body}
                            >
                              {triggerBtn}
                            </Popover>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="guangdada-advanced-row">
                    <div className="guangdada-advanced-group">
                      <span className="guangdada-advanced-label">其它</span>
                      <div className="guangdada-advanced-fields">
                        {formData.guangdadaPrimaryTab !== '电商/品牌' && (
                        <div className="guangdada-filter-select-wrap">
                          <Cascader
                            placeholder="链接类型"
                            allowClear
                            value={(formData.guangdadaLinkType || []).length ? formData.guangdadaLinkType : undefined}
                            onChange={(v) => handleChange('guangdadaLinkType', v ?? [])}
                            options={GUANGDADA_LINK_TYPE_CASCADER_OPTIONS}
                            className="guangdada-advanced-select guangdada-advanced-cascader"
                            getPopupContainer={(node) => node?.parentElement ?? document.body}
                            displayRender={(labels) => labels.join(' / ')}
                          />
                        </div>
                        )}
                        <Select
                          placeholder="重投广告"
                          allowClear
                          value={formData.guangdadaRetargeting || undefined}
                          onChange={(v) => handleChange('guangdadaRetargeting', v ?? '')}
                          options={GUANGDADA_RETARGETING_OPTIONS}
                          className="guangdada-advanced-select"
                          getPopupContainer={(node) => node?.parentElement ?? document.body}
                        />
                        {formData.guangdadaPrimaryTab === '电商/品牌' ? (
                          <>
                            <label className="guangdada-advanced-checkbox">
                              <Checkbox
                                checked={formData.guangdadaCodFlag === 1}
                                onChange={(e) => handleChange('guangdadaCodFlag', e.target.checked ? 1 : 0)}
                              />
                              <span>货到付款</span>
                            </label>
                            <label className="guangdada-advanced-checkbox">
                              <Checkbox
                                checked={formData.guangdadaSearchArbitrageFlag === 1}
                                onChange={(e) => handleChange('guangdadaSearchArbitrageFlag', e.target.checked ? 1 : 0)}
                              />
                              <span>搜索套利</span>
                            </label>
                          </>
                        ) : (
                          <>
                            <label className="guangdada-advanced-checkbox">
                              <Checkbox
                                checked={!!formData.guangdadaIncludePageInfo}
                                onChange={(e) => handleChange('guangdadaIncludePageInfo', e.target.checked)}
                              />
                              <span>包含主页信息</span>
                            </label>
                            <label className="guangdada-advanced-checkbox">
                              <Checkbox
                                checked={!!formData.guangdadaEndCard}
                                onChange={(e) => handleChange('guangdadaEndCard', e.target.checked)}
                              />
                              <span>结束卡片</span>
                            </label>
                          </>
                        )}
                        <label className="guangdada-advanced-checkbox">
                          <Checkbox
                            checked={!!formData.guangdadaViolationAd}
                            onChange={(e) => handleChange('guangdadaViolationAd', e.target.checked)}
                          />
                          <span>违规广告</span>
                        </label>
                        <label className="guangdada-advanced-checkbox">
                          <Checkbox
                            checked={!!formData.guangdadaHasCustomStorePage}
                            onChange={(e) => handleChange('guangdadaHasCustomStorePage', e.target.checked)}
                          />
                          <span>自定义商店页</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* 筛选项：表单筛选 Tag + 已选广告主 + 已屏蔽广告主，统一在「查询」按钮上方 */}
              {(() => {
                const filterTags = getGuangdadaFilterTags(formData);
                const hasSelectedAdv = (formData.guangdadaSearchCategory === '广告信息' || formData.guangdadaSearchCategory === '素材内容') && selectedAdvertisers.length > 0;
                const hasBlockedAdv = guangdadaBlockedAdvertisers.length > 0;
                const showMultimodalSelected =
                  formData.guangdadaSearchCategory === '素材内容' &&
                  formData.guangdadaPrimaryTab !== '电商/品牌' &&
                  !!guangdadaMultimodalPreviewUrl;
                const showMultimodalLink =
                  formData.guangdadaSearchCategory === '素材内容' &&
                  formData.guangdadaPrimaryTab !== '电商/品牌' &&
                  !!guangdadaMultimodalResourceLink;
                const showMultimodalPreviewOnly = showMultimodalSelected && !showMultimodalLink;
                const multimodalTitle = guangdadaMultimodalPreviewType === 'video' ? '搜素视频' : '搜索图片';
                if (filterTags.length === 0 && !hasSelectedAdv && !hasBlockedAdv && !showMultimodalPreviewOnly && !showMultimodalLink) return null;
                return (
                  <div className="guangdada-filter-tags-section">
                    <span className="guangdada-filter-tags-title">筛选项</span>
                    <div className="guangdada-filter-tags-row">
                      {showMultimodalLink && (
                        <Tooltip title={guangdadaMultimodalResourceLink} placement="top">
                          <Tag
                            closable
                            onClose={(e) => {
                              e.preventDefault();
                              const merged = {
                                ...formDataRef.current,
                                keyWord: '',
                                guangdadaMultimodalRequest: null,
                              };
                              setFormData(merged);
                              onClearGuangdadaMultimodalSelected?.();
                            }}
                            className="guangdada-filter-tag guangdada-multimodal-link-tag"
                          >
                            <span className="guangdada-multimodal-link-text">
                              资源链接：{guangdadaMultimodalResourceLink}
                            </span>
                          </Tag>
                        </Tooltip>
                      )}
                      {showMultimodalPreviewOnly && (
                        <Tag
                          closable
                          onClose={(e) => {
                            e.preventDefault();
                            const merged = {
                              ...formDataRef.current,
                              keyWord: '',
                              guangdadaMultimodalRequest: null,
                            };
                            setFormData(merged);
                            onClearGuangdadaMultimodalSelected?.();
                          }}
                          className="guangdada-filter-tag guangdada-multimodal-selected-tag"
                        >
                          <Tooltip title={multimodalTitle} placement="top">
                            <div className="guangdada-multimodal-selected-cell guangdada-multimodal-selected-cell--in-filter-tags">
                              <img
                                src={guangdadaMultimodalPreviewUrl}
                                alt="多模态搜索预览"
                                className="guangdada-multimodal-selected-thumb"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </Tooltip>
                        </Tag>
                      )}
                      {filterTags.map((t) => (
                        <Tooltip
                          key={t.fieldKey}
                          title={<span style={{ whiteSpace: 'pre-line' }}>{t.fullText}</span>}
                          placement="top"
                          overlayInnerStyle={{ maxHeight: 350, overflowY: 'auto', maxWidth: 560 }}
                        >
                          <Tag
                            closable
                            onClose={(e) => {
                              e.preventDefault();
                              handleChange(t.fieldKey, t.defaultValue);
                            }}
                            className="guangdada-filter-tag"
                          >
                            {t.label}：{t.summaryText}
                          </Tag>
                        </Tooltip>
                      ))}
                      {hasSelectedAdv && selectedAdvertisers.map((adv, idx) => (
                        <Tag
                          key={`selected-adv-${idx}-${adv.domain || adv.cross_app_id || adv.advertiser_name || ''}`}
                          closable
                          onClose={(e) => { e.preventDefault(); removeSelectedAdvertiser(adv); }}
                          className="guangdada-filter-tag guangdada-filter-tag--advertiser"
                        >
                          {adv.logo_url ? (
                            <img src={adv.logo_url} alt="" className="guangdada-filter-tag-avatar" referrerPolicy="no-referrer" />
                          ) : null}
                          已选广告主：{adv.advertiser_name || adv.domain || adv.cross_app_id || '—'}
                        </Tag>
                      ))}
                      {hasBlockedAdv && guangdadaBlockedAdvertisers.map((b) => (
                        <Tag
                          key={b.advertiser_id}
                          closable
                          onClose={(e) => { e.preventDefault(); onGuangdadaUnblockAdvertiser?.(b.advertiser_id); }}
                          className="guangdada-filter-tag guangdada-filter-tag--blocked"
                        >
                          {b.logo_url ? (
                            <img src={b.logo_url} alt="" className="guangdada-filter-tag-avatar" referrerPolicy="no-referrer" />
                          ) : null}
                          已屏蔽：{b.advertiser_name || b.advertiser_id}
                        </Tag>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* 底部查询按钮：使用当前表单（含关键词与所有筛选项）发起查询 */}
              <div className="guangdada-filters-footer">
                <button type="submit" className="guangdada-query-btn-bottom" disabled={loading} title={loading ? '查询中...' : '使用当前筛选条件查询'}>
                  <span className="guangdada-query-btn-icon">{loading ? <span className="spinner guangdada-spinner" /> : '🔍'}</span>
                  <span>{loading ? '查询中...' : '查询'}</span>
                </button>
              </div>
            </div>
        </div>
        <GuangdadaAiFileSearchModal
          open={aiFileModalOpen}
          onCancel={() => setAiFileModalOpen(false)}
          onConfirm={handleGuangdadaAiFileConfirm}
        />
        </>
      ) : (
        <>
      <div className={`form-group${platform === 'insightrackr' ? ' insightrackr-search-row' : ''}`}>
        <label htmlFor="searchKeyword">关键词</label>
        {platform === 'insightrackr' ? (
          <>
            <Input
              id="searchKeyword"
              name="keyword"
              className="insightrackr-keyword-input"
              placeholder="输入关键词搜索素材"
              value={formData.keyWord}
              onChange={(e) => handleChange('keyWord', e.target.value)}
              allowClear
              autoComplete="off"
            />
            <div className="insightrackr-global-search-cell">
              <span className="insightrackr-global-search-label">应用/产品</span>
              <InsightrackrGlobalSearch
                onChange={(v) => {
                  if (!(v && String(v).trim())) handleChange('insightrackrProductIds', []);
                }}
                onSelectProduct={(item) => {
                  const id = item.pkg || item.productId;
                  if (id) handleChange('insightrackrProductIds', [id]);
                }}
                onSelectCompany={(item) => {
                  const id = item.pkg || item.productId;
                  if (id) handleChange('insightrackrProductIds', [id]);
                }}
                placeholder="搜索应用、开发者并回填"
              />
            </div>
          </>
        ) : (
          <Input
            id="searchKeyword"
            name="keyword"
            placeholder="搜索任意应用、开发者、素材"
            value={formData.keyWord}
            onChange={(e) => handleChange('keyWord', e.target.value)}
            allowClear
            autoComplete="off"
          />
        )}
      </div>

      {platform === 'insightrackr' && (
        <div className="advanced-search-panel">
          {/* 推广 */}
          <div className="search-category">
            <div className="category-header">
              <span className="category-dot category-dot-promotion"></span>
              <span className="category-title">推广</span>
            </div>
            <div className="category-fields">
              <div className="form-group-inline">
                <label htmlFor="countryCascader">国家/地区</label>
                <CountryCascader
                  value={formData.countryLevel2 || []}
                  onChange={(selectedCountries) => {
                    handleChange('countryLevel2', selectedCountries);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="trafficChannelSelector">流量渠道</label>
                <TrafficChannelSelector
                  value={formData.mediaIds || []}
                  onChange={(selectedChannels) => {
                    handleChange('mediaIds', selectedChannels);
                  }}
                />
              </div>
              {insightrackrSearchTab !== 'playable' && (
              <div className="form-group-inline">
                <label htmlFor="adTypeSelector">广告类型</label>
                <AdTypeSelector
                  value={formData.adMediaType || ''}
                  onChange={(selectedType) => {
                    handleChange('adMediaType', selectedType);
                  }}
                />
              </div>
              )}
              <div className="form-group-inline">
                <label htmlFor="osSelector">操作系统</label>
                <OSSelector
                  value={formData.device || []}
                  onChange={(selectedOS) => {
                    handleChange('device', selectedOS);
                  }}
                />
              </div>
            </div>
          </div>

          {/* 产品 */}
          <div className="search-category">
            <div className="category-header">
              <span className="category-dot category-dot-product"></span>
              <span className="category-title">产品</span>
            </div>
            <div className="category-fields">
              <div className="form-group-inline">
                <label htmlFor="productCascader">行业类型</label>
                <ProductCascader
                  value={formData.productType || []}
                  onChange={(selectedProducts) => {
                    handleChange('productType', selectedProducts);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="productModelCheckbox">产品模型</label>
                <InsightrackrProductModelCheckbox
                  value={formData.productModel || []}
                  onChange={(selected) => {
                    handleChange('productModel', selected);
                  }}
                />
              </div>
              {insightrackrSearchTab !== 'playable' && (
              <div className="form-group-inline">
                <label htmlFor="promotionMethodSelector">推广方式</label>
                <PromotionMethodSelector
                  value={formData.selling || []}
                  onChange={(selectedMethods) => {
                    handleChange('selling', selectedMethods);
                  }}
                />
              </div>
              )}
              <div className="form-group-inline">
                <label htmlFor="gameThemeSelector">游戏题材</label>
                <GameThemeSelector
                  value={formData.classIds || []}
                  onChange={(selectedThemes) => {
                    handleChange('classIds', selectedThemes);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="productThemeSelector">产品主题</label>
                <ProductThemeSelector
                  value={formData.seelTargets || []}
                  onChange={(selectedThemes) => {
                    handleChange('seelTargets', selectedThemes);
                  }}
                />
              </div>
              {insightrackrSearchTab !== 'playable' && (
              <>
              <div className="form-group-inline">
                <label htmlFor="monetizationTypeSelector">变现类型</label>
                <MonetizationTypeSelector
                  value={formData.monetization || ''}
                  onChange={(selectedType) => {
                    handleChange('monetization', selectedType);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="payTypeSelector">下载类型</label>
                <PayTypeSelector
                  value={formData.payType || ''}
                  onChange={(selectedType) => {
                    handleChange('payType', selectedType);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="listingStatusSelector">上架状态</label>
                <ListingStatusSelector
                  value={formData.listingStatus || ''}
                  onChange={(selectedStatus) => {
                    handleChange('listingStatus', selectedStatus);
                  }}
                />
              </div>
              </>
              )}
            </div>
          </div>

          {/* 创意 - 试玩广告下不展示 */}
          {insightrackrSearchTab !== 'playable' && (
          <div className="search-category">
            <div className="category-header">
              <span className="category-dot category-dot-creative"></span>
              <span className="category-title">创意</span>
            </div>
            <div className="category-fields">
              <div className="form-group-inline">
                <label htmlFor="creativeTypeSelector">创意类型</label>
                <CreativeTypeSelector
                  value={formData.creativeType || ''}
                  onChange={(selectedType) => {
                    handleChange('creativeType', selectedType);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="creativeSpecSelector">创意规格</label>
                <CreativeSpecSelector
                  value={formData.creativeSpec || {}}
                  onChange={(selectedSpec) => {
                    handleChange('creativeSpec', selectedSpec);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="languageSelector">标题语言</label>
                <LanguageSelector
                  value={formData.languages || ''}
                  onChange={(selectedLanguage) => {
                    handleChange('languages', selectedLanguage);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="callToActionSelector">行动号召</label>
                <CallToActionSelector
                  value={formData.appealTypeList || []}
                  onChange={(selectedActions) => {
                    handleChange('appealTypeList', selectedActions);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="materialTagSelector">素材标签</label>
                <MaterialTagSelector
                  value={formData.interactionList || []}
                  onChange={(selectedTags) => {
                    handleChange('interactionList', selectedTags);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="audienceAnalysisSelector">受众分析</label>
                <AudienceAnalysisSelector
                  value={formData.audienceAnalysis || {}}
                  onChange={(selectedAnalysis) => {
                    handleChange('audienceAnalysis', selectedAnalysis);
                  }}
                />
              </div>
            </div>
          </div>
          )}

          {/* 指标 - 试玩广告下不展示 */}
          {insightrackrSearchTab !== 'playable' && (
          <div className="search-category">
            <div className="category-header">
              <span className="category-dot category-dot-metrics"></span>
              <span className="category-title">指标</span>
            </div>
            <div className="category-fields">
              <div className="form-group-inline">
                <label htmlFor="exposureEstimateRangeSelector">曝光预估</label>
                <ExposureEstimateRangeSelector
                  value={formData.exposureEstimateRange || ''}
                  onChange={(selectedRange) => {
                    handleChange('exposureEstimateRange', selectedRange);
                  }}
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="interactionMetricsSelector">互动指标</label>
                <InteractionMetricsSelector
                  value={formData.interactionMetrics || {}}
                  onChange={(selectedMetrics) => {
                    handleChange('interactionMetrics', selectedMetrics);
                  }}
                />
              </div>
            </div>
          </div>
          )}

          {/* 时间范围 */}
          <div className="form-group-inline" style={{ marginTop: '16px' }}>
            <label htmlFor="dateRange">时间范围</label>
            <RangePicker
              id="dateRange"
              value={formData.dateRange}
              onChange={(dates) => {
                handleChange('dateRange', dates);
              }}
              style={{ width: '250px' }}
            />
            <div className="form-group-inline checkbox-inline" style={{ marginLeft: '16px' }}>
              <label htmlFor="isNew" style={{ marginBottom: 0, lineHeight: '32px' }}>只看新增</label>
              <Checkbox
                id="isNew"
                checked={formData.isNew}
                onChange={(e) => handleChange('isNew', e.target.checked)}
                style={{ marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </div>
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={loading}>
        <span>{loading ? '查询中...' : '查询数据'}</span>
        {loading && <span className="spinner"></span>}
      </button>

      {platform === 'insightrackr' && (
        <div className="sort-section">
          <SortSelector
            sortField={formData.sortField}
            sortRule={formData.sortRule}
            onSortChange={(newSortParams) => {
              handleChange('sortField', newSortParams.sortField);
              handleChange('sortRule', newSortParams.sortRule);
              // 排序变更后直接发起查询（使用当前表单 + 新排序参数）
              onSearch(buildSearchParams({
                ...formData,
                sortField: newSortParams.sortField,
                sortRule: newSortParams.sortRule
              }));
            }}
            platform={platform}
            insightrackrSearchTab={insightrackrSearchTab}
          />
        </div>
      )}
        </>
      )}
    </form>
  );
}

export default SearchForm;
