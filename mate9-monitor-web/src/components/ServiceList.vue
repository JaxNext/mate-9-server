<script setup lang="ts">
import type { ServiceInfo } from '../types/status'
import { formatBytes } from '../utils/format'

defineProps<{ services: ServiceInfo[] }>()

const statusText = (status: string) => {
  if (status === 'online') return '运行中'
  if (status === 'offline') return '未响应'
  if (status === 'online' || status === 'launching') return status
  if (status === 'errored') return '异常'
  if (status === 'stopped') return '已停止'
  return status
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <table class="w-full text-left text-sm">
      <thead class="bg-slate-50 text-xs text-slate-400">
        <tr>
          <th class="px-3 py-2.5 font-medium sm:px-4">服务</th>
          <th class="px-3 py-2.5 font-medium sm:px-4">状态</th>
          <th class="hidden px-4 py-2.5 font-medium sm:table-cell">PID</th>
          <th class="hidden px-4 py-2.5 font-medium sm:table-cell">CPU</th>
          <th class="px-3 py-2.5 text-right font-medium sm:px-4 sm:text-left">内存</th>
          <th class="hidden px-4 py-2.5 font-medium sm:table-cell">重启</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="s in services" :key="`${s.source}-${s.name}`" class="hover:bg-slate-50/60">
          <td class="px-3 py-2.5 sm:px-4">
            <span class="font-medium text-slate-700">{{ s.name }}</span>
            <span class="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
              {{ s.source === 'pm2' ? `pm2 · :${s.port ?? '—'}` : `port :${s.port}` }}
            </span>
          </td>
          <td class="px-3 py-2.5 sm:px-4">
            <span class="inline-flex items-center gap-1.5">
              <span
                class="h-2 w-2 rounded-full"
                :class="s.status === 'online' ? 'bg-emerald-500' : 'bg-rose-400'"
              ></span>
              <span class="text-slate-600">{{ statusText(s.status) }}</span>
            </span>
          </td>
          <td class="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{{ s.pid ?? '—' }}</td>
          <td class="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{{ s.cpu != null ? `${s.cpu}%` : '—' }}</td>
          <td class="px-3 py-2.5 text-right text-slate-500 sm:px-4 sm:text-left">
            {{ s.mem != null ? formatBytes(s.mem) : '—' }}
          </td>
          <td class="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{{ s.restarts ?? '—' }}</td>
        </tr>
        <tr v-if="!services.length">
          <td colspan="6" class="px-3 py-6 text-center text-slate-400">暂无服务数据</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
