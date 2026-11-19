<script setup lang="ts">
import type { CalendarItem } from '~/types'

defineProps<{ item: CalendarItem }>()
const emit = defineEmits<{ toggle: []; more: [] }>()

function repeatText(item: CalendarItem) {
  if (item.freq === 'none') return ''
  if (item.freq === 'daily') return '每天'
  if (item.freq === 'weekly') return item.interval === 2 ? '每两周' : '每周'
  if (item.freq === 'monthly') return '每月'
  return '每年'
}

function metaLine(item: CalendarItem) {
  const owner = item.members.length ? item.members.map((member) => member.name).join('、') : '全家'
  const parts = [item.allDay ? '全天' : item.startTime ?? '', owner, repeatText(item)]
  return parts.filter(Boolean).join(' · ')
}
</script>

<template>
  <li class="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
    <button
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm transition active:scale-90"
      :class="[
        item.state === 'done'
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : item.state === 'skipped'
            ? 'border-slate-200 bg-slate-100 text-slate-400'
            : 'border-slate-300 text-transparent',
      ]"
      :aria-label="item.state === 'done' ? '撤销完成' : '标记完成'"
      @click="emit('toggle')"
    >
      {{ item.state === 'skipped' ? '–' : '✓' }}
    </button>

    <NuxtLink :to="`/event/${item.eventId}`" class="min-w-0 flex-1 py-0.5">
      <span class="flex items-center gap-2">
        <span
          class="min-w-0 flex-1 truncate text-base font-medium"
          :class="item.state ? 'text-slate-400 line-through' : 'text-slate-900'"
        >
          {{ item.title }}
        </span>
        <span v-if="item.state === 'skipped'" class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
          已跳过
        </span>
      </span>
      <span class="mt-0.5 block truncate text-xs text-slate-400">{{ metaLine(item) }}</span>
    </NuxtLink>

    <button
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
      aria-label="更多操作"
      @click="emit('more')"
    >
      ⋯
    </button>
  </li>
</template>
