import React, { createContext, useContext, useState } from 'react';

/** 下载项：{ id, filename, isVideo, status: 'pending'|'processing'|'done'|'error', progress: 0-100, errorMessage? } */
/** 当前批次输出尺寸文案，如「原尺寸」「720×1280（竖版）」 */
const DownloadListContext = createContext(null);

export function DownloadListProvider({ children }) {
  const [downloadList, setDownloadList] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [batchSizeLabel, setBatchSizeLabel] = useState('');
  return (
    <DownloadListContext.Provider value={{ downloadList, setDownloadList, downloading, setDownloading, batchSizeLabel, setBatchSizeLabel }}>
      {children}
    </DownloadListContext.Provider>
  );
}

export function useDownloadList() {
  const ctx = useContext(DownloadListContext);
  if (!ctx) throw new Error('useDownloadList must be used within DownloadListProvider');
  return ctx;
}
