<script setup lang="ts">
import type { Member, Tag, TagWithCount } from '~/types'

const route = useRoute()
const router = useRouter()
const { memberId, setIdentity, clearIdentity } = useIdentity()
const { setFilter } = useViewFilter()

const members = ref<Member[]>([])
const tags = ref<TagWithCount[]>([])
const loading = ref(true)
const showIdentity = ref(false)
const tagSheetOpen = ref(false)
const editingTag = ref<Tag | null>(null)

const me = computed(() => members.value.find((member) => member.id === memberId.value) ?? null)

async function loadMembers() {
  members.value = await $fetch<Member[]>('/api/members').catch(() => [])
}

async function loadTags() {
  tags.value = await $fetch<TagWithCount[]>('/api/tags').catch(() => [])
}

onMounted(async () => {
  await Promise.all([loadMembers(), loadTags()])
  loading.value = false

  if (memberId.value && !members.value.some((member) => member.id === memberId.value)) clearIdentity()

  if (route.query.login === '1') {
    showIdentity.value = true
    const query = { ...route.query }
    delete query.login
    router.replace({ query })
  }
})

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

function openNewTag() {
  if (!memberId.value) {
    showIdentity.value = true
    return
  }
  editingTag.value = null
  tagSheetOpen.value = true
}

function openTag(tag: TagWithCount) {
  editingTag.value = tag
  tagSheetOpen.value = true
}

async function onTagSaved() {
  tagSheetOpen.value = false
  editingTag.value = null
  await loadTags()
}

async function onTagDeleted() {
  tagSheetOpen.value = false
  editingTag.value = null
  await loadTags()
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
    <header>
      <p class="text-[11px] font-medium tracking-[0.2em] text-slate-400">设置</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900">设置</h1>
    </header>

    <p v-if="loading" class="mt-6 text-sm text-slate-400">加载中…</p>

    <template v-else>
      <section class="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex items-center justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <span
              v-if="me"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-medium text-white"
              :style="{ backgroundColor: me.color }"
            >
              {{ me.name.slice(0, 1) }}
            </span>
            <span
              v-else
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base text-slate-400"
            >
              ?
            </span>
            <div class="min-w-0">
              <p class="text-[11px] text-slate-400">身份</p>
              <p class="truncate text-base font-medium" :class="me ? 'text-slate-900' : 'text-slate-400'">
                {{ me ? me.name : '未登录，只能查看' }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 active:bg-indigo-100"
            @click="showIdentity = true"
          >
            {{ me ? '管理' : '输入名字' }}
          </button>
        </div>
      </section>

      <section class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-slate-900">家庭成员</h2>
          <span class="text-[11px] text-slate-400">{{ members.length }} 人</span>
        </div>
        <ul v-if="members.length" class="mt-2 divide-y divide-slate-100">
          <li v-for="member in members" :key="member.id" class="flex items-center gap-2.5 py-2">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: member.color }"></span>
            <span class="min-w-0 flex-1 truncate text-sm text-slate-700">{{ member.name }}</span>
            <span
              v-if="member.id === memberId"
              class="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"
            >
              本机
            </span>
          </li>
        </ul>
        <p v-else class="mt-2 text-xs text-slate-400">还没有人输入过名字</p>
      </section>

      <section class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-slate-900">标签管理</h2>
          <button
            type="button"
            class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 active:bg-indigo-100"
            @click="openNewTag"
          >
            新建
          </button>
        </div>

        <ul v-if="tags.length" class="mt-2 divide-y divide-slate-100">
          <li v-for="tag in tags" :key="tag.id">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 py-2.5 text-left active:opacity-60"
              @click="openTag(tag)"
            >
              <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: tag.color }"></span>
              <span class="min-w-0 flex-1 truncate text-sm text-slate-700">{{ tag.name }}</span>
              <span class="text-[11px] text-slate-400">{{ tag.count }} 个事项</span>
              <span class="text-slate-300">›</span>
            </button>
          </li>
        </ul>
        <p v-else class="mt-2 text-xs text-slate-400">还没有标签，新建后可以在事项里使用</p>
      </section>
    </template>

    <IdentitySheet
      :open="showIdentity"
      :member="me"
      @close="showIdentity = false"
      @changed="onIdentityChanged"
      @logout="onLogout"
    />

    <TagSheet
      :open="tagSheetOpen"
      :tag="editingTag"
      @close="tagSheetOpen = false"
      @saved="onTagSaved"
      @deleted="onTagDeleted"
    />
  </div>
</template>
