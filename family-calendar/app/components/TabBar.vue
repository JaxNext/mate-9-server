<script setup lang="ts">
const route = useRoute()
const { pending, refresh } = useTodaySummary()

const tabs = [
  { path: '/', label: '首页' },
  { path: '/calendar', label: '日历' },
  { path: '/list', label: '列表' },
  { path: '/settings', label: '设置' },
]

onMounted(refresh)
watch(
  () => route.path,
  () => refresh(),
)
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
  >
    <div class="grid grid-cols-4">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
        :class="route.path === tab.path ? 'text-indigo-600' : 'text-slate-400'"
      >
        <svg
          v-if="tab.path === '/'"
          viewBox="0 0 24 24"
          class="h-[22px] w-[22px]"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
        </svg>
        <svg
          v-else-if="tab.path === '/calendar'"
          viewBox="0 0 24 24"
          class="h-[22px] w-[22px]"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <svg
          v-else-if="tab.path === '/list'"
          viewBox="0 0 24 24"
          class="h-[22px] w-[22px]"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M8.5 6h12M8.5 12h12M8.5 18h12" />
          <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          class="h-[22px] w-[22px]"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
          <circle cx="9" cy="7" r="2" fill="#fff" />
          <circle cx="15" cy="12" r="2" fill="#fff" />
          <circle cx="9" cy="17" r="2" fill="#fff" />
        </svg>
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.path === '/' && pending"
          class="absolute top-1 left-[calc(50%+5px)] min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[10px] leading-4 font-medium text-white"
        >
          {{ pending > 99 ? '99+' : pending }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
