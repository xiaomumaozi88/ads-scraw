#!/usr/bin/env bash
# linux/amd64 构建镜像 → 导出 tar → 上传生产 env → 远程 load 并运行
# 用法：./scripts/deploy-docker-remote.sh
# 可选：SKIP_BACKUP=1 跳过部署前备份（默认会先执行 backup-docker-remote.sh）
# 环境变量：DEPLOY_SSH_KEY、DEPLOY_SERVER、DEPLOY_REMOTE_DIR、IMAGE_TAR_NAME
# 清理策略：REMOTE_BACKUP_KEEP=2 保留远端最近 2 份备份；CLEAN_REMOTE_TAR=1/CLEAN_LOCAL_TAR=1 删除部署 tar
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_nginx}"
SERVER="${DEPLOY_SERVER:-ecs-user@115.29.236.160}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/home/ecs-user}"
TAR_NAME="${IMAGE_TAR_NAME:-ads-scraw-docker.tar}"
LOCAL_TAR="$ROOT/$TAR_NAME"
ENV_FILE="$ROOT/ads-scraw-production.env"
REMOTE_ENV="${REMOTE_DIR}/ads-scraw-production.env"
REMOTE_BACKUP_KEEP="${REMOTE_BACKUP_KEEP:-2}"
CLEAN_REMOTE_TAR="${CLEAN_REMOTE_TAR:-1}"
CLEAN_LOCAL_TAR="${CLEAN_LOCAL_TAR:-1}"

SSH_OPTS=(-o "StrictHostKeyChecking=accept-new")
[ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

if [ "${SKIP_BACKUP:-}" != "1" ]; then
  echo ">>> 0/5 部署前备份远程 Docker ..."
  "$ROOT/scripts/backup-docker-remote.sh"
else
  echo ">>> 0/5 跳过备份（SKIP_BACKUP=1）"
fi

echo ">>> 1/5 准备生产环境变量 ..."
"$ROOT/scripts/prepare-production-env.sh" "$ENV_FILE"

echo ">>> 2/5 构建 linux/amd64 并导出 $TAR_NAME ..."
"$ROOT/scripts/build-docker-and-export.sh" "$LOCAL_TAR"

echo ">>> 3/5 上传 $TAR_NAME 与生产 env 到 ${SERVER} ..."
scp "${SSH_OPTS[@]}" "$LOCAL_TAR" "$ENV_FILE" "${SERVER}:${REMOTE_DIR}/"

REMOTE_RUN=$(cat <<'EOS'
set -e
cd REMOTE_DIR_PLACEHOLDER
ENV_FILE="REMOTE_ENV_PLACEHOLDER"
TAR="TAR_NAME_PLACEHOLDER"
REMOTE_BACKUP_KEEP="REMOTE_BACKUP_KEEP_PLACEHOLDER"
CLEAN_REMOTE_TAR="CLEAN_REMOTE_TAR_PLACEHOLDER"

sudo docker load -i "$TAR"
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true

mkdir -p REMOTE_DIR_PLACEHOLDER/ads-scraw-data

RUN_ARGS=(
  -d
  --name ads-scraw
  -p 3000:3000
  -p 9222:9222
  --env-file "$ENV_FILE"
  -e CHROME_REMOTE_DEBUGGING_PORT=9222
  -e FFMPEG_CPUS=1,2,3
  -v REMOTE_DIR_PLACEHOLDER/ads-scraw-data:/app/server/data
  --log-driver json-file
  --log-opt max-size=50m
  --log-opt max-file=3
  --restart unless-stopped
  --shm-size=1g
)

if grep -q '^DOCKER_CONTAINER_RESTART_ENABLED=true' "$ENV_FILE" 2>/dev/null; then
  RUN_ARGS+=(-v /var/run/docker.sock:/var/run/docker.sock)
fi

sudo docker run "${RUN_ARGS[@]}" ads-scraw:latest
sudo docker ps --filter name=ads-scraw
echo ">>> 容器日志（最近 30 行）"
sudo docker logs --tail 30 ads-scraw 2>&1 || true

if [ "$CLEAN_REMOTE_TAR" = "1" ]; then
  echo ">>> 清理远端部署镜像包 ${TAR}"
  rm -f "$TAR"
fi

if [ "${REMOTE_BACKUP_KEEP}" -gt 0 ] 2>/dev/null; then
  echo ">>> 清理远端历史备份，仅保留最近 ${REMOTE_BACKUP_KEEP} 份"
  find REMOTE_DIR_PLACEHOLDER -maxdepth 1 -type f -name 'ads-scraw-backup-*.tar' -printf '%T@ %p\n' \
    | sort -rn \
    | awk -v keep="$REMOTE_BACKUP_KEEP" 'NR > keep { sub(/^[^ ]+ /, ""); print }' \
    | xargs -r rm -f
fi
EOS
)
REMOTE_RUN="${REMOTE_RUN//REMOTE_DIR_PLACEHOLDER/$REMOTE_DIR}"
REMOTE_RUN="${REMOTE_RUN//REMOTE_ENV_PLACEHOLDER/$REMOTE_ENV}"
REMOTE_RUN="${REMOTE_RUN//TAR_NAME_PLACEHOLDER/$TAR_NAME}"
REMOTE_RUN="${REMOTE_RUN//REMOTE_BACKUP_KEEP_PLACEHOLDER/$REMOTE_BACKUP_KEEP}"
REMOTE_RUN="${REMOTE_RUN//CLEAN_REMOTE_TAR_PLACEHOLDER/$CLEAN_REMOTE_TAR}"

echo ">>> 4/5 远程 load 并启动 ..."
ssh "${SSH_OPTS[@]}" "$SERVER" "$REMOTE_RUN"

if [ "$CLEAN_LOCAL_TAR" = "1" ]; then
  echo ">>> 清理本地部署镜像包 $LOCAL_TAR"
  rm -f "$LOCAL_TAR"
fi

echo ">>> 5/5 完成。Web: http://115.29.236.160:3000"
echo "    回退见 DEPLOYMENT.md 第八节或 docs/iterations/2026-06-23-mysql-iam-relaxed-deploy.md"
