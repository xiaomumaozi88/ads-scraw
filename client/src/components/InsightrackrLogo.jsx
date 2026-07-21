import React from 'react';
import insightrackrLogo from '../../assets/insightrackr-logo.png';
import './InsightrackrLogo.css';

function InsightrackrLogo({
  className = '',
  size = 24,
  title = 'Insightrackr',
  variant = 'default',
  loading = 'lazy',
}) {
  const classNames = [
    'insightrackr-logo',
    variant === 'on-dark' ? 'insightrackr-logo--on-dark' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      className={classNames}
      src={insightrackrLogo}
      alt={title}
      width={size}
      height={size}
      loading={loading}
    />
  );
}

export default InsightrackrLogo;
