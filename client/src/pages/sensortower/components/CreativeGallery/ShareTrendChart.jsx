import React, { useId, useMemo } from 'react';
import {
  getShareSparklineColor,
  normalizeSharePercentValue,
} from '../../utils/formatGallery.js';
import './ShareTrendChart.css';

const MARGIN = { top: 10, right: 12, bottom: 32, left: 40 };

function niceYMax(maxPct) {
  if (!Number.isFinite(maxPct) || maxPct <= 0) return 10;
  const ticks = [6, 8, 10, 12, 16, 20, 24, 30, 35, 40, 48, 50, 60, 80, 100];
  return ticks.find((t) => t >= maxPct * 1.02) ?? Math.ceil(maxPct / 10) * 10;
}

function formatAxisDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAxisYear(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getFullYear());
}

function ShareTrendChart({ timeSeries = [], width = 360, height = 160 }) {
  const gradId = useId().replace(/:/g, '');

  const points = useMemo(
    () =>
      (timeSeries || [])
        .map((row) => ({
          date: row.date,
          value: normalizeSharePercentValue(row.share),
        }))
        .filter((p) => p.value != null && p.date),
    [timeSeries]
  );

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const { linePath, areaPath, yMax, color, firstDate, lastDate } = useMemo(() => {
    if (!points.length) {
      return { linePath: '', areaPath: '', yMax: 10, color: '#00897b', firstDate: '', lastDate: '' };
    }

    const values = points.map((p) => p.value);
    const maxVal = Math.max(...values, 0);
    const yTop = niceYMax(maxVal);
    const step = points.length > 1 ? plotW / (points.length - 1) : 0;

    const coords = points.map((p, i) => {
      const x = MARGIN.left + i * step;
      const y = MARGIN.top + plotH - (p.value / yTop) * plotH;
      return { x, y };
    });

    const path = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');

    const baseY = MARGIN.top + plotH;
    const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${baseY} L${coords[0].x.toFixed(1)},${baseY} Z`;

    return {
      linePath: path,
      areaPath: area,
      yMax: yTop,
      color: getShareSparklineColor(values),
      firstDate: points[0].date,
      lastDate: points[points.length - 1].date,
    };
  }, [points, plotW, plotH]);

  if (!points.length) {
    return <span className="st-share-trend st-share-trend--empty">暂无趋势数据</span>;
  }

  const yTicks = [0, yMax];
  const baseY = MARGIN.top + plotH;

  return (
    <div className="st-share-trend">
      <svg
        className="st-share-trend__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="曝光份额趋势图"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = MARGIN.top + plotH - (tick / yMax) * plotH;
          return (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={width - MARGIN.right}
                y2={y}
                className="st-share-trend__grid"
              />
              <text x={MARGIN.left - 8} y={y + 4} className="st-share-trend__ylabel" textAnchor="end">
                {tick}%
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill={`url(#${gradId})`} /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            className="st-share-trend__line"
          />
        ) : null}

        <text x={MARGIN.left} y={baseY + 16} className="st-share-trend__xlabel" textAnchor="start">
          {formatAxisDate(firstDate)}
        </text>
        <text x={MARGIN.left} y={baseY + 28} className="st-share-trend__xlabel-year" textAnchor="start">
          {formatAxisYear(firstDate)}
        </text>
        <text x={width - MARGIN.right} y={baseY + 16} className="st-share-trend__xlabel" textAnchor="end">
          {formatAxisDate(lastDate)}
        </text>
        <text
          x={width - MARGIN.right}
          y={baseY + 28}
          className="st-share-trend__xlabel-year"
          textAnchor="end"
        >
          {formatAxisYear(lastDate)}
        </text>
      </svg>
    </div>
  );
}

export default ShareTrendChart;
