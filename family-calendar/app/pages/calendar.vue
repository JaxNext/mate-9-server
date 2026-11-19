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
const members = ref<Member[]>([])
const loading = ref(true)
const loadError = ref('')
const notice = ref('')
const actionItem = ref<CalendarItem | null>(null)
const busy = ref(false)
const showIdentity = ref(false)

const { memberId, setIdentity, clearIdentity } = useIdentity()
const { filter, setFilter } = useViewFilter()
const { refresh: refreshSummary } = useTodaySummary()
const api = useApi()

const me = computed(() => members.value.find((member) => member.id === memberId.value) ?? null)

const monthStart = computed(() => dayjs(`${viewMonth.value}-01`))
const gridStart = computed(() => monthStart.value.subtract((monthStart.value.day() + 6) % 7, 'day'))
const rangeFrom = computed(() => gridStart.value.format('YYYY-MM-DD'))
const rangeTo = computed(() => gridStart.value.add(41, 'day').format('YYYY-MM-DD'))

function isPending(item: CalendarItem) {
  return item.state !== 'done' && item.state !== 'skipped'
}

function matchesFilter(item: CalendarItem) {
  if (!memberId.value || filter.value !== 'mine') return true
  return !item.members.length || item.members.some((member) => member.id === memberId.value)
}

const visibleItems = computed(() => items.value.filter(matchesFilter))

const byDate = computed(() => {
  const map: Record<string, CalendarItem[]> = {}
  for (const item of visibleItems.value) (map[item.date] ||= []).push(item)
  return map
})

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
  if (!value) setFilter('all')
})

async function refreshMembers() {
  members.value = await $fetch<Member[]>('/api/members').catch(() => [])
}

onMounted(async () => {
  await refreshMembers()
  if (memberId.value && !members.value.some((member) => member.id === memberId.value)) clearIdentity()
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

function createItem() {
  if (!requireIdentity()) return
  router.push({ path: '/event/new', query: { date: selected.value } })
}

function requireIdentity(): boolean {
  if (memberId.value) return true
  showIdentity.value = true
  return false
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
    const res = await api<{ state: CalendarItem['state'] }>(`/api/occurrences/${item.eventId}/${item.date}/${action}`, {
      method: 'POST',
    })
    for (const row of items.value) {
      if (row.eventId === item.eventId && row.date === item.date) row.state = res.state
    }
    actionItem.value = null
    refreshSummary()
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

function editItem() {
  const item = actionItem.value
  actionItem.value = null
  if (item) router.push(`/event/${item.eventId}`)
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
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
    <header class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-medium tracking-[0.2em] text-slate-400">日历</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">{{ monthStart.format('YYYY年M月') }}</h1>
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
        <button type="button" class="mt-1.5 text-xs font-medium text-rose-600 underline" @click="load">重试</button>
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
        <TaskRow
          v-for="item in dayItems"
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
