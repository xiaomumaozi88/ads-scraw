#!/usr/bin/env bash
# 从本地 .env 提取服务端生产环境变量（不含 VITE_* / DEV_*）
# 用法：./scripts/prepare-production-env.sh [输出路径]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/.env"
OUT="${1:-${ROOT}/ads-scraw-production.env}"

if [ ! -f "$SRC" ]; then
  echo "缺少 ${SRC}，请先配置本地 .env"
  exit 1
fi

{
  echo "# 由 scripts/prepare-production-env.sh 生成，勿提交 Git"
  echo "# $(date -Iseconds)"
  grep -E '^(NODE_ENV|PORT|IAM_|APP_|DB_|PLATFORM_|INSIGHTRACKR_|DOCKER_|CONTAINER_|CHROME_|FFMPEG_|BROWSER_|CORS_|COOKIE_)' "$SRC" \
    | grep -v '^VITE_' \
    | grep -v '^DEV_'
  # HTTP 部署（IP 直连）必须显式关闭 Secure Cookie
  if ! grep -q '^COOKIE_SECURE=' "$OUT" 2>/dev/null; then
    echo "COOKIE_SECURE=false"
  fi
} > "$OUT"

echo ">>> 已写入 ${OUT}（$(wc -l < "$OUT" | tr -d ' ') 行，不含密钥内容展示）"
grep -E '^[A-Z_]+=' "$OUT" | cut -d= -f1 | sort
