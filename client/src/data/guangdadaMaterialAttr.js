/**
 * 广大大素材属性选项：仅从产品 HTML 提取的键值对与层级
 * 视频时长、尺寸、画质、分辨率
 */

/** 视频时长：单选，value 为空表示「全部」，"-" 表示自定义区间 */
export const GUANGDADA_VIDEO_DURATION_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0-15', label: '≤15s' },
  { value: '15-30', label: '15-30s' },
  { value: '30-', label: '≥30s' },
  { value: '60-', label: '≥60s' },
  { value: '-', label: 'custom', isCustom: true }, // 自定义：最小值、最大值
];

/** 尺寸：多选 checkbox，5 列 */
export const GUANGDADA_SIZE_OPTIONS = [
  { value: '1:2', label: '1:2(竖版)' },
  { value: '9:16', label: '9:16(竖版)' },
  { value: '3:4', label: '3:4(竖版)' },
  { value: '4:5', label: '4:5(竖版)' },
  { value: '2:1', label: '2:1(横版)' },
  { value: '16:9', label: '16:9(横版)' },
  { value: '4:3', label: '4:3(横版)' },
  { value: '5:4', label: '5:4(横版)' },
  { value: '1:1', label: '1:1(方形)' },
  { value: 'banner', label: '横幅' },
];

/** 画质：多选 checkbox */
export const GUANGDADA_QUALITY_OPTIONS = [
  { value: 'hd', label: '高清' },
  { value: 'sd', label: '标清' },
];

/** 分辨率：多选 checkbox，初始列表，支持「添加」自定义 */
export const GUANGDADA_RESOLUTION_DEFAULTS = [
  '320 x 480',
  '1080 x 1350',
];
