/**
 * 广大大图片智能分析选项：仅从产品 HTML 提取的键值对与层级
 * 人物类型、美术风格、画面颜色、创意形式
 * value 为 checkbox value（字符串），label 为展示名
 */
export const GUANGDADA_IMAGE_ANALYSIS_CATEGORIES = [
  {
    title: '人物类型',
    items: [
      { value: '97', label: '真人' },
      { value: '98', label: '游戏角色' },
      { value: '99', label: '动漫角色' },
      { value: '100', label: '影视剧角色' },
    ],
  },
  {
    title: '美术风格',
    items: [
      { value: '6', label: '2D' },
      { value: '7', label: '3D' },
      { value: '8', label: '手绘' },
      { value: '9', label: '像素' },
      { value: '10', label: '多边形' },
      { value: '12', label: '中国风' },
      { value: '13', label: '韩式' },
      { value: '38', label: '卡通' },
      { value: '39', label: '写实' },
      { value: '40', label: '动漫' },
      { value: '41', label: '二次元' },
      { value: '42', label: '现代' },
      { value: '44', label: '插画' },
      { value: '45', label: '科幻' },
      { value: '46', label: '平面设计' },
      { value: '47', label: '简约' },
      { value: '48', label: '奇幻' },
      { value: '49', label: '日式动漫' },
    ],
  },
  {
    title: '画面颜色',
    items: [
      { value: '14', label: '暖色' },
      { value: '15', label: '冷色' },
      { value: '16', label: '暗色' },
      { value: '17', label: '亮色' },
      { value: '51', label: '红色' },
      { value: '52', label: '金色' },
      { value: '53', label: '蓝色' },
      { value: '54', label: '黄色' },
      { value: '55', label: '绿色' },
      { value: '56', label: '紫色' },
      { value: '57', label: '橙色' },
      { value: '58', label: '粉色' },
      { value: '61', label: '彩色' },
      { value: '63', label: '棕色' },
      { value: '64', label: '黑白' },
      { value: '65', label: '多彩' },
      { value: '66', label: '彩虹色' },
    ],
  },
  {
    title: '创意形式',
    items: [
      { value: '18', label: '游戏玩法内容' },
      { value: '19', label: '游戏角色' },
      { value: '20', label: '品牌宣传' },
      { value: '21', label: '素人玩家' },
      { value: '22', label: '明星名人' },
      { value: '101', label: '奖励与激励' },
      { value: '102', label: '促销活动' },
      { value: '103', label: '节日&事件' },
      { value: '104', label: '互动与体验' },
      { value: '105', label: '情感与叙事' },
      { value: '106', label: '功能与操作' },
      { value: '111', label: '其他' },
    ],
  },
];
