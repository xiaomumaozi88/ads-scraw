import React, { useEffect, useRef, useState } from 'react';
import { Drawer, Tag, Button, Space, Typography, Progress, Tooltip, List } from 'antd';
import { ReloadOutlined, LinkOutlined, HistoryOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMaterialProcessing } from '../contexts/MaterialProcessingContext';
import { getTranscodeQueueStatus } from '../utils/api';
import './DownloadListDrawer.css';

const { Text, Link } = Typography;

const TRANSCODE_PHASE_LABEL = {
  queued: '排队中',
  downloading: '下载中',
  probing: '探测元数据',
  transcoding: '转码中',
};

function formatOriginalSize(task) {
  if (task.originalWidth && task.originalHeight) {
    return `${task.originalWidth}×${task.originalHeight}`;
  }
  return '—';
}

function ProcessingTaskRow({ batchId, task, onRetry, compact = false }) {
  const canOpenSource = task.sourceUrl && !task.sourceUrl.startsWith('blob:');
  const handleRetry = () => {
    if (!batchId) return;
    onRetry(batchId, task.id);
  };
  return (
    <div className={`processing-task-row processing-task-row--${task.status}`}>
      <div className="processing-task-row__head">
        {task.sizeLabel && (
          <Tag className="processing-task-row__size-tag">{task.sizeLabel}</Tag>
        )}
        <Text className="processing-task-row__filename" ellipsis={{ tooltip: task.finalFilename || task.filename }}>
          {task.finalFilename || task.filename}
        </Text>
        {(task.status === 'error' || task.status === 'done') && (
          <Tooltip title="重试该任务">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRetry}
            />
          </Tooltip>
        )}
      </div>
      {!compact && (
        <div className="processing-task-row__meta">
          <span>原尺寸：{formatOriginalSize(task)}</span>
          <span>
            目标：
            {task.targetWidth && task.targetHeight
              ? `${task.targetWidth}×${task.targetHeight}`
              : task.sizeLabel || '原尺寸'}
          </span>
        </div>
      )}
      {!compact && task.sourceLabel && (
        <Text type="secondary" className="processing-task-row__source-label">
          {task.sourceLabel}
        </Text>
      )}
      {!compact && canOpenSource && (
        <Link href={task.sourceUrl} target="_blank" rel="noopener noreferrer" className="processing-task-row__link">
          <LinkOutlined /> 查看原链接
        </Link>
      )}
      {task.status === 'error' && task.errorMessage && (
        <Text type="danger" className="processing-task-row__error">{task.errorMessage}</Text>
      )}
      {(task.status === 'processing' || task.status === 'done') && (
        <Progress
          percent={task.status === 'done' ? 100 : Math.max(task.progress, 2)}
          size="small"
          status={task.status === 'processing' ? 'active' : 'success'}
          showInfo={false}
        />
      )}
    </div>
  );
}

function TranscodeQueueBlock({ status, videoPending }) {
  if (!status) return null;

  const running = status.running ?? 0;
  const waiting = status.waiting ?? 0;
  const maxConcurrent = status.maxConcurrent ?? 0;
  const jobs = status.jobs ?? [];
  const hasActivity = running > 0 || waiting > 0 || jobs.length > 0;

  if (!hasActivity && videoPending === 0) return null;

  return (
    <div className="download-list-drawer-queue-block">
      <div className="download-list-drawer-queue-block__summary">
        <Text strong>服务器转码队列</Text>
        <Text type="secondary">
          槽位 {running}/{maxConcurrent || '-'} · 排队 {waiting}
          {videoPending > 0 ? ` · 本批次待处理视频 ${videoPending}` : ''}
        </Text>
      </div>
      {jobs.length > 0 ? (
        <List
          size="small"
          className="download-list-drawer-queue-block__list"
          dataSource={jobs}
          renderItem={(job) => {
            const isQueued = job.status === 'queued';
            const phaseLabel = TRANSCODE_PHASE_LABEL[job.phase] || job.phase || '处理中';
            return (
              <List.Item className="download-list-drawer-queue-block__item">
                <div className="download-list-drawer-queue-block__item-main">
                  <Space size={4} wrap>
                    <Tag color={isQueued ? 'default' : 'processing'}>{phaseLabel}</Tag>
                    {isQueued && job.queuePosition != null ? (
                      <Tag>#{job.queuePosition}</Tag>
                    ) : null}
                    {job.targetSize ? <Text type="secondary">{job.targetSize}</Text> : null}
                    {job.creatorName ? <Text type="secondary">{job.creatorName}</Text> : null}
                  </Space>
                  {job.videoUrlPreview ? (
                    <Text type="secondary" ellipsis={{ tooltip: job.videoUrlPreview }} className="download-list-drawer-queue-block__url">
                      {job.videoUrlPreview}
                    </Text>
                  ) : null}
                </div>
                <Text type="secondary" className="download-list-drawer-queue-block__duration">
                  {isQueued ? job.waitDurationText : job.runDurationText || job.waitDurationText}
                </Text>
              </List.Item>
            );
          }}
        />
      ) : (
        <Text type="secondary" className="download-list-drawer-queue-block__empty">
          暂无活跃转码任务（本批次视频可能仍在下载或未提交转码）
        </Text>
      )}
    </div>
  );
}

function DownloadListDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const transcodeQueuePollRef = useRef(null);
  const [transcodeQueueStatus, setTranscodeQueueStatus] = useState(null);
  const {
    currentBatch,
    downloadList,
    downloading,
    retryTask,
  } = useMaterialProcessing();

  useEffect(() => {
    if (!open) {
      setTranscodeQueueStatus(null);
      if (transcodeQueuePollRef.current) {
        clearInterval(transcodeQueuePollRef.current);
        transcodeQueuePollRef.current = null;
      }
      return;
    }
    const fetchQueue = () => {
      getTranscodeQueueStatus()
        .then(setTranscodeQueueStatus)
        .catch(() => setTranscodeQueueStatus(null));
    };
    fetchQueue();
    transcodeQueuePollRef.current = setInterval(fetchQueue, 3000);
    return () => {
      if (transcodeQueuePollRef.current) {
        clearInterval(transcodeQueuePollRef.current);
        transcodeQueuePollRef.current = null;
      }
    };
  }, [open]);

  const pendingOrProcessing = downloadList.filter(
    (item) => item.status === 'pending' || item.status === 'processing'
  ).length;

  const videoPending = downloadList.filter(
    (i) => i.isVideo && (i.status === 'pending' || i.status === 'processing')
  ).length;

  return (
    <Drawer
      title={
        <Space>
          <span>下载处理列表</span>
          {downloading && <Tag color="processing">处理中</Tag>}
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      width={640}
      className="download-list-drawer"
      extra={
        <Button
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => {
            onClose();
            navigate('/tools/material-processing/history');
          }}
        >
          处理历史
        </Button>
      }
    >
      {currentBatch && (
        <div className="download-list-drawer__batch-info">
          <Text type="secondary">
            当前批次：{currentBatch.sourceLabel}
            {currentBatch.folderName ? ` · 保存至 ${currentBatch.folderName}` : ''}
          </Text>
        </div>
      )}
      {open ? (
        <TranscodeQueueBlock status={transcodeQueueStatus} videoPending={videoPending} />
      ) : null}
      {downloadList.length === 0 ? (
        <div className="download-list-drawer-empty">
          暂无进行中的下载任务
          <div style={{ marginTop: 12 }}>
            <Button type="link" onClick={() => { onClose(); navigate('/tools/material-processing/history'); }}>
              查看处理历史
            </Button>
          </div>
        </div>
      ) : (
        <div className="download-list-drawer-body">
          {pendingOrProcessing > 0 && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              进行中 {pendingOrProcessing} / {downloadList.length}
            </Text>
          )}
          {downloadList.map((task) => (
            <ProcessingTaskRow
              key={task.id}
              batchId={currentBatch?.id}
              task={task}
              onRetry={retryTask}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

export { ProcessingTaskRow };
export default DownloadListDrawer;
