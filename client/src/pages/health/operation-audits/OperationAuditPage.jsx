import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { getOperationAuditSummary, listOperationAudits } from '../../../utils/api';
import { ROUTES } from '../../../config/routes';
import { formatBeijingTime } from '../utils/format';
import './OperationAuditPage.css';

const { Text, Paragraph } = Typography;

const PLATFORM_OPTIONS = [
  { value: '', label: '全部平台' },
  { value: 'insightrackr', label: '热云' },
  { value: 'guangdada', label: '广大大' },
  { value: 'sensortower', label: 'Sensor Tower' },
  { value: 'material_tools', label: '素材处理' },
];

const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'platform_login', label: '手动登录' },
  { value: 'platform_login_trigger', label: '一键登录' },
  { value: 'platform_clear_login', label: '清除登录' },
  { value: 'platform_visibility_update', label: '平台显隐' },
  { value: 'platform_request', label: '平台请求/额度' },
  { value: 'material_batch_submit', label: '素材批次提交' },
  { value: 'transcode_job_submit', label: '转码任务提交' },
];

const PLATFORM_LABEL = {
  insightrackr: '热云',
  guangdada: '广大大',
  sensortower: 'Sensor Tower',
  material_tools: '素材处理',
};

const ACTION_LABEL = {
  platform_login: '手动登录',
  platform_login_trigger: '一键登录',
  platform_clear_login: '清除登录',
  platform_visibility_update: '平台显隐',
  platform_request: '平台请求/额度',
  material_batch_submit: '素材批次提交',
  transcode_job_submit: '转码任务提交',
};

const STATUS_COLOR = {
  success: 'success',
  failed: 'error',
  skipped: 'default',
  blocked: 'warning',
};

const STATUS_LABEL = {
  success: '成功',
  failed: '失败',
  skipped: '跳过',
  blocked: '已拦截',
};

function renderAuditTime(_, row) {
  if (row.createdAt) return formatBeijingTime(row.createdAt);
  return row.createdAtFormatted || '-';
}

function formatQuotaBreakdown(quotaByKey = {}) {
  return Object.entries(quotaByKey)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([key, value]) => `${key}: ${value}`)
    .join('、') || '-';
}

function renderAuditMetadata(row) {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  if (row.action === 'platform_request') {
    return (
      <div style={{ padding: '4px 0' }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">
            请求：{metadata.endpoint || '-'} · 动作 {metadata.requestAction || '-'} · 额度 {metadata.quotaKey || '-'} × {metadata.quotaAmount ?? 0}
          </Text>
          <Text type="secondary">
            剩余/已用/上限：{metadata.quotaRemaining ?? '-'} / {metadata.quotaUsed ?? '-'} / {metadata.quotaLimit ?? '-'}
            {metadata.quotaCycle ? ` · 周期 ${metadata.quotaCycle}` : ''}
          </Text>
          {metadata.page != null || metadata.displayPage != null || metadata.pageSize != null ? (
            <Text type="secondary">
              页码：展示页 {metadata.displayPage ?? '-'} · 官方页 {metadata.page ?? '-'} · 官方 pageSize {metadata.pageSize ?? '-'}
            </Text>
          ) : null}
          {metadata.adKey ? (
            <Text copyable={{ text: metadata.adKey }} type="secondary">ad_key：{metadata.adKey}</Text>
          ) : null}
          {metadata.sourceUrls?.length ? (
            <div>
              <Text type="secondary">素材链接：</Text>
              {metadata.sourceUrls.slice(0, 10).map((url, index) => (
                <Paragraph
                  key={`${url}-${index}`}
                  copyable={{ text: url }}
                  ellipsis={{ rows: 2, expandable: true }}
                  style={{ margin: '4px 0 0' }}
                >
                  {url}
                </Paragraph>
              ))}
            </div>
          ) : null}
        </Space>
      </div>
    );
  }
  const urls = Array.isArray(metadata.originalVideoUrls) && metadata.originalVideoUrls.length
    ? metadata.originalVideoUrls
    : Array.isArray(metadata.originalUrls)
      ? metadata.originalUrls
      : metadata.originalVideoUrl
        ? [metadata.originalVideoUrl]
        : [];
  const targetSizes = Array.isArray(metadata.targetSizes) ? metadata.targetSizes : [];
  const taskSummaries = Array.isArray(metadata.taskSummaries) ? metadata.taskSummaries : [];
  return (
    <div style={{ padding: '4px 0' }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Text type="secondary">
          批次/任务：{metadata.batchId || metadata.jobId || '-'}
          {metadata.totalCount != null ? ` · 数量 ${metadata.totalCount}` : ''}
          {metadata.videoCount != null ? ` · 视频 ${metadata.videoCount}` : ''}
          {metadata.imageCount != null ? ` · 图片 ${metadata.imageCount}` : ''}
          {metadata.htmlCount != null ? ` · HTML ${metadata.htmlCount}` : ''}
        </Text>
        {targetSizes.length ? (
          <Text type="secondary">目标尺寸：{targetSizes.join('、')}</Text>
        ) : null}
        {urls.length ? (
          <div>
            <Text type="secondary">原始链接：</Text>
            {urls.slice(0, 20).map((url, index) => (
              <Paragraph
                key={`${url}-${index}`}
                copyable={{ text: url }}
                ellipsis={{ rows: 2, expandable: true }}
                style={{ margin: '4px 0 0' }}
              >
                {url}
              </Paragraph>
            ))}
            {urls.length > 20 ? (
              <Text type="secondary">还有 {urls.length - 20} 条链接已省略</Text>
            ) : null}
          </div>
        ) : null}
        {taskSummaries.length ? (
          <Text type="secondary">
            任务摘要：{taskSummaries.slice(0, 5).map((task) => task.filename || task.taskId || '未命名').join('、')}
            {metadata.truncatedTaskCount > 0 ? ` 等，另有 ${metadata.truncatedTaskCount} 条未展开` : ''}
          </Text>
        ) : null}
      </Space>
    </div>
  );
}

function OperationAuditPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [dbEnabled, setDbEnabled] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [platform, setPlatform] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState({ items: [], days: 7 });
  const [error, setError] = useState(null);

  const fetchAudits = useCallback(() => {
    setLoading(true);
    setSummaryLoading(true);
    setError(null);
    const summaryPlatform = platform || 'guangdada';
    const auditsPromise = listOperationAudits({
      page,
      pageSize,
      platform: platform || undefined,
      action: action || undefined,
    });
    const summaryPromise = getOperationAuditSummary({
      platform: summaryPlatform,
      action: 'platform_request',
      days: 7,
      limit: 10,
    });

    return Promise.allSettled([auditsPromise, summaryPromise])
      .then(([auditsResult, summaryResult]) => {
        if (auditsResult.status === 'fulfilled') {
          const data = auditsResult.value;
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
          setDbEnabled(data.dbEnabled !== false);
        } else {
          setError(auditsResult.reason?.message || '加载失败');
        }
        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value || { items: [], days: 7 });
        } else {
          setSummary({ items: [], days: 7, error: summaryResult.reason?.message || '汇总加载失败' });
        }
      })
      .finally(() => {
        setLoading(false);
        setSummaryLoading(false);
      });
  }, [page, pageSize, platform, action]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const columns = [
    {
      title: '时间（北京时间）',
      dataIndex: 'createdAt',
      width: 170,
      render: renderAuditTime,
    },
    {
      title: '操作人',
      key: 'operator',
      width: 160,
      render: (_, row) => (
        <div>
          <div>{row.operatorName || '-'}</div>
          {row.operatorEmail ? (
            <Text type="secondary" style={{ fontSize: 12 }}>{row.operatorEmail}</Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      width: 120,
      render: (value) => PLATFORM_LABEL[value] || value || '-',
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 110,
      render: (value) => ACTION_LABEL[value] || value || '-',
    },
    {
      title: '目标账号',
      dataIndex: 'targetAccount',
      width: 200,
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value) => (
        <Tag color={STATUS_COLOR[value] || 'default'}>
          {STATUS_LABEL[value] || value || '-'}
        </Tag>
      ),
    },
    {
      title: '说明',
      dataIndex: 'message',
      ellipsis: true,
      render: (value) => value || '-',
    },
  ];

  return (
    <div className="operation-audit-page">
      <div className="operation-audit-page__intro">
        <Paragraph type="secondary" className="operation-audit-page__desc">
          记录各平台登录、素材下载与批量转码提交等敏感操作，便于追溯谁在何时使用了哪个账户或素材。
        </Paragraph>
        <Space wrap>
          <Link to={ROUTES.HEALTH}>
            <Button icon={<ArrowLeftOutlined />}>返回健康概览</Button>
          </Link>
          <Button icon={<ReloadOutlined />} onClick={fetchAudits} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert type="error" showIcon message={error} className="operation-audit-page__alert" />
      ) : null}

      {!dbEnabled ? (
        <Alert
          type="info"
          showIcon
          className="operation-audit-page__alert"
          message="当前使用服务器本地文件存储"
          description="MySQL 未连接，审计记录写入 server/data/operation-audits.json。RDS 白名单配置完成后重启容器即可切回数据库。"
        />
      ) : null}

      <Card bordered={false} className="operation-audit-page__filters">
        <Space wrap size={[16, 12]}>
          <span>
            平台
            <Select
              className="operation-audit-page__select"
              value={platform}
              options={PLATFORM_OPTIONS}
              onChange={(value) => {
                setPlatform(value);
                setPage(1);
              }}
            />
          </span>
          <span>
            操作类型
            <Select
              className="operation-audit-page__select"
              value={action}
              options={ACTION_OPTIONS}
              onChange={(value) => {
                setAction(value);
                setPage(1);
              }}
            />
          </span>
        </Space>
      </Card>

      <Card
        bordered={false}
        className="operation-audit-page__summary-card"
        title={`${PLATFORM_LABEL[platform || 'guangdada'] || '广大大'}近 ${summary.days || 7} 天额度消耗榜`}
      >
        <Table
          rowKey="operatorKey"
          size="small"
          loading={summaryLoading}
          pagination={false}
          dataSource={summary.items || []}
          columns={[
            {
              title: '排名',
              dataIndex: 'rank',
              width: 70,
              render: (value) => <Tag color={value <= 3 ? 'blue' : 'default'}>{value}</Tag>,
            },
            {
              title: '操作人',
              key: 'operator',
              width: 180,
              render: (_, row) => (
                <div>
                  <div>{row.operatorName || '-'}</div>
                  {row.operatorEmail ? <Text type="secondary" style={{ fontSize: 12 }}>{row.operatorEmail}</Text> : null}
                </div>
              ),
            },
            {
              title: '额度消耗',
              dataIndex: 'quotaAmount',
              width: 110,
              render: (value) => <Text strong>{Number(value || 0).toLocaleString('zh-CN')}</Text>,
            },
            {
              title: '请求数',
              dataIndex: 'totalRequests',
              width: 90,
            },
            {
              title: '成功/拦截/失败',
              key: 'statusCounts',
              width: 150,
              render: (_, row) => `${row.successCount || 0} / ${row.blockedCount || 0} / ${row.failedCount || 0}`,
            },
            {
              title: '额度类型',
              dataIndex: 'quotaByKey',
              render: (value) => formatQuotaBreakdown(value),
            },
            {
              title: '最近请求',
              dataIndex: 'lastAt',
              width: 170,
              render: (value, row) => value ? formatBeijingTime(value) : (row.lastAtFormatted || '-'),
            },
          ]}
          locale={{ emptyText: summary.error || '暂无请求消耗记录' }}
        />
      </Card>

      <Card bordered={false} className="operation-audit-page__table-card">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          expandable={{
            expandedRowRender: renderAuditMetadata,
            rowExpandable: (row) => !!row.metadata,
          }}
          scroll={{ x: 960 }}
          locale={{ emptyText: '暂无审计记录' }}
        />
      </Card>
    </div>
  );
}

export default OperationAuditPage;
