/**
 * 广大大排序选项（value 为 API sort_field 取值，仅以下为有效值）
 * -correlation, -impression, -first_seen, -last_seen, -days, -related_ads_count, -heat_degree, -like_count, -comment_count, -share_count
 * 默认 -first_seen
 */
export const GUANGDADA_SORT_OPTIONS = [
  { value: '-first_seen', label: '最新创意', disabled: false },
  { value: '-last_seen', label: '最后看见', disabled: false },
  { value: '-correlation', label: '相关性', disabled: true },
  { value: '-impression', label: '展示估值', disabled: false },
  { value: '-days', label: '投放天数', disabled: false },
  { value: '-related_ads_count', label: '关联广告数', disabled: false },
  { value: '-heat_degree', label: '热度', disabled: false },
  { value: '-like_count', label: '点赞数', disabled: false },
  { value: '-comment_count', label: '评论数', disabled: false },
  { value: '-share_count', label: '分享数', disabled: false },
];

/** 去重选项（value 对应 API duplicate_removal） */
export const GUANGDADA_DEDUP_OPTIONS = [
  { value: 0, label: '广告' },
  { value: 1, label: '素材' },
  { value: 2, label: '广告主' },
];
