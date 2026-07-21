import { useState, useEffect, useCallback } from 'react';
import { getStatus } from '../utils/api';

const defaultDetail = () => ({
  status: 'LOGGED_OUT',
  email: null,
  cnJwtExpiresAt: null,
  code: null,
  message: '',
  authLinkRequired: false,
  url: '',
});

export function usePlatformStatus() {
  const [statuses, setStatuses] = useState({
    insightrackr: defaultDetail(),
    guangdada: defaultDetail(),
    sensortower: defaultDetail(),
  });
  const [loading, setLoading] = useState({});

  const fetchStatus = useCallback(async (platform) => {
    setLoading(prev => ({ ...prev, [platform]: true }));
    try {
      const data = await getStatus(platform);
      const newStatus = data.data?.status || data.status || 'LOGGED_OUT';
      const email = data.data?.email ?? null;
      const detail = data.data && typeof data.data === 'object' ? data.data : {};
      const cnJwtExpiresAt =
        platform === 'guangdada' && data.data && 'cnJwtExpiresAt' in data.data
          ? data.data.cnJwtExpiresAt
          : null;
      const nextDetail = {
        status: newStatus,
        email,
        cnJwtExpiresAt,
        code: detail.code || null,
        message: detail.message || data.message || '',
        authLinkRequired: Boolean(detail.authLinkRequired),
        url: detail.url || '',
      };
      setStatuses(prev => ({
        ...prev,
        [platform]: nextDetail,
      }));
      return nextDetail;
    } catch (error) {
      console.error(`获取 ${platform} 状态失败:`, error);
      setStatuses(prev => ({ ...prev, [platform]: defaultDetail() }));
      return defaultDetail();
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  }, []);

  const refreshStatus = useCallback(async (platform) => {
    const detail = await fetchStatus(platform);
    return detail.status;
  }, [fetchStatus]);

  const refreshStatusDetail = useCallback(async (platform) => {
    return await fetchStatus(platform);
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus('insightrackr');
    fetchStatus('guangdada');
    fetchStatus('sensortower');
  }, [fetchStatus]);

  return {
    statuses,
    loading,
    refreshStatus,
    refreshStatusDetail,
    getStatus: (platform) => (statuses[platform] && typeof statuses[platform] === 'object' ? statuses[platform].status : statuses[platform]) || 'LOGGED_OUT',
    getStatusDetail: (platform) => (statuses[platform] && typeof statuses[platform] === 'object' ? statuses[platform] : defaultDetail())
  };
}
