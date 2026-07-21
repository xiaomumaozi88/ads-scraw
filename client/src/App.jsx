import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BubbleHint from './components/BubbleHint';
import LoginModal from './components/LoginModal';
import DataCard from './components/DataCard';
import VideoResizePage from './pages/video-resize/VideoResizePage';
import MaterialProcessingHistoryPage from './pages/material-processing/MaterialProcessingHistoryPage';
import HealthPage from './pages/health/HealthPage';
import TranscodeQueuePage from './pages/health/transcode-queue/TranscodeQueuePage';
import OperationAuditPage from './pages/health/operation-audits/OperationAuditPage';
import GuangdadaCreativeRankPage from './pages/guangdada/GuangdadaCreativeRankPage';
import AdminLayout from './layout/AdminLayout';
import PlatformQuickLoginButton from './components/PlatformQuickLoginButton';
import { useAuth } from './contexts/AuthContext';
import { usePlatformStatus } from './hooks/usePlatformStatus';
import { useLogs } from './hooks/useLogs';
import { FEATURES } from './config/features';
import { ROUTES, isGuangdadaRoute, isInsightrackrRoute, isSensortowerRoute } from './config/routes';
import { canAccessRoute, getFirstAllowedRoute } from './config/iam';
import './styles/App.css';
import guangdadaBg from '../assets/guangdada-bg.svg';

function platformDisplayName(platform) {
  if (platform === 'insightrackr') return '热云';
  if (platform === 'guangdada') return '广大大';
  if (platform === 'sensortower') return 'Sensor Tower';
  return platform || '';
}

const SENSOR_TOWER_AUTH_CHALLENGE_KEY = 'ads-scraw:sensortower-auth-link-required';
const SENSOR_TOWER_AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE =
  'Sensor Tower 需要邮箱授权，请粘贴邮件中的授权链接';

function readSensorTowerAuthChallenge() {
  try {
    const raw = window.localStorage.getItem(SENSOR_TOWER_AUTH_CHALLENGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.expiresAt || Number(data.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(SENSOR_TOWER_AUTH_CHALLENGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveSensorTowerAuthChallenge(message = SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE) {
  const data = {
    message,
    createdAt: Date.now(),
    expiresAt: Date.now() + SENSOR_TOWER_AUTH_CHALLENGE_TTL_MS,
  };
  try {
    window.localStorage.setItem(SENSOR_TOWER_AUTH_CHALLENGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
  return data;
}

function clearSensorTowerAuthChallenge() {
  try {
    window.localStorage.removeItem(SENSOR_TOWER_AUTH_CHALLENGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function resolveRouteMeta(pathname) {
  if (pathname.startsWith(ROUTES.MATERIAL_HISTORY)) {
    return { kind: 'tool', platform: null, contentClassName: 'admin-layout__content--tool' };
  }
  if (pathname.startsWith(ROUTES.VIDEO_RESIZE)) {
    return { kind: 'tool', platform: null, contentClassName: 'admin-layout__content--tool' };
  }
  if (pathname.startsWith(ROUTES.HEALTH)) {
    return { kind: 'health', platform: null, contentClassName: 'admin-layout__content--health' };
  }
  if (isInsightrackrRoute(pathname)) {
    return { kind: 'platform', platform: 'insightrackr', contentClassName: 'admin-layout__content--insightrackr' };
  }
  if (isSensortowerRoute(pathname)) {
    return { kind: 'platform', platform: 'sensortower', contentClassName: 'admin-layout__content--sensortower' };
  }
  if (isGuangdadaRoute(pathname)) {
    return { kind: 'platform', platform: 'guangdada', contentClassName: 'container--guangdada' };
  }
  return null;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const pathname = location.pathname || '/';
  const routeMeta = useMemo(() => resolveRouteMeta(pathname), [pathname]);
  const selectedPlatform = routeMeta?.platform ?? null;
  const firstAllowedRoute = useMemo(() => getFirstAllowedRoute(profile), [profile]);
  const canAccessCurrentRoute = useMemo(() => {
    if (!routeMeta) return true;
    return canAccessRoute(profile, pathname);
  }, [profile, pathname, routeMeta]);

  useEffect(() => {
    const fallbackRoute = firstAllowedRoute || ROUTES.VIDEO_RESIZE;
    if (pathname === '/') {
      navigate(fallbackRoute, { replace: true });
      return;
    }
    if (pathname === ROUTES.EXTERNAL_SEARCH_DEBUG && !FEATURES.externalSearchDebug) {
      navigate(fallbackRoute, { replace: true });
      return;
    }
    if (pathname !== '/' && !routeMeta) {
      navigate(fallbackRoute, { replace: true });
      return;
    }
    if (routeMeta && !canAccessCurrentRoute) {
      navigate(fallbackRoute, { replace: true });
    }
  }, [pathname, routeMeta, canAccessCurrentRoute, firstAllowedRoute, navigate]);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalAuthLinkMode, setLoginModalAuthLinkMode] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState('');
  const [insightrackrStatusConfirmed, setInsightrackrStatusConfirmed] = useState(false);
  const [sensortowerStatusChecked, setSensortowerStatusChecked] = useState(false);
  const [bubbleHintStartRect, setBubbleHintStartRect] = useState(null);
  const [downloadBtnWobble, setDownloadBtnWobble] = useState(false);
  const downloadListBtnRef = useRef(null);
  const handleBatchModeEnteredWithHint = useCallback((rect) => {
    setBubbleHintStartRect(rect);
    setTimeout(() => setBubbleHintStartRect(null), 1500);
  }, []);
  const handleBubbleReachTarget = useCallback(() => {
    setDownloadBtnWobble(true);
    setTimeout(() => setDownloadBtnWobble(false), 700);
  }, []);
  const { refreshStatus, refreshStatusDetail, getStatus, getStatusDetail, loading } = usePlatformStatus();
  const { addLog } = useLogs();

  useEffect(() => {
    if (!isInsightrackrRoute(pathname)) setInsightrackrStatusConfirmed(false);
    if (!isSensortowerRoute(pathname)) setSensortowerStatusChecked(false);
  }, [pathname]);

  useEffect(() => {
    if (!selectedPlatform) return;
    let cancelled = false;
    const pendingSensorTowerAuth =
      selectedPlatform === 'sensortower' ? readSensorTowerAuthChallenge() : null;
    if (pendingSensorTowerAuth) {
      setLoginModalAuthLinkMode(true);
      setLoginModalMessage(pendingSensorTowerAuth.message || SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE);
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false);
      setLoginModalAuthLinkMode(false);
      setLoginModalMessage('');
    }
    refreshStatusDetail(selectedPlatform)
      .then((detail) => {
        if (cancelled) return;
        const status = detail?.status || 'LOGGED_OUT';
        if (selectedPlatform === 'insightrackr') {
          setInsightrackrStatusConfirmed(status === 'ONLINE');
        }
        if (selectedPlatform === 'sensortower') {
          setSensortowerStatusChecked(true);
          if (status === 'ONLINE') {
            clearSensorTowerAuthChallenge();
            if (pendingSensorTowerAuth) {
              setShowLoginModal(false);
              setLoginModalAuthLinkMode(false);
              setLoginModalMessage('');
            }
            return;
          }
          if (detail?.authLinkRequired || detail?.code === 'NEW_DEVICE_VERIFICATION') {
            const challenge = saveSensorTowerAuthChallenge(
              detail.message || SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE
            );
            setLoginModalAuthLinkMode(true);
            setLoginModalMessage(challenge.message);
            setShowLoginModal(true);
            return;
          }
          const stillPending = readSensorTowerAuthChallenge();
          if (stillPending) {
            setLoginModalAuthLinkMode(true);
            setLoginModalMessage(stillPending.message || SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE);
            setShowLoginModal(true);
          }
        }
        if (status !== 'ONLINE') {
          addLog(`${platformDisplayName(selectedPlatform)} 当前未登录，可点击右上角登录按钮`, 'info');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (selectedPlatform === 'insightrackr') {
          setInsightrackrStatusConfirmed(false);
          return;
        }
        if (selectedPlatform === 'sensortower') setSensortowerStatusChecked(true);
        const isNetworkError = !error.message || /fetch|network|failed to fetch/i.test(error.message);
        if (isNetworkError) {
          addLog(`无法连接服务器，请确认后端已启动且使用同一地址访问（当前为 ${window.location.origin}）`, 'error');
        } else {
          addLog(`登录状态检查失败: ${error.message}`, 'error');
        }
      });
    return () => { cancelled = true; };
  }, [pathname, selectedPlatform, refreshStatusDetail, addLog]);

  const handleLoginSuccess = async () => {
    if (selectedPlatform) {
      setShowLoginModal(false);
      setLoginModalAuthLinkMode(false);
      setLoginModalMessage('');
      if (selectedPlatform === 'sensortower') clearSensorTowerAuthChallenge();
      addLog('登录成功，跳转到查询页面', 'success');
      refreshStatus(selectedPlatform).then((status) => {
        if (status === 'ONLINE') {
          addLog(`登录状态已确认: ${status}`, 'success');
          if (selectedPlatform === 'insightrackr') setInsightrackrStatusConfirmed(true);
          if (selectedPlatform === 'sensortower') setSensortowerStatusChecked(true);
        }
      }).catch((err) => addLog(`登录状态检查失败: ${err.message}`, 'error'));
    }
  };

  const handleRequireLogin = () => {
    addLog(`请先点击右上角「点击登录」完成 ${platformDisplayName(selectedPlatform)} 登录`, 'info');
  };

  const handleManualLogin = (options = {}) => {
    if (!selectedPlatform) return;
    let message = options.message || '';
    if (selectedPlatform === 'sensortower' && options.authLinkMode) {
      const challenge = saveSensorTowerAuthChallenge(message || SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE);
      message = challenge.message;
    }
    setLoginModalAuthLinkMode(Boolean(options.authLinkMode));
    setLoginModalMessage(message);
    setShowLoginModal(true);
    addLog(message || `请手动登录 ${platformDisplayName(selectedPlatform)}`, 'info');
  };

  const handleSensorTowerAuthLinkRequired = useCallback((message) => {
    const challenge = saveSensorTowerAuthChallenge(message || SENSOR_TOWER_AUTH_CHALLENGE_MESSAGE);
    setLoginModalAuthLinkMode(true);
    setLoginModalMessage(challenge.message);
    setShowLoginModal(true);
    addLog(challenge.message, 'info');
  }, [addLog]);

  const handleGuangdadaQuotaChanged = useCallback(() => {
    return refreshStatus('guangdada');
  }, [refreshStatus]);

  if (!routeMeta || !canAccessCurrentRoute) {
    return null;
  }

  const loginStatusNode = selectedPlatform ? (
    <PlatformQuickLoginButton
      platform={selectedPlatform}
      status={getStatus(selectedPlatform)}
      email={getStatusDetail(selectedPlatform)?.email}
      statusLoading={loading?.[selectedPlatform]}
      onRefreshStatus={() => refreshStatus(selectedPlatform)}
      onLoginSuccess={() => {
        setShowLoginModal(false);
        setLoginModalAuthLinkMode(false);
        setLoginModalMessage('');
        if (selectedPlatform === 'sensortower') clearSensorTowerAuthChallenge();
        if (selectedPlatform === 'insightrackr') setInsightrackrStatusConfirmed(true);
        if (selectedPlatform === 'sensortower') setSensortowerStatusChecked(true);
      }}
      onManualLogin={handleManualLogin}
    />
  ) : null;

  const contentStyle = selectedPlatform === 'guangdada'
    ? { backgroundImage: `url(${guangdadaBg})` }
    : undefined;

  return (
    <div className={`app${downloadBtnWobble ? ' app--download-wobble' : ''}`}>
      <AdminLayout
        contentClassName={routeMeta.contentClassName}
        contentStyle={contentStyle}
        loginStatusNode={loginStatusNode}
        downloadListBtnRef={downloadListBtnRef}
      >
        {routeMeta.kind === 'health' ? (
          pathname.startsWith(ROUTES.OPERATION_AUDITS) ? (
            <OperationAuditPage />
          ) : pathname.startsWith(ROUTES.TRANSCODE_QUEUE) ? (
            <TranscodeQueuePage />
          ) : (
            <HealthPage />
          )
        ) : routeMeta.kind === 'tool' ? (
          pathname.startsWith(ROUTES.MATERIAL_HISTORY) ? (
            <MaterialProcessingHistoryPage />
          ) : (
            <VideoResizePage />
          )
        ) : pathname.startsWith(ROUTES.GUANGDADA_RANK) ? (
          <GuangdadaCreativeRankPage
            isLoggedIn={getStatus('guangdada') === 'ONLINE'}
            onRequireLogin={handleRequireLogin}
            addLog={addLog}
            onQuotaChanged={handleGuangdadaQuotaChanged}
          />
        ) : (
          <div
            className={`container${
              selectedPlatform === 'guangdada'
                ? ' container--guangdada'
                : selectedPlatform === 'insightrackr'
                  ? ' container--insightrackr'
                  : selectedPlatform === 'sensortower'
                    ? ' container--sensortower'
                    : ''
            }`}
            style={contentStyle}
          >
            <div className="main-content">
              <DataCard
                platform={selectedPlatform}
                addLog={addLog}
                onRequireLogin={handleRequireLogin}
                isLoggedIn={
                  selectedPlatform === 'sensortower'
                    ? sensortowerStatusChecked
                      && getStatus('sensortower') === 'ONLINE'
                    : getStatus(selectedPlatform) === 'ONLINE'
                }
                insightrackrStatusConfirmed={insightrackrStatusConfirmed}
                onBatchModeEnteredWithHint={handleBatchModeEnteredWithHint}
                refreshPlatformStatus={refreshStatus}
              />
            </div>
          </div>
        )}
      </AdminLayout>

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
        initialAuthLinkMode={loginModalAuthLinkMode}
        initialMessage={loginModalMessage}
        onClose={() => {
          setShowLoginModal(false);
          setLoginModalAuthLinkMode(false);
          setLoginModalMessage('');
          if (selectedPlatform === 'sensortower') clearSensorTowerAuthChallenge();
        }}
        onLoginSuccess={handleLoginSuccess}
        onAuthLinkRequired={handleSensorTowerAuthLinkRequired}
        addLog={addLog}
      />
    </div>
  );
}

export default App;
