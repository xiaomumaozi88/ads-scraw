/**
 * 国内版 BBA ad-info：行业「游戏 / 工具 / 电商」的分类多选。
 * value 与线上 checkbox 一致；复合 value 会在请求时展开并去重。
 */
export const DOMESTIC_GAME_CATEGORY_OPTIONS = [
  { value: 5005, label: '角色扮演' },
  { value: 5003, label: '策略' },
  { value: 5009, label: '娱乐场' },
  { value: 5014, label: '益智解谜' },
  { value: 5002, label: '动作' },
  { value: 5008, label: '卡牌' },
  { value: 5015, label: '模拟' },
  { value: 5006, label: '街机' },
  { value: 5004, label: '探险' },
  { value: 5016, label: '体育' },
  { value: 5007, label: '桌面' },
  { value: 5001, label: '竞速' },
  { value: '5022,5006', label: '休闲' },
  { value: 5018, label: '文字' },
  { value: 5013, label: '音乐' },
  { value: 5011, label: '教育游戏' },
  { value: 5012, label: '家庭聚会' },
  { value: 20001, label: '飞行射击' },
  { value: 20002, label: '末日生存' },
  { value: 20003, label: '辅助工具' },
];

export const DOMESTIC_TOOL_CATEGORY_OPTIONS = [
  { value: 5021, label: '社交' },
  { value: 5026, label: '金融' },
  { value: 5019, label: '工具' },
  { value: 5020, label: '娱乐' },
  { value: 5024, label: '购物' },
  { value: '5036,5077', label: '新闻' },
  { value: 5023, label: '生活' },
  { value: 5025, label: '教育' },
  { value: 5066, label: '效率' },
  { value: 5082, label: '阅读' },
  { value: 5027, label: '餐饮美食' },
  { value: '5070,5081', label: '旅游' },
  { value: '5065,5079', label: '摄影' },
  { value: '5072,5066', label: '商务办公' },
  { value: 5071, label: '天气' },
  { value: 5028, label: '健康健美' },
  { value: 5033, label: '医疗' },
  { value: 5034, label: '音乐与音频' },
  { value: 5069, label: '体育工具' },
  { value: 5035, label: '地图和导航' },
  { value: 5090, label: '家居装修' },
  { value: 5076, label: '漫画' },
  { value: 5088, label: '社交约会' },
  { value: 5075, label: '通讯' },
  { value: 10080, label: '短剧' },
  { value: 10081, label: '系统工具' },
  { value: 10082, label: '手机美化' },
  { value: 10083, label: 'AI工具' },
];

/** 电商/品牌：与产品勾选对应的 classfication id（可多 id 逗号拼接） */
export const DOMESTIC_ECOMMERCE_CATEGORY_OPTIONS = [
  { value: '8001,10001,10016,10020', label: '服装配饰' },
  { value: 8002, label: '鞋袜' },
  { value: '8003,10008', label: '珠宝/手表' },
  { value: 8006, label: '电子产品' },
  { value: 8008, label: '婚礼' },
  { value: '8009,10050,10066', label: '运动' },
  { value: '8012,10022', label: '儿童' },
  { value: '8014,10003,10009', label: '综合购物' },
  { value: '8017,10023,10034,10051', label: '出行服务' },
  { value: '8018,10048,10036,10055,10073,10027,10054', label: '本地服务' },
  { value: '8019,10015,10053', label: '教育' },
  { value: '8013,10047,10013,10038,10028', label: '家居和房产' },
];

const VALUE_TO_LABEL = Object.fromEntries(
  [
    ...DOMESTIC_GAME_CATEGORY_OPTIONS,
    ...DOMESTIC_TOOL_CATEGORY_OPTIONS,
    ...DOMESTIC_ECOMMERCE_CATEGORY_OPTIONS,
  ].map((o) => [o.value, o.label])
);

export function getDomesticCategoryOptionsByIndustry(industry) {
  if (industry === 'game') return DOMESTIC_GAME_CATEGORY_OPTIONS;
  if (industry === 'tool') return DOMESTIC_TOOL_CATEGORY_OPTIONS;
  if (industry === 'ecommerce') return DOMESTIC_ECOMMERCE_CATEGORY_OPTIONS;
  return [];
}

/**
 * 表单多选值 → API 用的数字 id（去重）。支持「休闲」的复合字符串 value。
 */
export function expandDomesticCategorySelectionToApiIds(selected) {
  if (!Array.isArray(selected) || selected.length === 0) return [];
  const out = [];
  for (const v of selected) {
    if (typeof v === 'string' && v.includes(',')) {
      v.split(',').forEach((s) => {
        const n = Number(String(s).trim());
        if (Number.isFinite(n)) out.push(n);
      });
    } else {
      const n = Number(v);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  return [...new Set(out)];
}

export function domesticCategoryLabelsFromValues(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return values.map((v) => VALUE_TO_LABEL[v] ?? String(v));
}

/**
 * 接口返回的 app_category（数字 id 或字符串 id）→ 与表单一致的中文标签
 */
export function domesticApiCategoryIdsToLabels(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return ids.map((raw) => {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n) && VALUE_TO_LABEL[n] != null) return VALUE_TO_LABEL[n];
    const s = String(raw).trim();
    if (VALUE_TO_LABEL[s] != null) return VALUE_TO_LABEL[s];
    return String(raw);
  });
}
