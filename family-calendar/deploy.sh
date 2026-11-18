#!/bin/sh
# 构建并发布家庭日历到 Mate9
# 用法：./deploy.sh
# 可覆盖变量：MATE9_HOST（默认 mate9）、MATE9_REMOTE_DIR（默认 family-calendar）、MATE9_PORT（默认 8081）
set -eu

cd "$(dirname "$0")"

HOST="${MATE9_HOST:-mate9}"
REMOTE_DIR="${MATE9_REMOTE_DIR:-family-calendar}"
PORT="${MATE9_PORT:-8081}"

echo "==> 构建"
pnpm build

echo "==> 上传 .output 到 $HOST:~/$REMOTE_DIR"
ssh "$HOST" "mkdir -p ~/$REMOTE_DIR/data"
rsync -az --delete .output/ "$HOST:~/$REMOTE_DIR/.output/"

echo "==> 重启 pm2（端口 ${PORT}）"
ssh "$HOST" "cd ~/$REMOTE_DIR && \
  if pm2 describe family-calendar >/dev/null 2>&1; then \
    PORT=${PORT} pm2 restart family-calendar --update-env; \
  else \
    PORT=${PORT} pm2 start .output/server/index.mjs --name family-calendar --max-memory-restart 300M; \
  fi && pm2 save"

echo "==> 上传备份脚本"
rsync -az backup.mjs "$HOST:~/$REMOTE_DIR/backup.mjs"

echo "==> 配置每日备份（03:30，保留 7 份）"
ssh "$HOST" "cd ~/$REMOTE_DIR && \
  if pm2 describe family-backup >/dev/null 2>&1; then \
    pm2 restart family-backup >/dev/null; \
  else \
    pm2 start backup.mjs --name family-backup --cron '30 3 * * *' --no-autorestart >/dev/null; \
  fi && pm2 save >/dev/null"

echo "==> 完成，访问 http://192.168.31.234:${PORT}（数据文件 ~/$REMOTE_DIR/data/family.db，备份在 ~/backup/）"
