/**
 * 国内版渠道/媒体：按 BBA 渠道 ID 使用 assets/icon 下的 PNG（优先于 sprite/base64）。
 */
import url134 from '../../assets/icon/百度联盟.png?url';
import url141 from '../../assets/icon/快手联盟.png?url';
import url7 from '../../assets/icon/今日头条.png?url';
import url13 from '../../assets/icon/网易新闻.png?url';
import url15 from '../../assets/icon/搜狐新闻.png?url';
import url112 from '../../assets/icon/一点资讯.png?url';
import url119 from '../../assets/icon/凤凰新闻.png?url';
import url105 from '../../assets/icon/趣头条.png?url';
import url106 from '../../assets/icon/抖音短视频.png?url';
import url103 from '../../assets/icon/西瓜视频.png?url';
import url114 from '../../assets/icon/皮皮虾.png?url';
import url126 from '../../assets/icon/快手.png?url';
import url11 from '../../assets/icon/优酷视频.png?url';
import url120 from '../../assets/icon/土豆视频.png?url';
import url4 from '../../assets/icon/爱奇艺.png?url';
import url104 from '../../assets/icon/哔哩哔哩.png?url';
import url30 from '../../assets/icon/搜狐视频.png?url';
import url100 from '../../assets/icon/微信.png?url';
import url107 from '../../assets/icon/知乎.png?url';
import url116 from '../../assets/icon/百度贴吧.png?url';
import url17 from '../../assets/icon/微博.png?url';
import url133 from '../../assets/icon/百度APP.png?url';
import url125 from '../../assets/icon/搜狗浏览器.png?url';
import url101 from '../../assets/icon/WIFI万能钥匙.png?url';
import url110 from '../../assets/icon/车来了.png?url';

export const DOMESTIC_CHANNEL_CUSTOM_ICON_URL_BY_ID = {
  134: url134,
  141: url141,
  7: url7,
  13: url13,
  15: url15,
  112: url112,
  119: url119,
  105: url105,
  106: url106,
  103: url103,
  114: url114,
  126: url126,
  11: url11,
  120: url120,
  4: url4,
  104: url104,
  30: url30,
  100: url100,
  107: url107,
  116: url116,
  17: url17,
  133: url133,
  125: url125,
  101: url101,
  110: url110,
};

export function getDomesticChannelCustomIconUrl(channelId) {
  const n = Number(channelId);
  if (Number.isFinite(n) && DOMESTIC_CHANNEL_CUSTOM_ICON_URL_BY_ID[n] != null) {
    return DOMESTIC_CHANNEL_CUSTOM_ICON_URL_BY_ID[n];
  }
  const s = String(channelId).trim();
  return DOMESTIC_CHANNEL_CUSTOM_ICON_URL_BY_ID[s] || '';
}
