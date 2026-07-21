import React from 'react';
import './PlatformSegmentIcon.css';

function AppStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.28 0A5.28 5.28 0 0 0 0 5.28v13.44A5.28 5.28 0 0 0 5.28 24h13.44A5.28 5.28 0 0 0 24 18.72V5.28A5.28 5.28 0 0 0 18.72 0zm7.12 4.869-.425.77-.418-.773c-.267-.481-.847-.644-1.307-.369a1.03 1.03 0 0 0-.351 1.37l.973 1.77-3.117 5.661H5.319c-.53 0-.955.446-.955 1.001 0 .556.425 1 .955 1h8.687c.417-.818-.12-2-1.081-2H9.962l4.097-7.43c.262-.48.107-1.094-.352-1.369a.933.933 0 0 0-1.307.369M7.37 17.999l.919-1.668c-.496-.627-1.123-.82-1.895-.57L5.713 17c-.263.481-.108 1.094.351 1.37a.933.933 0 0 0 1.307-.37m11.314-4.695H16.2l-.549-.996q-1.47-2.67-2.267-4.104c-.564.492-1.136 1.943-.336 3.39l1.275 2.314L16.578 18c.268.481.848.643 1.307.368.46-.28.614-.888.352-1.369l-.932-1.694h1.38c.53 0 .956-.445.956-1 0-.556-.425-1.001-.956-1.001"
      />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M2.995 24A1.84 1.84 0 0 1 2 22.355V1.645C2 .925 2.403.292 2.995 0l11.667 12zm12.673-10.964 2.689 2.765-12.744 7.578zm3.968-4.082 2.689 1.596c.403.33.699.84.699 1.45s-.26 1.096-.675 1.438l-2.713 1.608L16.676 12zm-3.968 2.01L5.613.621 18.357 8.2z"
      />
    </svg>
  );
}

function UnifiedPlatformIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M21.777 17.532q-2.223 2.135-5.413 2.135a7.7 7.7 0 0 1-1.637-.184 6.6 6.6 0 0 1-1.445-.471q1.418-.943 2.25-2.75t.832-3.929q0-2.12-.832-3.928t-2.25-2.75q.6-.288 1.445-.472A7.7 7.7 0 0 1 16.364 5q3.191 0 5.413 2.135T24 12.333t-2.223 5.2m-7.513-1.034q-1.01 1.86-2.264 1.86t-2.264-1.86q-1.008-1.86-1.009-4.165t1.01-4.164Q10.744 6.31 12 6.31q1.253 0 2.264 1.86 1.009 1.86 1.009 4.164 0 2.305-1.01 4.165m-4.991 2.985a7.7 7.7 0 0 1-1.637.184q-3.19 0-5.413-2.135T0 12.333t2.223-5.198Q4.446 5 7.636 5q.791 0 1.637.183.845.184 1.445.472-1.418.942-2.25 2.75-.832 1.807-.832 3.928t.832 3.929 2.25 2.75q-.6.289-1.445.471"
      />
    </svg>
  );
}

const ICON_BY_PLATFORM = {
  ios: AppStoreIcon,
  android: GooglePlayIcon,
  unified: UnifiedPlatformIcon,
};

export default function PlatformSegmentIcon({ platformId, className = '' }) {
  const Icon = ICON_BY_PLATFORM[platformId] ?? ICON_BY_PLATFORM.unified;
  const classNames = ['st-platform-segment-icon', className].filter(Boolean).join(' ');

  return (
    <span className={classNames}>
      <Icon />
    </span>
  );
}
