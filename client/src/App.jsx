import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from 'antd';
import PlatformSelection from './components/PlatformSelection';
import LoginModal from './components/LoginModal';
import DataCard from './components/DataCard';
import { usePlatformStatus } from './hooks/usePlatformStatus';
import { useLogs } from './hooks/useLogs';
import { clearLogin } from './utils/api';
import './styles/App.css';
import insightrackrLogo from '../assets/insightrackr-logo.png';
import guangdadaLogo from '../assets/guangdada-logo.svg';

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
      <div className="container">
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
        <div className="main-content">
          <DataCard
            platform={selectedPlatform}
            addLog={addLog}
            onRequireLogin={handleRequireLogin}
            isLoggedIn={getStatus(selectedPlatform) === 'ONLINE'}
          />
        </div>
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
