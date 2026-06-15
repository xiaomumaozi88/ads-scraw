import React from 'react';
import { formatChartTooltipDate, formatShareTooltipPercent } from '../../../utils/formatImpressionShare.js';
import { resolveImpressionShareSeriesIcon } from '../../../utils/impressionShareSeriesIcon.js';

function TooltipSeriesIcon({ series, breakdownId, appsById }) {
  const { iconUrl, fallbackLetter, fallbackColor } = resolveImpressionShareSeriesIcon(series, {
    breakdownId,
    appsById,
  });

  if (iconUrl) {
    return <img className="st-is-chart-tooltip__icon" src={iconUrl} alt="" />;
  }

  return (
    <span
      className="st-is-chart-tooltip__icon st-is-chart-tooltip__icon--fallback"
      style={{ backgroundColor: fallbackColor || series.color }}
      aria-hidden
    >
      {fallbackLetter}
    </span>
  );
}

function ImpressionShareChartTooltip({ date, series, activeIndex, breakdownId, appsById, style }) {
  if (activeIndex == null || !date || !series?.length) return null;

  const rows = series.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    value: Number(s.values[activeIndex]) || 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="st-is-chart-tooltip" style={style} role="tooltip">
      <p className="st-is-chart-tooltip__date">{formatChartTooltipDate(date)}</p>
      <ul className="st-is-chart-tooltip__list">
        {rows.map((row) => (
          <li key={row.id} className="st-is-chart-tooltip__row">
            <span className="st-is-chart-tooltip__swatch" style={{ backgroundColor: row.color }} />
            <TooltipSeriesIcon
              series={{ id: row.id, name: row.name, color: row.color }}
              breakdownId={breakdownId}
              appsById={appsById}
            />
            <span className="st-is-chart-tooltip__name">{row.name}</span>
            <span className="st-is-chart-tooltip__value">{formatShareTooltipPercent(row.value)}</span>
          </li>
        ))}
      </ul>
      <div className="st-is-chart-tooltip__total">
        <span className="st-is-chart-tooltip__total-label">总共</span>
        <span className="st-is-chart-tooltip__total-value">{formatShareTooltipPercent(total)}</span>
      </div>
    </div>
  );
}

export default ImpressionShareChartTooltip;
