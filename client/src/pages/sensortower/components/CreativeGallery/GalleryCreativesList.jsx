import React, { useMemo } from 'react';
import { GALLERY_LIST_COLUMN_GROUPS } from '../../constants/galleryListColumns.js';
import {
  formatSharePercent,
  getCreativeGalleryRowKey,
  getNetworkColor,
  isVideoCreative,
  resolveCreativeThumbUrl,
} from '../../utils/formatGallery.js';
import { formatListCellValue } from '../../utils/galleryListCellFormat.js';
import ShareSparkline from './ShareSparkline.jsx';
import CreativeThumbPlayOverlay from '../CreativeThumbPlayOverlay.jsx';
import './GalleryCreativesList.css';

function buildVisibleColumnDefs(isColumnVisible) {
  const cols = [];
  for (const group of GALLERY_LIST_COLUMN_GROUPS) {
    for (const col of group.columns) {
      if (isColumnVisible(col.id)) {
        cols.push({ id: col.id, label: col.label });
      }
    }
  }
  return cols;
}

function orderListColumns(visibleCols) {
  const appCol = visibleCols.find((col) => col.id === 'app');
  const rest = visibleCols.filter((col) => col.id !== 'app');
  const ordered = [];
  if (appCol) ordered.push(appCol);
  ordered.push({ id: 'creative', label: '创意' });
  ordered.push(...rest);
  return ordered;
}

function CreativeThumbCell({ item, onClick }) {
  const thumbUrl = resolveCreativeThumbUrl(item);
  const isVideo = isVideoCreative(item);

  return (
    <button
      type="button"
      className="st-creatives-list__thumb-btn"
      onClick={() => onClick?.(item)}
      aria-label="查看创意详情"
    >
      <div className="st-creatives-list__thumb-wrap">
        {thumbUrl ? (
          <img className="st-creatives-list__thumb" src={thumbUrl} alt="" loading="lazy" />
        ) : (
          <span className="st-creatives-list__thumb-empty">无预览</span>
        )}
        {isVideo ? <CreativeThumbPlayOverlay size="sm" /> : null}
      </div>
    </button>
  );
}

function GalleryCreativesList({ rows, appsById, page, pageSize, visibleColumns, onCreativeClick }) {
  const rankBase = (page - 1) * pageSize;
  const orderedCols = useMemo(() => {
    const isVisible = (id) => visibleColumns.has(id);
    return orderListColumns(buildVisibleColumnDefs(isVisible));
  }, [visibleColumns]);

  return (
    <div className="st-creatives-list-wrap">
      <table className="st-creatives-list">
        <thead>
          <tr>
            <th scope="col" className="st-creatives-list__th st-creatives-list__th--rank">
              排名
            </th>
            {orderedCols.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={`st-creatives-list__th st-creatives-list__th--${col.id}`}
              >
                {col.id === 'share' ? `${col.label} ↓` : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => {
            const rank = rankBase + idx + 1;
            const app = appsById.get(item.unified_app_id);
            const appName = app?.name || `App ${String(item.unified_app_id || '').slice(0, 8)}`;
            const publisher = app?.publisher || '—';
            const network = item.network || '—';
            const shareText = formatSharePercent(item.grouped_creative_share);

            return (
              <tr
                key={getCreativeGalleryRowKey(item) || `creative-${idx}`}
                className="st-creatives-list__row"
              >
                <td className="st-creatives-list__td st-creatives-list__td--rank">{rank}</td>
                {orderedCols.map((col) => {
                  if (col.id === 'app') {
                    return (
                      <td key={col.id} className="st-creatives-list__td st-creatives-list__td--app">
                        <div className="st-creatives-list__app">
                          {app?.iconUrl ? (
                            <img
                              className="st-creatives-list__app-icon"
                              src={app.iconUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className="st-creatives-list__app-icon st-creatives-list__app-icon--placeholder"
                              style={{ backgroundColor: app?.accent || '#5c6bc0' }}
                            >
                              {appName.charAt(0)}
                            </span>
                          )}
                          <span className="st-creatives-list__app-text">
                            <span className="st-creatives-list__app-name">{appName}</span>
                            <span className="st-creatives-list__app-publisher">{publisher}</span>
                          </span>
                        </div>
                      </td>
                    );
                  }
                  if (col.id === 'creative') {
                    return (
                      <td key={col.id} className="st-creatives-list__td st-creatives-list__td--creative">
                        <CreativeThumbCell item={item} onClick={onCreativeClick} />
                      </td>
                    );
                  }
                  if (col.id === 'network') {
                    return (
                      <td key={col.id} className="st-creatives-list__td st-creatives-list__td--network">
                        <span
                          className="st-creatives-list__network-badge"
                          style={{ color: getNetworkColor(network) }}
                          title={network}
                        >
                          {network.slice(0, 1)}
                        </span>
                      </td>
                    );
                  }
                  if (col.id === 'share') {
                    return (
                      <td key={col.id} className="st-creatives-list__td st-creatives-list__td--share">
                        <div className="st-creatives-list__share">
                          <span className="st-creatives-list__share-pct">{shareText}</span>
                          <ShareSparkline creative={item} width={128} height={40} />
                        </div>
                      </td>
                    );
                  }
                  const text = formatListCellValue(col.id, item, app);
                  const tdClass = [
                    'st-creatives-list__td',
                    `st-creatives-list__td--${col.id}`,
                    col.id === 'firstSeen' || col.id === 'lastSeen' ? 'st-creatives-list__td--date' : '',
                    col.id === 'duration' || col.id === 'videoDuration' ? 'st-creatives-list__td--duration' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={col.id} className={tdClass}>
                      {text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default GalleryCreativesList;
