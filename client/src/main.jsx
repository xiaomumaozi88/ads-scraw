import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import App from './App';
import ExternalSearchDebugPage from './components/ExternalSearchDebugPage';
import { DownloadListProvider } from './contexts/DownloadListContext';
import { AuthProvider, AuthGate } from './contexts/AuthContext';
import { FEATURES } from './config/features';
import { ROUTES } from './config/routes';
import 'antd/dist/reset.css';
import 'flag-icon-css/css/flag-icons.min.css';
import './styles/index.css';

if (import.meta.env.DEV) {
  console.info(
    '%c[ads-scraw]%c 开发入口已加载（若页面仍是 Vite 默认模板，请尝试 127.0.0.1:5173、无痕窗口，或检查系统代理/Clash 对 localhost 的绕过）',
    'color:#0d47a1;font-weight:bold',
    'color:inherit;font-weight:normal'
  );
  window.__ADS_SCRAW_CLIENT__ = true;
}

function RoutedApp() {
  const location = useLocation();
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

function RoutedExternalSearchDebugPage() {
  const location = useLocation();
  return (
    <AuthGate>
      <ExternalSearchDebugPage />
    </AuthGate>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DownloadListProvider>
          <Routes>
            <Route path="/" element={<RoutedApp />} />
            <Route path={ROUTES.INSIGHTRACKR} element={<RoutedApp />} />
            <Route path={`${ROUTES.GUANGDADA}/*`} element={<RoutedApp />} />
            <Route path={ROUTES.SENSORTOWER} element={<RoutedApp />} />
            <Route path="/insightrackr" element={<Navigate to={ROUTES.INSIGHTRACKR} replace />} />
            <Route path="/guangdada/*" element={<Navigate to={ROUTES.GUANGDADA} replace />} />
            <Route path="/sensortower" element={<Navigate to={ROUTES.SENSORTOWER} replace />} />
            <Route path={ROUTES.VIDEO_RESIZE} element={<RoutedApp />} />
            <Route path={ROUTES.MATERIAL_HISTORY} element={<RoutedApp />} />
            <Route path="/health/*" element={<RoutedApp />} />
            {FEATURES.externalSearchDebug ? (
              <Route path={ROUTES.EXTERNAL_SEARCH_DEBUG} element={<RoutedExternalSearchDebugPage />} />
            ) : (
              <Route path={ROUTES.EXTERNAL_SEARCH_DEBUG} element={<Navigate to={ROUTES.INSIGHTRACKR} replace />} />
            )}
          </Routes>
        </DownloadListProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
