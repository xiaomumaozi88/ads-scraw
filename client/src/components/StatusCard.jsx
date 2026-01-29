import React from 'react';

const statusMap = {
  'LOGGED_OUT': { text: '未登录', class: 'LOGGED_OUT' },
  'ONLINE': { text: '已登录', class: 'ONLINE' }
};

function StatusCard({ status, onRefresh }) {
  const statusInfo = statusMap[status] || { text: status || '检查中...', class: 'LOGGED_OUT' };

  return (
    <div className="card status-card">
      <h2>登录状态</h2>
      <div className="status-info">
        <span className="status-label">当前状态：</span>
        <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>
      </div>
      <button className="btn btn-secondary" onClick={onRefresh}>
        刷新状态
      </button>
    </div>
  );
}

export default StatusCard;
