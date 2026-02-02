import React, { useState } from 'react';
import { login, formatRequestError } from '../utils/api';

function LoginCard({ platform, onLoginSuccess, addLog }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

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
        onLoginSuccess();
      } else {
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

  return (
    <div className="card login-card">
      <h2>登录</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">邮箱</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="请输入邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">密码</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <span>{loading ? '登录中...' : '登录'}</span>
          {loading && <span className="spinner"></span>}
        </button>
      </form>
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}
    </div>
  );
}

export default LoginCard;
