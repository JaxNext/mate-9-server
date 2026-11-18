import { onBeforeUnmount, reactive, ref } from 'vue'
import type { StatusSnapshot } from '../types/status'
import { formatTime } from '../utils/format'

const MAX_POINTS = 60
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export function useServerStatus() {
  const snapshot = ref<StatusSnapshot | null>(null)
  const connected = ref(false)

  const history = reactive({
    labels: [] as string[],
    cpu: [] as (number | null)[],
    load: [] as number[],
    mem: [] as number[],
    rxValue: [] as number[],
    txValue: [] as number[],
  })

  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const pushHistory = (s: StatusSnapshot) => {
    history.labels.push(formatTime(s.time))
    history.cpu.push(s.cpu.usage)
    history.load.push(s.cpu.load[0] ?? 0)
    history.mem.push(s.mem.percent)
    history.rxValue.push(s.net?.rxRate ?? 0)
    history.txValue.push(s.net?.txRate ?? 0)
    if (history.labels.length > MAX_POINTS) {
      history.labels.shift()
      history.cpu.shift()
      history.load.shift()
      history.mem.shift()
      history.rxValue.shift()
      history.txValue.shift()
    }
  }

  const connect = () => {
    source?.close()
    source = new EventSource(`${API_BASE}/api/stream`)
    source.onopen = () => {
      connected.value = true
    }
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StatusSnapshot
        snapshot.value = data
        pushHistory(data)
      } catch {
        // 忽略单条解析失败，等待下一帧
      }
    }
    source.onerror = () => {
      connected.value = false
      // 手机浏览器切后台再回来时 EventSource 可能已彻底关闭，浏览器的自动重连不会生效
      if (source?.readyState === EventSource.CLOSED && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null
          connect()
        }, 5000)
      }
    }
  }

  const disconnect = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    source?.close()
    source = null
    connected.value = false
  }

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return
    if (!source || source.readyState === EventSource.CLOSED) connect()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    disconnect()
  })

  return { snapshot, connected, history, connect, disconnect }
}
