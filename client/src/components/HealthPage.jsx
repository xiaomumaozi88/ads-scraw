import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRequestError } from '../utils/api';
import './HealthPage.css';

const API_BASE = '/api';

function HealthPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchHealth = React.useCallback(() => {
    setLoading(true);
    setError(null);
    setActionError(null);
    fetch(`${API_BASE}/health`, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) setData(json.data);
        else setError(formatRequestError(json.message || '请求失败'));
      })
      .catch((err) => setError(formatRequestError(err.message || '请求异常')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleClearLogs = () => {
    setActionError(null);
    fetch(`${API_BASE}/health/clear-logs`, { method: 'POST', credentials: 'same-origin' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) fetchHealth();
        else setActionError(json.message || '清除失败');
      })
      .catch((err) => setActionError(err.message || '请求异常'));
  };

  const handleReopenBrowser = () => {
    setActionError(null);
    setReopenLoading(true);
    fetch(`${API_BASE}/health/reopen-browser`, { method: 'POST', credentials: 'same-origin' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) fetchHealth();
        else setActionError(json.message || '重新打开失败');
      })
      .catch((err) => setActionError(err.message || '请求异常'))
      .finally(() => setReopenLoading(false));
  };

  return (
    <div className="health-page">
      <div className="health-header">
        <button type="button" className="health-back" onClick={() => navigate('/')}>
          ← 返回首页
        </button>
        <h1>浏览器健康检查</h1>
        <p className="health-desc">用于排查浏览器实例、页面数量及登录账号状态</p>
      </div>

      {loading && <div className="health-loading">加载中...</div>}
      {error && <div className="health-error">{error}</div>}
      {actionError && <div className="health-error health-action-error">{actionError}</div>}

      {data && !loading && (
        <div className="health-content">
          <section className="health-summary">
            <h2>汇总</h2>
            <ul>
              <li>浏览器实例数：<strong>{data.summary?.totalBrowsers ?? '-'}</strong></li>
              <li>总页面数（标签页）：<strong>{data.summary?.totalPages ?? '-'}</strong></li>
              <li>上次启动时间：<strong>{data.summary?.lastStartTimeFormatted ?? '-'}</strong></li>
              <li>窗口打开时长：<strong>{data.summary?.uptimeText ?? '-'}</strong></li>
            </ul>
            <div className="health-summary-actions">
              <button type="button" className="health-btn health-btn-primary" onClick={handleReopenBrowser} disabled={reopenLoading}>
                {reopenLoading ? '正在重新打开窗口...' : '重新打开窗口'}
              </button>
              <button type="button" className="health-btn health-btn-secondary" onClick={handleClearLogs}>
                清除日志
              </button>
            </div>
          </section>

          <section className="health-platforms">
            <h2>各平台</h2>
            {['insightrackr', 'guangdada'].map((key) => {
              const p = data[key];
              if (!p) return null;
              return (
                <div key={key} className="health-card">
                  <h3>{p.name ?? key}</h3>
                  <dl>
                    <dt>浏览器已创建</dt>
                    <dd>{p.browserExists ? '是' : '否'}</dd>
                    <dt>当前页面数</dt>
                    <dd>{p.pageCount ?? '-'}</dd>
                    <dt>登录状态</dt>
                    <dd>{p.status ?? '-'} {p.isLoggedIn ? '(已登录)' : ''}</dd>
                    <dt>登录账号</dt>
                    <dd>{p.email ? String(p.email) : '-'}</dd>
                    {p.error && (
                      <>
                        <dt>错误信息</dt>
                        <dd className="health-error-text">{p.error}</dd>
                      </>
                    )}
                  </dl>
                </div>
              );
            })}
          </section>

          {((data.recentErrors && data.recentErrors.length > 0) || (data.recentLogs && data.recentLogs.length > 0)) && (
            <section className="health-logs">
              <h2>错误与日志</h2>
              {data.recentErrors && data.recentErrors.length > 0 && (
                <div className="health-log-block">
                  <h3>最近错误</h3>
                  <ul className="health-log-list health-log-list--error">
                    {data.recentErrors.slice(-20).reverse().map((entry, i) => (
                      <li key={`err-${i}`} className="health-log-entry">
                        <span className="health-log-time">{entry.time}</span>
                        <span className="health-log-level">{entry.level}</span>
                        <span className="health-log-msg">{entry.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.recentLogs && data.recentLogs.length > 0 && (
                <div className="health-log-block">
                  <h3>最近日志（最近 {Math.min(30, data.recentLogs.length)} 条）</h3>
                  <ul className="health-log-list">
                    {data.recentLogs.slice(-30).reverse().map((entry, i) => (
                      <li key={`log-${i}`} className={`health-log-entry health-log-entry--${(entry.level || '').toLowerCase()}`}>
                        <span className="health-log-time">{entry.time}</span>
                        <span className="health-log-level">{entry.level}</span>
                        <span className="health-log-msg">{entry.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default HealthPage;
