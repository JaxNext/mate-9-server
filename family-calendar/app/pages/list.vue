<script setup lang="ts">
import dayjs from 'dayjs'
import type { EventListItem, Member, TagWithCount } from '~/types'

const today = dayjs().format('YYYY-MM-DD')

const router = useRouter()
const api = useApi()
const { memberId, setIdentity, clearIdentity } = useIdentity()
const { filter, setFilter } = useViewFilter()
const { refresh: refreshSummary } = useTodaySummary()

const items = ref<EventListItem[]>([])
const tags = ref<TagWithCount[]>([])
const members = ref<Member[]>([])
const selectedTag = ref<number | null>(null)
const loading = ref(true)
const loadError = ref('')
const notice = ref('')
const busyId = ref<number | null>(null)
const showIdentity = ref(false)

const me = computed(() => members.value.find((member) => member.id === memberId.value) ?? null)
const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD')

const groups = computed(() => {
  const buckets: Record<string, EventListItem[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    ended: [],
  }

  for (const item of items.value) {
    if (!item.nextDate) buckets.ended.push(item)
    else if (item.overdue) buckets.overdue.push(item)
    else if (item.nextDate === today) buckets.today.push(item)
    else if (item.nextDate <= weekEnd) buckets.week.push(item)
    else buckets.later.push(item)
  }

  return [
    { key: 'overdue', label: '逾期', items: buckets.overdue },
    { key: 'today', label: '今天', items: buckets.today },
    { key: 'week', label: '本周', items: buckets.week },
    { key: 'later', label: '以后', items: buckets.later },
    { key: 'ended', label: '已结束', items: buckets.ended },
  ].filter((group) => group.items.length)
})

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  loadError.value = ''

  const query: Record<string, string | number> = {}
  if (selectedTag.value) query.tag = selectedTag.value
  if (memberId.value && filter.value === 'mine') query.member = memberId.value

  try {
    const res = await $fetch<{ items: EventListItem[] }>('/api/events/list', { query })
    if (seq === requestSeq) items.value = res.items
  } catch (err: any) {
    if (seq === requestSeq) {
      loadError.value = err?.data?.statusMessage || err?.statusMessage || '加载失败，请确认服务已启动'
    }
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadTags() {
  tags.value = await $fetch<TagWithCount[]>('/api/tags').catch(() => [])
}

async function refreshMembers() {
  members.value = await $fetch<Member[]>('/api/members').catch(() => [])
}

watch([filter, selectedTag], load)
watch(memberId, (value) => {
  if (!value) setFilter('all')
})

onMounted(async () => {
  await Promise.all([loadTags(), refreshMembers()])
  load()
  if (memberId.value && !members.value.some((member) => member.id === memberId.value)) clearIdentity()
})

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

function createItem() {
  if (!requireIdentity()) return
  router.push({ path: '/event/new' })
}

async function completeNext(item: EventListItem) {
  if (!item.nextDate || busyId.value) return
  if (!requireIdentity()) return

  busyId.value = item.id
  try {
    await api(`/api/occurrences/${item.id}/${item.nextDate}/complete`, { method: 'POST' })
    await load()
    refreshSummary()
  } catch (err: any) {
    showNotice(err?.data?.statusMessage || err?.statusMessage || '操作失败')
  } finally {
    busyId.value = null
  }
}

function repeatText(item: EventListItem) {
  if (item.freq === 'none') return ''
  if (item.freq === 'daily') return '每天'
  if (item.freq === 'weekly') return item.interval === 2 ? '每两周' : '每周'
  if (item.freq === 'monthly') return '每月'
  return '每年'
}

function metaLine(item: EventListItem) {
  const owner = item.members.length ? item.members.map((member) => member.name).join('、') : '全家'
  const repeat = repeatText(item)

  if (!item.nextDate) return [repeat, owner, '已结束'].filter(Boolean).join(' · ')
  if (item.overdue) {
    const days = dayjs(today).diff(dayjs(item.nextDate), 'day')
    return [`逾期 ${days} 天`, repeat, owner].filter(Boolean).join(' · ')
  }
  return [`下次 ${dayjs(item.nextDate).format('M月D日')}`, repeat, owner].filter(Boolean).join(' · ')
}

function dotClass(item: EventListItem) {
  if (!item.nextDate) return 'bg-slate-300'
  if (item.overdue) return 'bg-rose-500'
  return 'bg-indigo-500'
}

function tagChipStyle(tag: { color: string }) {
  return { color: tag.color, backgroundColor: `${tag.color}18` }
}

function openItem(item: EventListItem) {
  router.push(`/event/${item.id}`)
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
    <header class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-medium tracking-[0.2em] text-slate-400">列表</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">全部事项</h1>
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

    <div v-if="tags.length" class="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      <button
        type="button"
        class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition"
        :class="selectedTag === null ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-900/5'"
        @click="selectedTag = null"
      >
        全部
      </button>
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
        :class="selectedTag === tag.id ? 'text-white' : 'bg-white text-slate-600 ring-1 ring-slate-900/5'"
        :style="selectedTag === tag.id ? { backgroundColor: tag.color } : {}"
        @click="selectedTag = tag.id"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="selectedTag === tag.id ? 'bg-white/80' : ''"
          :style="selectedTag === tag.id ? {} : { backgroundColor: tag.color }"
        ></span>
        {{ tag.name }}
        <span :class="selectedTag === tag.id ? 'text-white/70' : 'text-slate-400'">{{ tag.count }}</span>
      </button>
    </div>

    <div v-if="loadError" class="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-600">
      <p>{{ loadError }}</p>
      <button type="button" class="mt-1.5 text-xs font-medium text-rose-600 underline" @click="load">重试</button>
    </div>

    <div v-else-if="loading" class="mt-4 space-y-2">
      <div v-for="index in 3" :key="index" class="h-[72px] animate-pulse rounded-2xl bg-white/70"></div>
    </div>

    <div
      v-else-if="!items.length"
      class="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center"
    >
      <p class="text-sm text-slate-400">{{ selectedTag ? '这个标签下还没有事项' : '还没有事项' }}</p>
      <button
        v-if="selectedTag"
        type="button"
        class="mt-2 text-sm font-medium text-indigo-600"
        @click="selectedTag = null"
      >
        看看全部事项
      </button>
      <button v-else type="button" class="mt-2 text-sm font-medium text-indigo-600" @click="createItem">
        新建第一个
      </button>
    </div>

    <template v-else>
      <section v-for="group in groups" :key="group.key" class="mt-5">
        <div class="flex items-center gap-2 px-1">
          <h2
            class="text-xs font-medium"
            :class="group.key === 'overdue' ? 'text-rose-500' : 'text-slate-400'"
          >
            {{ group.label }}
          </h2>
          <span class="text-[11px] text-slate-300">{{ group.items.length }}</span>
        </div>

        <ul class="mt-2 space-y-2">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5 active:bg-slate-50"
            role="button"
            tabindex="0"
            @click="openItem(item)"
            @keyup.enter="openItem(item)"
          >
            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90"
              :class="
                !item.nextDate
                  ? 'border-slate-200 text-transparent'
                  : item.overdue
                    ? 'border-rose-300 text-transparent'
                    : 'border-slate-300 text-transparent'
              "
              :disabled="!item.nextDate || busyId === item.id"
              :aria-label="item.nextDate ? '完成下一次待办' : '没有待办'"
              @click.stop="completeNext(item)"
            >
              ✓
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="min-w-0 truncate text-[15px] font-medium text-slate-900">{{ item.title }}</span>
                <span
                  v-for="tag in item.tags.slice(0, 2)"
                  :key="tag.id"
                  class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  :style="tagChipStyle(tag)"
                >
                  {{ tag.name }}
                </span>
                <span v-if="item.tags.length > 2" class="shrink-0 text-[10px] text-slate-400">
                  +{{ item.tags.length - 2 }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-slate-400">{{ metaLine(item) }}</p>
            </div>

            <span class="h-2 w-2 shrink-0 rounded-full" :class="dotClass(item)"></span>
          </li>
        </ul>
      </section>
    </template>

    <IdentitySheet
      :open="showIdentity"
      :member="me"
      @close="showIdentity = false"
      @changed="onIdentityChanged"
      @logout="onLogout"
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
