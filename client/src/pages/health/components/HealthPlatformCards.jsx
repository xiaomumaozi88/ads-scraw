import React from 'react';
import { Button, Card, Col, Row, Tag, Typography } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { formatBeijingTime, PLATFORM_STATUS_COLOR } from '../utils/format';

const { Text } = Typography;

const PLATFORM_KEYS = ['insightrackr', 'guangdada', 'sensortower'];

function HealthPlatformCards({ data, onRelogin, reloginLoadingByPlatform = {} }) {
  return (
    <Card title="各平台浏览器" className="health-page__panel">
      <Row gutter={[16, 16]}>
        {PLATFORM_KEYS.map((key) => {
          const p = data?.[key];
          if (!p) return null;
          const statusColor = PLATFORM_STATUS_COLOR[p.status] || 'default';
          return (
            <Col xs={24} lg={8} key={key}>
              <Card size="small" className="health-page__platform-card" bordered>
                <div className="health-page__platform-head">
                  <div className="health-page__platform-title">
                    <Text strong>{p.name ?? key}</Text>
                    <Tag color={p.browserExists ? 'success' : 'error'}>
                      {p.browserExists ? '浏览器已启动' : '浏览器未启动'}
                    </Tag>
                  </div>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<LoginOutlined />}
                    loading={Boolean(reloginLoadingByPlatform[key])}
                    disabled={!onRelogin}
                    onClick={() => onRelogin?.(key)}
                  >
                    重新登录
                  </Button>
                </div>
                <dl className="health-page__platform-dl">
                  <div>
                    <dt>页面数</dt>
                    <dd>{p.pageCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>登录状态</dt>
                    <dd>
                      <Tag color={statusColor}>{p.status ?? '未知'}</Tag>
                      {p.isLoggedIn ? ' 已登录' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>账号</dt>
                    <dd>{p.email || '—'}</dd>
                  </div>
                  {key === 'guangdada' && (
                    <div>
                      <dt>国内令牌到期</dt>
                      <dd>{p.cnJwtExpiresAt ? formatBeijingTime(p.cnJwtExpiresAt) : '—'}</dd>
                    </div>
                  )}
                  {p.error && (
                    <div className="health-page__platform-error">
                      <dt>错误</dt>
                      <dd><Text type="danger">{p.error}</Text></dd>
                    </div>
                  )}
                </dl>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}

export default HealthPlatformCards;
