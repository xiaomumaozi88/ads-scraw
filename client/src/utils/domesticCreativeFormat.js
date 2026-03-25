/** 展示估值：与线上一致，≥1万 显示 x.x 万 */
export function formatDomesticImpressionDisplay(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return { main: '—', unit: '' };
  if (num >= 10000) {
    const w = Math.round((num / 10000) * 10) / 10;
    const main = Number.isInteger(w) ? String(w) : String(w);
    return { main, unit: '万' };
  }
  return { main: String(num), unit: '' };
}

export function isDomesticVideoItem(item) {
  if (!item) return false;
  const typeNum = Number(item.type);
  // 返回字段 type 与「创意类型」一致：2=视频，10/11/12/13=图片
  if (Number.isFinite(typeNum)) {
    if (typeNum === 2) return true;
    if ([10, 11, 12, 13].includes(typeNum)) return false;
  }
  if (item.video_flag === 1) return true;
  const r = item.resources?.[0];
  if (typeof r === 'string' && /\.(mp4|webm|mov)(\?|$)/i.test(r)) return true;
  return false;
}

/** 从 resources 中取首个视频 URL（用于 hover 播放） */
export function getDomesticVideoUrl(item) {
  const arr = item?.resources;
  if (!Array.isArray(arr)) return '';
  for (const r of arr) {
    if (typeof r === 'string' && /\.(mp4|webm|mov)(\?|$)/i.test(r)) return r;
  }
  return '';
}
