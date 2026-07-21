import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, message, Tooltip } from 'antd';
import { LoginOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getPlatformAutoLoginInfo,
  triggerPlatformLogin,
} from '../utils/api';
import './PlatformQuickLoginButton.css';

const PLATFORM_NAME = {
  insightrackr: '热云',
  guangdada: '广大大',
  sensortower: 'Sensor Tower',
};

function PlatformQuickLoginButton({
  platform,
  status,
  email,
  statusLoading,
  onRefreshStatus,
  onLoginSuccess,
  onManualLogin,
}) {
  const [autoLoginInfo, setAutoLoginInfo] = useState(null);
  const [triggerLoading, setTriggerLoading] = useState(false);

  const platformName = PLATFORM_NAME[platform] || '平台';

  useEffect(() => {
    if (!platform) {
      setAutoLoginInfo(null);
      return undefined;
    }
    let cancelled = false;
    getPlatformAutoLoginInfo(platform)
      .then((info) => {
        if (!cancelled) setAutoLoginInfo(info);
      })
      .catch(() => {
        if (!cancelled) setAutoLoginInfo({ configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const handleClick = useCallback(async () => {
    if (status === 'ONLINE') {
      setTriggerLoading(true);
      try {
        const latestStatus = await onRefreshStatus?.();
        if (latestStatus === 'ONLINE') {
          message.success(`${platformName} 登录状态已刷新`);
          onLoginSuccess?.();
        } else {
          message.warning(`${platformName} 当前已变为未登录`);
        }
      } catch (err) {
        message.error(err.message || '刷新登录状态失败');
      } finally {
        setTriggerLoading(false);
      }
      return;
    }

    if (!autoLoginInfo?.configured) {
      onManualLogin?.();
      return;
    }

    setTriggerLoading(true);
    try {
      const latestStatus = await onRefreshStatus?.();
      if (latestStatus === 'ONLINE') {
        message.success(`${platformName} 已登录，状态已刷新`);
        onLoginSuccess?.();
        return;
      }

      const result = await triggerPlatformLogin(platform);
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
      if (platform === 'sensortower' && result.code === 'NEW_DEVICE_VERIFICATION') {
        const tip = result.message || 'Sensor Tower 需要邮箱授权，请粘贴邮件中的授权链接';
        message.warning(tip);
        onManualLogin?.({
          authLinkMode: true,
          message: tip,
        });
        return;
      }
      message.error(result.message || '登录失败');
    } catch (err) {
      message.error(err.message || '登录请求失败');
    } finally {
      setTriggerLoading(false);
    }
  }, [autoLoginInfo, onRefreshStatus, onLoginSuccess, onManualLogin, platform, platformName, status]);

  const loading = triggerLoading || statusLoading;
  const isOnline = status === 'ONLINE';

  const label = useMemo(() => {
    if (isOnline) return email || autoLoginInfo?.emailPreview || '已登录';
    if (!autoLoginInfo) return '检查登录...';
    if (!autoLoginInfo.configured) return '手动登录';
    return '点击登录';
  }, [autoLoginInfo, email, isOnline]);

  if (!platform || !autoLoginInfo) {
    return null;
  }

  const tooltip = isOnline
    ? '已登录，点击刷新状态'
    : autoLoginInfo.configured
      ? `使用服务端账号 ${autoLoginInfo.emailPreview || ''} 自动登录`
      : '未配置服务端账号，点击手动登录';

  return (
    <Tooltip title={tooltip}>
      <Button
        type={isOnline ? 'text' : autoLoginInfo.configured ? 'primary' : 'link'}
        size="small"
        className={`platform-quick-login__btn${isOnline ? ' platform-quick-login__btn--online' : ''}`}
        icon={isOnline ? <ReloadOutlined /> : <LoginOutlined />}
        loading={loading}
        onClick={handleClick}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

export default PlatformQuickLoginButton;
