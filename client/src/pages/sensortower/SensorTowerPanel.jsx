import React, { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CreativeGallery from './components/CreativeGallery/CreativeGallery.jsx';
import ImpressionShare from './components/ImpressionShare/ImpressionShare.jsx';
import SensorTowerPageTabs from './components/SensorTowerPageTabs.jsx';
import {
  SENSOR_TOWER_DEFAULT_PAGE_ID,
  SENSOR_TOWER_PAGE_IDS,
  SENSOR_TOWER_PAGES,
  isValidSensorTowerPageId,
} from './constants/sensorTowerPages.js';
import { readStoredSensorTowerPage, writeStoredSensorTowerPage } from './utils/sensorTowerPageStorage.js';
import './SensorTowerPanel.css';

const URL_PAGE_PARAM = 'page';

function resolveActivePageId(searchParams) {
  const fromUrl = searchParams.get(URL_PAGE_PARAM);
  if (fromUrl) {
    return isValidSensorTowerPageId(fromUrl) ? fromUrl : SENSOR_TOWER_DEFAULT_PAGE_ID;
  }
  return SENSOR_TOWER_DEFAULT_PAGE_ID;
}

function SensorTowerPanel({ isLoggedIn, addLog, onRequireLogin }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activePageId = resolveActivePageId(searchParams);

  useEffect(() => {
    if (searchParams.get(URL_PAGE_PARAM)) return;
    const stored = readStoredSensorTowerPage();
    if (stored && stored !== SENSOR_TOWER_DEFAULT_PAGE_ID) {
      const next = new URLSearchParams(searchParams);
      next.set(URL_PAGE_PARAM, stored);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback(
    (pageId) => {
      if (!isValidSensorTowerPageId(pageId) || pageId === activePageId) return;
      writeStoredSensorTowerPage(pageId);
      const next = new URLSearchParams(searchParams);
      if (pageId === SENSOR_TOWER_DEFAULT_PAGE_ID) {
        next.delete(URL_PAGE_PARAM);
      } else {
        next.set(URL_PAGE_PARAM, pageId);
      }
      setSearchParams(next, { replace: true });
    },
    [activePageId, searchParams, setSearchParams]
  );

  const panelId = `st-page-panel-${activePageId}`;

  return (
    <div className="sensor-tower-panel">
      <SensorTowerPageTabs
        pages={SENSOR_TOWER_PAGES}
        activePageId={activePageId}
        onChange={handlePageChange}
      />
      <div
        className="sensor-tower-panel__content"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`st-page-tab-${activePageId}`}
      >
        {activePageId === SENSOR_TOWER_PAGE_IDS.CREATIVE_GALLERY ? (
          <CreativeGallery
            isLoggedIn={isLoggedIn}
            addLog={addLog}
            onRequireLogin={onRequireLogin}
          />
        ) : null}
        {activePageId === SENSOR_TOWER_PAGE_IDS.IMPRESSION_SHARE ? (
          <ImpressionShare
            isLoggedIn={isLoggedIn}
            addLog={addLog}
            onRequireLogin={onRequireLogin}
          />
        ) : null}
      </div>
    </div>
  );
}

export default SensorTowerPanel;
