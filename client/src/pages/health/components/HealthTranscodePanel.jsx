import React from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, Progress, Space, Table, Tag, Typography, Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { ROUTES } from '../../../config/routes';
import { TRANSCODE_PHASE_LABEL } from '../utils/format';

const { Text } = Typography;

function phaseTag(phase, status) {
  if (status === 'queued' || phase === 'queued') {
    return <Tag color="default">排队中</Tag>;
  }
  const colorMap = {
    downloading: 'processing',
    probing: 'cyan',
    transcoding: 'blue',
  };
  return (
    <Tag color={colorMap[phase] || 'processing'}>
      {TRANSCODE_PHASE_LABEL[phase] || phase || '处理中'}
    </Tag>
  );
}

function HealthTranscodePanel({ transcode }) {
  if (!transcode) return null;

  if (transcode.error) {
    return (
      <Card title="视频转码队列" className="health-page__panel">
        <Text type="danger">{transcode.error}</Text>
      </Card>
    );
  }

  const maxConcurrent = transcode.maxConcurrent ?? 0;
  const running = transcode.running ?? 0;
  const waiting = transcode.waiting ?? 0;
  const jobs = transcode.jobs ?? [];
  const slotPct = maxConcurrent > 0 ? Math.round((running / maxConcurrent) * 100) : 0;

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      width: 140,
      render: (id) => <Text code copyable={{ text: id }}>{id}</Text>,
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 100,
      render: (name) => name || '—',
    },
    {
      title: '创建时间',
      dataIndex: 'enqueuedAtFormatted',
      width: 168,
    },
    {
      title: '状态',
      dataIndex: 'phase',
      width: 110,
      render: (phase, row) => phaseTag(phase, row.status),
    },
    {
      title: '队列',
      dataIndex: 'queuePosition',
      width: 72,
      render: (pos, row) => (
        row.status === 'queued' && pos != null ? `#${pos}` : '—'
      ),
    },
    {
      title: '目标尺寸',
      dataIndex: 'targetSize',
      width: 100,
    },
    {
      title: '等待',
      dataIndex: 'waitDurationText',
      width: 88,
    },
    {
      title: '已运行',
      dataIndex: 'runDurationText',
      width: 88,
      render: (text) => text || '—',
    },
    {
      title: '入队时间',
      dataIndex: 'enqueuedAtFormatted',
      width: 168,
    },
    {
      title: '视频来源',
      dataIndex: 'videoUrlPreview',
      ellipsis: true,
      render: (url) => (
        <Text ellipsis={{ tooltip: url }} className="health-page__url-cell">
          {url || '—'}
        </Text>
      ),
    },
  ];

  return (
    <Card
      title="视频转码队列"
      className="health-page__panel health-page__panel--transcode"
      extra={
        <Space size="middle">
          <Text type="secondary">并发 {running}/{maxConcurrent}</Text>
          <Text type="secondary">排队 {waiting}</Text>
          <Link to={ROUTES.TRANSCODE_QUEUE}>
            <Button type="link" size="small" icon={<ArrowRightOutlined />}>
              完整队列
            </Button>
          </Link>
        </Space>
      }
    >
      <div className="health-page__transcode-summary">
        <div className="health-page__transcode-meter">
          <Text type="secondary">槽位占用</Text>
          <Progress
            percent={slotPct}
            status={slotPct >= 100 ? 'exception' : 'active'}
            format={() => `${running}/${maxConcurrent}`}
          />
        </div>
        <Space wrap size={[16, 8]} className="health-page__transcode-meta">
          <Text type="secondary">下载超时 {transcode.downloadTimeoutMs != null ? `${transcode.downloadTimeoutMs / 1000}s` : '-'}</Text>
          <Text type="secondary">转码超时 {transcode.transcodeTimeoutMs != null ? `${transcode.transcodeTimeoutMs / 60000}min` : '-'}</Text>
          <Text type="secondary">ffmpeg 线程 {transcode.ffmpegThreads ?? '-'}</Text>
          <Text type="secondary">预设 {transcode.ffmpegPreset ?? '-'}</Text>
          {transcode.ffmpegCpus ? (
            <Text type="secondary">CPU 绑定 {transcode.ffmpegCpus}</Text>
          ) : null}
        </Space>
      </div>

      {jobs.length === 0 ? (
        <Empty description="当前无转码任务（进行中或排队均为 0）" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={jobs}
          pagination={false}
          scroll={{ x: 960 }}
          className="health-page__transcode-table"
        />
      )}

      <Text type="secondary" className="health-page__panel-hint">
        排队任务在获得槽位前会显示队列序号；处理中任务会展示当前阶段（下载 / 探测 / 转码）。
      </Text>
    </Card>
  );
}

export default HealthTranscodePanel;
