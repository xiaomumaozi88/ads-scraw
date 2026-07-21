import React from 'react';
import './PlatformSelection.css';
import insightrackrLogo from '../../assets/insightrackr-logo.png';
import sensorTowerLogo from '../../assets/sensorTower.svg';
import { FEATURES } from '../config/features';

const platforms = [
  {
    id: 'insightrackr',
    name: 'Insightrackr',
    description: '广告数据查询平台',
    logo: insightrackrLogo,
    color: '#667eea'
  },
  ...(FEATURES.guangdada ? [{
    id: 'guangdada',
    name: '广大大',
    description: '广告创意分析平台',
    logo: null,
    color: '#764ba2'
  }] : []),
  {
    id: 'sensortower',
    name: 'Sensor Tower',
    description: '应用分析与创意库',
    logo: sensorTowerLogo,
    color: '#0d47a1'
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
              {platform.logo ? (
                <img src={platform.logo} alt={platform.name} className="platform-card-logo" />
              ) : (
                <span className="platform-card-logo platform-card-logo--text" aria-hidden>
                  ST
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {FEATURES.externalSearchDebug && (
        <p className="platform-selection-debug-link">
          <a href="/external-search-debug">外部查询接口调试（临时）</a>
        </p>
      )}
    </div>
  );
}

export default PlatformSelection;
