# mate9-monitor-web

Mate9 服务器状态仪表盘：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + ECharts，数据来自 [mate9-monitor-server](../mate9-monitor-server) 的 SSE 推送。

## 开发

```bash
pnpm install
pnpm dev
```

`/api` 默认代理到 `http://192.168.31.234:3100`（见 [vite.config.ts](./vite.config.ts)），需要指向别的地址时：

```bash
VITE_API_TARGET=http://127.0.0.1:3100 pnpm dev
```

## 部署

```bash
./deploy.sh        # 或 pnpm deploy
```

脚本会执行 `pnpm build`，再用 `rsync -az --delete` 把 `dist/` 同步到 Mate9 的 `~/mate9-monitor-web`，由 Caddy 在 `:8080` 提供页面，并把 `/api/*` 反向代理到采集服务。可用变量：

```bash
MATE9_HOST=mate9 MATE9_CADDY_DIR=mate9-monitor-web ./deploy.sh
```

部署后访问 `http://Mate9IP:8080`。

## 结构

```
src/
├── App.vue                    # 仪表盘布局
├── components/
│   ├── LineChart.vue          # ECharts 折线（按需引入）
│   ├── StatCard.vue           # 指标卡片
│   └── ServiceList.vue        # 服务状态表
├── composables/
│   └── useServerStatus.ts     # EventSource 订阅 + 60 点环形缓冲
├── types/status.ts            # 与后端接口对应的类型
└── utils/format.ts            # 字节 / 速率 / 时长格式化
```
