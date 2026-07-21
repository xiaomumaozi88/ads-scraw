import React from 'react';
import { Card, Collapse, Typography } from 'antd';
import { formatBeijingTime } from '../utils/format';

const { Text } = Typography;

function HealthLogsPanel({ recentErrors, recentLogs }) {
  const hasErrors = recentErrors?.length > 0;
  const hasLogs = recentLogs?.length > 0;
  if (!hasErrors && !hasLogs) return null;

  const items = [];
  if (hasErrors) {
    items.push({
      key: 'errors',
      label: `最近错误（${Math.min(20, recentErrors.length)} 条）`,
      children: (
        <ul className="health-page__log-list health-page__log-list--error">
          {recentErrors.slice(-20).reverse().map((entry, i) => (
            <li key={`err-${i}`} className="health-page__log-item">
              <Text type="secondary" className="health-page__log-time">{formatBeijingTime(entry.time)}</Text>
              <Text type="danger" className="health-page__log-level">{entry.level}</Text>
              <Text className="health-page__log-msg">{entry.message}</Text>
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (hasLogs) {
    items.push({
      key: 'logs',
      label: `最近日志（${Math.min(30, recentLogs.length)} 条）`,
      children: (
        <ul className="health-page__log-list">
          {recentLogs.slice(-30).reverse().map((entry, i) => (
            <li key={`log-${i}`} className={`health-page__log-item health-page__log-item--${(entry.level || '').toLowerCase()}`}>
              <Text type="secondary" className="health-page__log-time">{formatBeijingTime(entry.time)}</Text>
              <Text className="health-page__log-level">{entry.level}</Text>
              <Text className="health-page__log-msg">{entry.message}</Text>
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <Card title="日志" className="health-page__panel">
      <Collapse items={items} defaultActiveKey={hasErrors ? ['errors'] : []} />
    </Card>
  );
}

export default HealthLogsPanel;
