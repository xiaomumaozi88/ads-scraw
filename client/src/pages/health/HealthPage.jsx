import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Spin, Typography } from 'antd';
import { clearLogin, formatRequestError, apiFetch, triggerPlatformLogin } from '../../utils/api';
import { API_BASE } from '../../config/api';
import HealthActionsBar from './components/HealthActionsBar';
import HealthOverviewCards from './components/HealthOverviewCards';
import HealthTranscodePanel from './components/HealthTranscodePanel';
import HealthPlatformCards from './components/HealthPlatformCards';
import HealthSystemPanel from './components/HealthSystemPanel';
import HealthPlatformCredentialsPanel from './components/HealthPlatformCredentialsPanel';
import HealthRemoteDebugPanel from './components/HealthRemoteDebugPanel';
import HealthLogsPanel from './components/HealthLogsPanel';
import './HealthPage.css';

const { Paragraph, Text } = Typography;

const PLATFORM_DISPLAY_NAMES = {
  guangdada: '广大大',
  insightrackr: '热云',
  sensortower: 'SensorTower',
};

function HealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [restartContainerLoading, setRestartContainerLoading] = useState(false);
  const [reloginLoadingByPlatform, setReloginLoadingByPlatform] = useState({});
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetchHealth = useCallback((options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
      setError(null);
      setActionError(null);
      setActionMessage(null);
    }
    return apiFetch(`${API_BASE}/health`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data);
          setLastUpdatedAt(Date.now());
        } else if (!silent) {
          setError(formatRequestError(json.message || '请求失败'));
        }
      })
      .catch((err) => {
        if (!silent) setError(formatRequestError(err.message || '请求异常'));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleClearLogs = () => {
    apiFetch(`${API_BASE}/health/clear-logs`, { method: 'POST' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) fetchHealth({ silent: true });
        else setActionError(json.message || '清除失败');
      })
      .catch((err) => setActionError(err.message || '请求异常'));
  };

  const handleRestartContainer = () => {
    if (!window.confirm('确定要重启 Docker 容器吗？服务将中断约 30～60 秒。')) return;
    setRestartContainerLoading(true);
    apiFetch(`${API_BASE}/health/restart-container`, { method: 'POST' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setActionError(json.message || `重启失败（HTTP ${res.status}）`);
          return;
        }
        window.alert(json.message || '重启指令已发送');
      })
      .catch((err) => setActionError(err.message || '请求异常'))
      .finally(() => setRestartContainerLoading(false));
  };

  const handleReopenBrowser = () => {
    setReopenLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    apiFetch(`${API_BASE}/health/reopen-browser`, { method: 'POST', signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        await fetchHealth({ silent: true });
        if (!res.ok || !json.success) {
          setActionError(json.message || '重新打开失败');
        }
      })
      .catch((err) => {
        setActionError(
          err.name === 'AbortError'
            ? '重新打开超时，请稍后刷新查看状态'
            : err.message || '请求异常'
        );
        fetchHealth({ silent: true });
      })
      .finally(() => {
        clearTimeout(timer);
        setReopenLoading(false);
      });
  };

  const handlePlatformRelogin = useCallback(async (platform) => {
    const platformName = data?.[platform]?.name || PLATFORM_DISPLAY_NAMES[platform] || platform;

    setActionError(null);
    setActionMessage(null);
    setReloginLoadingByPlatform((prev) => ({ ...prev, [platform]: true }));

    try {
      const clearResult = await clearLogin(platform);
      if (!clearResult?.success) {
        throw new Error(clearResult?.message || `${platformName}清除登录状态失败`);
      }

      const loginResult = await triggerPlatformLogin(platform);
      await fetchHealth({ silent: true });

      if (loginResult?.success) {
        setActionMessage(loginResult.message || `${platformName}重新登录成功`);
        return;
      }

      setActionError(loginResult?.message || `${platformName}重新登录失败`);
    } catch (err) {
      await fetchHealth({ silent: true }).catch(() => {});
      setActionError(formatRequestError(err.message || `${platformName}重新登录失败`));
    } finally {
      setReloginLoadingByPlatform((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
    }
  }, [data, fetchHealth]);

  return (
    <div className="health-page">
      <div className="health-page__intro">
        <Paragraph type="secondary" className="health-page__desc">
          浏览器实例、转码队列与系统资源一览。转码队列会列出每个排队/处理中任务的阶段与来源。
        </Paragraph>
        {lastUpdatedAt ? (
          <Text type="secondary" className="health-page__updated">
            上次更新：{new Date(lastUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })}
          </Text>
        ) : null}
      </div>

      <HealthActionsBar
        onRefresh={() => fetchHealth()}
        refreshing={loading}
        onReopenBrowser={handleReopenBrowser}
        reopenLoading={reopenLoading}
        onRestartContainer={handleRestartContainer}
        restartContainerLoading={restartContainerLoading}
        containerRestartAvailable={data?.containerRestart?.available}
        onClearLogs={handleClearLogs}
      />

      {loading && !data ? (
        <div className="health-page__loading">
          <Spin size="large" />
          <Text type="secondary">加载健康状态…</Text>
        </div>
      ) : null}
      {error ? <Alert type="error" showIcon message={error} className="health-page__alert" /> : null}
      {actionError ? <Alert type="warning" showIcon message={actionError} className="health-page__alert" /> : null}
      {actionMessage ? <Alert type="success" showIcon message={actionMessage} className="health-page__alert" /> : null}

      {data ? (
        <div className="health-page__content">
          <HealthOverviewCards
            summary={data.summary}
            transcode={data.transcode}
            performance={data.performance}
          />
          <HealthTranscodePanel transcode={data.transcode} />
          <HealthPlatformCards
            data={data}
            onRelogin={handlePlatformRelogin}
            reloginLoadingByPlatform={reloginLoadingByPlatform}
          />
          <HealthPlatformCredentialsPanel
            credentials={data.platformCredentials}
            onSaved={() => fetchHealth({ silent: true })}
          />
          <HealthSystemPanel
            performance={data.performance}
            containerRestart={data.containerRestart}
          />
          <HealthRemoteDebugPanel remoteDebug={data.remoteDebug} />
          <HealthLogsPanel recentErrors={data.recentErrors} recentLogs={data.recentLogs} />
        </div>
      ) : null}
    </div>
  );
}

export default HealthPage;
