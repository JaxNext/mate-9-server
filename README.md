# 华为Mate9（鸿蒙 + Termux）家庭服务器搭建文档
> 设备：华为 Mate9 | 系统：鸿蒙 | 用途：内网网页服务、Node后端、Caddy静态服务、SQLite数据库、局域网SSH远程（WindTerm）
> 特性：开机自启、PM2保活Node、Caddy静态服务、SSH远程登录、唤醒锁防休眠
> ⚠️ 重要前提：华为侧电池后台权限必须先配置，否则鸿蒙会杀掉Termux进程，所有服务掉线

## 一、华为Mate9 系统前置配置（必做，鸿蒙杀后台重灾区）
1. 安装3个APK包：Termux、Termux:API、Termux:Boot（同来源，版本匹配）
2. 手机管家设置（3个APP都要设置）
   - 电池：关闭自动管理 → **允许后台活动**，电池优化 → **不允许**
   - 权限：全部允许后台、自启动、关联启动
3. WLAN设置：WiFi高级设置 → **休眠时始终保持网络连接**
4. 多任务界面：把Termux卡片上锁（下拉锁定）
5. 路由器后台：给Mate9的MAC地址**固定内网IP**，避免IP变动导致WindTerm、网页访问失效

## 二、Termux基础初始化 & 换源
打开Termux，执行换源（避免下载慢）
```bash
# 一键换源
termux-change-repo
```
> 操作：选择国内镜像源，确认；如果报错可以手动编辑sources.list

```bash
# 更新软件列表
pkg update && pkg upgrade -y
```

## 三、基础组件安装
```bash
# 核心工具 + openssh（WindTerm远程SSH）
pkg install openssh termux-api net-tools -y

# nodejs（网页后端）
pkg install nodejs -y

# caddy（静态web服务）
pkg install caddy -y

# 安装pm2，Node进程托管、崩溃自动重启
npm install -g pm2
```

校验版本
```bash
node -v
caddy version
pm2 -v
```

## 四、SSH配置（WindTerm 局域网远程登录）
> Termux SSH固定端口：8022，**不是22**
```bash
# 设置ssh登录密码（WindTerm登录密码）
passwd

# 查看ssh用户名（复制这个，后面WindTerm填）
whoami

# 查看本机局域网IP（wlan0 inet）
ifconfig

# 启动ssh服务
sshd
```
### WindTerm 会话配置
- 主机：Mate9内网IP（如192.168.1.100）
- 端口：`8022`
- 用户名：`whoami`输出的u0_xxxx
- 密码：刚才passwd设置的密码

测试端口监听
```bash
netstat -tulnp | grep 8022
```

### 免密登录（SSH 密钥认证，可选）
> 在**电脑**上操作，手机端无需改动；配置后 `ssh mate9` 直接进 shell，不再输密码

1. 生成 Mate9 专用密钥（`-N ""` 表示不设口令）
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_mate9 -C "mac-to-mate9" -N ""
```

2. 把公钥装到手机（只需输一次密码，用户名换成 `whoami` 的结果）
```bash
ssh-copy-id -i ~/.ssh/id_ed25519_mate9.pub -p 8022 u0_a26@192.168.31.234
```
> 看到 `Number of key(s) added: 1` 即成功。没有 `ssh-copy-id` 时用：
```bash
ssh -p 8022 u0_a26@192.168.31.234 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" < ~/.ssh/id_ed25519_mate9.pub
```

3. 追加 SSH 别名，之后直接 `ssh mate9`
```bash
cat >> ~/.ssh/config <<'EOF'

Host mate9
    HostName 192.168.31.234
    Port 8022
    User u0_a26
    IdentityFile ~/.ssh/id_ed25519_mate9
    IdentitiesOnly yes
EOF
```

验证
```bash
ssh mate9
```

故障排查：如果仍然提示要密码，说明手机端权限不对，在 Termux 里执行
```bash
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
```

## 五、项目目录准备
```bash
# node项目目录
mkdir -p ~/web
# caddy静态网页目录（mate9-monitor-web 构建产物）
mkdir -p ~/mate9-monitor-web
```
> 把你的node项目放到`~/web`，静态文件放到`~/mate9-monitor-web`
> 进入web目录，启动node服务并交给pm2托管
```bash
cd ~/web
pm2 start index.js --name mate9-web
# 保存当前pm2服务列表，开机resurrect恢复
pm2 save
```

PM2常用命令
```bash
pm2 list                  # 查看运行服务
pm2 logs mate9-web       # 实时日志
pm2 restart mate9-web    # 重启node服务
pm2 monit                 # 监控内存CPU（Mate9内存紧张，经常看）
pm2 delete mate9-web     # 删除服务
```

## 六、开机自启脚本（Termux:Boot）
> 路径：`~/.termux/boot/start-server.sh`，Termux:Boot自动执行
```bash
# 创建boot目录
mkdir -p ~/.termux/boot
```

写入开机脚本
```bash
cat > ~/.termux/boot/start-server.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
# 获取唤醒锁，防止锁屏休眠断服务
termux-wake-lock

LOG_FILE="$HOME/server.log"
echo "==================== $(date) 开机启动 ====================" >> $LOG_FILE

# 启动SSH服务，供WindTerm远程连接
sshd
echo "sshd 已启动 :8022" >> $LOG_FILE

# PM2恢复Node服务（崩溃自动重启）
pm2 resurrect >> $LOG_FILE 2>&1
echo "PM2 已恢复Node服务" >> $LOG_FILE

# 启动Caddy静态服务，先杀掉残留进程防止端口占用
pkill caddy
nohup caddy run --config $HOME/Caddyfile >> $LOG_FILE 2>&1 &
echo "Caddy 服务已启动，PID: $!" >> $LOG_FILE

echo "全部服务启动完成" >> $LOG_FILE
EOF
```

赋予执行权限（必须！）
```bash
chmod +x ~/.termux/boot/start-server.sh
```

测试开机脚本（不用重启手机）
```bash
~/.termux/boot/start-server.sh
```
查看日志
```bash
tail -f ~/server.log
```

### Mac 侧部署脚本
> 前置：Mac 上已配好 `mate9` 免密登录别名

| 脚本 | 作用 |
|---|---|
| `./deploy-caddy.sh` | 上传根目录 `Caddyfile` → `caddy validate` 校验 → 平滑 `caddy reload`（未运行则拉起）→ 自测首页与 `/api/status` |
| `mate9-monitor-server/deploy.sh` | 上传采集服务到 `~/mate9-monitor-server`，pm2 启动/重启后 `pm2 save` |
| `mate9-monitor-web/deploy.sh` | 构建前端，`rsync --delete` 同步到 `~/mate9-monitor-web` |

```bash
./deploy-caddy.sh
cd mate9-monitor-server && ./deploy.sh
cd mate9-monitor-web && ./deploy.sh
```

目标机器可用环境变量覆盖：`MATE9_HOST`（默认 `mate9`）。

## 七、一键停止脚本（停止所有服务、释放唤醒锁）
```bash
cat > ~/stop-server.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
pm2 stop all
pm2 save
pkill caddy
pkill sshd
termux-wake-unlock
echo "所有服务停止，唤醒锁释放"
EOF
chmod +x ~/stop-server.sh
```
运行停止
```bash
./stop-server.sh
```

## 八、服务访问地址（同局域网）
- Node后端：`http://Mate9IP:3000`（你的node监听端口，可自行修改）
- Caddy静态网页：`http://Mate9IP:8080`
- SSH远程：`Mate9IP:8022`（WindTerm）

## 九、数据库说明
直接使用Node内置SQLite，文件存在项目目录，无需额外数据库服务，适合轻量业务；
> 不建议跑MySQL，Mate9内存小，容易OOM被杀。

## 十、故障排查清单
1. WindTerm连不上：
   - 确认手机电脑同一WiFi、IP没变化
   - 确认sshd已经启动，8022端口监听
   - 鸿蒙后台是否杀掉Termux
2. 锁屏之后服务掉线：
   - 检查电池白名单、休眠保持WiFi、termux-wake-lock唤醒锁
3. Node服务自动退出：
   - `pm2 logs mate9-web` 看报错，大概率内存不足
4. Caddy端口占用：脚本里自带pkill caddy清理残留，也可以修改listen端口

## 十一、安全提醒
1. **不要直接把8022、8080、3000端口映射公网**，风险极高
2. 如果需要外网访问，推荐Tailscale虚拟局域网
3. SSH密码不要设置太简单
