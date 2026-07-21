import React from 'react';
import { Card, Col, Descriptions, Row, Typography } from 'antd';

const { Text } = Typography;

function HealthSystemPanel({ performance, containerRestart }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card title="系统性能" className="health-page__panel">
          {performance?.error ? (
            <Text type="danger">{performance.error}</Text>
          ) : (
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="堆内存已用">{performance?.memory?.heapUsedMb ?? '-'} MB</Descriptions.Item>
              <Descriptions.Item label="堆内存总量">{performance?.memory?.heapTotalMb ?? '-'} MB</Descriptions.Item>
              <Descriptions.Item label="RSS">{performance?.memory?.rssMb ?? '-'} MB</Descriptions.Item>
              <Descriptions.Item label="External">{performance?.memory?.externalMb ?? '-'} MB</Descriptions.Item>
              <Descriptions.Item label="CPU 用户态">{performance?.cpuUsageSeconds?.user ?? '-'} s</Descriptions.Item>
              <Descriptions.Item label="CPU 内核态">{performance?.cpuUsageSeconds?.system ?? '-'} s</Descriptions.Item>
              <Descriptions.Item label="进程运行">
                {performance?.processUptimeSeconds != null
                  ? `${Math.floor(performance.processUptimeSeconds / 60)} 分 ${Math.round(performance.processUptimeSeconds % 60)} 秒`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="CPU 核心">{performance?.cpus ?? '-'}</Descriptions.Item>
              {performance?.loadAvg && (
                <>
                  <Descriptions.Item label="负载 1min">{performance.loadAvg['1min']?.toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="负载 5min">{performance.loadAvg['5min']?.toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="负载 15min">{performance.loadAvg['15min']?.toFixed(2)}</Descriptions.Item>
                </>
              )}
            </Descriptions>
          )}
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card title="运维配置" className="health-page__panel">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="平台自动登录">
              见“平台账号配置”
            </Descriptions.Item>
            <Descriptions.Item label="容器重启">
              {containerRestart?.available
                ? `可用（${containerRestart.containerName}）`
                : containerRestart?.enabled
                  ? '已启用但 Docker 套接字不可用'
                  : '未启用'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );
}

export default HealthSystemPanel;
