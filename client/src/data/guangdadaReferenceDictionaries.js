import { CHANNEL_VALUE_MAP } from './guangdadaChannels.js';
import { GUANGDADA_COPY_LANG_OPTIONS } from './guangdadaCopyLangs.js';
import { GUANGDADA_GAME_CODE_TO_LABEL } from './guangdadaGameCategoriesTree.js';
import { GUANGDADA_TOOL_CATEGORIES_TREE } from './guangdadaToolCategoriesTree.js';
import {
  GUANGDADA_CATEGORY_TAG_KEY_TO_LABEL,
  GUANGDADA_CORE_TRACK_CODE_TO_LABEL,
} from './guangdadaCoreTrack.js';
import { GUANGDADA_IMAGE_ANALYSIS_CATEGORIES } from './guangdadaImageAnalysis.js';
import { GUANGDADA_VIDEO_ANALYSIS_CATEGORIES } from './guangdadaVideoAnalysis.js';

export const GUANGDADA_LANGUAGE_CODE_TO_LABEL = Object.fromEntries(
  GUANGDADA_COPY_LANG_OPTIONS.map((item) => [String(item.value), item.label])
);

export const GUANGDADA_TOOL_FIRST_LEVEL_CATEGORY_CODE_TO_LABEL = {
  51: '金融理财',
  52: '餐饮美食',
  54: '购物',
  55: '家庭关系',
  56: '健康与健身',
  57: '教育',
  58: '旅行&出行',
  59: '汽车车辆',
  60: '商务和工作',
  61: '社交',
  62: '生活方式',
  63: '体育',
  64: '图形与设计',
  65: '图书',
  66: '实用工具',
  67: '新闻阅读/杂志',
  68: '娱乐',
  69: '照片和视频',
  73: '工具网赚',
  30200: '生成式AI',
  30233274: '个性化',
};

const GUANGDADA_TOOL_CATEGORY_CODE_TO_LABEL = GUANGDADA_TOOL_CATEGORIES_TREE.reduce((acc, cat) => {
  (cat.children || []).forEach((child) => {
    if (child.value != null) acc[String(child.value)] = child.label;
  });
  return acc;
}, { ...GUANGDADA_TOOL_FIRST_LEVEL_CATEGORY_CODE_TO_LABEL });

export const GUANGDADA_IOS_APP_CATEGORY_CODE_TO_LABEL = {
  7001: '动作',
  7002: '冒险',
  7003: '休闲',
  7004: '桌面',
  7005: '卡牌',
  7006: '娱乐场',
  7007: '骰子',
  7008: '教育类',
  7009: '家庭聚会',
  7011: '音乐',
  7012: '益智解谜',
  7013: '竞速',
  7014: '角色扮演',
  7015: '模拟',
  7016: '体育',
  7017: '策略',
  7018: '问答',
  7019: '字谜',
  6018: '图书',
  6000: '商务',
  6022: '商品指南',
  6026: '软件开发工具',
  6017: '教育',
  6016: '娱乐',
  6015: '财务',
  6023: '美食佳饮',
  6027: '图形和设计',
  6013: '健康健美',
  6012: '生活',
  6021: '报刊杂志',
  6020: '医疗',
  6011: '音乐',
  6010: '导航',
  6009: '新闻',
  6008: '摄影与录像',
  6007: '效率',
  6006: '参考资料',
  6024: '购物',
  6005: '社交',
  6004: '体育',
  6025: '贴纸',
  6003: '旅游',
  6002: '实用工具',
  6001: '天气',
};

export const GUANGDADA_ANDROID_APP_CATEGORY_CODE_TO_LABEL = {
  7001: '动作',
  7002: '冒险',
  7050: '街机',
  7004: '桌面和棋类',
  7005: '卡牌',
  7006: '娱乐场',
  7003: '休闲',
  7008: '教育',
  7011: '音乐',
  7012: '益智',
  7013: '竞速',
  7014: '角色扮演',
  7015: '模拟',
  7016: '体育',
  7017: '策略',
  7018: '知识问答',
  7019: '文字',
  6064: '可佩戴设备',
  6050: '艺术和设计',
  6052: '车辆和交通',
  6053: '美容时尚',
  6018: '图书与工具书',
  6000: '办公',
  6055: '通讯',
  6054: '漫画',
  6056: '社交约会',
  6017: '教育',
  6016: '娱乐',
  6058: '活动',
  6015: '财务',
  6023: '餐饮美食',
  6013: '健康与健身',
  6059: '家居装修',
  6060: '软件库与演示',
  6012: '生活时尚',
  6010: '地图和导航',
  6020: '医疗',
  6011: '音乐与音频',
  6021: '新闻杂志',
  6061: '育儿',
  6062: '个性定制',
  6008: '摄影',
  6007: '效率',
  6024: '购物',
  6005: '社交',
  6004: '体育',
  6002: '实用工具',
  6003: '旅游与本地出行',
  6063: '视频播放和编辑',
  6065: '手表应用',
  6001: '天气',
};

export const GUANGDADA_MATERIAL_CONTENT_ATTRIBUTE_CATEGORIES = [
  {
    title: '美术风格',
    items: [
      { values: ['16', '113'], label: '2D二次元' },
      { values: ['17', '114'], label: '2D卡通' },
      { values: ['18', '115'], label: '2D国风水墨' },
      { values: ['19', '116'], label: '2D扁平插画' },
      { values: ['23', '120'], label: '极简UI' },
      { values: ['21', '118'], label: '低多边形' },
      { values: ['20', '117'], label: '像素风' },
      { values: ['14', '111'], label: '写实3D' },
      { values: ['22', '119'], label: '定格/黏土/纸片' },
      { values: ['25', '122'], label: '混合' },
      { values: ['24', '121'], label: '真人拍摄' },
      { values: ['15', '112'], label: '风格化3D' },
    ],
  },
  {
    title: '人物信息',
    items: [
      { values: ['45', '144'], label: '敌人/怪物' },
      { values: ['46', '145'], label: '明星' },
      { values: ['44', '143'], label: '游戏角色' },
      { values: ['43', '142'], label: '真人' },
    ],
  },
  {
    title: '广告主题',
    items: [
      { values: ['60', '249'], label: 'IP联动' },
      { values: ['54', '240'], label: 'PVP对战' },
      { values: ['62', '251'], label: '其他' },
      { values: ['245'], label: '利益引导' },
      { values: ['50', '236'], label: '剧情叙事' },
      { values: ['244'], label: '逆境反击' },
      { values: ['55', '241'], label: '建造经营/模拟' },
      { values: ['57', '246'], label: '开服活动' },
      { values: ['61', '250'], label: '情怀' },
      { values: ['243'], label: '成长强化' },
      { values: ['56', '242'], label: '抽卡收集' },
      { values: ['47', '233'], label: '爽快战斗' },
      { values: ['48', '234'], label: '玩法' },
      { values: ['53', '239'], label: '社交组队' },
      { values: ['58', '247'], label: '玩家回归' },
      { values: ['59', '248'], label: '节日营销' },
      { values: ['49', '235'], label: '角色展示' },
      { values: ['52', '238'], label: '休闲治愈' },
      { values: ['51', '237'], label: '解谜益智' },
    ],
  },
  {
    title: '营销卖点',
    items: [
      { values: ['78', '218'], label: '省时不肝/不氪' },
      { values: ['88', '228'], label: '自由定制' },
      { values: ['80', '220'], label: '内容丰富' },
      { values: ['74', '214'], label: '免费福利' },
      { values: ['79', '219'], label: '公平竞技' },
      { values: ['91', '231'], label: '其他' },
      { values: ['76', '216'], label: '快速成长' },
      { values: ['83', '223'], label: '沉浸剧情' },
      { values: ['86', '226'], label: '真实专业' },
      { values: ['82', '222'], label: '社交乐趣' },
      { values: ['81', '221'], label: '策略烧脑' },
      { values: ['85', '225'], label: '经典IP/情怀' },
      { values: ['87', '227'], label: '解压治愈' },
      { values: ['77', '217'], label: '轻松上手' },
      { values: ['89', '229'], label: '成长收集' },
      { values: ['84', '224'], label: '高品质感' },
      { values: ['75', '215'], label: '高爆高回' },
    ],
  },
  {
    title: '玩家心理',
    items: [
      { values: ['69', '209'], label: '创造表达' },
      { values: ['72', '212'], label: '情绪宣泄' },
      { values: ['64', '204'], label: '成就进步' },
      { values: ['66', '206'], label: '技巧挑战' },
      { values: ['65', '205'], label: '掌控力量' },
      { values: ['67', '207'], label: '探索好奇' },
      { values: ['70', '210'], label: '收集拥有' },
      { values: ['71', '211'], label: '放松逃离' },
      { values: ['68', '208'], label: '社交归属' },
    ],
  },
];

const MATERIAL_CONTENT_ATTRIBUTE_CODE_TO_META = GUANGDADA_MATERIAL_CONTENT_ATTRIBUTE_CATEGORIES.reduce((acc, cat) => {
  cat.items.forEach((item) => {
    item.values.forEach((value) => {
      acc[String(value)] = { label: item.label, parentLabel: cat.title };
    });
  });
  return acc;
}, {});

const ANALYSIS_CODE_TO_META = [
  ...GUANGDADA_IMAGE_ANALYSIS_CATEGORIES,
  ...GUANGDADA_VIDEO_ANALYSIS_CATEGORIES,
].reduce((acc, cat) => {
  cat.items.forEach((item) => {
    acc[String(item.value)] = { label: item.label, parentLabel: cat.title };
  });
  return acc;
}, {});

function normalizeCode(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

export function formatGuangdadaChannel(value) {
  const labels = normalizeList(value).map((item) => {
    const code = normalizeCode(item);
    return CHANNEL_VALUE_MAP[code]?.label || code;
  }).filter(Boolean);
  return labels.length ? labels.join('、') : '—';
}

export function formatGuangdadaLanguage(value) {
  const labels = normalizeList(value).map((item) => {
    const code = normalizeCode(item);
    return GUANGDADA_LANGUAGE_CODE_TO_LABEL[code] || code;
  }).filter(Boolean);
  return labels.length ? labels.join('、') : '其他';
}

export function getGuangdadaAppCategoryLabel(code, os) {
  const key = normalizeCode(code);
  if (!key) return '';
  const osNum = Number(os);
  if (osNum === 1) return GUANGDADA_IOS_APP_CATEGORY_CODE_TO_LABEL[key] || key;
  if (osNum === 2) return GUANGDADA_ANDROID_APP_CATEGORY_CODE_TO_LABEL[key] || key;
  return (
    GUANGDADA_ANDROID_APP_CATEGORY_CODE_TO_LABEL[key]
    || GUANGDADA_IOS_APP_CATEGORY_CODE_TO_LABEL[key]
    || key
  );
}

export function getGuangdadaTagLabel(code) {
  const key = normalizeCode(code);
  if (!key) return '';
  return (
    GUANGDADA_CORE_TRACK_CODE_TO_LABEL[key]
    || GUANGDADA_GAME_CODE_TO_LABEL[key]
    || GUANGDADA_TOOL_CATEGORY_CODE_TO_LABEL[key]
    || MATERIAL_CONTENT_ATTRIBUTE_CODE_TO_META[key]?.label
    || ANALYSIS_CODE_TO_META[key]?.label
    || key
  );
}

export function getGuangdadaCategoryTagGroupLabel(key) {
  const code = normalizeCode(key);
  if (!code) return '';
  return (
    GUANGDADA_GAME_CODE_TO_LABEL[code]
    || GUANGDADA_TOOL_CATEGORY_CODE_TO_LABEL[code]
    || GUANGDADA_CATEGORY_TAG_KEY_TO_LABEL[code]
    || ''
  );
}

export function getGuangdadaAnalysisTagMeta(tag) {
  if (tag && typeof tag === 'object') {
    const id = normalizeCode(tag.id ?? tag.code ?? tag.value);
    const fallback = id ? (MATERIAL_CONTENT_ATTRIBUTE_CODE_TO_META[id] || ANALYSIS_CODE_TO_META[id]) : null;
    return {
      label: tag.cn_name || tag.name || tag.en_name || fallback?.label || id,
      parentLabel: tag.parent_cn_name || tag.parent_name || tag.parent_en_name || fallback?.parentLabel || '其他',
    };
  }
  const id = normalizeCode(tag);
  const fallback = MATERIAL_CONTENT_ATTRIBUTE_CODE_TO_META[id] || ANALYSIS_CODE_TO_META[id];
  return {
    label: fallback?.label || id,
    parentLabel: fallback?.parentLabel || '其他',
  };
}
