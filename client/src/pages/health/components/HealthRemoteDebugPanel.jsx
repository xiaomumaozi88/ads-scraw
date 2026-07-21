import React from 'react';
import { Card, Col, Row, Typography } from 'antd';

const { Text, Paragraph } = Typography;

function HealthRemoteDebugPanel({ remoteDebug }) {
  if (!remoteDebug) return null;
  const entries = [
    remoteDebug.guangdada?.enabled ? { key: 'guangdada', label: '广大大', ...remoteDebug.guangdada } : null,
    remoteDebug.sensortower?.enabled ? { key: 'sensortower', label: 'Sensor Tower', ...remoteDebug.sensortower } : null,
    remoteDebug.insightrackr?.enabled ? { key: 'insightrackr', label: 'Insightrackr', ...remoteDebug.insightrackr } : null,
  ].filter(Boolean);

  if (entries.length === 0) return null;

  return (
    <Card title="远程调试 Chrome" className="health-page__panel">
      <Paragraph type="secondary">
        无头模式下可通过 DevTools 远程连接排查人机验证等问题。建议仅通过 SSH 隧道访问调试端口。
      </Paragraph>
      <Row gutter={[16, 16]}>
        {entries.map((item) => (
          <Col xs={24} md={12} lg={8} key={item.key}>
            <Card size="small" className="health-page__debug-card">
              <Text strong>{item.label}</Text>
              <div className="health-page__debug-line">端口 <Text code>{item.port}</Text></div>
              <div className="health-page__debug-line">地址 <Text code>{item.url}</Text></div>
              <Text type="secondary" className="health-page__debug-hint">{item.hint}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

export default HealthRemoteDebugPanel;
