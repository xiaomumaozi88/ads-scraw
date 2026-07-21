import React from 'react';
import './CreativeThumbPlayOverlay.css';

function CreativeThumbPlayOverlay({ size = 'md' }) {
  return (
    <span
      className={`st-creative-thumb-play${size === 'sm' ? ' st-creative-thumb-play--sm' : ''}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l11.14-6.86a1 1 0 0 0 0-1.7L9.54 4.3A1 1 0 0 0 8 5.14z" fill="currentColor" />
      </svg>
    </span>
  );
}

export default CreativeThumbPlayOverlay;
