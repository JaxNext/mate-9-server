import dayjs from 'dayjs'
import type { CalendarItem } from '~/types'

/**
 * 今日未完成数量：同时驱动底部「首页」角标与 document.title 前缀。
 */
export function useTodaySummary() {
  const pending = useState<number>('fc-today-pending', () => 0)

  function applyTitle() {
    if (typeof document === 'undefined') return
    document.title = pending.value ? `(${pending.value}) 家庭日历` : '家庭日历'
  }

  function setPending(count: number) {
    pending.value = Math.max(0, count)
    applyTitle()
  }

  async function refresh() {
    const today = dayjs().format('YYYY-MM-DD')
    try {
      const res = await $fetch<{ items: CalendarItem[] }>('/api/events', {
        query: { from: today, to: today },
      })
      setPending(res.items.filter((item) => item.state !== 'done' && item.state !== 'skipped').length)
    } catch {
      // 角标失败不影响主流程
    }
  }

  return { pending, setPending, refresh }
}
