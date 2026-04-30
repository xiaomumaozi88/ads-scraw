import React from 'react';
import { Link } from 'react-router-dom';
import './PlatformSelection.css';
import insightrackrLogo from '../../assets/insightrackr-logo.png';
import guangdadaLogo from '../../assets/guangdada-logo.svg';

const platforms = [
  {
    id: 'insightrackr',
    name: 'Insightrackr',
    description: '广告数据查询平台',
    logo: insightrackrLogo,
    color: '#667eea'
  },
  {
    id: 'guangdada',
    name: '广大大',
    description: '广告创意分析平台',
    logo: guangdadaLogo,
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
            <div className="platform-card-logo-wrap">
              <img src={platform.logo} alt={platform.name} className="platform-card-logo" />
            </div>
          </div>
        ))}
      </div>
      <p className="platform-selection-debug-link">
        <Link to="/external-search-debug">外部查询接口调试（临时）</Link>
      </p>
    </div>
  );
}

export default PlatformSelection;
