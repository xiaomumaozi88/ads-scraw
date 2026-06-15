import React, { useMemo } from 'react';
import {
  buildImpressionShareSubtitle,
  buildImpressionShareTitle,
  formatGrowthPercent,
} from '../../../utils/formatImpressionShare.js';

function ImpressionShareContentHead({
  platformId,
  startDate,
  endDate,
  allRegions,
  selectedRegions,
  granularityId,
  breakdownId,
  summaryCards,
  appsById,
}) {
  const title = buildImpressionShareTitle(breakdownId);
  const subtitle = useMemo(
    () =>
      buildImpressionShareSubtitle({
        platformId,
        startDate,
        endDate,
        allRegions,
        selectedRegions,
        granularityId,
      }),
    [platformId, startDate, endDate, allRegions, selectedRegions, granularityId]
  );

  return (
    <section className="st-is-head">
      <div className="st-is-head__title-row">
        <h2 className="st-is-head__title">{title}</h2>
        <p className="st-is-head__subtitle">{subtitle}</p>
        <button type="button" className="st-is-head__ad-spend" disabled title="即将推出">
          <span className="st-is-head__ad-spend-lock" aria-hidden>
            🔒
          </span>
          分析广告支出
        </button>
      </div>

      {summaryCards.length > 0 ? (
        <div className="st-is-head__summary-cards">
          {summaryCards.map((card) => {
            const app = appsById.get(card.unifiedAppId);
            const growth = Number(card.growthPercent);
            const isUp = growth > 0;
            const isDown = growth < 0;
            return (
              <div key={card.unifiedAppId} className="st-is-head__summary-card">
                {app?.iconUrl ? (
                  <img className="st-is-head__summary-icon-img" src={app.iconUrl} alt="" loading="lazy" />
                ) : (
                  <span
                    className="st-is-head__summary-icon"
                    style={{ backgroundColor: card.accent || app?.accent || '#5c6bc0' }}
                    aria-hidden
                  >
                    {card.name?.charAt(0) || '?'}
                  </span>
                )}
                <span className="st-is-head__summary-name">{card.name}</span>
                <span
                  className={`st-is-head__summary-growth${isUp ? ' st-is-head__summary-growth--up' : ''}${isDown ? ' st-is-head__summary-growth--down' : ''}`}
                >
                  {isUp ? '↑' : isDown ? '↓' : ''}
                  {formatGrowthPercent(growth)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default ImpressionShareContentHead;
