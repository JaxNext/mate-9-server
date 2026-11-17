#!/data/data/com.termux/files/usr/bin/sh
pm2 stop all
pm2 save
pkill caddy
termux-wake-unlock
echo "所有服务停止，唤醒锁释放"
EOF