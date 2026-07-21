import React, { useId, useMemo } from 'react';
import { extractShareSeries, getShareSparklineColor } from '../../utils/formatGallery.js';
import './ShareSparkline.css';

function buildPath(points, width, height, padY = 2) {
  if (!points.length) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || max || 1;
  const innerH = height - padY * 2;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points
    .map((v, i) => {
      const x = i * step;
      const y = padY + innerH - ((v - min) / span) * innerH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function ShareSparkline({ creative, shareSeries: shareSeriesProp, width = 120, height = 36 }) {
  const gradId = useId().replace(/:/g, '');
  const series = useMemo(() => {
    if (Array.isArray(shareSeriesProp) && shareSeriesProp.length) return shareSeriesProp;
    return extractShareSeries(creative);
  }, [creative, shareSeriesProp]);
  const color = useMemo(() => getShareSparklineColor(series), [series]);
  const linePath = useMemo(() => buildPath(series, width, height), [series, width, height]);
  const areaPath = useMemo(() => {
    if (!linePath) return '';
    return `${linePath} L${width},${height} L0,${height} Z`;
  }, [linePath, width, height]);

  if (!series.length) {
    return <span className="st-sparkline st-sparkline--empty">—</span>;
  }

  return (
    <svg
      className="st-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {areaPath ? <path className="st-sparkline__area" d={areaPath} fill={`url(#${gradId})`} /> : null}
      {linePath ? (
        <path className="st-sparkline__line" d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
      ) : null}
    </svg>
  );
}

export default ShareSparkline;
