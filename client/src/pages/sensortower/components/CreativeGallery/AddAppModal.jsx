import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchRecentGalleryApps,
  formatMetric,
  loadRecentAppsFromStorage,
  saveRecentAppToStorage,
  searchGalleryApps,
} from '../../utils/galleryAppSearch.js';
import './AddAppModal.css';

function AppSearchRow({ app, onSelect }) {
  const downloads = formatMetric(app.downloads);
  const revenue = formatMetric(app.revenue);

  return (
    <button type="button" className="st-add-app-row" onClick={() => onSelect(app)}>
      <div className="st-add-app-row__stores" aria-hidden>
        <span className="st-add-app-row__store" title="App Store">
          <span className="st-add-app-row__store-icon"></span>
          {app.iosCount != null ? <span>{app.iosCount}</span> : null}
        </span>
        <span className="st-add-app-row__store" title="Google Play">
          <span className="st-add-app-row__store-icon st-add-app-row__store-icon--gp">▶</span>
          {app.androidCount != null ? <span>{app.androidCount}</span> : null}
        </span>
      </div>
      {app.iconUrl ? (
        <img className="st-add-app-row__icon" src={app.iconUrl} alt="" loading="lazy" />
      ) : (
        <span className="st-add-app-row__icon st-add-app-row__icon--placeholder" aria-hidden>
          {app.name?.charAt(0) || '?'}
        </span>
      )}
      <div className="st-add-app-row__meta">
        <span className="st-add-app-row__name">{app.name || app.unifiedAppId}</span>
        {app.publisher ? <span className="st-add-app-row__publisher">{app.publisher}</span> : null}
      </div>
      <div className="st-add-app-row__metrics">
        {downloads ? (
          <span className="st-add-app-row__metric" title="下载量">
            ↓ {downloads}
          </span>
        ) : null}
        {revenue ? (
          <span className="st-add-app-row__metric" title="收入">
            $ {revenue}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function AddAppModal({ open, onClose, onSelectApp }) {
  const [tab, setTab] = useState('apps');
  const [query, setQuery] = useState('');
  const [recentApps, setRecentApps] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRecent = useCallback(async () => {
    const stored = loadRecentAppsFromStorage();
    if (stored.length) {
      setRecentApps(stored);
      return;
    }
    try {
      const remote = await fetchRecentGalleryApps();
      setRecentApps(remote);
    } catch {
      setRecentApps([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab('apps');
    setQuery('');
    setSearchResults([]);
    setError('');
    loadRecent();
  }, [open, loadRecent]);

  useEffect(() => {
    if (!open) return undefined;
    const term = query.trim();
    if (!term) {
      setSearchResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const apps = await searchGalleryApps(term, 20);
        setSearchResults(apps);
      } catch (e) {
        setError(e?.message || String(e));
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, open]);

  const handleSelect = (app) => {
    if (!app?.unifiedAppId) return;
    saveRecentAppToStorage(app);
    onSelectApp(app);
    onClose();
  };

  if (!open) return null;

  const list = query.trim() ? searchResults : recentApps;
  const sectionTitle = query.trim() ? '搜索结果' : '最近使用的应用程序';

  return (
    <div className="st-add-app-modal" role="presentation" onClick={onClose}>
      <div
        className="st-add-app-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="st-add-app-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-add-app-modal__tabs">
          <button
            type="button"
            className={`st-add-app-modal__tab${tab === 'apps' ? ' st-add-app-modal__tab--active' : ''}`}
            onClick={() => setTab('apps')}
          >
            应用
          </button>
          <button
            type="button"
            className={`st-add-app-modal__tab${tab === 'groups' ? ' st-add-app-modal__tab--active' : ''}`}
            onClick={() => setTab('groups')}
            disabled
            title="敬请期待"
          >
            群组
          </button>
        </div>

        {tab === 'apps' ? (
          <>
            <label className="st-add-app-modal__search">
              <span className="st-add-app-modal__search-icon" aria-hidden>
                ⌕
              </span>
              <input
                id="st-add-app-title"
                type="search"
                placeholder="搜索应用"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </label>
            <h3 className="st-add-app-modal__section-title">{sectionTitle}</h3>
            {error ? (
              <p className="st-add-app-modal__error" role="alert">
                {error}
              </p>
            ) : null}
            {loading ? <p className="st-add-app-modal__hint">搜索中…</p> : null}
            {!loading && !list.length ? (
              <p className="st-add-app-modal__hint">
                {query.trim() ? '未找到匹配应用' : '暂无最近使用，请搜索应用名称'}
              </p>
            ) : null}
            <div className="st-add-app-modal__list">
              {list.map((app) => (
                <AppSearchRow
                  key={app.unifiedAppId}
                  app={app}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="st-add-app-modal__hint">群组功能即将上线</p>
        )}

        <button type="button" className="st-add-app-modal__close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
    </div>
  );
}

export default AddAppModal;
