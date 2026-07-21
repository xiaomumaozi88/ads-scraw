import React, { useCallback, useEffect, useState } from 'react';
import { Button, message, Tooltip } from 'antd';
import { LoginOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getInsightrackrAutoLoginInfo,
  triggerInsightrackrLogin,
} from '../../../utils/api';
import './InsightrackrQuickLoginButton.css';

function InsightrackrQuickLoginButton({
  status,
  email,
  statusLoading,
  onRefreshStatus,
  onLoginSuccess,
  onManualLogin,
}) {
  const [autoLoginInfo, setAutoLoginInfo] = useState(null);
  const [triggerLoading, setTriggerLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getInsightrackrAutoLoginInfo()
      .then((info) => {
        if (!cancelled) setAutoLoginInfo(info);
      })
      .catch(() => {
        if (!cancelled) setAutoLoginInfo({ configured: false });
      });
    return () => { cancelled = true; };
  }, []);

  const handleClick = useCallback(async () => {
    if (!autoLoginInfo?.configured) {
      onManualLogin?.();
      return;
    }

    setTriggerLoading(true);
    try {
      const latestStatus = await onRefreshStatus?.();
      if (latestStatus === 'ONLINE') {
        message.success('Insightrackr 已登录，状态已刷新');
        onLoginSuccess?.();
        return;
      }

      const result = await triggerInsightrackrLogin();
      if (result.code === 'LOGIN_IN_PROGRESS') {
        message.warning(result.message || '其他用户正在登录，请稍后再试');
        return;
      }
      if (result.alreadyOnline || result.success) {
        await onRefreshStatus?.();
        message.success(result.message || '登录成功');
        onLoginSuccess?.();
        return;
      }
      message.error(result.message || '登录失败');
    } catch (err) {
      message.error(err.message || '登录请求失败');
    } finally {
      setTriggerLoading(false);
    }
  }, [autoLoginInfo, onRefreshStatus, onLoginSuccess, onManualLogin]);

  const loading = triggerLoading || statusLoading;
  const isOnline = status === 'ONLINE';

  if (!autoLoginInfo) {
    return null;
  }

  if (!autoLoginInfo.configured) {
    return isOnline ? (
      <span
        className="insightrackr-quick-login__btn insightrackr-quick-login__btn--online"
        title="已登录"
      >
        {email || '已登录'}
      </span>
    ) : (
      <Button type="link" className="insightrackr-quick-login__btn" onClick={() => onManualLogin?.()}>
        手动登录
      </Button>
    );
  }

  const label = isOnline
    ? (email || autoLoginInfo.emailPreview || '已登录')
    : '点击登录';

  const tooltip = isOnline
    ? '已登录，点击刷新状态'
    : `使用服务端账号 ${autoLoginInfo.emailPreview || ''} 自动登录`;

  return (
    <Tooltip title={tooltip}>
      <Button
        type={isOnline ? 'text' : 'primary'}
        size="small"
        className={`insightrackr-quick-login__btn${isOnline ? ' insightrackr-quick-login__btn--online' : ''}`}
        icon={isOnline ? <ReloadOutlined /> : <LoginOutlined />}
        loading={loading}
        onClick={handleClick}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

export default InsightrackrQuickLoginButton;
