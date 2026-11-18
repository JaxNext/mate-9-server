<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    value: string
    unit?: string
    hint?: string
    percent?: number
    tone?: 'emerald' | 'sky' | 'amber' | 'violet'
  }>(),
  { unit: '', hint: '', percent: undefined, tone: 'emerald' },
)

const toneMap: Record<string, { bar: string; text: string }> = {
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600' },
  sky: { bar: 'bg-sky-500', text: 'text-sky-600' },
  amber: { bar: 'bg-amber-500', text: 'text-amber-600' },
  violet: { bar: 'bg-violet-500', text: 'text-violet-600' },
}

const tone = computed(() => toneMap[props.tone])
const width = computed(() => `${Math.min(100, Math.max(0, props.percent ?? 0))}%`)
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <p class="text-[11px] font-medium tracking-wide text-slate-400 sm:text-xs">{{ title }}</p>
    <p class="mt-1 flex items-baseline gap-1">
      <span class="text-xl font-semibold sm:text-2xl" :class="tone.text">{{ value }}</span>
      <span v-if="unit" class="text-xs text-slate-400">{{ unit }}</span>
    </p>
    <div v-if="percent !== undefined" class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:mt-3">
      <div class="h-full rounded-full transition-all duration-500" :class="tone.bar" :style="{ width }"></div>
    </div>
    <p v-if="hint" class="mt-2 line-clamp-2 text-[11px] leading-snug text-slate-400 sm:text-xs">{{ hint }}</p>
  </div>
</template>
