import React, { useState } from 'react';
import './LogCard.css';

function LogCard({ logs, onClear }) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div className="log-card-minimized" onClick={() => setIsMinimized(false)}>
        <span>📋 日志 ({logs.length})</span>
      </div>
    );
  }

  return (
    <div className="card log-card">
      <div className="log-card-header">
        <h2>操作日志</h2>
        <div className="log-card-actions">
          <button className="btn-icon" onClick={() => setIsMinimized(true)} title="最小化">
            −
          </button>
          <button className="btn-icon" onClick={onClear} title="清空日志">
            🗑️
          </button>
        </div>
      </div>
      <div className="log-container">
        {logs.length === 0 ? (
          <div className="log-item">系统已启动，等待操作...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`log-item ${log.type}`}>
              [{log.timestamp}] {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LogCard;
