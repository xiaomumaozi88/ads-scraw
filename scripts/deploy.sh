#!/usr/bin/env bash
# 上传并部署到服务器（使用 -i 指定密钥）
set -e
cd "$(dirname "$0")/.."

# ========== 你的服务器与路径 ==========
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_nginx}"
SERVER="${DEPLOY_SERVER:-ecs-user@120.27.200.123}"
REMOTE_PATH="${DEPLOY_PATH:-/home/ecs-user/ads-scraw}"
# =====================================

SSH_OPTS=(-o "StrictHostKeyChecking=accept-new")
[ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo ">>> 本地构建..."
npm run build

echo ">>> 上传到服务器 ${SERVER}:${REMOTE_PATH} ..."
rsync -avz --delete -e "$RSYNC_SSH" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude 'dist' \
  . "${SERVER}:${REMOTE_PATH}/"

echo ">>> 上传 dist/ ..."
rsync -avz -e "$RSYNC_SSH" \
  dist/ "${SERVER}:${REMOTE_PATH}/dist/"

echo ">>> 上传完成。"
echo ""
echo "在服务器上执行："
echo "  ssh -i $SSH_KEY $SERVER"
echo "  cd ${REMOTE_PATH} && npm install --omit=dev && pm2 restart ads-scraw"
echo ""
if [ "$1" = "--restart" ]; then
  echo ">>> 远程执行 npm install 并重启 pm2..."
  ssh "${SSH_OPTS[@]}" "${SERVER}" "cd ${REMOTE_PATH} && npm install --omit=dev && (pm2 restart ads-scraw || pm2 start server/app.js --name ads-scraw)"
fi
