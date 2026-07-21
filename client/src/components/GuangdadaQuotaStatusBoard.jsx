import React from 'react';
import { Button, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

const IMPORTANT_KEYS = new Set(['search', 'download', 'ads_detail', 'multimodal_search']);

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('zh-CN');
}

function formatPercent(quota) {
  if (!quota || !Number.isFinite(Number(quota.limit)) || Number(quota.limit) <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(quota.remaining) / Number(quota.limit)) * 100));
}

function AccountText({ account }) {
  if (!account) return <span>未读取到账户</span>;
  const name = account.username || account.email || account.userId || '当前账户';
  return (
    <span>
      {name}
      {account.companyId ? <span className="gdd-quota-board__account-sub">公司 {account.companyId}</span> : null}
    </span>
  );
}

function GuangdadaQuotaStatusBoard({
  status,
  loading = false,
  isLoggedIn = false,
  onRefresh,
}) {
  if (!isLoggedIn) {
    return (
      <div className="gdd-quota-board gdd-quota-board--muted">
        <div className="gdd-quota-board__empty">登录后查看广大大账户额度</div>
      </div>
    );
  }

  const quotas = Array.isArray(status?.quotas) ? status.quotas : [];
  const important = quotas.filter((q) => IMPORTANT_KEYS.has(q.key));
  const others = quotas.filter((q) => !IMPORTANT_KEYS.has(q.key));
  const displayQuotas = [...important, ...others];
  const exhausted = displayQuotas.filter((q) => q.exhausted);

  return (
    <section className="gdd-quota-board" aria-label="广大大账户额度">
      <div className="gdd-quota-board__head">
        <div>
          <div className="gdd-quota-board__title">账户额度</div>
          <div className="gdd-quota-board__meta">
            <AccountText account={status?.account} />
            {status?.fromCache ? <span>缓存</span> : null}
            {status?.warning ? <span className="gdd-quota-board__warning">{status.warning}</span> : null}
          </div>
        </div>
        <Tooltip title="刷新额度">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => onRefresh?.({ forceRefresh: true })}
          />
        </Tooltip>
      </div>

      {exhausted.length > 0 ? (
        <div className="gdd-quota-board__notice">
          {exhausted.map((q) => q.label).join('、')}额度已用完，请在群里参与「账户排队」以使用其他账户。
        </div>
      ) : null}

      {displayQuotas.length === 0 ? (
        <div className="gdd-quota-board__empty">
          {loading ? '正在读取额度...' : '暂无额度数据'}
        </div>
      ) : (
        <div className="gdd-quota-board__grid">
          {displayQuotas.map((quota) => {
            const percent = formatPercent(quota);
            return (
              <div
                key={quota.key}
                className={`gdd-quota-board__item${quota.exhausted ? ' gdd-quota-board__item--empty' : ''}${quota.low && !quota.exhausted ? ' gdd-quota-board__item--low' : ''}${IMPORTANT_KEYS.has(quota.key) ? ' gdd-quota-board__item--main' : ''}`}
              >
                <div className="gdd-quota-board__item-top">
                  <span className="gdd-quota-board__item-label" title={quota.key}>{quota.label}</span>
                  <span className="gdd-quota-board__cycle">{quota.cycleLabel}</span>
                </div>
                <div className="gdd-quota-board__numbers">
                  <strong>{formatNumber(quota.remaining)}</strong>
                  <span>/ {formatNumber(quota.limit)}</span>
                </div>
                <div className="gdd-quota-board__bar" aria-hidden>
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default GuangdadaQuotaStatusBoard;
