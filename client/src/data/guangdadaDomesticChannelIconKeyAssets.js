/**
 * assets/icon 下 PNG：文件名（不含 .png）与广大大 icon key 一致时，供 DomesticChannelIcon 使用。
 * 含脚本从 base64 导出的 {key}.png，以及可与 key 同名的其它资源。
 */
const modules = import.meta.glob('../../assets/icon/*.png', { eager: true, query: '?url', import: 'default' });

function basenameFromGlobPath(globPath) {
  const seg = globPath.split('/').pop() || '';
  return seg.replace(/\.png$/i, '');
}

/** @type {Record<string, string>} */
export const DOMESTIC_CHANNEL_ICON_URL_BY_KEY = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [basenameFromGlobPath(path), url])
);

export function getDomesticChannelIconUrlByKey(iconKey) {
  if (iconKey == null || iconKey === '') return '';
  return DOMESTIC_CHANNEL_ICON_URL_BY_KEY[iconKey] || '';
}
