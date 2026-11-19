<script setup lang="ts">
import type { CalendarItem } from '~/types'

defineProps<{ item: CalendarItem | null; busy: boolean }>()
const emit = defineEmits<{
  close: []
  apply: [action: 'complete' | 'skip' | 'undo']
  edit: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="item"
      class="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30"
      role="dialog"
      aria-modal="true"
      aria-label="事项操作"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <div class="w-full max-w-md rounded-t-3xl bg-white px-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div class="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-200"></div>
        <p class="px-4 pt-2 pb-1 text-xs text-slate-400">
          {{ item.title }} · {{ item.allDay ? '全天' : item.startTime }}
        </p>
        <button
          type="button"
          class="mt-1 w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50"
          :class="item.state === 'done' ? 'opacity-40' : ''"
          :disabled="busy || item.state === 'done'"
          @click="emit('apply', 'complete')"
        >
          <span class="px-3">标记完成</span>
        </button>
        <button
          type="button"
          class="w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50"
          :class="item.state === 'skipped' ? 'opacity-40' : ''"
          :disabled="busy || item.state === 'skipped'"
          @click="emit('apply', 'skip')"
        >
          <span class="px-3">跳过本次</span>
        </button>
        <button
          v-if="item.state"
          type="button"
          class="w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50 disabled:opacity-40"
          :disabled="busy"
          @click="emit('apply', 'undo')"
        >
          <span class="px-3">撤销状态</span>
        </button>
        <button
          type="button"
          class="w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50"
          @click="emit('edit')"
        >
          <span class="px-3">编辑事项</span>
        </button>
        <button
          type="button"
          class="mt-1 w-full rounded-2xl border-t border-slate-100 py-3 text-center text-[15px] text-slate-400 active:bg-slate-50"
          @click="emit('close')"
        >
          取消
        </button>
      </div>
    </div>
  </Teleport>
</template>
