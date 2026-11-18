#!/bin/sh
# 部署 Caddyfile 到 Mate9，校验后平滑重载 Caddy
# 用法：./deploy-caddy.sh
# 可覆盖变量：MATE9_HOST（默认 mate9）
set -eu

cd "$(dirname "$0")"

HOST="${MATE9_HOST:-mate9}"

echo "==> 上传 Caddyfile 到 $HOST:~/Caddyfile"
scp Caddyfile "$HOST:Caddyfile"

echo "==> 校验配置"
ssh "$HOST" 'caddy validate --config ~/Caddyfile 2>&1 | tail -2'

if ssh "$HOST" 'pgrep -x caddy >/dev/null 2>&1'; then
  echo "==> Caddy 已在运行，平滑重载"
  ssh "$HOST" 'caddy reload --config ~/Caddyfile' || {
    echo "==> 重载失败，改为重启"
    ssh "$HOST" 'pkill -x caddy; sleep 1; cd ~ && (setsid caddy run --config ~/Caddyfile > ~/caddy.log 2>&1 < /dev/null &); sleep 2'
  }
else
  echo "==> Caddy 未运行，直接启动"
  ssh "$HOST" 'cd ~ && (setsid caddy run --config ~/Caddyfile > ~/caddy.log 2>&1 < /dev/null &); sleep 2'
fi

echo "==> 验证（手机本机自访问）"
ssh "$HOST" 'curl -s -o /dev/null -w "首页 HTTP %{http_code}\n" --max-time 5 http://127.0.0.1:8080/; curl -s -o /dev/null -w "API  HTTP %{http_code}\n" --max-time 5 http://127.0.0.1:8080/api/status'

echo "==> 完成"
