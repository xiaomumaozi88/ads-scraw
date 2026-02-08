/**
 * 电商/品牌 - 网站类型筛选树：独立网站、电商平台、社交账号
 * value 为接口使用的值（多域名用逗号分隔），label 为显示名
 */

/** 独立网站下前 12 项，用于「更多」按钮前的药丸 tag（请求参数 independent_website） */
export const GUANGDADA_INDEPENDENT_WEBSITE_PILLS = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'wordpress', label: 'Wordpress' },
  { value: 'magento', label: 'Magento' },
  { value: 'bigcommerce', label: 'BigCommerce' },
  { value: 'opencart', label: 'OpenCart' },
  { value: 'prestashop', label: 'PrestaShop' },
  { value: 'wix', label: 'Wix' },
  { value: 'squarespace', label: 'Squarespace' },
  { value: 'ecwid', label: 'Ecwid' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'ueeshop', label: 'Ueeshop' },
];

export const GUANGDADA_WEBSITE_TYPE_TREE = [
  {
    name: '独立网站',
    children: [
      ...GUANGDADA_INDEPENDENT_WEBSITE_PILLS,
      { value: 'bigcartel', label: 'BigCartel' },
      { value: 'strikingly', label: 'Strikingly' },
      { value: '3dcart', label: '3Dcart' },
      { value: 'volusion', label: 'Volusion' },
      { value: 'miva', label: 'Miva' },
    ],
  },
  {
    name: '电商平台',
    children: [
      { value: 'aliexpress.com,aliexpress.ru', label: 'AliExpress' },
      { value: 'amazon.com,amazon.co,amazon.de,amazon.ca,amazon.co.uk,amazon.in,amazon.ae,amazon.it,amazon.es,amazon.com.mx,amazon.fr', label: 'Amazon' },
      { value: 'cdiscount.com', label: 'Cdiscount' },
      { value: 'dhgate.com', label: 'DHgate' },
      { value: 'ebay.com', label: 'eBay' },
      { value: 'etsy.com', label: 'Etsy' },
      { value: 'flipkart.com', label: 'Flipkart' },
      { value: 'fordeal.com', label: 'Fordeal' },
      { value: 'joom.com', label: 'JOOM' },
      { value: 'lightinthebox.com', label: 'Lightinthebox' },
      { value: 'lazada.com,lazada.co.id,lazada.co.th,lazada.com.my,lazada.vn,lazada.com.ph,lazada.sg,lazada.co', label: 'Lazada' },
      { value: 'mercadolivre.com', label: 'Mercadolivre' },
      { value: 'shopee.com,shopee.co.id,shopee.vn,shopee.co.th,shopee.tw,shopee.com.my,shopee.ph,shopee.sg', label: 'Shopee' },
      { value: 'souq.com', label: 'Souq' },
      { value: 'tophatter.com', label: 'Tophatter' },
      { value: 'wish.com', label: 'Wish' },
      { value: 'walmart.com,walmart.com.mx,walmart.ca,walmart.com.ar', label: 'Walmart' },
      { value: 'shein.com', label: 'Shein' },
      { value: 'shop.tiktok.com', label: 'TikTok Shop' },
    ],
  },
  {
    name: '社交账号',
    children: [
      { value: 'facebook.com', label: 'FB Social Account' },
      { value: 'messenger.com', label: 'Messager Social Account' },
      { value: 'instagram.com', label: 'Ins Social Account' },
      { value: 'twitter.com', label: 'Twitter Social Account' },
    ],
  },
];
