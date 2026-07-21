const FOLDER_NAME_STORAGE_KEY = 'ads-scraw:download-folder-name';

/** 浏览器是否支持选择保存文件夹（File System Access API） */
export function isFolderPickerSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export function readStoredFolderName() {
  try {
    return localStorage.getItem(FOLDER_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function writeStoredFolderName(name) {
  try {
    if (name) localStorage.setItem(FOLDER_NAME_STORAGE_KEY, name);
    else localStorage.removeItem(FOLDER_NAME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 弹出文件夹选择器，返回 DirectoryHandle 或 null（用户取消 / 不支持） */
export async function pickDownloadDirectory() {
  if (!isFolderPickerSupported()) return null;
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    writeStoredFolderName(handle.name || '已选文件夹');
    return handle;
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}

export async function saveBlobToDirectory(directoryHandle, filename, blob) {
  if (!directoryHandle) {
    throw new Error('未选择保存文件夹');
  }
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** 保存到指定文件夹；无 folderHandle 时回退为浏览器默认下载 */
export async function saveProcessedBlob(blob, filename, directoryHandle = null) {
  if (directoryHandle) {
    await saveBlobToDirectory(directoryHandle, filename, blob);
    return { mode: 'folder', filename };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { mode: 'browser', filename };
}

export function formatSizeLabel(width, height) {
  if (!width || !height) return '原尺寸';
  return `${width}×${height}`;
}
