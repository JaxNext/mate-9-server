<script setup lang="ts">
import dayjs from 'dayjs'
import type { EventDetail, Member } from '~/types'

const REPEAT_OPTIONS = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '每两周' },
  { value: 'monthly', label: '每月同日' },
  { value: 'yearly', label: '每年同日' },
]

const route = useRoute()
const router = useRouter()
const { memberId: identityId } = useIdentity()
const api = useApi()
const rawId = computed(() => String(route.params.id ?? 'new'))
const isNew = computed(() => rawId.value === 'new')

const members = ref<Member[]>([])
const loading = ref(!isNew.value)
const saving = ref(false)
const error = ref('')

const form = reactive({
  title: '',
  startDate:
    typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date)
      ? route.query.date
      : dayjs().format('YYYY-MM-DD'),
  allDay: true,
  startTime: '09:00',
  memberIds: identityId.value ? [identityId.value] : ([] as number[]),
  repeat: 'none',
  endDate: '',
  note: '',
})

onMounted(async () => {
  if (!identityId.value) {
    router.replace({ path: '/', query: { login: '1' } })
    loading.value = false
    return
  }

  members.value = await $fetch<Member[]>('/api/members').catch(() => [])

  if (isNew.value) return
  try {
    const detail = await $fetch<EventDetail>(`/api/events/${rawId.value}`)
    form.title = detail.title
    form.startDate = detail.startDate
    form.allDay = detail.allDay
    form.startTime = detail.startTime ?? '09:00'
    form.memberIds = detail.members.map((member) => member.id)
    form.repeat = detail.freq === 'weekly' && detail.interval === 2 ? 'biweekly' : detail.freq
    form.endDate = detail.endDate ?? ''
    form.note = detail.note ?? ''
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.statusMessage || '事项加载失败'
  } finally {
    loading.value = false
  }
})

function isMemberSelected(id: number) {
  return form.memberIds.includes(id)
}

function toggleMember(id: number) {
  form.memberIds = isMemberSelected(id)
    ? form.memberIds.filter((item) => item !== id)
    : [...form.memberIds, id]
}

function buildPayload() {
  const repeat = form.repeat
  const freq = repeat === 'biweekly' ? 'weekly' : repeat
  return {
    title: form.title.trim(),
    startDate: form.startDate,
    allDay: form.allDay,
    startTime: form.allDay ? null : form.startTime,
    memberIds: form.memberIds,
    freq,
    interval: repeat === 'biweekly' ? 2 : 1,
    endDate: repeat === 'none' ? null : form.endDate || null,
    note: form.note.trim() || null,
  }
}

async function save() {
  error.value = ''
  if (!form.title.trim()) {
    error.value = '请填写事项标题'
    return
  }
  if (form.repeat !== 'none' && form.endDate && form.endDate < form.startDate) {
    error.value = '重复结束日期不能早于开始日期'
    return
  }

  saving.value = true
  try {
    if (isNew.value) {
      await api('/api/events', { method: 'POST', body: buildPayload() })
    } else {
      await api(`/api/events/${rawId.value}`, { method: 'PATCH', body: buildPayload() })
    }
    router.replace({ path: '/', query: { d: form.startDate } })
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.statusMessage || '保存失败'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!window.confirm(`删除「${form.title}」？`)) return
  saving.value = true
  try {
    await api(`/api/events/${rawId.value}`, { method: 'DELETE' })
    router.replace('/')
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.statusMessage || '删除失败'
    saving.value = false
  }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/')
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <header class="flex items-center gap-3">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-slate-500 shadow-sm ring-1 ring-slate-900/5 active:scale-95"
        aria-label="返回"
        @click="goBack"
      >
        ‹
      </button>
      <h1 class="text-lg font-semibold text-slate-900">{{ isNew ? '新建事项' : '编辑事项' }}</h1>
    </header>

    <p v-if="loading" class="mt-6 text-sm text-slate-400">加载中…</p>

    <template v-else>
      <div class="mt-5 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <label class="block p-4">
          <span class="text-[11px] text-slate-400">标题</span>
          <input
            v-model="form.title"
            maxlength="60"
            placeholder="例如：报修洗衣机"
            class="mt-1 w-full bg-transparent text-base outline-none placeholder:text-slate-300"
          />
        </label>

        <label class="flex items-center justify-between p-4">
          <span class="text-sm text-slate-600">日期</span>
          <input v-model="form.startDate" type="date" class="bg-transparent text-right text-base outline-none" />
        </label>

        <div class="flex items-center justify-between p-4">
          <span class="text-sm text-slate-600">全天</span>
          <button
            type="button"
            role="switch"
            :aria-checked="form.allDay"
            class="relative h-6 w-11 rounded-full transition-colors"
            :class="form.allDay ? 'bg-indigo-600' : 'bg-slate-200'"
            @click="form.allDay = !form.allDay"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
              :class="form.allDay ? 'left-[22px]' : 'left-0.5'"
            ></span>
          </button>
        </div>

        <label v-if="!form.allDay" class="flex items-center justify-between p-4">
          <span class="text-sm text-slate-600">时间</span>
          <input v-model="form.startTime" type="time" class="bg-transparent text-right text-base outline-none" />
        </label>

        <div class="p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-600">成员</span>
            <span class="text-[11px] text-slate-400">可多选，不选即全家共用</span>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-medium transition"
              :class="form.memberIds.length ? 'bg-slate-100 text-slate-500' : 'bg-indigo-600 text-white'"
              @click="form.memberIds = []"
            >
              全家
            </button>
            <button
              v-for="member in members"
              :key="member.id"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-medium transition"
              :class="isMemberSelected(member.id) ? 'text-white' : 'bg-slate-100 text-slate-600'"
              :style="isMemberSelected(member.id) ? { backgroundColor: member.color } : {}"
              @click="toggleMember(member.id)"
            >
              {{ member.name }}
            </button>
          </div>
        </div>

        <label class="flex items-center justify-between p-4">
          <span class="text-sm text-slate-600">重复</span>
          <select v-model="form.repeat" class="bg-transparent text-right text-base outline-none">
            <option v-for="option in REPEAT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label v-if="form.repeat !== 'none'" class="flex items-center justify-between p-4">
          <span class="text-sm text-slate-600">重复结束</span>
          <input
            v-model="form.endDate"
            type="date"
            class="bg-transparent text-right text-base outline-none"
          />
        </label>
      </div>

      <label class="mt-3 block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <span class="text-[11px] text-slate-400">备注</span>
        <textarea
          v-model="form.note"
          rows="3"
          maxlength="500"
          placeholder="补充说明（可选）"
          class="mt-1 w-full resize-none bg-transparent text-base outline-none placeholder:text-slate-300"
        ></textarea>
      </label>

      <p v-if="error" class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{{ error }}</p>

      <button
        type="button"
        :disabled="saving"
        class="mt-5 w-full rounded-2xl bg-indigo-600 py-3.5 text-base font-medium text-white shadow-lg shadow-indigo-600/20 transition active:scale-[0.99] disabled:opacity-60"
        @click="save"
      >
        {{ saving ? '保存中…' : '保存' }}
      </button>

      <button
        v-if="!isNew"
        type="button"
        :disabled="saving"
        class="mt-3 w-full rounded-2xl py-3 text-sm font-medium text-rose-500 active:bg-rose-50 disabled:opacity-60"
        @click="remove"
      >
        删除事项
      </button>
    </template>
  </div>
</template>
