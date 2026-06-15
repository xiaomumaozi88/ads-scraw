import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getChartTypeById } from '../../../constants/impressionShareConstants.js';
import { toDateKey } from '../../../utils/galleryDatePresets.js';
import { formatShareAxisTick } from '../../../utils/formatImpressionShare.js';
import {
  buildChartDateAxis,
  computeAbsoluteShareYAxis,
  normalizeSeriesToFullStack,
  PERCENT100_Y_TICKS,
  resampleChartSeries,
} from '../../../utils/impressionShareChartAxis.js';
import ImpressionShareChartTooltip from './ImpressionShareChartTooltip.jsx';

const CHART_H = 360;
const PAD = { top: 20, right: 12, bottom: 40, left: 48 };
const DEFAULT_CHART_W = 720;
const MIN_CHART_W = 280;
const TOOLTIP_W = 240;
const TOOLTIP_GAP = 12;

function createChartLayout(chartW) {
  const pad = PAD;
  const width = Math.max(MIN_CHART_W, chartW);
  const plotW = width - pad.left - pad.right;
  const plotH = CHART_H - pad.top - pad.bottom;
  const xAt = (index, count) => pad.left + (index / Math.max(count - 1, 1)) * plotW;
  const yAt = (value, maxY) => pad.top + plotH - (value / maxY) * plotH;
  return { width, height: CHART_H, pad, plotW, plotH, xAt, yAt };
}

function seriesToLinePath(values, maxY, layout) {
  const pts = values.map((v, i) => `${layout.xAt(i, values.length)},${layout.yAt(v, maxY)}`);
  return `M ${pts.join(' L ')}`;
}

function stackedAreaPaths(series, maxY, layout) {
  const n = series[0]?.values?.length ?? 0;
  const paths = [];
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const tops = [];
    const bottoms = [];
    for (let i = 0; i < n; i++) {
      let base = 0;
      for (let j = 0; j < si; j++) base += series[j].values[i] || 0;
      const top = base + (s.values[i] || 0);
      tops.push(`${layout.xAt(i, n)},${layout.yAt(top, maxY)}`);
      bottoms.push(`${layout.xAt(i, n)},${layout.yAt(base, maxY)}`);
    }
    const d = `M ${tops.join(' L ')} L ${bottoms.reverse().join(' L ')} Z`;
    paths.push({ id: s.id, color: s.color, name: s.name, d });
  }
  return paths;
}

function GridAndYAxis({ layout, maxY, yTicks, formatTick, xLabelCount }) {
  const { pad, plotW, plotH } = layout;
  return (
    <>
      {yTicks.map((tick) => {
        const y = layout.yAt(tick, maxY);
        return (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={pad.left + plotW}
              y1={y}
              y2={y}
              className="st-is-chart__grid"
            />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" className="st-is-chart__axis-label">
              {formatTick(tick)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: xLabelCount }, (_, i) => (
        <line
          key={`vx-${i}`}
          x1={layout.xAt(i, xLabelCount)}
          x2={layout.xAt(i, xLabelCount)}
          y1={pad.top}
          y2={pad.top + plotH}
          className="st-is-chart__grid st-is-chart__grid--vertical"
        />
      ))}
    </>
  );
}

function XAxisLabels({ dates, labels, layout }) {
  const labelY = layout.height - 10;
  const tickY = layout.height - 22;
  return dates.map((date, i) => {
    const x = layout.xAt(i, dates.length);
    const label = labels[i];
    if (!label) {
      return (
        <circle
          key={`tick-${toDateKey(date)}-${i}`}
          cx={x}
          cy={tickY}
          r="1.75"
          className="st-is-chart__axis-tick"
        />
      );
    }
    return (
      <text
        key={`${label}-${i}`}
        x={x}
        y={labelY}
        textAnchor="middle"
        className="st-is-chart__axis-label"
      >
        {label}
      </text>
    );
  });
}

function ChartCrosshair({ layout, index, pointCount, maxY }) {
  if (index == null || pointCount <= 0) return null;
  const { pad, plotH } = layout;
  const x = layout.xAt(index, pointCount);
  return (
    <line
      x1={x}
      x2={x}
      y1={pad.top}
      y2={pad.top + plotH}
      className="st-is-chart__crosshair"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function LineChart({ series, maxY, yTicks, dates, xLabels, layout, hoverIndex }) {
  const n = dates.length;
  return (
    <>
      <GridAndYAxis
        layout={layout}
        maxY={maxY}
        yTicks={yTicks}
        xLabelCount={n}
        formatTick={formatShareAxisTick}
      />
      {series.map((s) => (
        <path
          key={s.id}
          d={seriesToLinePath(s.values, maxY, layout)}
          fill="none"
          stroke={s.color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {hoverIndex != null &&
        series.map((s) => {
          const v = s.values[hoverIndex];
          if (!Number.isFinite(v)) return null;
          return (
            <circle
              key={`${s.id}-dot`}
              cx={layout.xAt(hoverIndex, n)}
              cy={layout.yAt(v, maxY)}
              r="3.5"
              fill={s.color}
              stroke="#fff"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      <ChartCrosshair layout={layout} index={hoverIndex} pointCount={n} maxY={maxY} />
      <XAxisLabels dates={dates} labels={xLabels} layout={layout} />
    </>
  );
}

function MarketShareChart({ series, maxY, yTicks, dates, xLabels, layout, hoverIndex }) {
  const paths = stackedAreaPaths(series, maxY, layout);
  const n = dates.length;
  return (
    <>
      <GridAndYAxis
        layout={layout}
        maxY={maxY}
        yTicks={yTicks}
        xLabelCount={n}
        formatTick={(t) => `${Math.round(t * 100)}%`}
      />
      {paths.map((p) => (
        <path key={p.id} d={p.d} fill={p.color} opacity="0.92" stroke="none" />
      ))}
      <ChartCrosshair layout={layout} index={hoverIndex} pointCount={n} maxY={maxY} />
      <XAxisLabels dates={dates} labels={xLabels} layout={layout} />
    </>
  );
}

function GroupedBarChart({ series, maxY, yTicks, dates, xLabels, layout, hoverIndex }) {
  const n = dates.length;
  const count = series.length;
  const { pad, plotW, plotH } = layout;
  const groupW = plotW / n;
  const barW = Math.min(14, (groupW * 0.72) / Math.max(count, 1));
  const gap = (groupW - barW * count) / 2;

  return (
    <>
      <GridAndYAxis
        layout={layout}
        maxY={maxY}
        yTicks={yTicks}
        xLabelCount={n}
        formatTick={formatShareAxisTick}
      />
      {series.map((s, si) =>
        s.values.map((v, di) => {
          const gx = pad.left + di * groupW + gap + si * barW;
          const barH = (v / maxY) * plotH;
          const y = pad.top + plotH - barH;
          const dimmed = hoverIndex != null && hoverIndex !== di;
          return (
            <rect
              key={`${s.id}-${di}`}
              x={gx}
              y={y}
              width={barW}
              height={barH}
              fill={s.color}
              rx="1"
              opacity={dimmed ? 0.35 : 1}
            />
          );
        })
      )}
      <ChartCrosshair layout={layout} index={hoverIndex} pointCount={n} maxY={maxY} />
      <XAxisLabels dates={dates} labels={xLabels} layout={layout} />
    </>
  );
}

function StackedBarChart({ series, maxY, yTicks, dates, xLabels, layout, hoverIndex }) {
  const n = dates.length;
  const { pad, plotW, plotH } = layout;
  const groupW = plotW / n;
  const barW = groupW * 0.5;
  const offset = (groupW - barW) / 2;

  return (
    <>
      <GridAndYAxis
        layout={layout}
        maxY={maxY}
        yTicks={yTicks}
        xLabelCount={n}
        formatTick={(t) => `${Math.round(t * 100)}%`}
      />
      {dates.map((_, di) => {
        const gx = pad.left + di * groupW + offset;
        let base = 0;
        const dimmed = hoverIndex != null && hoverIndex !== di;
        return series.map((s) => {
          const v = s.values[di] || 0;
          const segH = (v / maxY) * plotH;
          const y = pad.top + plotH - base - segH;
          base += segH;
          return (
            <rect
              key={`${s.id}-${di}`}
              x={gx}
              y={y}
              width={barW}
              height={segH}
              fill={s.color}
              opacity={dimmed ? 0.35 : 1}
            />
          );
        });
      })}
      <ChartCrosshair layout={layout} index={hoverIndex} pointCount={n} maxY={maxY} />
      <XAxisLabels dates={dates} labels={xLabels} layout={layout} />
    </>
  );
}

function ImpressionShareChart({
  chartTypeId,
  startDate,
  endDate,
  granularityId,
  breakdownId,
  chartSeries = [],
  appsById,
}) {
  const wrapRef = useRef(null);
  const [chartW, setChartW] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const chartMeta = getChartTypeById(chartTypeId);
  const plotType = chartMeta.id;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const syncWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const next = Math.round(w);
        setChartW((prev) => (prev === next ? prev : next));
      }
    };

    syncWidth();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chartData = useMemo(() => {
    const axis = buildChartDateAxis(startDate, endDate, granularityId);
    let series = chartSeries?.length ? chartSeries : [];

    if (series.length && series[0]?.values?.length !== axis.pointCount) {
      series = resampleChartSeries(series, axis.pointCount);
    }

    const needsFullStack = plotType === 'marketShare' || plotType === 'stackedBar';
    const rawSeries = series;
    const plotted = needsFullStack ? normalizeSeriesToFullStack(series) : series;
    if (chartMeta.yScale === 'percent100') {
      return {
        axisDates: axis.dates,
        xLabels: axis.labels,
        rawSeries,
        plotSeries: plotted,
        maxY: 1,
        yTicks: PERCENT100_Y_TICKS,
      };
    }

    const allValues = plotted.flatMap((s) => s.values);
    const { maxY: roundedMax, yTicks: ticks } = computeAbsoluteShareYAxis(allValues);
    return {
      axisDates: axis.dates,
      xLabels: axis.labels,
      rawSeries,
      plotSeries: plotted,
      maxY: roundedMax,
      yTicks: ticks,
    };
  }, [startDate, endDate, granularityId, chartSeries, plotType, chartMeta.yScale]);

  const layout = useMemo(
    () => createChartLayout(chartW > 0 ? chartW : DEFAULT_CHART_W),
    [chartW]
  );

  const resolveHoverIndex = useCallback(
    (clientX) => {
      const el = wrapRef.current;
      const n = chartData.xLabels.length;
      if (!el || n <= 1) return null;

      const rect = el.getBoundingClientRect();
      const relX = clientX - rect.left;
      const plotLeft = (layout.pad.left / layout.width) * rect.width;
      const plotWidth = (layout.plotW / layout.width) * rect.width;
      if (plotWidth <= 0) return null;

      const ratio = (relX - plotLeft) / plotWidth;
      const idx = Math.round(ratio * (n - 1));
      return Math.max(0, Math.min(n - 1, idx));
    },
    [chartData.xLabels.length, layout.pad.left, layout.plotW, layout.width]
  );

  const handlePlotMouseMove = useCallback(
    (e) => {
      const idx = resolveHoverIndex(e.clientX);
      setHoverIndex(idx);
      const el = wrapRef.current;
      if (!el || idx == null) return;

      const rect = el.getBoundingClientRect();
      const plotLeft = (layout.pad.left / layout.width) * rect.width;
      const plotWidth = (layout.plotW / layout.width) * rect.width;
      const xRatio = idx / Math.max(chartData.xLabels.length - 1, 1);
      const anchorX = plotLeft + xRatio * plotWidth;

      let left = anchorX + TOOLTIP_GAP;
      if (left + TOOLTIP_W > rect.width - 4) {
        left = anchorX - TOOLTIP_W - TOOLTIP_GAP;
      }
      left = Math.max(4, Math.min(left, rect.width - TOOLTIP_W - 4));

      setTooltipPos({ x: left, y: 8 });
    },
    [resolveHoverIndex, layout, chartData.xLabels.length]
  );

  const handlePlotMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const ariaLabel =
    plotType === 'line'
      ? '展示份额折线图'
      : plotType === 'marketShare'
        ? '市场份额堆叠面积图'
        : plotType === 'groupedBar'
          ? '展示份额分组柱状图'
          : '展示份额堆叠柱状图';

  const chartProps = {
    series: chartData.plotSeries,
    maxY: chartData.maxY,
    yTicks: chartData.yTicks,
    dates: chartData.axisDates,
    xLabels: chartData.xLabels,
    layout,
    hoverIndex,
  };

  const plotOverlayStyle = {
    left: `${(layout.pad.left / layout.width) * 100}%`,
    width: `${(layout.plotW / layout.width) * 100}%`,
    top: layout.pad.top,
    height: layout.plotH,
  };

  const activeDate = hoverIndex != null ? chartData.axisDates[hoverIndex] : null;

  return (
    <div className="st-is-chart" role="img" aria-label={ariaLabel}>
      {chartMeta.chartHeading ? (
        <h3 className="st-is-chart__heading">{chartMeta.chartHeading}</h3>
      ) : null}
      <div ref={wrapRef} className="st-is-chart__svg-wrap">
        {chartW > 0 ? (
          <>
            <svg
              className="st-is-chart__svg"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              preserveAspectRatio="none"
            >
              {plotType === 'line' && <LineChart {...chartProps} />}
              {plotType === 'marketShare' && <MarketShareChart {...chartProps} />}
              {plotType === 'groupedBar' && <GroupedBarChart {...chartProps} />}
              {plotType === 'stackedBar' && <StackedBarChart {...chartProps} />}
            </svg>
            <div
              className="st-is-chart__hover-layer"
              style={plotOverlayStyle}
              onMouseMove={handlePlotMouseMove}
              onMouseLeave={handlePlotMouseLeave}
              aria-hidden
            />
            <ImpressionShareChartTooltip
              date={activeDate}
              series={chartData.rawSeries}
              activeIndex={hoverIndex}
              breakdownId={breakdownId}
              appsById={appsById}
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            />
          </>
        ) : null}
      </div>
      <div className="st-is-chart__legend">
        {chartData.plotSeries.map((s) => (
          <span key={s.id} className="st-is-chart__legend-item">
            <span className="st-is-chart__legend-dot" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ImpressionShareChart;
