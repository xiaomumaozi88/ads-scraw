import {
  isExternalSearchDebugEnabled,
  getExternalSearchDebugEntries,
  clearExternalSearchDebugEntries,
} from '../utils/externalSearchDebugStore.js';

export const getExternalSearchDebugLog = (req, res) => {
  if (!isExternalSearchDebugEnabled()) {
    return res.status(404).json({
      success: false,
      message: '外部查询调试未开启（生产环境默认关闭，可设置 EXTERNAL_SEARCH_DEBUG=1）',
    });
  }
  res.status(200).json({
    success: true,
    enabled: true,
    entries: getExternalSearchDebugEntries(),
  });
};

export const postClearExternalSearchDebugLog = (req, res) => {
  if (!isExternalSearchDebugEnabled()) {
    return res.status(404).json({ success: false, message: '调试未开启' });
  }
  clearExternalSearchDebugEntries();
  res.status(200).json({ success: true });
};
