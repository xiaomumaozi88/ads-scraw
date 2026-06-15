import React from 'react';
import { buildSummarySubtitle } from '../../utils/formatGallery.js';

function GalleryAppSummary({
  platformId,
  startDate,
  endDate,
  allRegions,
  allNetworks,
  appSummaries,
}) {
  const subtitle = buildSummarySubtitle({
    platformId,
    startDate,
    endDate,
    allRegions,
    allNetworks,
  });

  return (
    <section className="st-summary">
      <div className="st-summary__head">
        <h2 className="st-summary__title">广告创意</h2>
        <p className="st-summary__subtitle">{subtitle}</p>
      </div>
      <div className="st-summary__apps">
        {appSummaries.map((app) => (
          <div key={app.unifiedAppId} className="st-summary__app-card">
            <span
              className="st-summary__app-icon"
              style={{ backgroundColor: app.accent || '#5c6bc0' }}
              aria-hidden
            >
              {app.name?.charAt(0) || '?'}
            </span>
            <div className="st-summary__app-text">
              <span className="st-summary__app-name">{app.name}</span>
              <span className="st-summary__app-publisher">{app.publisher}</span>
            </div>
            <div className="st-summary__app-count">
              <span className="st-summary__app-count-num">{app.creativeCount}</span>
              <span className="st-summary__app-count-label">Creatives</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default GalleryAppSummary;
