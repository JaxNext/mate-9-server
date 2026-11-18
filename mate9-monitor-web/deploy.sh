#!/bin/sh
# 构建前端并发布到 Mate9 的 Caddy 静态目录
# 用法：./deploy.sh
# 可覆盖变量：MATE9_HOST（默认 mate9）、MATE9_CADDY_DIR（默认 mate9-monitor-web）
set -eu

cd "$(dirname "$0")"

HOST="${MATE9_HOST:-mate9}"
REMOTE_DIR="${MATE9_CADDY_DIR:-mate9-monitor-web}"

echo "==> 构建"
pnpm build

echo "==> 上传 dist 到 $HOST:~/$REMOTE_DIR"
ssh "$HOST" "mkdir -p ~/$REMOTE_DIR"
rsync -az --delete dist/ "$HOST:~/$REMOTE_DIR/"

echo "==> 完成，访问 http://$HOST:8080（本机访问用 Mate9 的局域网 IP）"
