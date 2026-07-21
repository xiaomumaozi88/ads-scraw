import React from 'react';
import { Button } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import './NoPermissionPage.css';

function NoPermissionPage({ title = '暂无访问权限', description }) {
  const { profile, portalUrl } = useAuth();
  const userLabel = profile?.user_name || profile?.feishu_user_id || '';

  return (
    <div className="no-permission-page">
      <div className="no-permission-page__card">
        <h1 className="no-permission-page__title">{title}</h1>
        <p className="no-permission-page__desc">
          {description ||
            (userLabel
              ? `${userLabel}，您当前没有本模块或本平台的数据访问权限，请联系管理员在 IAM 权限中心授权。`
              : '您当前没有本模块或本平台的数据访问权限，请联系管理员在 IAM 权限中心授权。')}
        </p>
        {portalUrl ? (
          <Button type="link" href={portalUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}>
            返回企业门户
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default NoPermissionPage;
