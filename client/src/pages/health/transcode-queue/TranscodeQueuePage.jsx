import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Empty,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { listTranscodeJobs } from '../../../utils/api';
import { ROUTES } from '../../../config/routes';
import { TRANSCODE_PHASE_LABEL } from '../utils/format';
import './TranscodeQueuePage.css';

const { Text, Paragraph } = Typography;

const STATUS_COLOR = {
  queued: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
};

function phaseTag(phase, status) {
  if (status === 'queued' || phase === 'queued') {
    return <Tag color="default">排队中</Tag>;
  }
  if (status === 'completed') return <Tag color="success">已完成</Tag>;
  if (status === 'failed') return <Tag color="error">失败</Tag>;
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

function TranscodeQueuePage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetchJobs = useCallback((options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    setError(null);
    return listTranscodeJobs({
      activeOnly: filter === 'active',
      limit: 300,
    })
      .then((list) => {
        setJobs(list);
        setLastUpdatedAt(Date.now());
      })
      .catch((err) => {
        if (!silent) setError(err.message || '加载失败');
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'active') {
      return job.status === 'queued' || job.status === 'running';
    }
    if (filter === 'failed') return job.status === 'failed';
    return true;
  });

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      width: 150,
      fixed: 'left',
      render: (id) => <Text code copyable={{ text: id }}>{id}</Text>,
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      width: 120,
      render: (name, row) => (
        <div>
          <div>{name || '—'}</div>
          {row.createdBy?.email ? (
            <Text type="secondary" className="transcode-queue-page__sub">{row.createdBy.email}</Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'enqueuedAtFormatted',
      width: 168,
    },
    {
      title: '状态',
      dataIndex: 'phase',
      width: 100,
      render: (phase, row) => phaseTag(phase, row.status),
    },
    {
      title: '队列',
      dataIndex: 'queuePosition',
      width: 72,
      render: (pos, row) => (row.status === 'queued' && pos != null ? `#${pos}` : '—'),
    },
    {
      title: '目标尺寸',
      dataIndex: 'targetSize',
      width: 96,
    },
    {
      title: '来源',
      dataIndex: 'sourceLabel',
      width: 120,
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: '批次 / 任务',
      width: 140,
      render: (_, row) => (
        <div className="transcode-queue-page__ids">
          {row.clientBatchId ? <Text code ellipsis>{row.clientBatchId}</Text> : '—'}
          {row.clientTaskId ? (
            <Text type="secondary" code ellipsis className="transcode-queue-page__sub">
              {row.clientTaskId}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '等待',
      dataIndex: 'waitDurationText',
      width: 88,
    },
    {
      title: '运行',
      dataIndex: 'runDurationText',
      width: 88,
      render: (v) => v || '—',
    },
    {
      title: '完成时间',
      dataIndex: 'finishedAtFormatted',
      width: 168,
      render: (v) => v || '—',
    },
    {
      title: '视频来源',
      dataIndex: 'videoUrlPreview',
      ellipsis: true,
      render: (url) => (
        <Text ellipsis={{ tooltip: url }} className="transcode-queue-page__url">
          {url || '—'}
        </Text>
      ),
    },
    {
      title: '错误',
      dataIndex: 'errorMessage',
      width: 180,
      ellipsis: true,
      render: (msg) => (msg ? <Text type="danger">{msg}</Text> : '—'),
    },
  ];

  const activeCount = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;

  return (
    <div className="transcode-queue-page">
      <div className="transcode-queue-page__head">
        <Link to={ROUTES.HEALTH} className="transcode-queue-page__back">
          <ArrowLeftOutlined /> 返回系统健康
        </Link>
        <Typography.Title level={4} className="transcode-queue-page__title">
          视频转码队列
        </Typography.Title>
        <Paragraph type="secondary" className="transcode-queue-page__desc">
          展示所有转码任务的创建人、时间与进度。服务重启后会自动恢复排队中的任务；已完成结果保留供下载，过期后自动清理。
        </Paragraph>
        {lastUpdatedAt ? (
          <Text type="secondary" className="transcode-queue-page__updated">
            上次更新：{new Date(lastUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })}
            {activeCount > 0 ? ` · 进行中 ${activeCount} 个` : ''}
          </Text>
        ) : null}
      </div>

      <Card bordered={false} className="transcode-queue-page__toolbar">
        <Space wrap size="middle">
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => fetchJobs()}>
            刷新
          </Button>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '进行中', value: 'active' },
              { label: '失败', value: 'failed' },
            ]}
          />
        </Space>
      </Card>

      {error ? <Alert type="error" showIcon message={error} className="transcode-queue-page__alert" /> : null}

      <Card bordered={false} className="transcode-queue-page__table-card">
        {filteredJobs.length === 0 && !loading ? (
          <Empty description="暂无转码任务记录" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={filteredJobs}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 1600 }}
          />
        )}
      </Card>
    </div>
  );
}

export default TranscodeQueuePage;
