import { useState, useEffect, useCallback } from 'react';
import { getStatus } from '../utils/api';

const defaultDetail = () => ({ status: 'LOGGED_OUT', email: null });

export function usePlatformStatus() {
  const [statuses, setStatuses] = useState({
    insightrackr: defaultDetail(),
    guangdada: defaultDetail()
  });
  const [loading, setLoading] = useState({});

  const fetchStatus = useCallback(async (platform) => {
    setLoading(prev => ({ ...prev, [platform]: true }));
    try {
      const data = await getStatus(platform);
      const newStatus = data.data?.status || data.status || 'LOGGED_OUT';
      const email = data.data?.email ?? null;
      setStatuses(prev => ({ ...prev, [platform]: { status: newStatus, email } }));
      return newStatus;
    } catch (error) {
      console.error(`获取 ${platform} 状态失败:`, error);
      setStatuses(prev => ({ ...prev, [platform]: defaultDetail() }));
      return 'LOGGED_OUT';
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  }, []);

  const refreshStatus = useCallback(async (platform) => {
    return await fetchStatus(platform);
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus('insightrackr');
    fetchStatus('guangdada');
  }, [fetchStatus]);

  return {
    statuses,
    loading,
    refreshStatus,
    getStatus: (platform) => (statuses[platform] && typeof statuses[platform] === 'object' ? statuses[platform].status : statuses[platform]) || 'LOGGED_OUT',
    getStatusDetail: (platform) => (statuses[platform] && typeof statuses[platform] === 'object' ? statuses[platform] : defaultDetail())
  };
}
