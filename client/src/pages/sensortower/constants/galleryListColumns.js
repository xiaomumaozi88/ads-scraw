/** 列表视图可配置列（与官方「列」面板一致） */

/** 列表视图固定列：排名 + 创意（创意列渲染在应用列之后） */
export const GALLERY_LIST_FIXED_COLUMNS = ['rank', 'creative'];

export const GALLERY_LIST_COLUMN_GROUPS = [
  {
    id: 'details',
    label: '详情',
    columns: [
      { id: 'app', label: '应用', defaultVisible: true },
      { id: 'network', label: '网络', defaultVisible: true },
      { id: 'region', label: '国家/地区', defaultVisible: false },
    ],
  },
  {
    id: 'creativeAttrs',
    label: '创意属性',
    columns: [
      { id: 'firstSeen', label: '首次看到', defaultVisible: true },
      { id: 'lastSeen', label: '最后看到', defaultVisible: true },
      { id: 'duration', label: '持续时间', defaultVisible: true },
      { id: 'share', label: '展示份额', defaultVisible: true },
      { id: 'adType', label: '广告类型', defaultVisible: false },
      { id: 'adFormat', label: '广告格式', defaultVisible: false },
      { id: 'placement', label: '投放位置', defaultVisible: false },
      { id: 'videoDuration', label: '视频时长', defaultVisible: false },
      { id: 'mediaSize', label: '媒体尺寸', defaultVisible: false },
      { id: 'adPublisher', label: '广告发布商', defaultVisible: false },
    ],
  },
];

export function getAllConfigurableListColumnIds() {
  return GALLERY_LIST_COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.id));
}

export function getDefaultVisibleListColumns() {
  const ids = new Set();
  for (const group of GALLERY_LIST_COLUMN_GROUPS) {
    for (const col of group.columns) {
      if (col.defaultVisible) ids.add(col.id);
    }
  }
  return ids;
}

export function getListColumnMeta(id) {
  for (const group of GALLERY_LIST_COLUMN_GROUPS) {
    const col = group.columns.find((c) => c.id === id);
    if (col) return col;
  }
  return null;
}
