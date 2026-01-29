import React, { useState, useEffect } from 'react';
import { login } from '../utils/api';
import './LoginModal.css';

function LoginModal({ platform, isOpen, onClose, onLoginSuccess, addLog }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (isOpen) {
      // 重置表单
      setEmail('');
      setPassword('');
      setMessage({ text: '', type: '' });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessage({ text: '请填写完整的登录信息', type: 'error' });
      addLog('请填写完整的登录信息', 'error');
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const platformName = platform === 'insightrackr' ? 'Insightrackr' : '广大大';
    addLog(`开始登录 ${platformName}，邮箱: ${email}`, 'info');

    try {
      const data = await login(platform, email, password);

      if (data.success) {
        addLog('登录成功', 'success');
        setMessage({ text: '登录成功', type: 'success' });
        // 延迟一下让用户看到成功消息
        setTimeout(() => {
          onLoginSuccess();
        }, 500);
      } else {
        addLog(`登录失败: ${data.message}`, 'error');
        setMessage({ text: data.message || '登录失败', type: 'error' });
      }
    } catch (error) {
      addLog(`登录请求失败: ${error.message}`, 'error');
      setMessage({ text: `请求失败: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const platformName = platform === 'insightrackr' ? 'Insightrackr' : '广大大';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-header">
          <h2>登录 {platformName}</h2>
        </div>
        <form onSubmit={handleSubmit}>
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
          {message.text && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <span>{loading ? '登录中...' : '登录'}</span>
              {loading && <span className="spinner"></span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
