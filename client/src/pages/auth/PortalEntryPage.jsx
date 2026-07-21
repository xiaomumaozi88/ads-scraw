import React, { useEffect, useMemo } from 'react';
import { Spin } from 'antd';
import { buildPortalReLoginUrl } from '../../config/portal';
import './PortalEntryPage.css';

/** 未登录：跳转门户 IAM 重登（带 redirect_url + platform_code） */
function PortalEntryPage() {
  const portalLoginUrl = useMemo(
    () => buildPortalReLoginUrl(window.location.href),
    []
  );

  useEffect(() => {
    window.location.replace(portalLoginUrl);
  }, [portalLoginUrl]);

  return (
    <div className="portal-entry-page">
      <div className="portal-entry-page__card">
        <Spin size="large" />
        <h1 className="portal-entry-page__title">正在跳转到 IAM 登录</h1>
        <p className="portal-entry-page__desc">
          门户完成登录后将自动携带 token 返回本系统。
        </p>
        <p className="portal-entry-page__hint">
          若长时间未跳转，请
          <a href={portalLoginUrl}>点击此处继续</a>
        </p>
      </div>
    </div>
  );
}

export default PortalEntryPage;
