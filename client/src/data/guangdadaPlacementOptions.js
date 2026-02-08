/**
 * 广告版位：仅在渠道单选 Admob 或 YouTube 时可用，选项按平台不同
 * value 为接口 ad_positions 用（多个用逗号分隔），label 为显示名
 */
export const GUANGDADA_PLACEMENT_ADMOB = [
  { value: '104,124,114,154,174,134,144,4', label: '插播广告' },
  { value: '12', label: '激励广告' },
  { value: '1022,122,152,112,1062,2,102,172,142,132', label: '插页式广告' },
  { value: '111,121,1021,151,1061,101,171,1', label: '横幅广告' },
  { value: '106,116,126,136,156,176', label: '原生广告' },
];

export const GUANGDADA_PLACEMENT_YOUTUBE = [
  { value: '6101', label: '展示广告-图片' },
  { value: '6102', label: '展示广告-视频' },
  { value: '6201', label: '插播广告-图片' },
  { value: '6202', label: '插播广告-视频' },
  { value: '6301', label: '探索式广告-图片' },
  { value: '6402', label: '短视频广告-视频' },
];
