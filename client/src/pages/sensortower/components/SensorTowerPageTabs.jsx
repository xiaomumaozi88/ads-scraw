import React from 'react';
import './SensorTowerPageTabs.css';

function SensorTowerPageTabs({ pages, activePageId, onChange }) {
  return (
    <nav className="st-page-tabs" aria-label="Sensor Tower 页面">
      <div className="st-page-tabs__list" role="tablist">
        {pages.map((page) => {
          const isActive = page.id === activePageId;
          return (
            <button
              key={page.id}
              type="button"
              role="tab"
              id={`st-page-tab-${page.id}`}
              className={`st-page-tabs__tab${isActive ? ' st-page-tabs__tab--active' : ''}`}
              aria-selected={isActive}
              aria-controls={`st-page-panel-${page.id}`}
              onClick={() => onChange(page.id)}
            >
              {page.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default SensorTowerPageTabs;
