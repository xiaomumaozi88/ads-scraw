-- ads-scraw MySQL schema（启动时自动执行 CREATE IF NOT EXISTS）

CREATE TABLE IF NOT EXISTS system_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_system_logs_created (created_at),
  INDEX idx_system_logs_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transcode_jobs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  phase VARCHAR(32) NOT NULL,
  enqueued_at BIGINT NOT NULL,
  started_at BIGINT NULL,
  finished_at BIGINT NULL,
  target_w INT NOT NULL DEFAULT 800,
  target_h INT NOT NULL DEFAULT 800,
  video_url TEXT NOT NULL,
  video_url_preview VARCHAR(512) NULL,
  queue_position INT NULL,
  created_by JSON NULL,
  client_batch_id VARCHAR(64) NULL,
  client_task_id VARCHAR(64) NULL,
  source_label VARCHAR(255) NULL,
  error_message TEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_transcode_status_enqueued (status, enqueued_at),
  INDEX idx_transcode_enqueued (enqueued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operation_audits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(64) NOT NULL,
  platform VARCHAR(32) NULL,
  operator_feishu_user_id VARCHAR(64) NULL,
  operator_name VARCHAR(128) NULL,
  operator_email VARCHAR(255) NULL,
  target_account VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL,
  message TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_platform (platform),
  INDEX idx_audit_action (action),
  INDEX idx_audit_operator (operator_feishu_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guangdada_quota_usage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_key VARCHAR(128) NOT NULL,
  quota_key VARCHAR(64) NOT NULL,
  period_key VARCHAR(32) NOT NULL,
  period_start_ms BIGINT NOT NULL,
  period_end_ms BIGINT NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  last_limit_count INT NULL,
  cycle VARCHAR(8) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uniq_gdd_quota_usage (account_key, quota_key, period_key),
  INDEX idx_gdd_quota_account_period (account_key, period_key),
  INDEX idx_gdd_quota_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
