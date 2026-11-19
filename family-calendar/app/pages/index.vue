<script setup lang="ts">
import dayjs from 'dayjs'
import type { CalendarItem, Member } from '~/types'

const OVERDUE_DAYS = 30
const OVERDUE_LIMIT = 5

const route = useRoute()
const router = useRouter()
const today = dayjs().format('YYYY-MM-DD')

const todayItems = ref<CalendarItem[]>([])
const overdueItems = ref<CalendarItem[]>([])
const members = ref<Member[]>([])
const loading = ref(true)
const loadError = ref('')
const notice = ref('')
const actionItem = ref<CalendarItem | null>(null)
const busy = ref(false)
const showIdentity = ref(false)

const { memberId, seen, setIdentity, clearIdentity, markSeen } = useIdentity()
const { filter, setFilter } = useViewFilter()
const { setPending } = useTodaySummary()
const api = useApi()

const me = computed(() => members.value.find((member) => member.id === memberId.value) ?? null)
const weekLabel = `周${'日一二三四五六'[dayjs(today).day()]}`

function isPending(item: CalendarItem) {
  return item.state !== 'done' && item.state !== 'skipped'
}

function matchesFilter(item: CalendarItem) {
  if (!memberId.value || filter.value !== 'mine') return true
  return !item.members.length || item.members.some((member) => member.id === memberId.value)
}

const todayVisible = computed(() => todayItems.value.filter(matchesFilter))
const overdueVisible = computed(() => overdueItems.value.filter(matchesFilter))
const overdueShown = computed(() => overdueVisible.value.slice(0, OVERDUE_LIMIT))
const overdueMore = computed(() => Math.max(0, overdueVisible.value.length - OVERDUE_LIMIT))
const todayPendingTotal = computed(() => todayItems.value.filter(isPending).length)
const todayDone = computed(() => todayVisible.value.filter((item) => item.state === 'done').length)

watch(todayPendingTotal, (count) => setPending(count), { immediate: true })

async function load() {
  loading.value = true
  loadError.value = ''

  const overdueFrom = dayjs(today).subtract(OVERDUE_DAYS, 'day').format('YYYY-MM-DD')
  const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')

  try {
    const [todayRes, overdueRes] = await Promise.all([
      $fetch<{ items: CalendarItem[] }>('/api/events', { query: { from: today, to: today } }),
      $fetch<{ items: CalendarItem[] }>('/api/events', { query: { from: overdueFrom, to: yesterday } }),
    ])
    todayItems.value = todayRes.items
    overdueItems.value = overdueRes.items.filter(isPending)
  } catch (err: any) {
    loadError.value = err?.data?.statusMessage || err?.statusMessage || '加载失败，请确认服务已启动'
  } finally {
    loading.value = false
  }
}

async function refreshMembers() {
  members.value = await $fetch<Member[]>('/api/members').catch(() => [])
}

onMounted(async () => {
  await refreshMembers()
  load()
  if (memberId.value && !members.value.some((member) => member.id === memberId.value)) clearIdentity()

  if (route.query.login === '1') {
    showIdentity.value = true
    const query = { ...route.query }
    delete query.login
    router.replace({ query })
    return
  }
  if (!memberId.value && !seen.value) {
    markSeen()
    showIdentity.value = true
  }
})

function goCalendar() {
  router.push('/calendar')
}

function createItem() {
  if (!requireIdentity()) return
  router.push({ path: '/event/new', query: { date: today } })
}

function requireIdentity(): boolean {
  if (memberId.value) return true
  showIdentity.value = true
  return false
}

function showNotice(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2600)
}

function onIdentityChanged(member: Member) {
  setIdentity(member.id)
  const index = members.value.findIndex((item) => item.id === member.id)
  if (index >= 0) members.value[index] = member
  else members.value.push(member)
  showIdentity.value = false
}

function onLogout() {
  clearIdentity()
  setFilter('all')
  showIdentity.value = false
}

async function applyState(item: CalendarItem, action: 'complete' | 'skip' | 'undo') {
  if (!requireIdentity()) return
  busy.value = true
  try {
    const res = await api<{ state: CalendarItem['state'] }>(`/api/occurrences/${item.eventId}/${item.date}/${action}`, {
      method: 'POST',
    })
    item.state = res.state
    for (const row of todayItems.value) {
      if (row.eventId === item.eventId && row.date === item.date) row.state = res.state
    }
    if (res.state) {
      overdueItems.value = overdueItems.value.filter(
        (row) => !(row.eventId === item.eventId && row.date === item.date),
      )
    } else if (item.date !== today) {
      load()
    }
    actionItem.value = null
  } catch (err: any) {
    showNotice(err?.data?.statusMessage || err?.statusMessage || '操作失败')
  } finally {
    busy.value = false
  }
}

function toggleDone(item: CalendarItem) {
  applyState(item, item.state === 'done' ? 'undo' : 'complete')
}

function openActions(item: CalendarItem) {
  if (!requireIdentity()) return
  actionItem.value = item
}

function overdueDays(date: string) {
  return dayjs(today).diff(dayjs(date), 'day')
}

function editItem() {
  const item = actionItem.value
  actionItem.value = null
  if (item) router.push(`/event/${item.eventId}`)
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
    <header class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-medium tracking-[0.2em] text-slate-400">家庭日历</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">
          {{ dayjs(today).format('M月D日') }}
          <span class="ml-1 text-base font-normal text-slate-400">{{ weekLabel }}</span>
        </h1>
      </div>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-2xl font-light text-white shadow-lg shadow-indigo-600/25 transition active:scale-95"
        aria-label="新建事项"
        @click="createItem"
      >
        +
      </button>
    </header>

    <div v-if="memberId" class="mt-3 flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-900/5">
      <button
        type="button"
        class="flex-1 rounded-full py-1.5 text-xs font-medium transition"
        :class="filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500'"
        @click="setFilter('all')"
      >
        全部
      </button>
      <button
        type="button"
        class="flex-1 rounded-full py-1.5 text-xs font-medium transition"
        :class="filter === 'mine' ? 'bg-indigo-600 text-white' : 'text-slate-500'"
        @click="setFilter('mine')"
      >
        我的
      </button>
    </div>

    <section v-if="overdueVisible.length" class="mt-3 rounded-2xl bg-rose-50/80 p-2.5 ring-1 ring-rose-100">
      <div class="flex items-center justify-between px-1">
        <p class="text-xs font-medium text-rose-600">逾期未完成</p>
        <span class="text-[11px] text-rose-400">{{ overdueVisible.length }} 项</span>
      </div>
      <ul class="mt-1.5 space-y-1">
        <li v-for="item in overdueShown" :key="`${item.eventId}-${item.date}`">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-left active:bg-white"
            @click="openActions(item)"
          >
            <span class="min-w-0 flex-1 truncate text-sm text-slate-700">{{ item.title }}</span>
            <span class="shrink-0 text-[11px] text-rose-500">逾期 {{ overdueDays(item.date) }} 天</span>
          </button>
        </li>
        <li v-if="overdueMore">
          <NuxtLink
            to="/list"
            class="block px-1 pt-0.5 text-[11px] text-rose-400 active:text-rose-500"
          >
            还有 {{ overdueMore }} 项… 去列表查看
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section class="mt-6">
      <div class="flex items-baseline justify-between px-1">
        <h2 class="text-lg font-semibold text-slate-900">今日待办</h2>
        <span v-if="todayVisible.length" class="text-xs text-slate-400">
          已完成 {{ todayDone }} / {{ todayVisible.length }}
        </span>
      </div>

      <div v-if="loadError" class="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-600">
        <p>{{ loadError }}</p>
        <button type="button" class="mt-1.5 text-xs font-medium text-rose-600 underline" @click="load">重试</button>
      </div>

      <div v-else-if="loading" class="mt-3 space-y-2">
        <div v-for="index in 2" :key="index" class="h-[68px] animate-pulse rounded-2xl bg-white/70"></div>
      </div>

      <div
        v-else-if="!todayVisible.length"
        class="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center"
      >
        <p class="text-sm text-slate-400">今天没有安排</p>
        <div class="mt-2 flex items-center justify-center gap-4">
          <button type="button" class="text-sm font-medium text-indigo-600" @click="createItem">添加一个事项</button>
          <button type="button" class="text-sm text-slate-400" @click="goCalendar">看看日历</button>
        </div>
      </div>

      <ul v-else class="mt-3 space-y-2">
        <TaskRow
          v-for="item in todayVisible"
          :key="`${item.eventId}-${item.date}`"
          :item="item"
          @toggle="toggleDone(item)"
          @more="openActions(item)"
        />
      </ul>
    </section>

    <IdentitySheet
      :open="showIdentity"
      :member="me"
      @close="showIdentity = false"
      @changed="onIdentityChanged"
      @logout="onLogout"
    />

    <TaskActionSheet
      :item="actionItem"
      :busy="busy"
      @close="actionItem = null"
      @apply="actionItem && applyState(actionItem, $event)"
      @edit="editItem"
    />

    <Transition name="fade">
      <p
        v-if="notice"
        class="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white"
        role="status"
        aria-live="polite"
      >
        {{ notice }}
      </p>
    </Transition>
  </div>
</template>
