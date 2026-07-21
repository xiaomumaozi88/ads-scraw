import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createBatchId,
  createTaskId,
  loadHistoryBatches,
  saveHistoryBatches,
  computeBatchStatus,
} from '../utils/materialProcessingStorage.js';
import { runBatchTasks } from '../utils/materialProcessingRunner.js';
import {
  isFolderPickerSupported,
  pickDownloadDirectory,
  readStoredFolderName,
  writeStoredFolderName,
} from '../utils/downloadFolder.js';
import { auditMaterialBatchSubmit } from '../utils/api.js';

const MaterialProcessingContext = createContext(null);

function hasQueuedWork(batch) {
  return batch?.tasks?.some(
    (task) =>
      task.status === 'pending' ||
      (task.status === 'processing' && task.isVideo && task.serverJobId)
  );
}

function getNextQueuedBatch(batches) {
  return [...(batches || [])]
    .filter(hasQueuedWork)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0] ?? null;
}

function getBatchSizeLabel(tasks) {
  return [...new Set((tasks || []).map((task) => task.sizeLabel).filter(Boolean))].join('、') || '';
}

export function MaterialProcessingProvider({ children }) {
  const [historyBatches, setHistoryBatches] = useState(() => loadHistoryBatches());
  const [currentBatchId, setCurrentBatchId] = useState(() => {
    const batches = loadHistoryBatches();
    const running = batches.find((b) => b.status === 'running');
    return running?.id ?? batches[0]?.id ?? null;
  });
  const [downloading, setDownloading] = useState(false);
  const [batchSizeLabel, setBatchSizeLabel] = useState('');
  const [downloadDirectoryHandle, setDownloadDirectoryHandle] = useState(null);
  const [downloadFolderName, setDownloadFolderName] = useState(() => readStoredFolderName());
  const localFileMapRef = useRef(new Map());
  const directoryHandleRef = useRef(null);
  const historyRef = useRef(historyBatches);
  const queueRunningRef = useRef(false);
  historyRef.current = historyBatches;
  const resumeAttemptedRef = useRef(false);

  const persistBatches = useCallback((batches) => {
    historyRef.current = batches;
    saveHistoryBatches(batches);
    setHistoryBatches(batches);
  }, []);

  const currentBatch = useMemo(
    () => historyBatches.find((b) => b.id === currentBatchId) ?? null,
    [historyBatches, currentBatchId]
  );

  const downloadList = currentBatch?.tasks ?? [];

  const updateBatchInState = useCallback((batchId, updater) => {
    const prev = historyRef.current;
    const idx = prev.findIndex((b) => b.id === batchId);
    if (idx === -1) return;
    const updated = typeof updater === 'function' ? updater(prev[idx]) : updater;
    const next = [...prev];
    next[idx] = updated;
    historyRef.current = next;
    saveHistoryBatches(next);
    setHistoryBatches(next);
  }, []);

  const updateTaskInBatch = useCallback((batchId, taskId, updates) => {
    updateBatchInState(batchId, (batch) => {
      const tasks = batch.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
      return {
        ...batch,
        tasks,
        status: computeBatchStatus(tasks),
      };
    });
  }, [updateBatchInState]);

  const finalizeBatchStatus = useCallback((batchId) => {
    updateBatchInState(batchId, (batch) => ({
      ...batch,
      status: computeBatchStatus(batch.tasks),
    }));
  }, [updateBatchInState]);

  const pickDownloadFolder = useCallback(async () => {
    const handle = await pickDownloadDirectory();
    if (!handle) return null;
    directoryHandleRef.current = handle;
    setDownloadDirectoryHandle(handle);
    const name = handle.name || '已选文件夹';
    setDownloadFolderName(name);
    writeStoredFolderName(name);
    return handle;
  }, []);

  const clearDownloadFolder = useCallback(() => {
    directoryHandleRef.current = null;
    setDownloadDirectoryHandle(null);
    setDownloadFolderName('');
    writeStoredFolderName('');
  }, []);

  const registerLocalFile = useCallback((taskId, file) => {
    if (taskId && file) localFileMapRef.current.set(taskId, file);
  }, []);

  const resolveLocalFile = useCallback((taskId) => {
    return localFileMapRef.current.get(taskId) ?? null;
  }, []);

  const runQueuedBatches = useCallback(async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    setDownloading(true);
    try {
      while (true) {
        const batch = getNextQueuedBatch(historyRef.current);
        if (!batch) break;
        setCurrentBatchId(batch.id);
        setBatchSizeLabel(getBatchSizeLabel(batch.tasks));
        await runBatchTasks({
          batch,
          directoryHandle: directoryHandleRef.current,
          localFileResolver: resolveLocalFile,
          onTaskUpdate: updateTaskInBatch,
          onBatchUpdate: finalizeBatchStatus,
        });
        finalizeBatchStatus(batch.id);
      }
    } finally {
      queueRunningRef.current = false;
      setDownloading(false);
    }
  }, [updateTaskInBatch, finalizeBatchStatus, resolveLocalFile]);

  const runBatchById = useCallback(async (batchId, taskIds = null) => {
    const batch = historyRef.current.find((b) => b.id === batchId);
    if (!batch) return;
    setCurrentBatchId(batchId);
    setDownloading(true);
    try {
      await runBatchTasks({
        batch,
        directoryHandle: directoryHandleRef.current,
        localFileResolver: resolveLocalFile,
        taskIds,
        onTaskUpdate: updateTaskInBatch,
        onBatchUpdate: finalizeBatchStatus,
      });
    } finally {
      setDownloading(false);
      finalizeBatchStatus(batchId);
    }
  }, [updateTaskInBatch, finalizeBatchStatus, resolveLocalFile]);

  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;

    const batches = loadHistoryBatches();
    const runningBatches = batches.filter((b) => b.status === 'running');
    if (runningBatches.length === 0) return;
    const runningIds = new Set(runningBatches.map((b) => b.id));

    let changed = false;
    const nextBatches = batches.map((batch) => {
      if (!runningIds.has(batch.id)) return batch;
      const tasks = batch.tasks.map((task) => {
        if (task.status !== 'processing') return task;
        if (task.isVideo && task.serverJobId) return task;
        changed = true;
        return { ...task, status: 'pending', progress: 0 };
      });
      const status = computeBatchStatus(tasks);
      return { ...batch, tasks, status };
    });

    const hasWork = nextBatches.some(hasQueuedWork);
    if (!hasWork) return;

    if (changed) {
      saveHistoryBatches(nextBatches);
      historyRef.current = nextBatches;
      setHistoryBatches(nextBatches);
    }

    const timer = setTimeout(() => {
      runQueuedBatches();
    }, 800);
    return () => clearTimeout(timer);
  }, [runQueuedBatches]);

  /**
   * @param {Object} params
   * @param {string} params.source
   * @param {string} params.sourceLabel
   * @param {Array} params.tasks - task definitions before id assignment
   * @param {FileSystemDirectoryHandle|null} [params.folderHandle]
   * @param {string|null} [params.folderName]
   */
  const startBatch = useCallback(async ({
    source,
    sourceLabel,
    tasks,
    folderHandle = null,
    folderName = null,
  }) => {
    if (!tasks?.length) return null;

    if (folderHandle) {
      directoryHandleRef.current = folderHandle;
      setDownloadDirectoryHandle(folderHandle);
      const name = folderName || folderHandle.name || '已选文件夹';
      setDownloadFolderName(name);
      writeStoredFolderName(name);
    }

    const activeFolderName =
      folderName
      || downloadFolderName
      || directoryHandleRef.current?.name
      || null;

    const batchId = createBatchId();
    const batchTasks = tasks.map((t) => {
      const id = t.id || createTaskId();
      if (t.localFile) {
        registerLocalFile(id, t.localFile);
      }
      return {
        id,
        filename: t.filename,
        finalFilename: null,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        sizeLabel: t.sizeLabel,
        sourceUrl: t.sourceUrl ?? t.processPayload?.url ?? '',
        sourceLabel: t.sourceLabel ?? '',
        originalWidth: t.originalWidth ?? null,
        originalHeight: t.originalHeight ?? null,
        targetWidth: t.targetWidth ?? t.processPayload?.targetW ?? null,
        targetHeight: t.targetHeight ?? t.processPayload?.targetH ?? null,
        isVideo: !!t.isVideo,
        isHtml: !!t.isHtml,
        sourceType: t.sourceType || (t.localFile ? 'local' : 'remote'),
        processPayload: t.processPayload,
      };
    });

    const batch = {
      id: batchId,
      createdAt: Date.now(),
      source,
      sourceLabel,
      folderName: activeFolderName,
      status: 'running',
      tasks: batchTasks,
    };

    await auditMaterialBatchSubmit(batch);

    const nextBatches = [batch, ...historyRef.current.filter((b) => b.id !== batchId)];
    historyRef.current = nextBatches;
    saveHistoryBatches(nextBatches);
    setHistoryBatches(nextBatches);
    if (!queueRunningRef.current) {
      setCurrentBatchId(batchId);
      setBatchSizeLabel(getBatchSizeLabel(batchTasks));
    }
    void runQueuedBatches();

    return batchId;
  }, [
    downloadFolderName,
    registerLocalFile,
    runQueuedBatches,
  ]);

  const retryTask = useCallback(async (batchId, taskId) => {
    updateTaskInBatch(batchId, taskId, { status: 'pending', progress: 0, errorMessage: null });
    await runQueuedBatches();
  }, [runQueuedBatches, updateTaskInBatch]);

  const clearHistory = useCallback(() => {
    persistBatches([]);
    setCurrentBatchId(null);
  }, [persistBatches]);

  const refreshHistoryFromStorage = useCallback(() => {
    const batches = loadHistoryBatches();
    historyRef.current = batches;
    setHistoryBatches(batches);
    setCurrentBatchId((prev) => {
      if (prev && batches.some((b) => b.id === prev)) return prev;
      const running = batches.find((b) => b.status === 'running');
      return running?.id ?? batches[0]?.id ?? null;
    });
  }, []);

  const value = useMemo(() => ({
    historyBatches,
    currentBatch,
    currentBatchId,
    downloadList,
    downloading,
    batchSizeLabel,
    downloadDirectoryHandle,
    downloadFolderName,
    isFolderPickerSupported: isFolderPickerSupported(),
    pickDownloadFolder,
    clearDownloadFolder,
    startBatch,
    retryTask,
    runBatchById,
    clearHistory,
    refreshHistoryFromStorage,
    registerLocalFile,
    setBatchSizeLabel,
  }), [
    historyBatches,
    currentBatch,
    currentBatchId,
    downloadList,
    downloading,
    batchSizeLabel,
    downloadDirectoryHandle,
    downloadFolderName,
    pickDownloadFolder,
    clearDownloadFolder,
    startBatch,
    retryTask,
    runBatchById,
    clearHistory,
    refreshHistoryFromStorage,
    registerLocalFile,
  ]);

  return (
    <MaterialProcessingContext.Provider value={value}>
      {children}
    </MaterialProcessingContext.Provider>
  );
}

export function useMaterialProcessing() {
  const ctx = useContext(MaterialProcessingContext);
  if (!ctx) throw new Error('useMaterialProcessing must be used within MaterialProcessingProvider');
  return ctx;
}

export function useDownloadList() {
  const ctx = useMaterialProcessing();
  return {
    downloadList: ctx.downloadList,
    setDownloadList: () => {
      console.warn('[useDownloadList] setDownloadList 已废弃，请使用 startBatch');
    },
    downloading: ctx.downloading,
    setDownloading: () => {
      console.warn('[useDownloadList] setDownloading 已废弃，请使用 startBatch');
    },
    batchSizeLabel: ctx.batchSizeLabel,
    setBatchSizeLabel: ctx.setBatchSizeLabel,
  };
}
