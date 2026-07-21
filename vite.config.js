import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const devApiTarget = process.env.DEV_API_TARGET || `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react()],
  root: './client',
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    /** 占用时直接报错，避免静默改用 5174/5175 导致浏览器仍打开 5173 却看到其它项目的默认页 */
    strictPort: true,
    host: true, // 允许局域网通过 IP 访问
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
      '/sso': {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
    },
  },
});
