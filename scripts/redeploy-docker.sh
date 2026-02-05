#!/usr/bin/env bash
# 在服务器上执行：上传完成后在项目目录运行此脚本，完成 Docker 重新部署
# 用法：cd /path/to/ads-scraw && ./scripts/redeploy-docker.sh
set -e
cd "$(dirname "$0")/.."

echo ">>> 停止并删除旧容器..."
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true

echo ">>> 构建镜像..."
sudo docker build -t ads-scraw .

echo ">>> 启动新容器..."
sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw

echo ">>> 部署完成。访问 http://<服务器IP>:3000"
