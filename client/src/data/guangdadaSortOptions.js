/**
 * 广大大排序选项（value 为 API sort_field 取值）
 * 含 -correlation … -share_count；最后一项为 -multimodal_similarity（素材相关性，仅「素材内容」下可点选）
 * 默认 -first_seen；素材内容默认 -multimodal_similarity
 */
export const GUANGDADA_SORT_OPTIONS = [
  { value: '-first_seen', label: '最新创意', disabled: false },
  { value: '-last_seen', label: '最后看见', disabled: false },
  { value: '-correlation', label: '相关性', disabled: false },
  { value: '-impression', label: '展示估值', disabled: false },
  { value: '-days', label: '投放天数', disabled: false },
  { value: '-related_ads_count', label: '关联广告数', disabled: false },
  { value: '-heat_degree', label: '热度', disabled: false },
  { value: '-like_count', label: '点赞数', disabled: false },
  { value: '-comment_count', label: '评论数', disabled: false },
  { value: '-share_count', label: '分享数', disabled: false },
  { value: '-multimodal_similarity', label: '素材相关性', disabled: false, requiresMaterialContent: true },
];

/** 去重选项（value 对应 API duplicate_removal） */
export const GUANGDADA_DEDUP_OPTIONS = [
  { value: 0, label: '广告' },
  { value: 1, label: '素材' },
  { value: 2, label: '广告主' },
];
