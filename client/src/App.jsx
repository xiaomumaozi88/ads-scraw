import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Drawer, Tag } from 'antd';
import PlatformSelection from './components/PlatformSelection';
import BubbleHint from './components/BubbleHint';
import { useDownloadList } from './contexts/DownloadListContext';
import LoginModal from './components/LoginModal';
import DataCard from './components/DataCard';
import { usePlatformStatus } from './hooks/usePlatformStatus';
import { useLogs } from './hooks/useLogs';
import { clearLogin } from './utils/api';
import './styles/App.css';
import insightrackrLogo from '../assets/insightrackr-logo.png';
import guangdadaLogo from '../assets/guangdada-logo.svg';
import guangdadaBg from '../assets/guangdada-bg.svg';

const PLATFORM_ROUTES = { insightrackr: '/insightrackr', guangdada: '/guangdada' };

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || '/';

  // 从路由推导当前平台：/insightrackr -> insightrackr，/guangdada -> guangdada，/ -> null
  const selectedPlatform = pathname === '/insightrackr' ? 'insightrackr' : pathname === '/guangdada' ? 'guangdada' : null;
  const isSelectionView = pathname === '/';

  // 未知路径重定向到首页
  useEffect(() => {
    if (!isSelectionView && !selectedPlatform) {
      navigate('/', { replace: true });
    }
  }, [pathname, isSelectionView, selectedPlatform, navigate]);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [downloadDrawerOpen, setDownloadDrawerOpen] = useState(false);
  /** 气泡引导：从开始下载按钮飘向下载列表按钮的起始位置 */
  const [bubbleHintStartRect, setBubbleHintStartRect] = useState(null);
  /** 气泡到达时，下载列表按钮摇晃变大 */
  const [downloadBtnWobble, setDownloadBtnWobble] = useState(false);
  const downloadListBtnRef = useRef(null);
  const { downloadList, downloading, batchSizeLabel } = useDownloadList();
  const handleBatchModeEnteredWithHint = useCallback((rect) => {
    setBubbleHintStartRect(rect);
    setTimeout(() => setBubbleHintStartRect(null), 1500);
  }, []);
  const handleBubbleReachTarget = useCallback(() => {
    setDownloadBtnWobble(true);
    setTimeout(() => setDownloadBtnWobble(false), 700);
  }, []);
  const { statuses, refreshStatus, getStatus, getStatusDetail } = usePlatformStatus();
  const { addLog } = useLogs();

  const handleReLogin = async (platform) => {
    try {
      await clearLogin(platform);
      await refreshStatus(platform);
      setShowLoginModal(true);
      addLog(`已清除 ${platform === 'insightrackr' ? 'Insightrackr' : '广大大'} 登录状态，请重新登录`, 'info');
    } catch (e) {
      addLog(`清除登录状态失败: ${e.message}`, 'error');
    }
  };

  // 在 Insightrackr / 广大大 路由下检查登录状态，未登录则弹出登录框（与 Insightrackr 一致）
  useEffect(() => {
    if (pathname !== '/insightrackr' && pathname !== '/guangdada') return;
    const platform = pathname === '/insightrackr' ? 'insightrackr' : 'guangdada';
    let cancelled = false;
    refreshStatus(platform)
      .then((status) => {
        if (cancelled) return;
        if (status !== 'ONLINE') {
          setShowLoginModal(true);
          addLog(`需要登录 ${platform === 'insightrackr' ? 'Insightrackr' : '广大大'}，当前状态: ${status}`, 'info');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const isNetworkError = !error.message || /fetch|network|failed to fetch/i.test(error.message);
        if (isNetworkError) {
          addLog(`无法连接服务器，请确认后端已启动且使用同一地址访问（当前为 ${window.location.origin}）`, 'error');
        } else {
          addLog(`登录状态检查失败: ${error.message}`, 'error');
        }
        setShowLoginModal(true);
      });
    return () => { cancelled = true; };
  }, [pathname, refreshStatus, addLog]);

  const handlePlatformSelect = (platform) => {
    const route = PLATFORM_ROUTES[platform];
    if (!route) return;
    navigate(route);
    if (platform === 'guangdada') {
      addLog(`进入广大大查询页面`, 'info');
    } else {
      addLog(`进入 Insightrackr 查询页面`, 'info');
    }
  };

  const handleLoginSuccess = async () => {
    if (selectedPlatform) {
      setShowLoginModal(false);
      addLog(`登录成功，跳转到查询页面`, 'success');
      refreshStatus(selectedPlatform).then((status) => {
        if (status === 'ONLINE') addLog(`登录状态已确认: ${status}`, 'success');
      }).catch((err) => addLog(`登录状态检查失败: ${err.message}`, 'error'));
    }
  };

  const handleBackToSelection = () => {
    navigate('/');
    addLog('返回平台选择', 'info');
  };

  const handleRequireLogin = () => {
    setShowLoginModal(true);
    addLog('需要重新登录', 'info');
  };

  // 首页：平台选择
  if (isSelectionView) {
    return (
      <div className="app">
        <PlatformSelection onSelectPlatform={handlePlatformSelect} />
        <LoginModal
          platform={selectedPlatform}
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
          addLog={addLog}
        />
      </div>
    );
  }

  // /insightrackr 或 /guangdada：数据查询页
  return (
    <div className="app">
      <div
        className={`container${selectedPlatform === 'guangdada' ? ' container--guangdada' : selectedPlatform === 'insightrackr' ? ' container--insightrackr' : ''}`}
        style={selectedPlatform === 'guangdada' ? { backgroundImage: `url(${guangdadaBg})` } : undefined}
      >
        <div className="search-page-header">
          <button className="btn-back" onClick={handleBackToSelection}>
            ← 返回平台选择
          </button>
          <div className="search-page-header-logo">
            <img
              src={selectedPlatform === 'insightrackr' ? insightrackrLogo : guangdadaLogo}
              alt={selectedPlatform === 'insightrackr' ? 'Insightrackr' : '广大大'}
              className="search-page-header-logo-img"
            />
            <span className="search-page-header-suffix">数据查询</span>
          </div>
          <div className="search-page-header-right">
            <span
              className={`search-page-header-download-btn-wrap${downloadBtnWobble ? ' search-page-header-download-btn-wrap--wobble' : ''}`}
              style={{ display: 'inline-block' }}
            >
              <button
                ref={downloadListBtnRef}
                type="button"
                className="search-page-header-download-btn"
                onClick={() => setDownloadDrawerOpen(true)}
              >
                下载列表
                {(() => {
                  const pendingOrProcessing = downloadList.filter(
                    (item) => item.status === 'pending' || item.status === 'processing'
                  ).length;
                  return pendingOrProcessing > 0 ? (
                    <span className="search-page-header-download-count">({pendingOrProcessing})</span>
                  ) : null;
                })()}
                {downloading && <span className="search-page-header-download-badge">处理中</span>}
              </button>
            </span>
            {getStatus(selectedPlatform) === 'ONLINE' ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'relogin',
                      label: '重新登录',
                      onClick: () => handleReLogin(selectedPlatform)
                    }
                  ]
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <button type="button" className="search-page-header-user">
                  {getStatusDetail(selectedPlatform)?.email || '已登录'}
                </button>
              </Dropdown>
            ) : (
              <span className="search-page-header-user search-page-header-user--muted">未登录</span>
            )}
          </div>
        </div>
        <Drawer
          title="下载处理列表"
          placement="right"
          open={downloadDrawerOpen}
          onClose={() => setDownloadDrawerOpen(false)}
          width={600}
          className="download-list-drawer"
        >
          {batchSizeLabel ? (
            <div className="download-list-drawer-size-block">本批次输出尺寸：{batchSizeLabel}</div>
          ) : null}
          {downloadList.length === 0 ? (
            <div className="download-list-drawer-empty">暂无下载任务</div>
          ) : (
            <div className="download-list-drawer-body">
              {downloadList.map((item) => (
                <div
                  key={item.id}
                  className={`download-list-item download-list-item--${item.status}`}
                >
                  {item.sizeLabel && (
                    <Tag className="download-list-item__size-tag">{item.sizeLabel}</Tag>
                  )}
                  <div className="download-list-item__main">
                    <span className="download-list-item__filename" title={item.filename}>
                      {item.filename.length > 40 ? item.filename.slice(0, 38) + '…' : item.filename}
                    </span>
                    <span className="download-list-item__status">
                      {item.status === 'pending' && '等待中'}
                      {item.status === 'processing' && `处理中 ${Math.round(item.progress)}%`}
                      {item.status === 'done' && '已完成'}
                      {item.status === 'error' && (item.errorMessage || '失败')}
                    </span>
                  </div>
                  {(item.status === 'processing' || item.status === 'done') && (
                    <div className="download-list-item__progress-wrap">
                      <div
                        className="download-list-item__progress-bar"
                        style={{
                          width: `${item.status === 'processing' && item.progress < 100
                            ? Math.max(item.progress, 2)
                            : item.progress}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Drawer>
        <div className="main-content">
          <DataCard
            platform={selectedPlatform}
            addLog={addLog}
            onRequireLogin={handleRequireLogin}
            isLoggedIn={getStatus(selectedPlatform) === 'ONLINE'}
            onBatchModeEnteredWithHint={handleBatchModeEnteredWithHint}
            refreshPlatformStatus={refreshStatus}
          />
        </div>
        {bubbleHintStartRect && (
          <BubbleHint
            startRect={bubbleHintStartRect}
            endRef={downloadListBtnRef}
            onReachTarget={handleBubbleReachTarget}
            onComplete={() => setBubbleHintStartRect(null)}
          />
        )}
        <LoginModal
          platform={selectedPlatform}
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
          addLog={addLog}
        />
      </div>
    </div>
  );
}

export default App;
