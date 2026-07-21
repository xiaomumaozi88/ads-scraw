import React from 'react';
import { getRegionFlagIconClass } from '../../constants/galleryRegionCodes.js';
import './RegionFlagIcon.css';

export default function RegionFlagIcon({ code, className = 'st-ffd__flag' }) {
  const flagClass = getRegionFlagIconClass(code);
  if (!flagClass) return null;

  const classNames = ['flag-icon', flagClass, className].filter(Boolean).join(' ');

  return <span className={classNames} aria-hidden />;
}
