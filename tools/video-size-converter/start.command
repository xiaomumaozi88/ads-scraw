#!/bin/sh
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8787}"
echo "视频尺寸转换工具已启动："
echo "http://127.0.0.1:${PORT}/"
echo
echo "按 Ctrl+C 可停止服务。"
python3 -m http.server "$PORT"
