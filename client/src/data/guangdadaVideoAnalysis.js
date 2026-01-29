/**
 * 广大大视频智能分析选项：仅从产品 HTML 提取的键值对与层级
 * 视频类型、美术风格、营销卖点
 * value 为 checkbox value（字符串），label 为展示名
 */
export const GUANGDADA_VIDEO_ANALYSIS_CATEGORIES = [
  {
    title: '视频类型',
    items: [
      { value: '142', label: '游戏录屏' },
      { value: '144', label: 'KOL录屏' },
      { value: '145', label: '动画展示' },
      { value: '146', label: '真人口播' },
      { value: '147', label: '玩法演示' },
      { value: '148', label: '角色展示' },
      { value: '149', label: '情景剧' },
      { value: '150', label: '游戏解说' },
      { value: '151', label: 'AI口播' },
    ],
  },
  {
    title: '美术风格',
    items: [
      { value: '204', label: '3D' },
      { value: '205', label: '2D' },
      { value: '206', label: '卡通' },
      { value: '207', label: '手绘' },
      { value: '208', label: '中国风' },
      { value: '209', label: '像素' },
      { value: '210', label: '多边形' },
      { value: '211', label: '韩式' },
      { value: '212', label: '真人' },
    ],
  },
  {
    title: '营销卖点',
    items: [
      { value: '134', label: '利益引导' },
      { value: '135', label: '玩法特色' },
      { value: '136', label: 'IP联动' },
      { value: '137', label: '价值向往' },
      { value: '138', label: '情怀感召' },
      { value: '139', label: '从众推荐' },
      { value: '140', label: '教育学习' },
      { value: '141', label: '社交联系' },
    ],
  },
];
