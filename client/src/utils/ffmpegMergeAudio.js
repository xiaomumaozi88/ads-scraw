/**
 * 使用 FFmpeg.wasm 将原视频的音频轨合并到「仅画面的 WebM」中，导出带声音的 WebM。
 * 首次调用会从 CDN 加载 FFmpeg 核心（约 31MB），之后复用同一实例。
 */

let ffmpegInstance = null;
let loadPromise = null;

const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL, fetchFile } = await import('@ffmpeg/util');
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();
  return loadPromise;
}

/**
 * 将原视频的音频合并到「仅画面的 WebM」里。
 * @param {Blob} originalVideoBlob - 原视频（含音轨）
 * @param {Blob} videoOnlyWebmBlob - 仅画面的 WebM（Canvas 录制）
 * @returns {Promise<Blob>} 带音频的 WebM；若合并失败（如原视频无音轨）则返回 videoOnlyWebmBlob
 */
export async function mergeAudioIntoVideo(originalVideoBlob, videoOnlyWebmBlob) {
  if (!originalVideoBlob || !videoOnlyWebmBlob || videoOnlyWebmBlob.size < 1000) {
    return videoOnlyWebmBlob;
  }
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    const ffmpeg = await getFFmpeg();
    const audioExt = (originalVideoBlob.type || '').includes('webm') ? 'webm' : 'mp4';
    await ffmpeg.writeFile(`audio_src.${audioExt}`, await fetchFile(originalVideoBlob));
    await ffmpeg.writeFile('video.webm', await fetchFile(videoOnlyWebmBlob));
    await ffmpeg.exec([
      '-i', `audio_src.${audioExt}`,
      '-i', 'video.webm',
      '-map', '0:a',
      '-map', '1:v',
      '-c:v', 'copy',
      '-c:a', 'libopus',
      '-shortest',
      '-y',
      'output.webm',
    ]);
    const data = await ffmpeg.readFile('output.webm');
    await ffmpeg.deleteFile(`audio_src.${audioExt}`);
    await ffmpeg.deleteFile('video.webm');
    await ffmpeg.deleteFile('output.webm');
    const buf = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data.buffer;
    return new Blob([buf], { type: 'video/webm' });
  } catch (e) {
    console.warn('[ffmpegMergeAudio] 合并音频失败，返回仅画面:', e?.message ?? e);
    return videoOnlyWebmBlob;
  }
}
