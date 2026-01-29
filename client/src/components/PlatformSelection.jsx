import React from 'react';
import './PlatformSelection.css';

const platforms = [
  {
    id: 'insightrackr',
    name: 'Insightrackr',
    description: '广告数据查询平台',
    icon: '📊',
    color: '#667eea'
  },
  {
    id: 'guangdada',
    name: '广大大',
    description: '广告创意分析平台',
    icon: '🎯',
    color: '#764ba2'
  }
];

function PlatformSelection({ onSelectPlatform }) {
  return (
    <div className="platform-selection">
      <div className="platform-selection-header">
        <h1>选择平台</h1>
        <p className="subtitle">请选择要使用的广告数据平台</p>
      </div>
      <div className="platform-cards">
        {platforms.map(platform => (
          <div
            key={platform.id}
            className="platform-card"
            onClick={() => onSelectPlatform(platform.id)}
            style={{ '--card-color': platform.color }}
          >
            <div className="platform-icon">{platform.icon}</div>
            <h2>{platform.name}</h2>
            <p>{platform.description}</p>
            <div className="platform-card-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlatformSelection;
