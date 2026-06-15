import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import HealthPage from './components/HealthPage';
import ExternalSearchDebugPage from './components/ExternalSearchDebugPage';
import { DownloadListProvider } from './contexts/DownloadListContext';
import 'antd/dist/reset.css';
import 'flag-icon-css/css/flag-icons.min.css';
import './styles/index.css';

if (import.meta.env.DEV) {
  // 打开控制台应看到此行；若看不到，说明浏览器并未执行本仓库入口（代理/缓存/其它端口上的项目）
  console.info(
    '%c[ads-scraw]%c 开发入口已加载（若页面仍是 Vite 默认模板，请尝试 127.0.0.1:5173、无痕窗口，或检查系统代理/Clash 对 localhost 的绕过）',
    'color:#0d47a1;font-weight:bold',
    'color:inherit;font-weight:normal'
  );
  window.__ADS_SCRAW_CLIENT__ = true;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DownloadListProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/insightrackr" element={<App />} />
        <Route path="/guangdada" element={<App />} />
        <Route path="/sensortower" element={<App />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/external-search-debug" element={<ExternalSearchDebugPage />} />
      </Routes>
      </DownloadListProvider>
    </BrowserRouter>
  </React.StrictMode>
);
