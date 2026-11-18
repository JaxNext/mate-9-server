<script setup lang="ts">
import dayjs from 'dayjs'
import type { CalendarItem, Member } from '~/types'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const route = useRoute()
const router = useRouter()
const today = dayjs().format('YYYY-MM-DD')
const initial =
  typeof route.query.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.d) ? route.query.d : today

const selected = ref(initial)
const viewMonth = ref(initial.slice(0, 7))
const items = ref<CalendarItem[]>([])
const overdueItems = ref<CalendarItem[]>([])
const todayItems = ref<CalendarItem[]>([])
const members = ref<Member[]>([])
const loading = ref(true)
const loadError = ref('')
const notice = ref('')
const actionItem = ref<CalendarItem | null>(null)
const busy = ref(false)

const OVERDUE_DAYS = 30
const OVERDUE_LIMIT = 5

const { memberId, seen, setIdentity, clearIdentity, markSeen } = useIdentity()
const api = useApi()
const showIdentity = ref(false)
const filter = ref<'all' | 'mine'>('all')
const me = computed(() => members.value.find((member) => member.id === memberId.value) ?? null)

const monthStart = computed(() => dayjs(`${viewMonth.value}-01`))
const gridStart = computed(() => monthStart.value.subtract((monthStart.value.day() + 6) % 7, 'day'))
const rangeFrom = computed(() => gridStart.value.format('YYYY-MM-DD'))
const rangeTo = computed(() => gridStart.value.add(41, 'day').format('YYYY-MM-DD'))

const visibleItems = computed(() => {
  if (filter.value !== 'mine' || !memberId.value) return items.value
  return items.value.filter(
    (item) => !item.members.length || item.members.some((member) => member.id === memberId.value),
  )
})

const byDate = computed(() => {
  const map: Record<string, CalendarItem[]> = {}
  for (const item of visibleItems.value) (map[item.date] ||= []).push(item)
  return map
})

function isPending(item: CalendarItem) {
  return item.state !== 'done' && item.state !== 'skipped'
}

function matchesFilter(item: CalendarItem) {
  if (filter.value !== 'mine' || !memberId.value) return true
  return !item.members.length || item.members.some((member) => member.id === memberId.value)
}

const overduePending = computed(() => overdueItems.value.filter(matchesFilter))
const overdueVisible = computed(() => overduePending.value.slice(0, OVERDUE_LIMIT))
const overdueMore = computed(() => Math.max(0, overduePending.value.length - OVERDUE_LIMIT))
const todayPending = computed(() => todayItems.value.filter(isPending).length)

const cells = computed(() =>
  Array.from({ length: 42 }, (_, index) => {
    const date = gridStart.value.add(index, 'day')
    const key = date.format('YYYY-MM-DD')
    const dayList = byDate.value[key] ?? []
    return {
      date: key,
      day: date.date(),
      inMonth: date.month() === monthStart.value.month(),
      isToday: key === today,
      isSelected: key === selected.value,
      items: dayList,
      pending: dayList.some(isPending),
    }
  }),
)

const dayItems = computed(() => byDate.value[selected.value] ?? [])
const dayPending = computed(() => dayItems.value.filter(isPending).length)
const weekdayLabel = computed(() => `周${'日一二三四五六'[dayjs(selected.value).day()]}`)

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<{ items: CalendarItem[] }>('/api/events', {
      query: { from: rangeFrom.value, to: rangeTo.value },
    })
    if (seq === requestSeq) items.value = res.items
  } catch (err: any) {
    if (seq === requestSeq) {
      loadError.value = err?.data?.statusMessage || err?.statusMessage || '加载失败，请确认服务已启动'
    }
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

watch([rangeFrom, rangeTo], load, { immediate: true })
watch(memberId, (value) => {
  if (!value) filter.value = 'all'
})
watch(todayPending, (count) => {
  document.title = count ? `(${count}) 家庭日历` : '家庭日历'
})

async function loadReminders() {
  const from = dayjs(today).subtract(OVERDUE_DAYS, 'day').format('YYYY-MM-DD')
  const to = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')
  const [overdue, todayRes] = await Promise.all([
    $fetch<{ items: CalendarItem[] }>('/api/events', { query: { from, to } }).catch(() => ({ items: [] })),
    $fetch<{ items: CalendarItem[] }>('/api/events', { query: { from: today, to: today } }).catch(() => ({ items: [] })),
  ])
  overdueItems.value = overdue.items.filter(isPending)
  todayItems.value = todayRes.items
}

async function refreshMembers() {
  members.value = await $fetch<Member[]>('/api/members').catch(() => [])
}

onMounted(async () => {
  await refreshMembers()
  loadReminders()
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

function selectDate(date: string) {
  selected.value = date
  if (date.slice(0, 7) !== viewMonth.value) viewMonth.value = date.slice(0, 7)
  router.replace({ query: { ...route.query, d: date } })
}

function shiftMonth(delta: number) {
  const next = monthStart.value.add(delta, 'month')
  const day = Math.min(Number(selected.value.slice(8, 10)), next.daysInMonth())
  selectDate(next.date(day).format('YYYY-MM-DD'))
}

function goToday() {
  selectDate(today)
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
  filter.value = 'all'
  showIdentity.value = false
}

function requireIdentity(): boolean {
  if (memberId.value) return true
  showIdentity.value = true
  return false
}

function createItem() {
  if (!requireIdentity()) return
  router.push({ path: '/event/new', query: { date: selected.value } })
}

function showNotice(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2600)
}

async function applyState(item: CalendarItem, action: 'complete' | 'skip' | 'undo') {
  if (!requireIdentity()) return
  busy.value = true
  try {
    const res = await api<{ state: CalendarItem['state'] }>(
      `/api/occurrences/${item.eventId}/${item.date}/${action}`,
      { method: 'POST' },
    )
    item.state = res.state
    for (const row of items.value) {
      if (row.eventId === item.eventId && row.date === item.date) row.state = res.state
    }
    if (item.date === today) {
      const target = todayItems.value.find((row) => row.eventId === item.eventId)
      if (target) target.state = res.state
    }
    if (res.state) {
      overdueItems.value = overdueItems.value.filter(
        (row) => !(row.eventId === item.eventId && row.date === item.date),
      )
    } else {
      loadReminders()
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

function repeatLabel(item: CalendarItem) {
  if (item.freq === 'none') return ''
  if (item.freq === 'daily') return '每天'
  if (item.freq === 'weekly') return item.interval === 2 ? '每两周' : '每周'
  if (item.freq === 'monthly') return '每月'
  return '每年'
}

function itemColors(item: CalendarItem) {
  return item.members.length ? item.members.map((member) => member.color) : ['#94a3b8']
}

function chipStyle(item: CalendarItem) {
  const colors = itemColors(item)
  if (colors.length === 1) return { backgroundColor: colors[0] }
  const stops = colors
    .map((color, index) => `${color} ${(index * 100) / colors.length}% ${((index + 1) * 100) / colors.length}%`)
    .join(', ')
  return { backgroundImage: `linear-gradient(90deg, ${stops})` }
}

function metaLine(item: CalendarItem) {
  const owner = item.members.length ? item.members.map((member) => member.name).join('、') : '全家'
  const parts = [item.allDay ? '全天' : item.startTime ?? '', owner]
  const repeat = repeatLabel(item)
  if (repeat) parts.push(repeat)
  return parts.filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <header class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-medium tracking-[0.2em] text-slate-400">家庭日历</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">{{ monthStart.format('YYYY年M月') }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-11 items-center gap-1.5 rounded-full bg-white px-2.5 shadow-sm ring-1 ring-slate-900/5 active:scale-95"
          :aria-label="me ? '账号设置' : '登录'"
          @click="showIdentity = true"
        >
          <span
            v-if="me"
            class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white"
            :style="{ backgroundColor: me.color }"
          >
            {{ me.name.slice(0, 1) }}
          </span>
          <span v-else class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs">?</span>
          <span class="max-w-[52px] truncate text-xs text-slate-500">{{ me ? me.name : '登录' }}</span>
        </button>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-2xl font-light text-white shadow-lg shadow-indigo-600/25 transition active:scale-95"
          aria-label="新建事项"
          @click="createItem"
        >
          +
        </button>
      </div>
    </header>

    <div v-if="memberId" class="mt-3 flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-900/5">
      <button
        type="button"
        class="flex-1 rounded-full py-1.5 text-xs font-medium transition"
        :class="filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500'"
        @click="filter = 'all'"
      >
        全部
      </button>
      <button
        type="button"
        class="flex-1 rounded-full py-1.5 text-xs font-medium transition"
        :class="filter === 'mine' ? 'bg-indigo-600 text-white' : 'text-slate-500'"
        @click="filter = 'mine'"
      >
        我的
      </button>
    </div>

    <section v-if="overduePending.length" class="mt-3 rounded-2xl bg-rose-50/80 p-2.5 ring-1 ring-rose-100">
      <div class="flex items-center justify-between px-1">
        <p class="text-xs font-medium text-rose-600">逾期未完成</p>
        <span class="text-[11px] text-rose-400">{{ overduePending.length }} 项</span>
      </div>
      <ul class="mt-1.5 space-y-1">
        <li v-for="item in overdueVisible" :key="`${item.eventId}-${item.date}`">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-left active:bg-white"
            @click="openActions(item)"
          >
            <span class="min-w-0 flex-1 truncate text-sm text-slate-700">{{ item.title }}</span>
            <span class="shrink-0 text-[11px] text-rose-500">逾期 {{ overdueDays(item.date) }} 天</span>
          </button>
        </li>
        <li v-if="overdueMore" class="px-1 pt-0.5 text-[11px] text-rose-400">还有 {{ overdueMore }} 项…</li>
      </ul>
    </section>

    <section class="mt-3 rounded-3xl bg-white p-2.5 shadow-sm ring-1 ring-slate-900/5">
      <div class="flex items-center justify-between px-1 pb-1">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 active:bg-slate-100"
          aria-label="上个月"
          @click="shiftMonth(-1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium text-indigo-600 active:bg-indigo-50"
          @click="goToday"
        >
          回到今天
        </button>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 active:bg-slate-100"
          aria-label="下个月"
          @click="shiftMonth(1)"
        >
          ›
        </button>
      </div>

      <div class="grid grid-cols-7">
        <p v-for="weekday in WEEKDAYS" :key="weekday" class="py-1 text-center text-[11px] text-slate-400">
          {{ weekday }}
        </p>
      </div>

      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="cell in cells"
          :key="cell.date"
          type="button"
          class="relative flex h-[68px] flex-col items-center rounded-xl pt-1 transition"
          :class="[
            cell.isSelected ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'active:bg-slate-50',
            cell.inMonth ? '' : 'opacity-40',
          ]"
          @click="selectDate(cell.date)"
        >
          <span
            v-if="cell.items.length"
            class="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
            :class="cell.pending ? 'bg-indigo-500' : 'border border-slate-300 bg-white'"
          ></span>
          <span
            class="text-[13px] leading-5"
            :class="cell.isToday ? 'font-bold text-indigo-600' : 'text-slate-700'"
          >
            {{ cell.day }}
          </span>
          <span class="mt-0.5 flex w-full flex-col gap-[2px] px-0.5">
            <span
              v-for="item in cell.items.slice(0, 2)"
              :key="item.eventId"
              class="truncate rounded px-1 text-[9px] leading-[12px] text-white"
              :style="[chipStyle(item), { opacity: item.state === 'done' || item.state === 'skipped' ? 0.4 : 1 }]"
            >
              {{ item.title }}
            </span>
            <span v-if="cell.items.length > 2" class="pl-1 text-left text-[9px] leading-[12px] text-slate-400">
              +{{ cell.items.length - 2 }}
            </span>
          </span>
        </button>
      </div>
    </section>

    <section class="mt-6">
      <div class="flex items-baseline justify-between px-1">
        <div class="flex items-baseline gap-2">
          <h2 class="text-lg font-semibold text-slate-900">{{ dayjs(selected).format('M月D日') }}</h2>
          <span class="text-xs text-slate-400">{{ weekdayLabel }}</span>
          <span
            v-if="selected === today"
            class="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
          >
            今天
          </span>
        </div>
        <span class="flex items-center gap-2">
          <span v-if="dayPending" class="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-500">
            未完成 {{ dayPending }}
          </span>
          <span class="text-xs text-slate-400">{{ dayItems.length ? `${dayItems.length} 项` : '' }}</span>
        </span>
      </div>

      <div v-if="loadError" class="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-600">
        <p>{{ loadError }}</p>
        <button type="button" class="mt-1.5 text-xs font-medium text-rose-600 underline" @click="load">
          重试
        </button>
      </div>

      <div v-else-if="loading" class="mt-3 space-y-2">
        <div v-for="index in 2" :key="index" class="h-[68px] animate-pulse rounded-2xl bg-white/70"></div>
      </div>

      <div
        v-else-if="!dayItems.length"
        class="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-7 text-center"
      >
        <p class="text-sm text-slate-400">{{ items.length ? '这一天没有安排' : '这个月还没有安排' }}</p>
        <button type="button" class="mt-2 text-sm font-medium text-indigo-600" @click="createItem">
          添加一个事项
        </button>
      </div>

      <ul v-else class="mt-3 space-y-2">
        <li
          v-for="item in dayItems"
          :key="`${item.eventId}-${item.date}`"
          class="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5"
        >
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
            @click="toggleDone(item)"
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
              <span
                v-if="item.state === 'skipped'"
                class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                已跳过
              </span>
            </span>
            <span class="mt-0.5 block truncate text-xs text-slate-400">{{ metaLine(item) }}</span>
          </NuxtLink>

          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            aria-label="更多操作"
            @click="openActions(item)"
          >
            ⋯
          </button>
        </li>
      </ul>
    </section>

    <IdentitySheet
      :open="showIdentity"
      :member="me"
      @close="showIdentity = false"
      @changed="onIdentityChanged"
      @logout="onLogout"
    />

    <Teleport to="body">
      <div
        v-if="actionItem"
        class="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30"
        role="dialog"
        aria-modal="true"
        aria-label="事项操作"
        @click.self="actionItem = null"
        @keydown.esc="actionItem = null"
      >
        <div class="w-full max-w-md rounded-t-3xl bg-white px-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div class="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-200"></div>
          <p class="px-4 pt-2 pb-1 text-xs text-slate-400">
            {{ actionItem.title }} · {{ actionItem.allDay ? '全天' : actionItem.startTime }}
          </p>
          <button
            type="button"
            class="mt-1 w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50"
            :class="actionItem.state === 'done' ? 'opacity-40' : ''"
            :disabled="busy || actionItem.state === 'done'"
            @click="applyState(actionItem, 'complete')"
          >
            <span class="px-3">标记完成</span>
          </button>
          <button
            type="button"
            class="w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50"
            :class="actionItem.state === 'skipped' ? 'opacity-40' : ''"
            :disabled="busy || actionItem.state === 'skipped'"
            @click="applyState(actionItem, 'skip')"
          >
            <span class="px-3">跳过本次</span>
          </button>
          <button
            v-if="actionItem.state"
            type="button"
            class="w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50 disabled:opacity-40"
            :disabled="busy"
            @click="applyState(actionItem, 'undo')"
          >
            <span class="px-3">撤销状态</span>
          </button>
          <button
            type="button"
            class="w-full rounded-2xl py-3 text-left text-[15px] text-slate-800 active:bg-slate-50"
            @click="editItem"
          >
            <span class="px-3">编辑事项</span>
          </button>
          <button
            type="button"
            class="mt-1 w-full rounded-2xl border-t border-slate-100 py-3 text-center text-[15px] text-slate-400 active:bg-slate-50"
            @click="actionItem = null"
          >
            取消
          </button>
        </div>
      </div>
    </Teleport>

    <Transition name="fade">
      <p
        v-if="notice"
        class="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white"
        role="status"
        aria-live="polite"
      >
        {{ notice }}
      </p>
    </Transition>
  </div>
</template>
