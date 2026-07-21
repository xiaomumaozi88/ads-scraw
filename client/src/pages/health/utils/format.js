/** 将 ISO 或时间戳转为北京时间展示 */
export function formatBeijingTime(isoOrTimestamp) {
  if (isoOrTimestamp == null || isoOrTimestamp === '') return '-';
  try {
    const d = new Date(isoOrTimestamp);
    if (Number.isNaN(d.getTime())) return String(isoOrTimestamp);
    return d.toLocaleString('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    });
  } catch {
    return String(isoOrTimestamp);
  }
}

export const TRANSCODE_PHASE_LABEL = {
  queued: '排队中',
  downloading: '下载中',
  probing: '探测元数据',
  transcoding: '转码中',
};

export const PLATFORM_STATUS_COLOR = {
  ONLINE: 'success',
  LOGGED_OUT: 'default',
  OFFLINE: 'warning',
};
