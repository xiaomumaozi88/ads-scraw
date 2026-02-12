/**
 * 在 npm install 时下载 ffmpeg.wasm 核心到 client/public/
 * 部署/构建后由前端从同源加载，用户首次使用无需再从 CDN 拉取约 31MB
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'client', 'public');
const CORE_VERSION = '0.12.10';
const BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
const FILES = [
  { name: 'ffmpeg-core.js', minSize: 100000 },
  { name: 'ffmpeg-core.wasm', minSize: 20000000 },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  for (const { name, minSize } of FILES) {
    const filePath = path.join(PUBLIC_DIR, name);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size >= minSize) {
      console.log(`[download-ffmpeg-core] 已存在且有效，跳过: ${name}`);
      continue;
    }
    const url = `${BASE}/${name}`;
    console.log(`[download-ffmpeg-core] 下载中: ${name}`);
    const buf = await download(url);
    fs.writeFileSync(filePath, buf);
    console.log(`[download-ffmpeg-core] 已写入: ${filePath} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  }
  console.log('[download-ffmpeg-core] 完成');
}

main().catch((e) => {
  console.error('[download-ffmpeg-core] 失败:', e.message);
  process.exit(1);
});
