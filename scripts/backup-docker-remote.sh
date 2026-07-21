#!/usr/bin/env bash
# 远程 Docker 备份（默认轻量：导出 ads-scraw:latest，约 2GB，数分钟）
# 全量备份（FULL_BACKUP=1）：commit 运行中容器，含 Chrome 会话等，约 10GB，可能 15～30 分钟
# 用法：./scripts/backup-docker-remote.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_nginx}"
SERVER="${DEPLOY_SERVER:-ecs-user@115.29.236.160}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/home/ecs-user}"
CONTAINER_NAME="${BACKUP_CONTAINER_NAME:-ads-scraw}"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_TAG="backup-${STAMP}"
FULL_BACKUP="${FULL_BACKUP:-0}"

SSH_OPTS=(-o "StrictHostKeyChecking=accept-new" -o "ServerAliveInterval=30" -o "ServerAliveCountMax=120")
[ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

if [ "$FULL_BACKUP" = "1" ]; then
  echo ">>> 全量备份（commit 容器，体积大、耗时长）..."
  REMOTE_SCRIPT=$(cat <<EOS
set -e
CONTAINER="${CONTAINER_NAME}"
TAG="${BACKUP_TAG}"
DIR="${REMOTE_DIR}"
TAR="\${DIR}/ads-scraw-backup-\${TAG}.tar"
INSPECT="\${DIR}/ads-scraw-inspect-\${TAG}.json"
IMAGE="ads-scraw:\${TAG}"

if ! sudo docker ps -a --format '{{.Names}}' | grep -qx "\${CONTAINER}"; then
  echo "容器 \${CONTAINER} 不存在"
  exit 1
fi

echo ">>> [1/3] commit \${CONTAINER} -> \${IMAGE}（可能 1～3 分钟）"
sudo docker commit "\${CONTAINER}" "\${IMAGE}"

echo ">>> [2/3] save -> \${TAR}（约 10GB，可能 10～30 分钟，无进度条属正常）"
sudo docker save "\${IMAGE}" -o "\${TAR}"

echo ">>> [3/3] inspect -> \${INSPECT}"
sudo docker inspect "\${CONTAINER}" | sudo tee "\${INSPECT}" > /dev/null

ls -lh "\${TAR}" "\${INSPECT}"
echo "BACKUP_MODE=full BACKUP_TAG=\${TAG} BACKUP_TAR=\${TAR}"
EOS
)
else
  echo ">>> 轻量备份（导出 ads-scraw:latest，推荐部署前使用）..."
  REMOTE_SCRIPT=$(cat <<EOS
set -e
TAG="${BACKUP_TAG}"
DIR="${REMOTE_DIR}"
TAR="\${DIR}/ads-scraw-backup-\${TAG}.tar"
INSPECT="\${DIR}/ads-scraw-inspect-\${TAG}.json"
IMAGE="ads-scraw:latest"

if ! sudo docker image inspect "\${IMAGE}" >/dev/null 2>&1; then
  echo "镜像 \${IMAGE} 不存在"
  exit 1
fi

echo ">>> [1/2] save \${IMAGE} -> \${TAR}"
sudo docker save "\${IMAGE}" -o "\${TAR}"

echo ">>> [2/2] inspect 当前容器 -> \${INSPECT}"
if sudo docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  sudo docker inspect "${CONTAINER_NAME}" | sudo tee "\${INSPECT}" > /dev/null
else
  sudo docker inspect "\${IMAGE}" | sudo tee "\${INSPECT}" > /dev/null
fi

ls -lh "\${TAR}" "\${INSPECT}"
echo "BACKUP_MODE=light BACKUP_TAG=\${TAG} BACKUP_TAR=\${TAR}"
EOS
)
fi

ssh "${SSH_OPTS[@]}" "$SERVER" "$REMOTE_SCRIPT"
echo ">>> 备份完成"
