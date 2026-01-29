import { useState, useEffect, useCallback } from 'react';
import { getStatus } from '../utils/api';

export function useStatus(platform) {
  const [status, setStatus] = useState('LOGGED_OUT');
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStatus(platform);
      const newStatus = data.data?.status || data.status || 'LOGGED_OUT';
      setStatus(newStatus);
    } catch (error) {
      console.error('获取状态失败:', error);
      setStatus('LOGGED_OUT');
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refreshStatus: fetchStatus };
}
