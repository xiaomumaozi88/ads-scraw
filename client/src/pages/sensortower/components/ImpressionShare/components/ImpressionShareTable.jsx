import React from 'react';
import {
  formatGrowthPercent,
  formatSharePercent,
} from '../../../utils/formatImpressionShare.js';

function ImpressionShareTable({ rows, totalShare, appsById, maxShare }) {
  const scaleMax = maxShare > 0 ? maxShare : 1;

  return (
    <div className="st-is-table-wrap">
      <table className="st-is-table">
        <thead>
          <tr>
            <th scope="col" className="st-is-table__col-app">
              应用/发行商
            </th>
            <th scope="col" className="st-is-table__col-share">
              展示份额 占总数约%
            </th>
            <th scope="col" className="st-is-table__col-growth">
              展示增长率 %
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="st-is-table__row-total">
            <td className="st-is-table__app-cell">
              <span className="st-is-table__total-label">所选总计</span>
            </td>
            <td className="st-is-table__share-cell">
              <span className="st-is-table__share-value">{formatSharePercent(totalShare)}</span>
            </td>
            <td className="st-is-table__growth-cell">—</td>
          </tr>
          {rows.map((row) => {
            const app = appsById.get(row.unifiedAppId);
            const growth = Number(row.growthPercent);
            const isUp = growth > 0;
            const isDown = growth < 0;
            const barWidth = `${Math.min(100, (row.sharePercent / scaleMax) * 100)}%`;
            return (
              <tr key={row.unifiedAppId}>
                <td className="st-is-table__app-cell">
                  <div className="st-is-table__app-main">
                    {app?.iconUrl ? (
                      <img className="st-is-table__icon-img" src={app.iconUrl} alt="" loading="lazy" />
                    ) : (
                      <span
                        className="st-is-table__icon"
                        style={{ backgroundColor: row.accent || app?.accent || '#5c6bc0' }}
                        aria-hidden
                      >
                        {row.name?.charAt(0) || '?'}
                      </span>
                    )}
                    <div className="st-is-table__app-text">
                      <span className="st-is-table__app-name">{row.name}</span>
                      <span className="st-is-table__app-publisher">{row.publisher}</span>
                    </div>
                  </div>
                </td>
                <td className="st-is-table__share-cell">
                  <div className="st-is-table__share-bar-wrap">
                    <div
                      className="st-is-table__share-bar"
                      style={{ width: barWidth, backgroundColor: row.accent || '#5c6bc0' }}
                    />
                    <span className="st-is-table__share-value">
                      {formatSharePercent(row.sharePercent)}
                    </span>
                  </div>
                </td>
                <td
                  className={`st-is-table__growth-cell${isUp ? ' st-is-table__growth-cell--up' : ''}${isDown ? ' st-is-table__growth-cell--down' : ''}`}
                >
                  {formatGrowthPercent(growth)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ImpressionShareTable;
