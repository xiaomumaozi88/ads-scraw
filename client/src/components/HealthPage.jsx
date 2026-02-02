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

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          if (json.success && json.data) setData(json.data);
          else setError(formatRequestError(json.message || '请求失败'));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(formatRequestError(err.message || '请求异常'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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

      {data && !loading && (
        <div className="health-content">
          <section className="health-summary">
            <h2>汇总</h2>
            <ul>
              <li>浏览器实例数：<strong>{data.summary?.totalBrowsers ?? '-'}</strong></li>
              <li>总页面数（标签页）：<strong>{data.summary?.totalPages ?? '-'}</strong></li>
            </ul>
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
