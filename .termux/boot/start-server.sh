#!/data/data/com.termux/files/usr/bin/sh
LOG_FILE="$HOME/server.log"
echo "==================== $(date) 开机启动 ====================" >> $LOG_FILE

termux-wake-lock
# 启动SSH服务
sshd
echo "sshd 已启动 :8022" >> $LOG_FILE

# 恢复pm2保存的node服务
pm2 resurrect >> $LOG_FILE 2>&1
echo "PM2 已恢复Node服务" >> $LOG_FILE

# 启动Caddy（先清残留，防止端口占用）
pkill caddy
nohup caddy run --config $HOME/Caddyfile >> $LOG_FILE 2>&1 &
echo "Caddy 服务已启动，PID: $!" >> $LOG_FILE

echo "全部服务启动完成" >> $LOG_FILE
