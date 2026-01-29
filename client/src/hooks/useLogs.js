import { useState, useCallback } from 'react';

const MAX_LOGS = 50;

export function useLogs() {
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    
    // 在 console 中输出日志
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    switch (type) {
      case 'error':
        console.error(logMessage);
        break;
      case 'success':
        console.log('%c' + logMessage, 'color: green');
        break;
      case 'warning':
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }
    
    setLogs(prev => {
      const newLogs = [{ message, type, timestamp }, ...prev];
      return newLogs.slice(0, MAX_LOGS);
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('日志已清空', 'info');
  }, [addLog]);

  return { logs, addLog, clearLogs };
}
