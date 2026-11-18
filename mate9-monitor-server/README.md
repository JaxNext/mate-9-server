# mate9-monitor-server

跑在 Mate9（Termux）上的状态采集服务：读取本机 CPU、内存、磁盘、网络、温度、电池和 pm2 服务，通过 HTTP/SSE 提供给 [mate9-monitor-web](../mate9-monitor-web)。

## 接口

| 路径 | 说明 |
|---|---|
| `GET /api/status` | 单次状态快照（JSON）|
| `GET /api/stream` | SSE 流，每 2 秒推送一帧 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3100` | 监听端口 |
| `INTERVAL` | `2000` | 采集/推送间隔（毫秒）|

## 部署

前置条件：Mac 上已配好 `mate9` 的免密登录别名（见根目录 [README.md](../README.md) 的「免密登录」一节）。

```bash
./deploy.sh        # 或 pnpm deploy
```

脚本依次做三件事：创建 `~/mate9-monitor-server` 目录 → 上传 `index.mjs` 和 `package.json` → 用 pm2 启动或重启 `mate9-monitor` 并 `pm2 save`，最后请求一次 `/api/status` 验证。

可用变量覆盖目标机器和目录：

```bash
MATE9_HOST=mate9 MATE9_MONITOR_DIR=mate9-monitor-server ./deploy.sh
```

## Caddy 反向代理

前端和 API 同源访问，Caddy 需要把 `/api/*` 转给本机 3100：

```caddyfile
:8080 {
    handle /api/* {
        reverse_proxy 127.0.0.1:3100
    }
    handle {
        root * /data/data/com.termux/files/home/mate9-monitor-web
        file_server
    }
}
```

## 注意事项

- 无 root 权限，`df` 只能看到 Termux 所在分区，看不到其他 App 的进程
- 电池数据依赖 `termux-api` 包和 Termux:API 应用，拿不到时返回 `null`，前端会显示 `—`
- 服务监听 `0.0.0.0:3100` 方便局域网内的 Mac 联调，**不要映射到公网**
- 改动 `index.mjs` 后重新执行 `./deploy.sh` 即会重启 pm2 进程
