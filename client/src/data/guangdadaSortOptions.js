/**
 * 广大大排序选项（与产品 UI 一致，value 对应 API sort_field）
 */
export const GUANGDADA_SORT_OPTIONS = [
  { value: '-first_seen', label: '最新创意', disabled: false },
  { value: '-last_seen', label: '最后看见', disabled: false },
  { value: 'relevance', label: '相关性', disabled: true },
  { value: '-estimate_display', label: '展示估值', disabled: false },
  { value: '-days_active', label: '投放天数', disabled: false },
  { value: '-ad_count', label: '关联广告数', disabled: false },
  { value: '-heat', label: '热度', disabled: false },
  { value: '-like', label: '点赞', disabled: false },
  { value: '-comment', label: '评论', disabled: false },
  { value: '-share', label: '分享', disabled: false },
  { value: 'material_relevance', label: '素材相关性', disabled: true },
];

/** 去重选项（value 对应 API duplicate_removal） */
export const GUANGDADA_DEDUP_OPTIONS = [
  { value: 0, label: '广告' },
  { value: 1, label: '素材' },
  { value: 2, label: '广告主' },
];
