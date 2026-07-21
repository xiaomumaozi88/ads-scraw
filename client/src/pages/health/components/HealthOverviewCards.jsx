import React from 'react';
import { Card, Col, Progress, Row, Statistic } from 'antd';
import {
  CloudServerOutlined,
  DesktopOutlined,
  FieldTimeOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';

function HealthOverviewCards({ summary, transcode, performance }) {
  const maxConcurrent = transcode?.maxConcurrent ?? 0;
  const running = transcode?.running ?? 0;
  const waiting = transcode?.waiting ?? 0;
  const slotUsedPct = maxConcurrent > 0 ? Math.round((running / maxConcurrent) * 100) : 0;

  return (
    <Row gutter={[16, 16]} className="health-page__stats-row">
      <Col xs={24} sm={12} lg={6}>
        <Card className="health-page__stat-card" bordered={false}>
          <Statistic
            title="浏览器实例"
            value={summary?.totalBrowsers ?? 0}
            suffix={`/ 3 平台`}
            prefix={<DesktopOutlined />}
          />
          <div className="health-page__stat-sub">标签页 {summary?.totalPages ?? 0} 个</div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card className="health-page__stat-card" bordered={false}>
          <Statistic
            title="服务运行时长"
            value={summary?.uptimeText ?? '-'}
            prefix={<FieldTimeOutlined />}
          />
          <div className="health-page__stat-sub">启动于 {summary?.lastStartTimeFormatted ?? '-'}</div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card className="health-page__stat-card" bordered={false}>
          <Statistic
            title="转码槽位"
            value={running}
            suffix={`/ ${maxConcurrent || '-'}`}
            prefix={<VideoCameraOutlined />}
          />
          <Progress
            percent={slotUsedPct}
            size="small"
            showInfo={false}
            strokeColor={slotUsedPct >= 100 ? '#ff4d4f' : '#1677ff'}
            className="health-page__stat-progress"
          />
          <div className="health-page__stat-sub">排队 {waiting} 个</div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card className="health-page__stat-card" bordered={false}>
          <Statistic
            title="进程内存 RSS"
            value={performance?.memory?.rssMb ?? '-'}
            suffix={performance?.memory?.rssMb != null ? 'MB' : ''}
            prefix={<CloudServerOutlined />}
          />
          <div className="health-page__stat-sub">
            堆 {performance?.memory?.heapUsedMb ?? '-'} / {performance?.memory?.heapTotalMb ?? '-'} MB
          </div>
        </Card>
      </Col>
    </Row>
  );
}

export default HealthOverviewCards;
