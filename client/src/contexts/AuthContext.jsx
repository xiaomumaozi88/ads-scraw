import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Spin } from 'antd';
import { getIamMe } from '../utils/api';
import {
  canEnterPlatform,
  hasMenuDataSource,
  setRelaxedIamAccess,
} from '../config/iam';
import {
  getPortalEntryTokenFromUrl,
  redirectToSsoEntry,
  resolvePortalUrl,
} from '../config/portal';
import PortalEntryPage from '../pages/auth/PortalEntryPage';
import NoPermissionPage from '../pages/auth/NoPermissionPage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState(null);
  const [handlingPortalToken, setHandlingPortalToken] = useState(() =>
    Boolean(getPortalEntryTokenFromUrl())
  );

  const portalUrl = resolvePortalUrl();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const json = await getIamMe();
      const data = json?.data || {};
      if (typeof data.iam_relaxed_access === 'boolean') {
        setRelaxedIamAccess(data.iam_relaxed_access);
      }
      setAuthenticated(json?.success === true && data.authenticated === true);
      setProfile(data.profile || null);
    } catch {
      setAuthenticated(false);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 门户回跳：?token=xxx&redirect_url=完整URL → 后端换会话
  useEffect(() => {
    const entry = getPortalEntryTokenFromUrl();
    if (!entry) {
      setHandlingPortalToken(false);
      return;
    }
    redirectToSsoEntry(entry.token, entry.redirectUrl);
  }, []);

  useEffect(() => {
    if (handlingPortalToken) return;
    refresh();
  }, [handlingPortalToken, refresh]);

  const value = useMemo(
    () => ({
      loading,
      authenticated,
      profile,
      portalUrl,
      handlingPortalToken,
      refresh,
      hasDataSource: (code) => hasMenuDataSource(profile, code),
    }),
    [loading, authenticated, profile, portalUrl, handlingPortalToken, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** 路由级鉴权：仅校验登录与平台准入；模块权限只控制侧栏菜单 */
export function AuthGate({ children }) {
  const { loading, authenticated, profile, handlingPortalToken } = useAuth();

  if (handlingPortalToken || loading) {
    const loadingText = handlingPortalToken ? '正在完成登录…' : '正在验证登录状态…';
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <span style={{ color: '#546e7a', fontSize: 14 }}>{loadingText}</span>
      </div>
    );
  }

  if (!authenticated) {
    return <PortalEntryPage />;
  }

  if (profile && !canEnterPlatform(profile)) {
    return (
      <NoPermissionPage
        title="无法进入平台"
        description="您不是本平台成员，请联系管理员在 IAM 中开通访问权限。"
      />
    );
  }

  return children;
}
