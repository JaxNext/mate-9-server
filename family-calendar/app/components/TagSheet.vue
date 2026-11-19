<script setup lang="ts">
import type { Tag } from '~/types'
import { TAG_PALETTE } from '~/utils/tags'

const props = defineProps<{ open: boolean; tag: Tag | null }>()
const emit = defineEmits<{ close: []; saved: [tag: Tag]; deleted: [id: number] }>()

const api = useApi()
const name = ref('')
const color = ref(TAG_PALETTE[0])
const saving = ref(false)
const error = ref('')

const isNew = computed(() => !props.tag)

watch(
  () => [props.open, props.tag] as const,
  () => {
    if (!props.open) return
    name.value = props.tag?.name ?? ''
    color.value = props.tag?.color ?? TAG_PALETTE[0]
    error.value = ''
  },
  { immediate: true },
)

async function save() {
  const value = name.value.trim()
  if (!value) {
    error.value = '请输入标签名'
    return
  }

  saving.value = true
  error.value = ''
  try {
    if (props.tag) {
      const tag = await api<Tag>(`/api/tags/${props.tag.id}`, {
        method: 'PATCH',
        body: { name: value, color: color.value },
      })
      emit('saved', tag)
    } else {
      const res = await api<{ tag: Tag }>('/api/tags', {
        method: 'POST',
        body: { name: value, color: color.value },
      })
      emit('saved', res.tag)
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.statusMessage || '保存失败'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.tag) return
  if (!window.confirm(`删除标签「${props.tag.name}」？事项不会被删除，只会解除这个标签。`)) return

  saving.value = true
  error.value = ''
  try {
    await api(`/api/tags/${props.tag.id}`, { method: 'DELETE' })
    emit('deleted', props.tag.id)
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.statusMessage || '删除失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-label="编辑标签"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <div class="w-full max-w-md rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div class="mx-auto h-1 w-10 rounded-full bg-slate-200"></div>

        <p class="pt-3 text-center text-base font-medium text-slate-900">{{ isNew ? '新建标签' : '编辑标签' }}</p>

        <label class="mt-4 block rounded-2xl bg-slate-50 px-4 py-2.5">
          <span class="text-[11px] text-slate-400">标签名</span>
          <input
            v-model="name"
            maxlength="12"
            placeholder="例如：家务"
            autofocus
            class="mt-0.5 w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-300"
            @keyup.enter="save"
          />
        </label>

        <div class="mt-3 px-1">
          <p class="text-[11px] text-slate-400">颜色</p>
          <div class="mt-2 flex items-center justify-between">
            <button
              v-for="swatch in TAG_PALETTE"
              :key="swatch"
              type="button"
              class="h-8 w-8 rounded-full transition active:scale-90"
              :class="color === swatch ? 'ring-2 ring-slate-900 ring-offset-2' : ''"
              :style="{ backgroundColor: swatch }"
              :aria-label="`选择颜色 ${swatch}`"
              @click="color = swatch"
            ></button>
          </div>
        </div>

        <p v-if="error" class="mt-2 px-1 text-xs text-rose-500">{{ error }}</p>

        <button
          type="button"
          :disabled="saving || (!isNew && name.trim() === tag?.name && color === tag?.color)"
          class="mt-4 w-full rounded-2xl bg-indigo-600 py-3 text-base font-medium text-white active:scale-[0.99] disabled:opacity-40"
          @click="save"
        >
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <button
          v-if="!isNew"
          type="button"
          :disabled="saving"
          class="mt-1 w-full rounded-2xl py-3 text-sm font-medium text-rose-500 active:bg-rose-50 disabled:opacity-40"
          @click="remove"
        >
          删除标签
        </button>
        <button
          type="button"
          class="w-full rounded-2xl py-2.5 text-sm text-slate-400 active:bg-slate-50"
          @click="emit('close')"
        >
          取消
        </button>
      </div>
    </div>
  </Teleport>
</template>
