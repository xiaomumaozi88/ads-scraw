import React, { useState, useEffect } from 'react';
import { login, formatRequestError } from '../utils/api';
import './LoginModal.css';

function platformDisplayName(platform) {
  if (platform === 'insightrackr') return 'Insightrackr';
  if (platform === 'guangdada') return '广大大';
  if (platform === 'sensortower') return 'Sensor Tower';
  return '平台';
}

function LoginModal({
  platform,
  isOpen,
  onClose,
  onLoginSuccess,
  onAuthLinkRequired,
  addLog,
  initialAuthLinkMode = false,
  initialMessage = '',
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLink, setAuthLink] = useState('');
  const [showSensorTowerAuthLinkField, setShowSensorTowerAuthLinkField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (isOpen) {
      // 重置表单
      setEmail('');
      setPassword('');
      setAuthLink('');
      setShowSensorTowerAuthLinkField(platform === 'sensortower' && initialAuthLinkMode);
      setMessage(initialMessage ? { text: initialMessage, type: 'error' } : { text: '', type: '' });
    }
  }, [initialAuthLinkMode, initialMessage, isOpen, platform]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isSensorTowerAuthLinkMode =
      platform === 'sensortower' && showSensorTowerAuthLinkField && !!authLink.trim();
    if (platform === 'sensortower' && showSensorTowerAuthLinkField && !authLink.trim()) {
      setMessage({ text: '请粘贴邮箱授权链接', type: 'error' });
      addLog('请粘贴邮箱授权链接', 'error');
      return;
    }
    if (!isSensorTowerAuthLinkMode && (!email.trim() || !password.trim())) {
      setMessage({ text: '请填写完整的登录信息', type: 'error' });
      addLog('请填写完整的登录信息', 'error');
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const platformName = platformDisplayName(platform);
    addLog(
      isSensorTowerAuthLinkMode
        ? `开始通过邮箱授权链接登录 ${platformName}`
        : `开始登录 ${platformName}，邮箱: ${email}`,
      'info'
    );

    try {
      const data = await login(
        platform,
        isSensorTowerAuthLinkMode ? '' : email,
        isSensorTowerAuthLinkMode ? '' : password,
        undefined,
        platform === 'sensortower' && showSensorTowerAuthLinkField ? authLink : undefined
      );

      if (data.success) {
        addLog('登录成功', 'success');
        setMessage({ text: '登录成功', type: 'success' });
        // 延迟一下让用户看到成功消息
        setTimeout(() => {
          onLoginSuccess();
        }, 500);
      } else {
        if (platform === 'sensortower' && data?.code === 'NEW_DEVICE_VERIFICATION') {
          setShowSensorTowerAuthLinkField(true);
          onAuthLinkRequired?.(data.message || 'Sensor Tower 需要邮箱授权，请粘贴邮件中的授权链接');
        }
        addLog(`登录失败: ${data.message}`, 'error');
        setMessage({ text: data.message || '登录失败', type: 'error' });
      }
    } catch (error) {
      addLog(`登录请求失败: ${error.message}`, 'error');
      setMessage({ text: formatRequestError(error.message), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const platformName = platformDisplayName(platform);
  const isSensorTowerAuthLinkForm = platform === 'sensortower' && showSensorTowerAuthLinkField;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-header">
          <h2>登录 {platformName}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          {!isSensorTowerAuthLinkForm && (
            <>
              <div className="form-group">
                <label htmlFor="modal-email">邮箱</label>
                <input
                  type="email"
                  id="modal-email"
                  name="email"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="modal-password">密码</label>
                <input
                  type="password"
                  id="modal-password"
                  name="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          {isSensorTowerAuthLinkForm && (
            <div className="form-group">
              <label htmlFor="modal-auth-link">邮箱授权链接</label>
              <input
                type="text"
                id="modal-auth-link"
                name="authLink"
                placeholder="若出现“授权新浏览器”，请粘贴邮件中的授权链接"
                value={authLink}
                onChange={(e) => setAuthLink(e.target.value)}
                autoComplete="off"
                autoFocus
              />
              <p className="modal-auth-link-help">请联系管理员获取邮件链接。</p>
            </div>
          )}
          {message.text && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <span>{loading ? '处理中...' : isSensorTowerAuthLinkForm ? '提交授权链接' : '登录'}</span>
              {loading && <span className="spinner"></span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
