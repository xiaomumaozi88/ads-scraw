import React, { useEffect } from 'react';
import {
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMaterialProcessing } from '../../contexts/MaterialProcessingContext';
import { formatBatchTime } from '../../utils/materialProcessingStorage';
import { ProcessingTaskRow } from '../../components/DownloadListDrawer';
import FolderPickerField from '../../components/FolderPickerField';
import '../../components/DownloadListDrawer.css';
import './MaterialProcessingHistoryPage.css';

const { Title, Text } = Typography;

const STATUS_COLOR = {
  running: 'processing',
  completed: 'success',
  partial: 'warning',
  failed: 'error',
};

const STATUS_LABEL = {
  running: '处理中',
  completed: '已完成',
  partial: '部分失败',
  failed: '失败',
};

function MaterialProcessingHistoryPage() {
  const {
    historyBatches,
    retryTask,
    runBatchById,
    clearHistory,
    downloading,
    refreshHistoryFromStorage,
  } = useMaterialProcessing();

  useEffect(() => {
    refreshHistoryFromStorage();
  }, [refreshHistoryFromStorage]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshHistoryFromStorage();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshHistoryFromStorage]);

  return (
    <div className="processing-history-page">
      <Card className="processing-history-page__intro">
        <Title level={4} style={{ marginTop: 0 }}>素材处理历史</Title>
        <Text type="secondary">
          记录 Insightrackr、Sensor Tower、广大大等平台下载与素材尺寸修改等所有处理批次。可查看原链接、尺寸信息，并对失败任务重试。
        </Text>
      </Card>

      <div className="processing-history-page__toolbar">
        <FolderPickerField />
        <Popconfirm
          title="确定清空全部处理历史？"
          onConfirm={clearHistory}
          okText="清空"
          cancelText="取消"
          disabled={historyBatches.length === 0}
        >
          <Button danger disabled={historyBatches.length === 0}>
            清空历史
          </Button>
        </Popconfirm>
      </div>

      {historyBatches.length === 0 ? (
        <Card>
          <Empty description="暂无处理历史" />
        </Card>
      ) : (
        historyBatches.map((batch) => {
          const failedTasks = batch.tasks.filter((t) => t.status === 'error');
          return (
            <Card key={batch.id} className="processing-history-batch">
              <div className="processing-history-batch__head">
                <div className="processing-history-batch__meta">
                  <Space wrap>
                    <Tag>{batch.sourceLabel || batch.source}</Tag>
                    <Tag color={STATUS_COLOR[batch.status] || 'default'}>
                      {STATUS_LABEL[batch.status] || batch.status}
                    </Tag>
                  </Space>
                  <Text type="secondary">{formatBatchTime(batch.createdAt)}</Text>
                  {batch.folderName && (
                    <Text type="secondary">保存文件夹：{batch.folderName}</Text>
                  )}
                  <Text type="secondary">
                    共 {batch.tasks.length} 项
                    {failedTasks.length > 0 ? `，${failedTasks.length} 项失败` : ''}
                  </Text>
                </div>
                {failedTasks.length > 0 && (
                  <Button
                    size="small"
                    loading={downloading}
                    onClick={() => runBatchById(batch.id, failedTasks.map((t) => t.id))}
                  >
                    重试失败项
                  </Button>
                )}
              </div>
              <div className="processing-history-batch__tasks">
                {batch.tasks.map((task) => (
                  <ProcessingTaskRow
                    key={task.id}
                    batchId={batch.id}
                    task={task}
                    onRetry={retryTask}
                  />
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default MaterialProcessingHistoryPage;
