import { useState, useEffect, useCallback } from 'react';
import { getStatus } from '../utils/api';

export function usePlatformStatus() {
  const [statuses, setStatuses] = useState({
    insightrackr: 'LOGGED_OUT',
    guangdada: 'LOGGED_OUT'
  });
  const [loading, setLoading] = useState({});

  const fetchStatus = useCallback(async (platform) => {
    setLoading(prev => ({ ...prev, [platform]: true }));
    try {
      const data = await getStatus(platform);
      const newStatus = data.data?.status || data.status || 'LOGGED_OUT';
      setStatuses(prev => ({ ...prev, [platform]: newStatus }));
      return newStatus;
    } catch (error) {
      console.error(`获取 ${platform} 状态失败:`, error);
      setStatuses(prev => ({ ...prev, [platform]: 'LOGGED_OUT' }));
      return 'LOGGED_OUT';
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  }, []);

  const refreshStatus = useCallback(async (platform) => {
    return await fetchStatus(platform);
  }, [fetchStatus]);

  // 初始化时获取所有平台状态
  useEffect(() => {
    fetchStatus('insightrackr');
    fetchStatus('guangdada');
  }, [fetchStatus]);

  return { 
    statuses, 
    loading, 
    refreshStatus,
    getStatus: (platform) => statuses[platform] || 'LOGGED_OUT'
  };
}
