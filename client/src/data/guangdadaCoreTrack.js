/**
 * 广大大核心赛道/玩法/主题/IP 选项：仅从产品 HTML 提取的键值对与层级
 * 核心赛道(NEW)、游戏玩法、游戏主题、IP
 * value 为 checkbox value（字符串），label 为展示名，newBadge 为分类标题旁是否显示 NEW
 */
export const GUANGDADA_CORE_TRACK_CATEGORIES = [
  {
    title: '核心赛道',
    newBadge: true,
    items: [
      { value: '90000001', label: '超休闲' },
      { value: '90000002', label: '轻度' },
      { value: '90000003', label: '中度' },
      { value: '90000004', label: '重度' },
    ],
  },
  {
    title: '游戏玩法',
    items: [
      { value: '50000167', label: '单机' },
      { value: '50000009', label: '玩家对战' },
      { value: '50000143', label: '社交' },
      { value: '50000001', label: '收集' },
      { value: '50000003', label: '养成' },
      { value: '50000105', label: '解谜' },
      { value: '50000163', label: 'PvE玩家对环境' },
      { value: '50000019', label: '经营管理' },
      { value: '50000033', label: '策略规划' },
      { value: '50000018', label: '任务' },
      { value: '50000081', label: '战斗' },
      { value: '50000066', label: '闯关' },
      { value: '50000109', label: '探索发现' },
      { value: '50000169', label: '挑战模式' },
      { value: '3201', label: '离线游戏' },
      { value: '50000030', label: '排行榜' },
      { value: '50000032', label: '游戏系统' },
      { value: '50000012', label: '限时挑战' },
      { value: '50000038', label: '竞技' },
      { value: '50000011', label: '挑战' },
    ],
  },
  {
    title: '游戏主题',
    items: [
      { value: '30000165', label: '都市' },
      { value: '30000148', label: '探险' },
      { value: '30000026', label: '动植物' },
      { value: '30000374', label: '魔法' },
      { value: '30000129', label: '现代科技' },
      { value: '30000149', label: '色彩' },
      { value: '30000340', label: '二次元' },
      { value: '30000180', label: '抽象几何' },
      { value: '30000111', label: '奇幻' },
      { value: '30000356', label: '科幻' },
      { value: '30000018', label: '战争' },
      { value: '30000090', label: '中世纪' },
      { value: '30000232', label: '怪物' },
      { value: '30000060', label: '赌博' },
      { value: '30000020', label: '车辆' },
      { value: '30000171', label: '轻松休闲' },
      { value: '30000068', label: '自然风光' },
      { value: '30000036', label: '地区文化' },
      { value: '30000220', label: '球' },
      { value: '30000064', label: '交通' },
      { value: '30000107', label: '教育' },
    ],
  },
  {
    title: 'IP',
    items: [
      { value: '100000014', label: '三国演义' },
      { value: '100000030', label: '龙珠' },
      { value: '100000039', label: 'Cocobi' },
      { value: '100000002', label: '西游记' },
      { value: '100000029', label: '宝可梦' },
      { value: '100000150', label: '三国' },
      { value: '100000140', label: '火影忍者' },
      { value: '100000024', label: '迪士尼' },
      { value: '100000019', label: 'Minecraft' },
      { value: '100000144', label: '海贼王' },
      { value: '100000096', label: '鱿鱼游戏' },
      { value: '100000415', label: '蜘蛛侠' },
      { value: '100000186', label: 'Wolfoo' },
      { value: '100000153', label: 'NBA' },
      { value: '100000052', label: '斗罗大陆' },
      { value: '100000082', label: 'Ragnarok' },
      { value: '100000317', label: 'Monopoly' },
      { value: '100000124', label: '仙境传说' },
      { value: '100000093', label: '东方Project' },
      { value: '100000219', label: 'BTS' },
      { value: '100000182', label: '三国志' },
      { value: '100000047', label: '圣斗士星矢' },
      { value: '100000734', label: '圣经' },
      { value: '100000275', label: '爱丽丝梦游仙境' },
      { value: '100000549', label: '金庸' },
    ],
  },
];

/** 核心/玩法/主题/IP 的 value -> label，用于详情里「核心」等 tag 的 code 转中文 */
export const GUANGDADA_CORE_TRACK_CODE_TO_LABEL = GUANGDADA_CORE_TRACK_CATEGORIES.reduce((acc, cat) => {
  (cat.items || []).forEach((item) => {
    if (item.value != null) acc[String(item.value)] = item.label || item.value;
  });
  return acc;
}, {});

/** 非分类字段的 tag key -> 父级中文名；category_tag 的数字 key 优先由分类字典解析 */
export const GUANGDADA_CATEGORY_TAG_KEY_TO_LABEL = {
  ip: 'IP',
  game_play: '游戏玩法',
  game_theme: '游戏主题',
  core_track: '核心赛道',
  game_core_track: '核心赛道',
  game_ip: 'IP',
};
