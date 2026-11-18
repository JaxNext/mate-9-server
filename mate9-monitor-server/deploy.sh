#!/bin/sh
# 把采集服务部署到 Mate9 并交给 pm2 托管
# 用法：./deploy.sh
# 可覆盖变量：MATE9_HOST（默认 mate9）、MATE9_MONITOR_DIR（默认 mate9-monitor-server）
set -eu

cd "$(dirname "$0")"

HOST="${MATE9_HOST:-mate9}"
REMOTE_DIR="${MATE9_MONITOR_DIR:-mate9-monitor-server}"

echo "==> 同步文件到 $HOST:~/$REMOTE_DIR"
ssh "$HOST" "mkdir -p ~/$REMOTE_DIR"
scp index.mjs package.json "$HOST:~/$REMOTE_DIR/"

echo "==> 启动 / 重启 pm2 进程 mate9-monitor"
ssh "$HOST" "cd ~/$REMOTE_DIR && if pm2 describe mate9-monitor >/dev/null 2>&1; then pm2 restart mate9-monitor; else pm2 start index.mjs --name mate9-monitor; fi && pm2 save"

echo "==> 完成，验证接口："
ssh "$HOST" "curl -s --max-time 5 http://127.0.0.1:3100/api/status | head -c 200; echo"
