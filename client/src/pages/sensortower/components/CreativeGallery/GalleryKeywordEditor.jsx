import React, { useCallback, useState } from 'react';

function GalleryKeywordEditor({ keywordItems, onAddKeyword, onToggleKeyword }) {
  const [draft, setDraft] = useState('');

  const submitDraft = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    onAddKeyword(text);
    setDraft('');
  }, [draft, onAddKeyword]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitDraft();
    }
  };

  return (
    <div className="st-sidebar__keywords">
      <div className="st-sidebar__keywords-row">
        <input
          className="st-sidebar__input st-sidebar__input--grow"
          placeholder="添加关键词…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="st-sidebar__kw-add"
          aria-label="添加关键词"
          onClick={submitDraft}
        >
          +
        </button>
        <button type="button" className="st-sidebar__kw-more" aria-label="更多选项">
          <span aria-hidden>⋮</span>
        </button>
      </div>
      <div className="st-sidebar__kw-section">
        <p className="st-sidebar__kw-label">
          <span>关键字</span>
          <span className="st-sidebar__kw-info" title="创意文本搜索将随官方 API 支持后接入">
            ⓘ
          </span>
        </p>
        {keywordItems.length > 0 ? (
          <ul className="st-sidebar__kw-list">
            {keywordItems.map((item) => (
              <li key={item.id} className="st-sidebar__kw-list-item">
                <button
                  type="button"
                  className={`st-sidebar__kw-item${item.selected ? ' st-sidebar__kw-item--selected' : ''}`}
                  onClick={() => onToggleKeyword(item.id)}
                  aria-pressed={item.selected}
                >
                  <span className="st-sidebar__kw-check" aria-hidden>
                    {item.selected ? '✓' : ''}
                  </span>
                  <span className="st-sidebar__kw-text">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default GalleryKeywordEditor;
