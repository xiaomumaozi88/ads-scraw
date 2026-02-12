#!/usr/bin/env bash
# 本地构建 Docker 镜像并导出为 tar，便于上传到无法访问 jsDelivr 的服务器
# 用法：./scripts/build-docker-and-export.sh [输出路径]
# 默认输出：项目根目录下的 ads-scraw-docker.tar
set -e
cd "$(dirname "$0")/.."

IMAGE_NAME="ads-scraw"
TAG="latest"
OUTPUT_FILE="${1:-./ads-scraw-docker.tar}"

echo ">>> 构建镜像 ${IMAGE_NAME}:${TAG}（平台 linux/amd64，便于在 x86 服务器运行）..."
docker build --platform linux/amd64 -t "${IMAGE_NAME}:${TAG}" .

echo ">>> 导出镜像到 ${OUTPUT_FILE} ..."
docker save "${IMAGE_NAME}:${TAG}" -o "$OUTPUT_FILE"

SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
echo ">>> 完成，镜像大小约 ${SIZE}"
echo ""
echo "上传到服务器示例（替换为你的密钥、用户、IP 和路径）："
echo "  scp -i ~/.ssh/你的密钥 ads-scraw-docker.tar 用户@服务器IP:/home/xxx/"
echo ""
echo "在服务器上执行："
echo "  docker load -i ads-scraw-docker.tar"
echo "  docker stop ads-scraw 2>/dev/null || true"
echo "  docker rm ads-scraw 2>/dev/null || true"
echo "  docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g ${IMAGE_NAME}:${TAG}"
echo ""
