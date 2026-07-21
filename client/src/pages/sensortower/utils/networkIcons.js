const iconModules = import.meta.glob('../../../../assets/networks/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const ICON_BY_SLUG = Object.fromEntries(
  Object.entries(iconModules).map(([path, url]) => {
    const slug = path.split('/').pop().replace(/\.svg$/, '');
    return [slug, url];
  })
);

/** GALLERY_NETWORKS / API network 名称 → assets/networks 文件名（无扩展名） */
const NETWORK_SLUG_ALIASES = {
  admob: 'admob',
  applovin: 'applovin',
  bidmachine: 'bidmachine',
  chartboost: 'chartboost',
  'digital turbine': 'digital_turbine',
  facebook: 'facebook',
  inmobi: 'inmobi',
  instagram: 'instagram',
  ironsource: 'ironsource',
  supersonic: 'ironsource',
  'iron source': 'ironsource',
  liftoff: 'liftoff',
  vungle: 'liftoff',
  line: 'line',
  'meta audience network': 'meta_audience_network',
  mintegral: 'mintegral',
  moloco: 'moloco',
  pangle: 'pangle',
  pinterest: 'pinterest',
  smaato: 'smaato',
  snapchat: 'snapchat',
  tiktok: 'tiktok',
  twitter: 'x_twitter',
  'x (formerly twitter)': 'x_twitter',
  unity: 'unity',
  verve: 'verve',
  youtube: 'youtube',
};

function normalizeNetworkKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getNetworkIconSlug(networkName) {
  const key = normalizeNetworkKey(networkName);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(NETWORK_SLUG_ALIASES, key)) {
    return NETWORK_SLUG_ALIASES[key];
  }
  const slug = key.replace(/\s+/g, '_');
  return ICON_BY_SLUG[slug] ? slug : null;
}

export function getNetworkIconUrl(networkName) {
  const slug = getNetworkIconSlug(networkName);
  if (!slug) return null;
  return ICON_BY_SLUG[slug] ?? null;
}
