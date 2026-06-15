import { getRegionByCode } from '../constants/galleryRegionCodes.js';

const MEDIA_BASE = 'https://cas-logo.oss-cn-hongkong.aliyuncs.com/oversea/media';

/** 广告网络 / 社交渠道图标（与官方 tooltip 一致） */
const NETWORK_ICON_URLS = {
  Admob: `${MEDIA_BASE}/Admob.png`,
  Applovin: `${MEDIA_BASE}/Applovin.png`,
  Facebook: `${MEDIA_BASE}/Facebook.png`,
  Instagram: `${MEDIA_BASE}/Instagram.png`,
  InMobi: `${MEDIA_BASE}/InMobi.png`,
  Moloco: `${MEDIA_BASE}/Moloco.png`,
  Pangle: `${MEDIA_BASE}/Pangle.png`,
  TikTok: `${MEDIA_BASE}/TikTok.png`,
  Youtube: `${MEDIA_BASE}/Youtube.png`,
};

/**
 * @returns {{ iconUrl?: string, fallbackLetter?: string, fallbackColor?: string }}
 */
export function resolveImpressionShareSeriesIcon(series, { breakdownId, appsById } = {}) {
  const id = series?.id;
  if (!id) return { fallbackLetter: '?', fallbackColor: series?.color };

  if (breakdownId === 'unifiedApp') {
    const app = appsById?.get?.(id);
    if (app?.iconUrl) return { iconUrl: app.iconUrl };
    return {
      fallbackLetter: (series.name || id).charAt(0).toUpperCase(),
      fallbackColor: app?.accent || series.color,
    };
  }

  if (breakdownId === 'country') {
    const region = getRegionByCode(id);
    if (region?.flagUrl) return { iconUrl: region.flagUrl };
    return {
      fallbackLetter: id.slice(0, 2).toUpperCase(),
      fallbackColor: series.color,
    };
  }

  const networkIcon = NETWORK_ICON_URLS[id];
  if (networkIcon) return { iconUrl: networkIcon };

  return {
    fallbackLetter: (series.name || id).charAt(0).toUpperCase(),
    fallbackColor: series.color,
  };
}
