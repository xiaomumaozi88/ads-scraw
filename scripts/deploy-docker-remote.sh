#!/usr/bin/env bash
# linux/amd64 构建镜像 → 导出 tar → 上传到服务器 → load 并运行（含广大大 Chrome 远程调试 9222）
# 用法：在项目根目录执行 ./scripts/deploy-docker-remote.sh
# 可通过环境变量覆盖：DEPLOY_SSH_KEY、DEPLOY_SERVER、DEPLOY_REMOTE_DIR、IMAGE_TAR_NAME
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_nginx}"
SERVER="${DEPLOY_SERVER:-ecs-user@120.27.200.123}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/home/ecs-user}"
TAR_NAME="${IMAGE_TAR_NAME:-ads-scraw-docker.tar}"
LOCAL_TAR="$ROOT/$TAR_NAME"

echo ">>> 1/4 构建 linux/amd64 并导出 $TAR_NAME ..."
"$ROOT/scripts/build-docker-and-export.sh" "$LOCAL_TAR"

SSH_OPTS=(-o "StrictHostKeyChecking=accept-new")
[ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

echo ">>> 2/4 上传 $TAR_NAME 到 ${SERVER}:${REMOTE_DIR}/"
scp "${SSH_OPTS[@]}" "$LOCAL_TAR" "${SERVER}:${REMOTE_DIR}/"

REMOTE_RUN=$(cat <<'EOS'
set -e
cd REMOTE_DIR_PLACEHOLDER
sudo docker load -i TAR_NAME_PLACEHOLDER
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true
sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -p 9222:9222 \
  -e NODE_ENV=production \
  -e CHROME_REMOTE_DEBUGGING_PORT=9222 \
  -e FFMPEG_CPUS=1,2,3 \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw:latest
sudo docker ps --filter name=ads-scraw
EOS
)
REMOTE_RUN="${REMOTE_RUN//REMOTE_DIR_PLACEHOLDER/$REMOTE_DIR}"
REMOTE_RUN="${REMOTE_RUN//TAR_NAME_PLACEHOLDER/$TAR_NAME}"

echo ">>> 3/4 远程 load 并启动（已映射 9222 + CHROME_REMOTE_DEBUGGING_PORT=9222）..."
ssh "${SSH_OPTS[@]}" "$SERVER" "$REMOTE_RUN"

echo ">>> 4/4 完成。Web: http://<服务器IP>:3000  广大大远程调试: http://<服务器IP>:9222（建议仅内网或 SSH 隧道）"
