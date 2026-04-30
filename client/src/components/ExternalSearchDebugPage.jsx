import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ExternalSearchDebugPage.css';

const API_BASE = '/api';

function jsonPretty(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function buildPostCurl(origin, path, bodyObj) {
  const url = `${origin.replace(/\/$/, '')}${path}`;
  const raw = JSON.stringify(bodyObj);
  return `curl -s -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d ${JSON.stringify(raw)}`;
}

export default function ExternalSearchDebugPage() {
  const [keyWord, setKeyWord] = useState('王者荣耀');
  const [sortBy, setSortBy] = useState('热度');
  const [timeRange, setTimeRange] = useState('近一年');
  const [topN, setTopN] = useState(10);
  const [loading, setLoading] = useState(false);
  const [lastApiJson, setLastApiJson] = useState('');
  const [logPayload, setLogPayload] = useState(null);
  const [logError, setLogError] = useState('');

  const refreshLog = useCallback(async () => {
    setLogError('');
    try {
      const r = await fetch(`${API_BASE}/external/debug-log`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLogPayload(null);
        setLogError(j.message || `HTTP ${r.status}`);
        return;
      }
      setLogPayload(j);
    } catch (e) {
      setLogPayload(null);
      setLogError(e.message || '请求失败');
    }
  }, []);

  useEffect(() => {
    refreshLog();
  }, [refreshLog]);

  const clearLog = useCallback(async () => {
    setLogError('');
    try {
      await fetch(`${API_BASE}/external/debug-log/clear`, { method: 'POST' });
      await refreshLog();
    } catch (e) {
      setLogError(e.message || '清空失败');
    }
  }, [refreshLog]);

  const runExternal = async (platform) => {
    const body = {
      keyWord: keyWord.trim(),
      sortBy,
      timeRange,
      topN: Number(topN) || 50,
    };
    if (!body.keyWord) {
      setLastApiJson('请填写 keyWord');
      return;
    }
    setLoading(true);
    setLastApiJson('');
    try {
      const path =
        platform === 'guangdada'
          ? `${API_BASE}/external/guangdada/top50`
          : `${API_BASE}/external/insightrackr/top50`;
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      setLastApiJson(jsonPretty(j));
      await refreshLog();
    } catch (e) {
      setLastApiJson(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sampleBody = {
    keyWord: keyWord.trim() || '关键词',
    sortBy,
    timeRange,
    topN: Number(topN) || 50,
  };
  const curlGuangdada = buildPostCurl(origin || 'http://localhost:3000', '/api/external/guangdada/top50', sampleBody);
  const curlInsight = buildPostCurl(origin || 'http://localhost:3000', '/api/external/insightrackr/top50', sampleBody);

  const entries = logPayload?.entries || [];

  return (
    <div className="external-search-debug">
      <header className="external-search-debug__header">
        <Link to="/" className="external-search-debug__back">
          ← 返回首页
        </Link>
        <h1>外部素材查询 · 调试页（临时）</h1>
        <p className="external-search-debug__sub">
          调用聚合接口后，可在下方查看每次请求对应<strong>发往广大大 / 热云</strong>的 JSON 请求体（不含 Header）及结果摘要。刷新记录从服务端读取内存日志。
        </p>
      </header>

      <section className="external-search-debug__panel">
        <h2>等价 curl（POST 聚合接口）</h2>
        <p className="external-search-debug__hint">
          开发时若直连后端，请将域名换为 <code>http://localhost:3000</code>（与 Vite 代理一致时可继续用当前域名）。
        </p>
        <label className="external-search-debug__label">广大大</label>
        <pre className="external-search-debug__pre">{curlGuangdada}</pre>
        <label className="external-search-debug__label">Insightrackr（热云）</label>
        <pre className="external-search-debug__pre">{curlInsight}</pre>
      </section>

      <section className="external-search-debug__panel">
        <h2>从页面发起调用</h2>
        <div className="external-search-debug__form">
          <label>
            keyWord
            <input
              value={keyWord}
              onChange={(e) => setKeyWord(e.target.value)}
              placeholder="关键词"
            />
          </label>
          <label>
            sortBy
            <input value={sortBy} onChange={(e) => setSortBy(e.target.value)} placeholder="热度 / exposure …" />
          </label>
          <label>
            timeRange
            <input value={timeRange} onChange={(e) => setTimeRange(e.target.value)} placeholder="近一年 / 30天 …" />
          </label>
          <label>
            topN
            <input
              type="number"
              min={1}
              max={500}
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
            />
          </label>
        </div>
        <div className="external-search-debug__actions">
          <button type="button" disabled={loading} onClick={() => runExternal('guangdada')}>
            调用广大大 /external/guangdada/top50
          </button>
          <button type="button" disabled={loading} onClick={() => runExternal('insightrackr')}>
            调用热云 /external/insightrackr/top50
          </button>
          <button type="button" onClick={refreshLog}>
            刷新调试记录
          </button>
          <button type="button" className="external-search-debug__btn-danger" onClick={clearLog}>
            清空服务端记录
          </button>
        </div>
        <label className="external-search-debug__label">本次接口完整响应（聚合接口返回）</label>
        <pre className="external-search-debug__pre external-search-debug__pre--tall">{lastApiJson || '（尚未调用）'}</pre>
      </section>

      <section className="external-search-debug__panel">
        <h2>服务端调试记录</h2>
        {logError ? (
          <div className="external-search-debug__warn">
            {logError}
            <div className="external-search-debug__warn-detail">
              生产环境默认关闭记录。本地开发（NODE_ENV=development）会自动开启；生产需临时排查时可设置环境变量{' '}
              <code>EXTERNAL_SEARCH_DEBUG=1</code> 后重启服务。
            </div>
          </div>
        ) : null}
        {entries.length === 0 && !logError ? <p>暂无记录。请先点击上方「调用」或自行 curl 聚合接口。</p> : null}
        <ul className="external-search-debug__entries">
          {entries.map((entry) => (
            <li key={entry.id} className="external-search-debug__entry">
              <div className="external-search-debug__entry-head">
                <span className="external-search-debug__badge">{entry.platform}</span>
                <time>{entry.at}</time>
              </div>
              <details>
                <summary>客户端请求（聚合接口）</summary>
                <pre className="external-search-debug__pre">{jsonPretty(entry.clientRequest)}</pre>
              </details>
              <details open>
                <summary>上游分步请求（{entry.steps?.length || 0} 步）</summary>
                <ol className="external-search-debug__steps">
                  {(entry.steps || []).map((step, i) => (
                    <li key={i}>
                      <div className="external-search-debug__step-title">{step.label}</div>
                      <div className="external-search-debug__step-url">{step.upstream}</div>
                      {step.note ? <div className="external-search-debug__step-note">{step.note}</div> : null}
                      {step.requestParams ? (
                        <>
                          <div className="external-search-debug__mini-label">请求参数</div>
                          <pre className="external-search-debug__pre">{jsonPretty(step.requestParams)}</pre>
                        </>
                      ) : null}
                      {step.requestBody ? (
                        <>
                          <div className="external-search-debug__mini-label">请求体 JSON（与 fetch body 一致）</div>
                          <pre className="external-search-debug__pre">{jsonPretty(step.requestBody)}</pre>
                        </>
                      ) : null}
                      <div className="external-search-debug__mini-label">结果摘要</div>
                      <pre className="external-search-debug__pre">{jsonPretty(step.responseSummary)}</pre>
                    </li>
                  ))}
                </ol>
              </details>
              <details>
                <summary>聚合接口返回（列表已折叠为 firstItem / 条数）</summary>
                <pre className="external-search-debug__pre">{jsonPretty(entry.externalApiResponse)}</pre>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
