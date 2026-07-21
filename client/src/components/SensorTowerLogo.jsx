import React from 'react';
import sensorTowerLogo from '../../assets/sensorTower.svg';
import './SensorTowerLogo.css';

function SensorTowerLogo({
  className = '',
  size = 24,
  title = 'Sensor Tower',
  variant = 'default',
  loading = 'lazy',
}) {
  const classNames = [
    'sensor-tower-logo',
    variant === 'on-dark' ? 'sensor-tower-logo--on-dark' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      className={classNames}
      src={sensorTowerLogo}
      alt={title}
      width={size}
      height={size}
      loading={loading}
    />
  );
}

export default SensorTowerLogo;
