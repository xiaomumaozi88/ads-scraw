import React from 'react';
import './DomesticChannelIcon.css';
import { getDomesticChannelIconKey } from '../data/guangdadaDomesticChannelIconKey';
import { getDomesticChannelCustomIconUrl } from '../data/guangdadaDomesticChannelCustomIcons';
import { getDomesticChannelIconUrlByKey } from '../data/guangdadaDomesticChannelIconKeyAssets';

function SvgFrame({ size, title, className, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className ? `gdd-domestic-channel-icon ${className}` : 'gdd-domestic-channel-icon'}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function GlyphNetwork() {
  return (
    <>
      <circle cx="3.5" cy="8" r="2" fill="#9e9e9e" />
      <circle cx="12.5" cy="5" r="2" fill="#9e9e9e" />
      <circle cx="12.5" cy="11" r="2" fill="#9e9e9e" />
      <path d="M5.2 8h5.1M10.3 6.2l1.8-1M10.3 9.8l1.8 1" stroke="#bdbdbd" strokeWidth="1" fill="none" />
    </>
  );
}

function glyphForIconKey(iconKey) {
  switch (iconKey) {
    case 'chuanshanjia':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FF5E9A" />;
    case 'youliang':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#46A0FC" />;
    case 'jinritoutiao':
      return <rect x="1" y="2" width="14" height="12" rx="2" fill="#F85959" />;
    case 'tiktok':
      return (
        <>
          <path d="M11 3.5c.8.8 1.2 1.9 1.2 3.1V8.2h-2V6.6c0-1-.8-1.8-1.8-1.8h-.4V3.5h3z" fill="#000" />
          <path d="M8.4 6.8c-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2H11c0 2.4-2 4.4-4.4 4.4S2.2 11.4 2.2 9s2-4.4 4.4-4.4c.5 0 1 .1 1.4.3v2.3c-.4-.2-.9-.4-1.4-.4-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8 1.8-.8 1.8-1.8V6.8z" fill="#25F4EE" />
          <path d="M8.4 6.8v2.4c0 1-.8 1.8-1.8 1.8-.5 0-1-.2-1.4-.5v2.3c.4.2.9.3 1.4.3 2.4 0 4.4-2 4.4-4.4H8.4z" fill="#FE2C55" />
        </>
      );
    case 'weixin':
      return (
        <>
          <ellipse cx="5.5" cy="6.5" rx="4" ry="3.2" fill="#09BB07" />
          <ellipse cx="10.5" cy="9.5" rx="3.2" ry="2.6" fill="#07C160" />
        </>
      );
    case 'kuaishou':
    case 'kwai':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FF5000" />
          <path d="M5 11V5l6 3-3 1.5L5 11z" fill="#fff" opacity="0.95" />
        </>
      );
    case 'bilibili':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FB7299" />
          <path d="M6.5 5.5h3L11 7v4H5V7l1.5-1.5z" fill="#fff" />
          <path d="M7 8.5v2l1.5-1L7 8.5z" fill="#FB7299" />
        </>
      );
    case 'baidu':
    case 'sougou':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="#3385FF" />
          <circle cx="6" cy="7" r="1.2" fill="#fff" />
          <circle cx="10" cy="7" r="1.2" fill="#fff" />
          <path d="M5.5 10.5c1 1.2 2.5 1.2 5 0" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" />
        </>
      );
    case '360':
      return (
        <>
          <path d="M8 1.5l5.5 3.2v6.6L8 14.5l-5.5-3.2V4.2L8 1.5z" fill="#FF6600" />
          <text x="8" y="10.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#fff" fontFamily="system-ui,sans-serif">
            360
          </text>
        </>
      );
    case 'weibo':
    case 'sina':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="#E6162D" />
          <ellipse cx="8" cy="8" rx="3.5" ry="2.5" fill="#fff" />
          <circle cx="8" cy="8" r="1.2" fill="#E6162D" />
        </>
      );
    case 'youku':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#1E90FF" />
          <path d="M6.5 5.5v5l4-2.5-4-2.5z" fill="#fff" />
        </>
      );
    case 'uc':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FF4A00" />
          <path d="M8 4c-2 2.5-3 4.5-3 6.2 0 1.5 1.2 2.8 3 2.8s3-1.3 3-2.8C11 8.5 10 6.5 8 4z" fill="#fff" />
        </>
      );
    case 'wangyi':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#E60012" />;
    case 'souhu':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF8500" />
          <circle cx="8" cy="8" r="2.5" fill="#fff" />
        </>
      );
    case 'aiqiyi':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#00C050" />
          <path d="M6.5 5v6l5-3-5-3z" fill="#fff" />
        </>
      );
    case 'zhihu':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#0084FF" />
          <text x="8" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="Georgia,serif">
            知
          </text>
        </>
      );
    case 'facebook':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#1877F2" />
          <path d="M9.2 14V8.9h1.7l.3-2h-2V5.8c0-.6.3-1 1-1h1.1V3.1c-.6-.1-1.2-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.7H5v2h1.5V14h2.7z" fill="#fff" />
        </>
      );
    case 'admob':
      return (
        <>
          <rect x="1" y="1" width="6" height="6" rx="1" fill="#FBBC04" />
          <rect x="9" y="1" width="6" height="6" rx="1" fill="#EA4335" />
          <rect x="1" y="9" width="6" height="6" rx="1" fill="#34A853" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="#4285F4" />
        </>
      );
    case 'googlesearch':
      return (
        <>
          <path d="M8 1.5A6.5 6.5 0 1 1 2.2 5.2" stroke="#4285F4" strokeWidth="1.2" fill="none" />
          <path d="M8 4.5v3.5l2.5 1.5" stroke="#EA4335" strokeWidth="1" fill="none" />
          <circle cx="6" cy="7" r="1" fill="#FBBC04" />
          <circle cx="10" cy="9" r="1" fill="#34A853" />
        </>
      );
    case 'youtube':
      return (
        <>
          <rect x="1" y="3.5" width="14" height="9" rx="2" fill="#FF0000" />
          <path d="M7 6.5v3l3-1.5-3-1.5z" fill="#fff" />
        </>
      );
    case 'twitter':
      return (
        <path
          d="M14 4.1c-.5.2-1 .4-1.5.5.6-.4 1-1 1.2-1.7-.6.3-1.2.6-1.9.7-.5-.6-1.3-1-2.2-1-1.7 0-3 1.4-3 3.1 0 .2 0 .5.1.7-2.5-.1-4.7-1.3-6.2-3.1-.3.5-.4 1-.4 1.6 0 1.1.6 2.1 1.4 2.7-.5 0-1-.2-1.4-.4v.1c0 1.6 1.1 2.9 2.6 3.2-.3.1-.6.1-.9.1-.2 0-.4 0-.6-.1.4 1.3 1.6 2.3 3 2.3-1.1.9-2.5 1.4-4 1.4-.3 0-.5 0-.8-.1 1.4.9 3.1 1.5 4.9 1.5 5.9 0 9.1-4.9 9.1-9.1v-.4c.6-.5 1.2-1 1.6-1.7z"
          fill="#1DA1F2"
        />
      );
    case 'instagram':
      return (
        <>
          <rect x="1" y="1" width="14" height="14" rx="4" fill="#E1306C" />
          <circle cx="8" cy="8" r="3.5" stroke="#fff" strokeWidth="1.2" fill="none" />
          <circle cx="11.5" cy="4.5" r="0.9" fill="#fff" />
        </>
      );
    case 'reddit':
      return (
        <>
          <circle cx="8" cy="9" r="5.5" fill="#FF4500" />
          <circle cx="5.5" cy="8" r="1" fill="#fff" />
          <circle cx="10.5" cy="8" r="1" fill="#fff" />
          <path d="M5.5 11c1 1 4 1 5 0" stroke="#fff" strokeWidth="0.8" fill="none" />
        </>
      );
    case 'WIFI':
      return (
        <>
          <path d="M8 12.5h.01" stroke="#00BCD4" strokeWidth="2" strokeLinecap="round" />
          <path d="M5.5 10a4.5 4.5 0 0 1 5 0" stroke="#00BCD4" strokeWidth="1.2" fill="none" />
          <path d="M3.5 7.5a7.5 7.5 0 0 1 9 0" stroke="#4DD0E1" strokeWidth="1" fill="none" />
        </>
      );
    case 'huoshan':
      return <path d="M8 1.5c0 3-2 4-2 6.5 0 1.5 1 2.8 2 3.5 1-.7 2-2 2-3.5 0-2.5-2-3.5-2-6.5z" fill="#FF6E40" />;
    case 'xigua':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="#16C784" />
          <path d="M6.5 5.5l5 5M11.5 5.5l-5 5" stroke="#fff" strokeWidth="1" />
        </>
      );
    case 'pipixia':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#8B5CF6" />;
    case 'dou-yu':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FF7744" />
          <ellipse cx="8" cy="8" rx="3" ry="2" fill="#fff" />
        </>
      );
    case 'qutoutiao':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF6B00" />;
    case 'quanmin':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FF4081" />;
    case 'haokan':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF4D4F" />
          <circle cx="8" cy="8" r="2.5" fill="#fff" />
        </>
      );
    case 'tieba':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#2932E1" />
          <text x="8" y="11" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="sans-serif">
            贴
          </text>
        </>
      );
    case 'yidianzixun':
      return <circle cx="8" cy="8" r="6" fill="#1E88E5" />;
    case 'dongqiudi':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="#00A854" />
          <path d="M8 4.5l1.2 2.5 2.7.4-2 1.9.5 2.7L8 10.6 5.6 12l.5-2.7-2-1.9 2.7-.4L8 4.5z" fill="#fff" />
        </>
      );
    case 'aoyou':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#1A73E8" />
          <text x="8" y="11.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="sans-serif">
            A
          </text>
        </>
      );
    case 'jinshan':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#3B9EFF" />
          <path d="M4 11V5l4 6 4-6v6" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      );
    case 'xiaomilianmeng':
    case 'xiaomillq':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FF6900" />;
    case 'vivollq':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#415FFF" />
          <text x="8" y="11.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="sans-serif">
            V
          </text>
        </>
      );
    case 'oppollq':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#00C853" />
          <ellipse cx="8" cy="8" rx="3.5" ry="4" stroke="#fff" strokeWidth="1.2" fill="none" />
        </>
      );
    case 'sougoul':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#FB6022" />;
    case 'brower':
      return (
        <>
          <circle cx="8" cy="8" r="6.5" fill="#78909C" />
          <circle cx="8" cy="8" r="2.5" fill="none" stroke="#fff" strokeWidth="1" />
          <path d="M8 1.5v13M1.5 8h13" stroke="#fff" strokeWidth="0.6" opacity="0.5" />
        </>
      );
    case 'alihuichuan':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF6A00" />
          <path d="M5 8h6M8 5v6" stroke="#fff" strokeWidth="1.2" />
        </>
      );
    case 'carcome':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#32ABED" />
          <path d="M5 10c1.5-2.5 4.5-2.5 6 0" stroke="#fff" strokeWidth="1.2" fill="none" />
        </>
      );
    case 'fanqie':
      return <circle cx="8" cy="8" r="6.5" fill="#FF3355" />;
    case 'tengxunxinwen':
    case 'tengxunshipin':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#12B7F5" />
          <path d="M6.5 5.5v5l3.5-2.5-3.5-2.5z" fill="#fff" />
        </>
      );
    case 'tiantian':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#4CAF50" />;
    case 'tudou':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FA9D3B" />;
    case 'fenghuang':
      return <circle cx="8" cy="8" r="6.5" fill="#881D23" />;
    case 'guangdiantong':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#006FFF" />
          <text x="8" y="11" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="sans-serif">
            广
          </text>
        </>
      );
    case 'neihanduanzi':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#333" />;
    case 'unity':
      return (
        <path
          d="M8 1.5l5.2 3v5l-5.2 3-5.2-3v-5L8 1.5zm0 2.2L4.8 5.8v4.4L8 12.3l3.2-2.1V5.8L8 3.7z"
          fill="#222"
        />
      );
    case 'applovin':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#98A0A7" />
          <text x="8" y="11.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="sans-serif">
            AL
          </text>
        </>
      );
    case 'chartboost':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF9E18" />;
    case 'yahoo':
    case 'yahooG':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#720E9E" />
          <text x="8" y="11.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" fontFamily="sans-serif">
            Y!
          </text>
        </>
      );
    case 'pinterest':
      return (
        <path
          d="M8 1.5C4.4 1.5 1.5 4.4 1.5 8c0 3.1 1.9 5.8 4.6 6.9-.1-.7-.1-1.7 0-2.5.2-.9 1.3-6.1 1.3-6.1s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.8 0 1.2.6 1.2 1.4 0 .9-.6 2.2-.9 3.4-.3 1 .6 1.8 1.8 1.8 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1 1 2.7.1.1.1.2.1.4-.1.4-.3 1.3-.4 1.5-.1.2-.2.3-.4.2-1.5-.7-2.4-2.8-2.4-4.5 0-3.7 2.7-8 8.2-8 4.3 0 7.7 3.1 7.7 7.2 0 4.3-2.7 7.8-6.5 7.8-1.3 0-2.5-.7-2.9-1.5l-.8 3.1c-.3 1.1-1.1 2.5-1.6 3.4.9.3 1.8.4 2.8.4 3.6 0 6.5-3 6.5-6.5C14.5 4.4 11.6 1.5 8 1.5z"
          fill="#E60023"
        />
      );
    case 'messenger':
      return <circle cx="8" cy="8" r="6.5" fill="#0084FF" />;
    case 'snapchat':
      return (
        <>
          <rect x="1" y="2" width="14" height="12" rx="3" fill="#FFFC00" stroke="#333" strokeWidth="0.5" />
          <circle cx="6" cy="7" r="1" fill="#333" />
          <circle cx="10" cy="7" r="1" fill="#333" />
        </>
      );
    case 'topbuzz':
      return <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF4081" />;
    case 'sohuvideo':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#FF8500" />
          <path d="M6.5 5.5v5l4-2.5-4-2.5z" fill="#fff" />
        </>
      );
    case 'daum':
    case 'naver':
    case 'ameba':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="#03C75A" />
          <text x="8" y="11.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="sans-serif">
            N
          </text>
        </>
      );
    case 'vungle':
    case 'adcolony':
    case 'ironsource':
    case 'mobvista':
    case 'nend':
    case 'amoad':
    case 'zucks':
    case 'imobile':
    case 'akane':
    case 'nate':
    case 'gunosy':
      return <GlyphNetwork />;
    case 'smartnews':
      return (
        <>
          <rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#1877F2" />
          <circle cx="8" cy="8" r="2.5" fill="#fff" />
        </>
      );
    case 'network':
    default:
      return <GlyphNetwork />;
  }
}

/**
 * 国内版渠道/媒体小图标：优先 assets/icon 下按渠道 ID 配置的 PNG，其次按 icon key 同名的 PNG，否则矢量占位。
 */
export default function DomesticChannelIcon({ channelId, size = 16, title, className }) {
  const customUrl = getDomesticChannelCustomIconUrl(channelId);
  if (customUrl) {
    return (
      <img
        src={customUrl}
        width={size}
        height={size}
        alt={title || ''}
        title={title}
        className={
          className
            ? `gdd-domestic-channel-icon gdd-domestic-channel-icon--asset ${className}`
            : 'gdd-domestic-channel-icon gdd-domestic-channel-icon--asset'
        }
        draggable={false}
      />
    );
  }

  const iconKey = getDomesticChannelIconKey(channelId);
  const keyAssetUrl = getDomesticChannelIconUrlByKey(iconKey);
  if (keyAssetUrl) {
    return (
      <img
        src={keyAssetUrl}
        width={size}
        height={size}
        alt={title || ''}
        title={title}
        className={
          className
            ? `gdd-domestic-channel-icon gdd-domestic-channel-icon--asset ${className}`
            : 'gdd-domestic-channel-icon gdd-domestic-channel-icon--asset'
        }
        draggable={false}
      />
    );
  }

  return (
    <SvgFrame size={size} title={title} className={className}>
      {glyphForIconKey(iconKey)}
    </SvgFrame>
  );
}
