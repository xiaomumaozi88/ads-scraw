import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Space } from 'antd';
import { ReloadOutlined, AuditOutlined } from '@ant-design/icons';
import { ROUTES } from '../../../config/routes';

function HealthActionsBar({
  onRefresh,
  refreshing,
  onReopenBrowser,
  reopenLoading,
  onRestartContainer,
  restartContainerLoading,
  containerRestartAvailable,
  onClearLogs,
}) {
  return (
    <Card className="health-page__actions" bordered={false}>
      <Space wrap size="middle" align="center">
        <Button type="primary" icon={<ReloadOutlined />} onClick={onRefresh} loading={refreshing}>
          刷新状态
        </Button>
        <Button onClick={onReopenBrowser} loading={reopenLoading}>
          重新打开浏览器
        </Button>
        {containerRestartAvailable ? (
          <Button danger onClick={onRestartContainer} loading={restartContainerLoading}>
            重启容器
          </Button>
        ) : null}
        <Button onClick={onClearLogs}>清除日志</Button>
        <Link to={ROUTES.OPERATION_AUDITS}>
          <Button icon={<AuditOutlined />}>操作审计</Button>
        </Link>
      </Space>
    </Card>
  );
}

export default HealthActionsBar;
