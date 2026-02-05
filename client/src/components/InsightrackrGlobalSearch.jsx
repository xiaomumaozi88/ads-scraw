import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Spin } from 'antd';
import { getInsightrackrSearchGlobal } from '../utils/api';
import './InsightrackrGlobalSearch.css';

function renderWithRedHighlight(str) {
  if (str == null || typeof str !== 'string') return null;
  const re = /<font color='red'>(.*?)<\/font>/g;
  const parts = [];
  let lastIndex = 0;
  let key = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<React.Fragment key={key++}>{str.slice(lastIndex, m.index)}</React.Fragment>);
    }
    parts.push(<span key={key++} style={{ color: '#ff4d4f' }}>{m[1]}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(<React.Fragment key={key++}>{str.slice(lastIndex)}</React.Fragment>);
  }
  return parts.length === 0 ? str : <>{parts}</>;
}

function InsightrackrGlobalSearch({ value, onChange, placeholder = '搜索应用/产品', onSelectProduct, onSelectCompany }) {
  const stripHtml = (s) => (s == null ? '' : String(s).replace(/<font color='red'>|<\/font>/g, '').trim());
  const [inputValue, setInputValue] = useState(value ?? '');
  const [lockedTag, setLockedTag] = useState(null); // 选中结果后回填的 tag，非空时锁定：仅展示 tag + 清除按钮，不可输入、不展开下拉
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productList, setProductList] = useState([]);
  const [companyList, setCompanyList] = useState([]);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  // 仅当传入 value 时与外部同步（未传 value 时为“应用/产品”独立输入，不与关键词 keyWord 同步）
  useEffect(() => {
    if (value === undefined) return;
    const v = value || '';
    setInputValue(v);
    if (!v) setLockedTag(null);
  }, [value]);

  useEffect(() => {
    if (lockedTag) return; // 锁定状态下不发起搜索
    const kw = inputValue.trim();
    if (!kw) {
      setProductList([]);
      setCompanyList([]);
      setOpen(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setLoading(true);
      // 输入关键词时发两个请求：searchType "1"（应用）与 "2"（开发者旗下APP）
      const requestApps = getInsightrackrSearchGlobal(kw, '1');
      const requestDevelopers = getInsightrackrSearchGlobal(kw, '2');
      Promise.all([requestApps, requestDevelopers])
        .then(([resApps, resDevelopers]) => {
          setProductList((resApps?.data?.productList || []).slice(0, 10));
          setCompanyList((resDevelopers?.data?.productList || []).slice(0, 10));
          setOpen(true);
        })
        .catch(() => {
          setProductList([]);
          setCompanyList([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputValue, lockedTag]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const v = e.target.value;
    setInputValue(v);
    onChange?.(v);
  };

  const handleClear = () => {
    setLockedTag(null);
    setInputValue('');
    onChange?.('');
    setOpen(false);
    setProductList([]);
    setCompanyList([]);
  };

  const handleSelectItem = (name) => {
    if (!name) return;
    setInputValue(name);
    setLockedTag(name);
    setOpen(false);
    // 选中项仅用于展示锁定态，不回调 onChange 写回关键词；productIds 由 onSelectProduct/onSelectCompany 在父组件中设置
  };

  const hasResults = productList.length > 0 || companyList.length > 0;
  const isLocked = !!lockedTag;

  return (
    <div className={`insightrackr-global-search-wrap${isLocked ? ' insightrackr-global-search-wrap--locked' : ''}`} ref={wrapRef}>
      {isLocked ? (
        <div className="insightrackr-global-search-row insightrackr-global-search-row--locked">
          <Input
            readOnly
            value={lockedTag}
            className="insightrackr-global-search-input-readonly"
            style={{ width: 'fit-content', minWidth: 120, maxWidth: '100%' }}
            suffix={
              <Button type="link" size="small" onClick={handleClear} className="insightrackr-global-search-clear-btn">
                清除
              </Button>
            }
          />
        </div>
      ) : (
        <>
      <div className="insightrackr-global-search-row">
        <Input
          className="insightrackr-global-search-input"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.trim() && hasResults && setOpen(true)}
          suffix={loading ? <Spin size="small" /> : null}
          allowClear
        />
      </div>
      {open && (productList.length > 0 || companyList.length > 0) && (
        <div className="insightrackr-global-search-dropdown">
          <div className="insightrackr-global-search-dropdown-inner">
            {productList.length > 0 && (
              <div className="insightrackr-global-search-column">
                <div className="insightrackr-global-search-column-title">应用/产品</div>
                <div className="insightrackr-global-search-list">
                  {productList.map((item) => (
                    <div
                      key={item.productId || item.pkg}
                      className="insightrackr-global-search-item"
                      onClick={() => {
                        const name = stripHtml(item.productName) || item.productNameOrigin || '';
                        handleSelectItem(name);
                        onSelectProduct?.(item);
                      }}
                    >
                      {item.productImageUrl ? (
                        <img src={item.productImageUrl} alt="" className="insightrackr-global-search-item-icon" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="insightrackr-global-search-item-icon insightrackr-global-search-item-icon--placeholder" />
                      )}
                      <div className="insightrackr-global-search-item-body">
                        <div className="insightrackr-global-search-item-name">
                          {renderWithRedHighlight(item.productName) || item.productNameOrigin || '—'}
                        </div>
                        <div className="insightrackr-global-search-item-meta">{item.pkg || item.productId || ''}</div>
                      </div>
                      <div className="insightrackr-global-search-item-count">
                        {(item.creativeCnt ?? item.materialUvCnt ?? '—') !== '—' ? (item.creativeCnt ?? item.materialUvCnt) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {companyList.length > 0 && (
              <div className="insightrackr-global-search-column">
                <div className="insightrackr-global-search-column-title">开发者旗下APP</div>
                <div className="insightrackr-global-search-list">
                  {companyList.map((item) => (
                    <div
                      key={item.productId || item.pkg}
                      className="insightrackr-global-search-item"
                      onClick={() => {
                        const name = stripHtml(item.productName) || item.productNameOrigin || '';
                        handleSelectItem(name);
                        onSelectCompany?.(item);
                      }}
                    >
                      {item.productImageUrl ? (
                        <img src={item.productImageUrl} alt="" className="insightrackr-global-search-item-icon" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="insightrackr-global-search-item-icon insightrackr-global-search-item-icon--placeholder" />
                      )}
                      <div className="insightrackr-global-search-item-body">
                        <div className="insightrackr-global-search-item-name">
                          {renderWithRedHighlight(item.productName) || item.productNameOrigin || '—'}
                        </div>
                        <div className="insightrackr-global-search-item-meta">
                          {renderWithRedHighlight(item.companyName) || item.companyNameOrigin || '—'}
                        </div>
                      </div>
                      <div className="insightrackr-global-search-item-count">
                        {(item.creativeCnt ?? item.materialUvCnt ?? '—') !== '—' ? (item.creativeCnt ?? item.materialUvCnt) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default InsightrackrGlobalSearch;
