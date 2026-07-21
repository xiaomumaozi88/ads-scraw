import {
  processItemToBlob,
  processVideoToBlob,
  buildProcessedFilename,
} from './batchDownloadProcessor.js';
import { saveProcessedBlob } from './downloadFolder.js';
import { computeBatchStatus } from './materialProcessingStorage.js';

const CONCURRENCY = 3;

function buildVideoMeta(task, context) {
  return {
    clientBatchId: context.batchId ?? null,
    clientTaskId: task.id,
    sourceLabel: task.sourceLabel || context.batchSourceLabel || null,
    serverJobId: task.serverJobId || null,
    onJobSubmitted: (jobId) => context.onJobSubmitted?.(task.id, jobId),
  };
}

/**
 * 执行单个任务：处理 + 保存
 */
export async function executeProcessingTask(task, directoryHandle, onProgress, context = {}) {
  const payload = task.processPayload || {};
  const { url, isVideo, isHtml, filename, targetW, targetH, baseFilename } = payload;

  if (!url) {
    throw new Error('缺少源文件或链接');
  }

  const videoMeta = buildVideoMeta(task, context);
  let blob;
  let finalFilename;

  if (payload.mode === 'localVideoResize') {
    blob = await processVideoToBlob(url, targetW, targetH, onProgress, videoMeta);
    finalFilename = buildProcessedFilename({
      url,
      isVideo: true,
      isHtml: false,
      filename,
      baseFilename,
      blob,
    });
  } else {
    ({ blob, finalFilename } = await processItemToBlob(
      { url, isVideo, isHtml, filename },
      targetW,
      targetH,
      onProgress,
      baseFilename,
      isVideo ? videoMeta : {}
    ));
  }

  await saveProcessedBlob(blob, finalFilename, directoryHandle);
  return { finalFilename };
}

/**
 * 并发执行批次内所有 pending/error 任务（重试时仅跑指定 task）
 */
export async function runBatchTasks({
  batch,
  directoryHandle,
  localFileResolver,
  taskIds = null,
  onTaskUpdate,
  onBatchUpdate,
}) {
  const tasksToRun = batch.tasks.filter((t) => {
    if (taskIds && !taskIds.includes(t.id)) return false;
    if (t.status === 'pending' || t.status === 'error') return true;
    if (t.status === 'processing' && t.isVideo && t.serverJobId) return true;
    return false;
  });

  if (tasksToRun.length === 0) return batch;

  const context = {
    batchId: batch.id,
    batchSourceLabel: batch.sourceLabel,
    onJobSubmitted: (taskId, jobId) => {
      onTaskUpdate(batch.id, taskId, { serverJobId: jobId });
    },
  };

  let nextIndex = 0;
  const runOne = async () => {
    while (nextIndex < tasksToRun.length) {
      const task = tasksToRun[nextIndex++];
      const payload = { ...task.processPayload };

      if (task.sourceType === 'local') {
        const file = localFileResolver?.(task.id);
        if (!file) {
          onTaskUpdate(batch.id, task.id, {
            status: 'error',
            progress: 0,
            errorMessage: '本地源文件已失效，请重新上传后再试',
          });
          continue;
        }
        if (!payload.url || payload.url.startsWith('blob:')) {
          payload.url = URL.createObjectURL(file);
        }
      }

      if (!(task.status === 'processing' && task.serverJobId)) {
        onTaskUpdate(batch.id, task.id, {
          status: 'processing',
          progress: 0,
          errorMessage: null,
        });
      }

      try {
        const { finalFilename } = await executeProcessingTask(
          { ...task, processPayload: payload },
          directoryHandle,
          (percent) => {
            onTaskUpdate(batch.id, task.id, {
              status: 'processing',
              progress: Math.min(99, Math.max(0, percent ?? 0)),
            });
          },
          context
        );
        onTaskUpdate(batch.id, task.id, {
          status: 'done',
          progress: 100,
          finalFilename,
          errorMessage: null,
          serverJobId: null,
        });
      } catch (e) {
        onTaskUpdate(batch.id, task.id, {
          status: 'error',
          progress: 0,
          errorMessage: e?.message || String(e),
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasksToRun.length) }, runOne)
  );

  onBatchUpdate(batch.id);
  return batch;
}

export { computeBatchStatus };
