export const DOMESTIC_CHANNEL_MEDIA_GROUPS = [
  {
    name: 'changYong',
    zh: '全部平台',
    en: 'All Platform',
    isCross: true,
    options: [
      { zh: '头条系', en: 'Toutiao Ads', value: '113,7,106,102,103,114,140' },
      { zh: '腾讯系', en: 'Tencent Ads', value: '132,131,129,130,100,137' },
      { zh: '百度系', en: 'Baidu Ads', value: '134,117,115,116,133' },
      { zh: '阿里系', en: 'Alibaba Ads', value: '111,12,11,120' },
      { zh: '其他', en: 'Other Networks', value: '128,127,13,15,118,112,119,105,126,4,104,30,136,107,17,108,109,122,125,135,101,121,110' },
    ],
  },
  {
    name: 'network',
    zh: '网盟渠道',
    en: 'Network',
    options: [
      { value: '113', zh: '穿山甲联盟', en: 'Pangle China' },
      { value: '132', zh: '优量广告', en: 'Youliang Ad' },
      { value: '134', zh: '百度联盟', en: 'Baidu Union' },
      { value: '111', zh: '阿里汇川', en: 'Ali Huichuan' },
      { value: '128', zh: '金山网络联盟', en: 'Jinshan Union' },
      { value: '127', zh: '小米联盟', en: 'Xiaomi Union' },
      { value: '141', zh: '快手联盟', en: 'Kuaishou Union' },
    ],
  },
  {
    name: 'news',
    zh: '综合资讯',
    en: 'News',
    options: [
      { value: '7', zh: '今日头条', en: 'TouTiao' },
      { value: '131', zh: '腾讯新闻', en: 'Tencent News' },
      { value: '129', zh: '天天快报', en: 'KuaiBao' },
      { value: '12', zh: 'UC头条', en: 'UC' },
      { value: '13', zh: '网易新闻', en: 'Netease News' },
      { value: '15', zh: '搜狐新闻', en: 'Souhu News' },
      { value: '118', zh: '新浪新闻', en: 'Sina News' },
      { value: '112', zh: '一点资讯', en: 'Yidian News' },
      { value: '119', zh: '凤凰新闻', en: 'Ifeng News' },
      { value: '105', zh: '趣头条', en: 'Qutoutiao' },
    ],
  },
  {
    name: 'video',
    zh: '视频',
    en: 'Video',
    options: [
      { value: '106', zh: '抖音短视频', en: 'Tiktok China' },
      { value: '102', zh: '抖音火山版', en: 'Huoshan Video' },
      { value: '103', zh: '西瓜视频', en: 'Xigua Video' },
      { value: '114', zh: '皮皮虾', en: 'Pipixia' },
      { value: '117', zh: '全民小视频', en: 'Quanmin Video' },
      { value: '115', zh: '好看视频', en: 'Haokan Viedo' },
      { value: '126', zh: '快手', en: 'Kuaishou' },
      { value: '130', zh: '腾讯视频', en: 'Tencent TV' },
      { value: '11', zh: '优酷视频', en: 'Youku' },
      { value: '120', zh: '土豆视频', en: 'Tudou' },
      { value: '4', zh: '爱奇艺', en: 'iQIYI' },
      { value: '104', zh: '哔哩哔哩', en: 'Bilibili' },
      { value: '30', zh: '搜狐视频', en: 'Souhu TV' },
      { value: '136', zh: '斗鱼', en: 'Douyu' },
    ],
  },
  {
    name: 'social',
    zh: '社交',
    en: 'Social',
    options: [
      { value: '100', zh: '微信', en: 'Wechat' },
      { value: '107', zh: '知乎', en: 'Zhihu' },
      { value: '116', zh: '百度贴吧', en: 'Baidu Tieba' },
      { value: '17', zh: '微博', en: 'Weibo' },
    ],
  },
  {
    name: 'search',
    zh: '搜索类',
    en: 'Search',
    options: [{ value: '133', zh: '百度APP', en: 'Baidu App' }],
  },
  {
    name: 'browser',
    zh: '浏览器',
    en: 'Browser',
    options: [
      { value: '137', zh: 'QQ浏览器', en: 'QQ Browser' },
      { value: '108', zh: '小米浏览器', en: 'Xiaomi Browser' },
      { value: '109', zh: 'vivo浏览器', en: 'VIVO Browser' },
      { value: '122', zh: '傲游浏览器', en: 'Maxthon' },
      { value: '125', zh: '搜狗浏览器', en: 'Sougou Browser' },
      { value: '135', zh: 'OPPO浏览器', en: 'OPPO Browser' },
    ],
  },
  {
    name: 'tool',
    zh: '工具和垂直类',
    en: 'Tool & Vertical',
    options: [
      { value: '101', zh: 'WIFI万能钥匙', en: 'WI-FI Key' },
      { value: '121', zh: '懂球帝', en: 'Dongqiudi' },
      { value: '110', zh: '车来了', en: 'Chelaile' },
      { value: '140', zh: '番茄小说', en: 'Fanqie Novel' },
    ],
  },
];

export const DOMESTIC_CHANNEL_MEDIA_SELECT_OPTIONS = DOMESTIC_CHANNEL_MEDIA_GROUPS.map((group) => ({
  label: group.zh,
  options: group.options.map((item) => ({
    value: item.value,
    label: item.zh,
    title: item.en,
  })),
}));

export const DOMESTIC_CHANNEL_MEDIA_LABEL_MAP = (() => {
  const m = {};
  DOMESTIC_CHANNEL_MEDIA_GROUPS.forEach((group) => {
    group.options.forEach((item) => {
      m[item.value] = item.zh;
    });
  });
  return m;
})();

/** 单渠道 ID 对应中文名（复合 value 如「113,7」不在此列时回退为原始字符串） */
export function getDomesticChannelMediaLabel(channelId) {
  const s = String(channelId).trim();
  if (!s) return '';
  return DOMESTIC_CHANNEL_MEDIA_LABEL_MAP[s] || s;
}
