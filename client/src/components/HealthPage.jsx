import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRequestError, clearLogin } from '../utils/api';
import './HealthPage.css';

const API_BASE = '/api';

/** 将 ISO 或时间戳转为北京时间展示 */
function formatBeijingTime(isoOrTimestamp) {
  if (isoOrTimestamp == null || isoOrTimestamp === '') return '-';
  try {
    const d = new Date(isoOrTimestamp);
    if (Number.isNaN(d.getTime())) return String(isoOrTimestamp);
    return d.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false, timeZone: 'Asia/Shanghai' });
  } catch {
    return String(isoOrTimestamp);
  }
}

function HealthPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [clearLoginLoading, setClearLoginLoading] = useState(null);

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    fetch(`${API_BASE}/health/reopen-browser`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (res) => {
        let json = {};
        try {
          json = await res.json();
        } catch {
          json = {};
        }
        await fetchHealth();
        if (!res.ok) {
          setActionError(json.message || `重新打开失败（HTTP ${res.status}）`);
          return;
        }
        if (!json.success) {
          setActionError(json.message || '重新打开失败');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setActionError('重新打开超时（超过 3 分钟），请稍后在页面上刷新健康状态或查看服务器是否仍在启动 Chrome。');
        } else {
          setActionError(err.message || '请求异常');
        }
        fetchHealth();
      })
      .finally(() => {
        clearTimeout(timer);
        setReopenLoading(false);
      });
  };

  const handleClearLogin = (platform) => {
    setActionError(null);
    setClearLoginLoading(platform);
    clearLogin(platform)
      .then(() => fetchHealth())
      .catch((err) => setActionError(formatRequestError(err.message || '退出登录失败')))
      .finally(() => setClearLoginLoading(null));
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

          {data.remoteDebug &&
            (data.remoteDebug.guangdada?.enabled ||
              data.remoteDebug.insightrackr?.enabled ||
              data.remoteDebug.sensortower?.enabled) && (
            <section className="health-summary health-remote-debug">
              <h2>远程调试（人机验证 / 远程操作页面）</h2>
              <p className="health-remote-debug-desc">
                服务器以无头模式运行，无法直接看到浏览器界面。开启远程调试后，可在本机通过 Chrome DevTools 连接服务器上的页面，查看界面、执行操作或完成人机验证。
              </p>
              <div className="health-remote-debug-cards">
                {data.remoteDebug.guangdada?.enabled && (
                  <div className="health-remote-debug-card">
                    <h3>广大大</h3>
                    <p className="health-remote-debug-port">端口：<strong>{data.remoteDebug.guangdada.port}</strong></p>
                    <p className="health-remote-debug-url">
                      调试地址：<code>{data.remoteDebug.guangdada.url}</code>
                    </p>
                    <p className="health-remote-debug-hint">{data.remoteDebug.guangdada.hint}</p>
                    <div className="health-remote-debug-steps">
                      <strong>操作步骤：</strong>
                      <ol>
                        <li>在本机执行 SSH 隧道（将 <code>用户@服务器IP</code> 换成实际信息）：<br />
                          <code>ssh -L {data.remoteDebug.guangdada.port}:localhost:{data.remoteDebug.guangdada.port} 用户@服务器IP</code>
                        </li>
                        <li>在本机 Chrome 地址栏打开 <code>{data.remoteDebug.guangdada.url}</code></li>
                        <li>在列表中点开要操作的页面（如广大大登录页），会打开 DevTools</li>
                        <li>在 DevTools 的 Console 中可执行 JS 模拟点击，例如完成人机验证：<br />
                          <code>document.querySelector('验证码按钮选择器')?.click()</code>
                        </li>
                      </ol>
                    </div>
                  </div>
                )}
                {data.remoteDebug.sensortower?.enabled && (
                  <div className="health-remote-debug-card">
                    <h3>Sensor Tower</h3>
                    <p className="health-remote-debug-port">端口：<strong>{data.remoteDebug.sensortower.port}</strong></p>
                    <p className="health-remote-debug-url">
                      调试地址：<code>{data.remoteDebug.sensortower.url}</code>
                    </p>
                    <p className="health-remote-debug-hint">{data.remoteDebug.sensortower.hint}</p>
                    <div className="health-remote-debug-steps">
                      <strong>操作步骤：</strong>
                      <ol>
                        <li>
                          在本机执行 SSH 隧道：<br />
                          <code>
                            ssh -L {data.remoteDebug.sensortower.port}:localhost:{data.remoteDebug.sensortower.port}{' '}
                            用户@服务器IP
                          </code>
                        </li>
                        <li>
                          在本机 Chrome 打开 <code>{data.remoteDebug.sensortower.url}</code>
                        </li>
                        <li>点开对应页面后，在 DevTools 中完成新设备验证或 MFA 等操作</li>
                      </ol>
                    </div>
                  </div>
                )}
                {data.remoteDebug.insightrackr?.enabled && (
                  <div className="health-remote-debug-card">
                    <h3>Insightrackr</h3>
                    <p className="health-remote-debug-port">端口：<strong>{data.remoteDebug.insightrackr.port}</strong></p>
                    <p className="health-remote-debug-url">
                      调试地址：<code>{data.remoteDebug.insightrackr.url}</code>
                    </p>
                    <p className="health-remote-debug-hint">{data.remoteDebug.insightrackr.hint}</p>
                    <div className="health-remote-debug-steps">
                      <strong>操作步骤：</strong>
                      <ol>
                        <li>在本机执行 SSH 隧道：<br />
                          <code>ssh -L {data.remoteDebug.insightrackr.port}:localhost:{data.remoteDebug.insightrackr.port} 用户@服务器IP</code>
                        </li>
                        <li>在本机 Chrome 打开 <code>{data.remoteDebug.insightrackr.url}</code></li>
                        <li>点开对应页面后，在 DevTools Console 中执行 JS 完成人机验证或其它操作</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
              <p className="health-remote-debug-warn">调试端口仅用于排查，不建议长期对公网开放；使用完毕可去掉环境变量并重启服务。</p>
            </section>
          )}

          {data.performance && (
            <section className="health-summary health-performance">
              <h2>性能与系统</h2>
              {data.performance.error ? (
                <p className="health-error-text">{data.performance.error}</p>
              ) : (
                <ul>
                  <li>内存 - 堆已用：<strong>{data.performance.memory?.heapUsedMb ?? '-'} MB</strong></li>
                  <li>内存 - 堆总量：<strong>{data.performance.memory?.heapTotalMb ?? '-'} MB</strong></li>
                  <li>内存 - 常驻集 (RSS)：<strong>{data.performance.memory?.rssMb ?? '-'} MB</strong></li>
                  <li>内存 - 外部：<strong>{data.performance.memory?.externalMb ?? '-'} MB</strong></li>
                  <li>进程累计 CPU（用户）：<strong>{data.performance.cpuUsageSeconds?.user ?? '-'} 秒</strong></li>
                  <li>进程累计 CPU（系统）：<strong>{data.performance.cpuUsageSeconds?.system ?? '-'} 秒</strong></li>
                  <li>进程运行时长：<strong>{data.performance.processUptimeSeconds != null ? `${Math.floor(data.performance.processUptimeSeconds / 60)} 分 ${Math.round(data.performance.processUptimeSeconds % 60)} 秒` : '-'}</strong></li>
                  {data.performance.cpus != null && <li>CPU 核心数：<strong>{data.performance.cpus}</strong></li>}
                  {data.performance.loadAvg && (
                    <>
                      <li>系统负载 (1 分钟)：<strong>{data.performance.loadAvg['1min']?.toFixed(2) ?? '-'}</strong></li>
                      <li>系统负载 (5 分钟)：<strong>{data.performance.loadAvg['5min']?.toFixed(2) ?? '-'}</strong></li>
                      <li>系统负载 (15 分钟)：<strong>{data.performance.loadAvg['15min']?.toFixed(2) ?? '-'}</strong></li>
                    </>
                  )}
                </ul>
              )}
              <p className="health-performance-hint">负载 &gt; CPU 核心数表示系统偏忙；内存/CPU 持续升高可结合转码队列排查。</p>
            </section>
          )}

          {data.transcode && (
            <section className="health-summary health-transcode">
              <h2>视频转码队列（排查卡住时查看）</h2>
              {data.transcode.error ? (
                <p className="health-error-text">{data.transcode.error}</p>
              ) : (
                <ul>
                  <li>最大并发数：<strong>{data.transcode.maxConcurrent ?? '-'}</strong></li>
                  <li>当前处理中：<strong>{data.transcode.running ?? '-'}</strong></li>
                  <li>排队等待：<strong>{data.transcode.waiting ?? '-'}</strong></li>
                  <li>当前任务开始时间：<strong>{data.transcode.currentJobStartedAtFormatted ?? '无'}</strong></li>
                  <li>当前任务已运行时长：<strong>{data.transcode.currentJobDurationText ?? '-'}</strong></li>
                  <li>下载超时：<strong>{data.transcode.downloadTimeoutMs != null ? `${data.transcode.downloadTimeoutMs / 1000} 秒` : '-'}</strong></li>
                  <li>转码超时：<strong>{data.transcode.transcodeTimeoutMs != null ? `${data.transcode.transcodeTimeoutMs / 60000} 分钟` : '-'}</strong></li>
                </ul>
              )}
              <p className="health-transcode-hint">若平台卡住且此处显示「当前处理中 1」且「已运行时长」很长，多为视频转码占满 CPU；可等待当前任务结束或重启服务。</p>
            </section>
          )}

          <section className="health-platforms">
            <h2>各平台</h2>
            {['insightrackr', 'guangdada', 'sensortower'].map((key) => {
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
                    {key === 'guangdada' && (
                      <>
                        <dt>国内令牌到期</dt>
                        <dd>{p.cnJwtExpiresAt ? formatBeijingTime(p.cnJwtExpiresAt) : '-'}</dd>
                      </>
                    )}
                    {p.error && (
                      <>
                        <dt>错误信息</dt>
                        <dd className="health-error-text">{p.error}</dd>
                      </>
                    )}
                  </dl>
                  <div className="health-card-actions">
                    <button
                      type="button"
                      className="health-btn health-btn-secondary"
                      onClick={() => handleClearLogin(key)}
                      disabled={clearLoginLoading === key || !p.isLoggedIn}
                    >
                      {clearLoginLoading === key ? '退出中...' : '退出登录'}
                    </button>
                  </div>
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
                        <span className="health-log-time">{formatBeijingTime(entry.time)}</span>
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
                        <span className="health-log-time">{formatBeijingTime(entry.time)}</span>
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
