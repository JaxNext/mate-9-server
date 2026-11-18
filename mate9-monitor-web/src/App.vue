<script setup lang="ts">
import { computed, onMounted } from 'vue'
import LineChart from './components/LineChart.vue'
import ServiceList from './components/ServiceList.vue'
import StatCard from './components/StatCard.vue'
import { useServerStatus } from './composables/useServerStatus'
import { formatBytes, formatTime, formatUptime } from './utils/format'

const { snapshot, connected, history, connect } = useServerStatus()
onMounted(connect)

const cpu = computed(() => snapshot.value?.cpu)
const mem = computed(() => snapshot.value?.mem)
const disks = computed(() => snapshot.value?.disks ?? [])
const services = computed(() => snapshot.value?.services ?? [])
const battery = computed(() => snapshot.value?.battery)
const temp = computed(() => snapshot.value?.temp)

const cpuAvailable = computed(() => cpu.value?.usage != null)

const cpuSeries = computed(() =>
  cpuAvailable.value
    ? [{ name: 'CPU', data: history.cpu, color: '#10b981' }]
    : [{ name: '负载', data: history.load, color: '#f43f5e' }],
)
const memSeries = computed(() => [{ name: '内存', data: history.mem, color: '#0ea5e9' }])
const netSeries = computed(() => [
  { name: '下行', data: history.rxValue.map((v) => Math.round(v / 1024)), color: '#6366f1' },
  { name: '上行', data: history.txValue.map((v) => Math.round(v / 1024)), color: '#f59e0b' },
])

const diskTone = (percent: number) =>
  percent > 85 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
</script>

<template>
  <div class="min-h-dvh bg-slate-100 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-800 sm:p-6">
    <div class="mx-auto max-w-6xl space-y-3 sm:space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div class="min-w-0">
          <h1 class="text-lg font-semibold tracking-tight sm:text-xl">Mate9 服务器状态</h1>
          <p class="mt-1 text-[11px] leading-relaxed break-words text-slate-500 sm:text-xs">
            {{ snapshot?.host ?? '等待连接' }}
            <span v-if="snapshot"> · {{ snapshot.platform }} · 已运行 {{ formatUptime(snapshot.uptime) }}</span>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2 text-[11px] sm:gap-3 sm:text-xs">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm">
            <span
              class="h-2 w-2 rounded-full"
              :class="connected ? 'animate-pulse bg-emerald-500' : 'bg-rose-400'"
            ></span>
            {{ connected ? '实时连接' : '连接断开，重试中' }}
          </span>
          <span v-if="snapshot" class="text-slate-400">{{ formatTime(snapshot.time) }}</span>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="CPU 使用率"
          :value="cpu?.usage != null ? cpu.usage.toFixed(1) : '—'"
          unit="%"
          :percent="cpu?.usage ?? undefined"
          tone="emerald"
          :hint="
            cpu
              ? `${cpu.cores} 核 · 负载 ${cpu.load[0]}${cpu.usage == null ? ' · 无 /proc/stat 权限' : ''}`
              : '采集失败'
          "
        />
        <StatCard
          title="内存占用"
          :value="mem ? mem.percent.toFixed(1) : '—'"
          unit="%"
          :percent="mem?.percent"
          tone="sky"
          :hint="mem ? `${formatBytes(mem.used)} / ${formatBytes(mem.total)}` : '采集失败'"
        />
        <StatCard
          title="电池电量"
          :value="battery ? String(battery.percentage) : '—'"
          unit="%"
          :percent="battery?.percentage"
          tone="violet"
          :hint="battery ? `${battery.status} · ${battery.plugged}` : '需要 Termux:API'"
        />
        <StatCard
          title="CPU 温度"
          :value="temp != null ? temp.toFixed(1) : '—'"
          unit="°C"
          tone="amber"
          :hint="battery?.temperature != null ? `电池 ${battery.temperature}°C` : '部分机型受限'"
        />
      </div>

      <div class="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <section class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h2 class="mb-2 text-sm font-medium text-slate-600">
            {{ cpuAvailable ? 'CPU 使用率趋势' : '系统负载趋势（1 分钟）' }}
          </h2>
          <LineChart
            :labels="history.labels"
            :series="cpuSeries"
            :unit="cpuAvailable ? '%' : ''"
            :max="cpuAvailable ? 100 : undefined"
          />
        </section>
        <section class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h2 class="mb-2 text-sm font-medium text-slate-600">内存占用趋势</h2>
          <LineChart :labels="history.labels" :series="memSeries" unit="%" :max="100" />
        </section>
        <section class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h2 class="mb-2 text-sm font-medium text-slate-600">网络速率（KB/s）</h2>
          <LineChart :labels="history.labels" :series="netSeries" unit=" KB/s" />
        </section>
      </div>

      <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-600">磁盘使用</h2>
          <ul class="space-y-3">
            <li v-for="d in disks" :key="d.mount">
              <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px] sm:text-xs">
                <span class="font-mono text-slate-600">{{ d.mount }}</span>
                <span class="text-slate-400 whitespace-nowrap">
                  {{ formatBytes(d.used) }} / {{ formatBytes(d.total) }}
                  <span class="ml-1 text-slate-600">{{ d.percent.toFixed(1) }}%</span>
                </span>
              </div>
              <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="diskTone(d.percent)"
                  :style="{ width: `${d.percent}%` }"
                ></div>
              </div>
            </li>
            <li v-if="!disks.length" class="text-xs text-slate-400">暂无磁盘数据</li>
          </ul>
        </section>

        <section class="space-y-2">
          <h2 class="px-1 text-sm font-medium text-slate-600">运行中的服务</h2>
          <ServiceList :services="services" />
        </section>
      </div>
    </div>
  </div>
</template>
