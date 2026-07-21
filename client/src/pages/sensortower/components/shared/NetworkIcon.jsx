import React from 'react';
import { getNetworkIconUrl } from '../../utils/networkIcons.js';
import './NetworkIcon.css';

export default function NetworkIcon({
  network,
  className = '',
  size = 20,
  title,
}) {
  const iconUrl = getNetworkIconUrl(network);
  if (!iconUrl) return null;

  const classNames = ['st-network-icon', className].filter(Boolean).join(' ');

  return (
    <img
      className={classNames}
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      title={title ?? network}
    />
  );
}
