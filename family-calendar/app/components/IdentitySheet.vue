<script setup lang="ts">
import type { Member } from '~/types'

const props = defineProps<{
  open: boolean
  member: Member | null
}>()

const emit = defineEmits<{ close: []; changed: [member: Member]; logout: [] }>()

const api = useApi()
const name = ref('')
const saving = ref(false)
const error = ref('')

const isLogin = computed(() => !props.member)

watch(
  () => [props.open, props.member] as const,
  () => {
    if (!props.open) return
    name.value = props.member?.name ?? ''
    error.value = ''
  },
  { immediate: true },
)

async function submit() {
  const value = name.value.trim()
  if (!value) {
    error.value = '请输入你的名字'
    return
  }

  saving.value = true
  error.value = ''
  try {
    if (props.member) {
      const member = await api<Member>(`/api/members/${props.member.id}`, {
        method: 'PATCH',
        body: { name: value },
      })
      emit('changed', member)
    } else {
      const res = await api<{ member: Member }>('/api/members', { method: 'POST', body: { name: value } })
      emit('changed', res.member)
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.statusMessage || '保存失败'
  } finally {
    saving.value = false
  }
}

function logout() {
  if (!window.confirm('清除本机身份？下次打开需要重新输入名字（同名会恢复原来的身份）。')) return
  emit('logout')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      :aria-label="isLogin ? '输入名字' : '账号设置'"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <div class="w-full max-w-md rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div class="mx-auto h-1 w-10 rounded-full bg-slate-200"></div>

        <template v-if="isLogin">
          <p class="pt-3 text-center text-base font-medium text-slate-900">你叫什么名字？</p>
          <p class="pt-1 text-center text-xs text-slate-400">用来标记你负责的事项，不需要密码，记在本机浏览器</p>

          <input
            v-model="name"
            maxlength="12"
            placeholder="输入你的名字"
            autofocus
            class="mt-4 w-full rounded-2xl bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500"
            @keyup.enter="submit"
          />
          <p v-if="error" class="mt-2 px-1 text-xs text-rose-500">{{ error }}</p>

          <button
            type="button"
            :disabled="saving"
            class="mt-3 w-full rounded-2xl bg-indigo-600 py-3 text-base font-medium text-white active:scale-[0.99] disabled:opacity-60"
            @click="submit"
          >
            {{ saving ? '保存中…' : '就用这个名字' }}
          </button>
          <button
            type="button"
            class="mt-1 w-full rounded-2xl py-3 text-sm text-slate-400 active:bg-slate-50"
            @click="emit('close')"
          >
            先看看，稍后再说
          </button>
        </template>

        <template v-else>
          <div class="flex flex-col items-center pt-4">
            <span
              class="flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium text-white"
              :style="{ backgroundColor: member?.color }"
            >
              {{ member?.name.slice(0, 1) }}
            </span>
            <p class="mt-2 text-base font-medium text-slate-900">{{ member?.name }}</p>
            <p class="text-xs text-slate-400">这是本机使用的身份</p>
          </div>

          <label class="mt-4 block rounded-2xl bg-slate-50 px-4 py-2.5">
            <span class="text-[11px] text-slate-400">名字</span>
            <input
              v-model="name"
              maxlength="12"
              class="mt-0.5 w-full bg-transparent text-base text-slate-900 outline-none"
              @keyup.enter="submit"
            />
          </label>
          <p v-if="error" class="mt-2 px-1 text-xs text-rose-500">{{ error }}</p>

          <button
            type="button"
            :disabled="saving || name.trim() === member?.name"
            class="mt-3 w-full rounded-2xl bg-indigo-600 py-3 text-base font-medium text-white active:scale-[0.99] disabled:opacity-40"
            @click="submit"
          >
            {{ saving ? '保存中…' : '保存名字' }}
          </button>
          <button
            type="button"
            class="mt-1 w-full rounded-2xl py-3 text-sm text-rose-500 active:bg-rose-50"
            @click="logout"
          >
            清除本机身份
          </button>
          <button
            type="button"
            class="w-full rounded-2xl py-2.5 text-sm text-slate-400 active:bg-slate-50"
            @click="emit('close')"
          >
            关闭
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>
