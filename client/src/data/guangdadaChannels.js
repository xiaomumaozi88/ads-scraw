/**
 * 广大大渠道选项：按推荐/全球/韩国/日本/俄罗斯分类，用于渠道 Popover 多选
 * value 用于表单与 API，label 为展示名，iconClass 为 net-icon-* 类名，beta 为是否显示 Beta 角标
 */
export const GUANGDADA_CHANNEL_CATEGORIES = [
  {
    title: '推荐',
    items: [
      { value: 'meta', label: 'Facebook系', iconClass: 'net-icon-meta' },
      { value: 'google', label: 'Google系', iconClass: 'net-icon-google' },
      { value: 'merge_facebook', label: '合并Facebook系' },
    ],
  },
  {
    title: '全球渠道',
    items: [
      { value: 'facebook', label: 'FB News Feed', iconClass: 'net-icon-facebook' },
      { value: 'instagram', label: 'Instagram', iconClass: 'net-icon-instagram' },
      { value: 'audience_network', label: 'Audience Network', iconClass: 'net-icon-audience_network' },
      { value: 'messenger', label: 'Messenger', iconClass: 'net-icon-messenger' },
      { value: 'youtube', label: 'YouTube', iconClass: 'net-icon-youtube' },
      { value: 'admob', label: 'Admob', iconClass: 'net-icon-admob' },
      { value: 'adsense', label: 'AdSense', iconClass: 'net-icon-adsense' },
      { value: 'twitter', label: 'X(Twitter)', iconClass: 'net-icon-twitter' },
      { value: 'unity_ads', label: 'UnityAds', iconClass: 'net-icon-unity_ads' },
      { value: 'vungle', label: 'Liftoff', iconClass: 'net-icon-liftoff' },
      { value: 'applovin', label: 'AppLovin', iconClass: 'net-icon-applovin' },
      { value: 'chartboost', label: 'Chartboost', iconClass: 'net-icon-chartboost' },
      { value: 'pinterest', label: 'Pinterest', iconClass: 'net-icon-pinterest' },
      { value: 'ironsource', label: 'ironSource', iconClass: 'net-icon-ironsource' },
      { value: 'reddit', label: 'Reddit', iconClass: 'net-icon-reddit' },
      { value: 'tiktok', label: 'TikTok', iconClass: 'net-icon-tiktok' },
      { value: 'topbuzz', label: 'TopBuzz', iconClass: 'net-icon-topbuzz' },
      { value: 'mobvista', label: 'Mintegral(Mobvista)', iconClass: 'net-icon-mobvista' },
      { value: 'pangle', label: 'Pangle', iconClass: 'net-icon-pangle' },
      { value: 'yahoo', label: 'Yahoo!', iconClass: 'net-icon-yahoo' },
      { value: 'snapchat', label: 'Snapchat', iconClass: 'net-icon-snapchat' },
      { value: 'tapjoy', label: 'Tapjoy', iconClass: 'net-icon-tapjoy' },
      { value: 'kwai', label: 'Kwai', iconClass: 'net-icon-kwai' },
      { value: 'inmobi', label: 'InMobi', iconClass: 'net-icon-inmobi' },
      { value: 'asa', label: 'Apple Search Ads', iconClass: 'net-icon-asa' },
      { value: 'moloco', label: 'Moloco', iconClass: 'net-icon-moloco' },
      { value: 'dt_exchange', label: 'DT Exchange', iconClass: 'net-icon-dt_exchange' },
      { value: 'bigoads', label: 'BIGO Ads', iconClass: 'net-icon-bigoads', beta: true },
    ],
  },
  {
    title: '韩国渠道',
    items: [
      { value: 'naver', label: 'NAVER(네이버)', iconClass: 'net-icon-naver' },
      { value: 'daum', label: 'Daum(다음)', iconClass: 'net-icon-daum' },
      { value: 'nate', label: 'Nate(네이트)', iconClass: 'net-icon-nate' },
    ],
  },
  {
    title: '日本渠道',
    items: [
      { value: 'ameba', label: 'Ameba(アメーバ)', iconClass: 'net-icon-ameba' },
      { value: 'yahoo_japan', label: 'Yahoo! Japan', iconClass: 'net-icon-yahoo_japan' },
      { value: 'gunosy', label: 'Gunosy(グノシー)', iconClass: 'net-icon-gunosy' },
      { value: 'zucks', label: 'Zucks', iconClass: 'net-icon-zucks' },
      { value: 'smartnews', label: 'SmartNews(スマートニュース)', iconClass: 'net-icon-smartnews' },
      { value: 'imobile', label: 'i-mobile', iconClass: 'net-icon-imobile' },
      { value: 'akane', label: 'AkaNe', iconClass: 'net-icon-akane' },
      { value: 'nend', label: 'Nend', iconClass: 'net-icon-nend' },
    ],
  },
  {
    title: '俄罗斯渠道',
    items: [
      { value: 'yandex', label: 'Yandex', iconClass: 'net-icon-yandex', beta: true },
      { value: 'vkontakte', label: 'Vkontakte', iconClass: 'net-icon-vkontakte', beta: true },
    ],
  },
];

/** 所有渠道 value 列表（用于“全部”勾选） */
export const ALL_CHANNEL_VALUES = GUANGDADA_CHANNEL_CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => item.value)
);

/** Facebook 系子渠道（用于渠道行「Facebook系」hover 下拉） */
export const FACEBOOK_FAMILY_ITEMS = [
  { value: 'facebook', label: 'FB News Feed', iconClass: 'net-icon-facebook' },
  { value: 'instagram', label: 'Instagram', iconClass: 'net-icon-instagram' },
  { value: 'audience_network', label: 'Audience Network', iconClass: 'net-icon-audience_network' },
  { value: 'messenger', label: 'Messenger', iconClass: 'net-icon-messenger' },
];

/** Google 系子渠道（用于渠道行「Google系」hover 下拉） */
export const GOOGLE_FAMILY_ITEMS = [
  { value: 'youtube', label: 'YouTube', iconClass: 'net-icon-youtube' },
  { value: 'admob', label: 'Admob', iconClass: 'net-icon-admob' },
  { value: 'adsense', label: 'AdSense', iconClass: 'net-icon-adsense' },
];

/** value -> { label, iconClass, beta } */
export const CHANNEL_VALUE_MAP = (() => {
  const m = {};
  GUANGDADA_CHANNEL_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      m[item.value] = { label: item.label, iconClass: item.iconClass, beta: item.beta };
    });
  });
  return m;
})();
