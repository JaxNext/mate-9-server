import type { EventRow, Freq } from './event-input'

const DAY = 86400000
const MAX_ITEMS = 400

const splitDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d }
}

const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d)
const tsOf = (date: string) => {
  const { y, m, d } = splitDate(date)
  return utc(y, m, d)
}
const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10)
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const addMonths = (y: number, m: number, months: number) => {
  const total = y * 12 + (m - 1) + months
  return { y: Math.floor(total / 12), m: (total % 12) + 1 }
}

/**
 * 在 [from, to] 区间内展开某条事项的实例日期（YYYY-MM-DD）。
 * 全部用 UTC 计算，避免本地时区/夏令时偏移；monthly/yearly 遇到小月自动退到月末。
 */
export function expandOccurrences(
  event: Pick<EventRow, 'freq' | 'interval' | 'start_date' | 'end_date'>,
  from: string,
  to: string,
): string[] {
  const freq: Freq = event.freq
  const interval = Math.max(1, Number(event.interval) || 1)

  const fromTs = tsOf(from)
  const toTs = tsOf(to)
  const start = splitDate(event.start_date)
  const startTs = utc(start.y, start.m, start.d)
  const endTs = event.end_date ? tsOf(event.end_date) : toTs
  const limitTs = Math.min(endTs, toTs)

  if (startTs > limitTs || limitTs < fromTs) return []

  if (freq === 'none') {
    return startTs >= fromTs ? [event.start_date] : []
  }

  const result: string[] = []

  if (freq === 'daily' || freq === 'weekly') {
    const step = (freq === 'daily' ? 1 : 7) * interval * DAY
    let cursor = startTs
    if (cursor < fromTs) cursor += Math.ceil((fromTs - cursor) / step) * step
    while (cursor <= limitTs && result.length < MAX_ITEMS) {
      result.push(fmt(cursor))
      cursor += step
    }
    return result
  }

  const endDate = event.end_date ? splitDate(event.end_date) : null
  const lastMonthIndex = endDate ? endDate.y * 12 + endDate.m - 1 : Infinity
  const fromDate = splitDate(from)

  if (freq === 'monthly') {
    const offset = (fromDate.y - start.y) * 12 + (fromDate.m - start.m)
    let k = Math.max(0, Math.floor(offset / interval))
    while (result.length < MAX_ITEMS) {
      const { y, m } = addMonths(start.y, start.m, k * interval)
      if (y * 12 + m - 1 > lastMonthIndex) break
      const ts = utc(y, m, Math.min(start.d, daysInMonth(y, m)))
      if (ts > limitTs) break
      if (ts >= fromTs) result.push(fmt(ts))
      k += 1
    }
    return result
  }

  let k = Math.max(0, Math.floor((fromDate.y - start.y) / interval))
  while (result.length < MAX_ITEMS) {
    const y = start.y + k * interval
    if (endDate && y > endDate.y) break
    const ts = utc(y, start.m, Math.min(start.d, daysInMonth(y, start.m)))
    if (ts > limitTs) break
    if (ts >= fromTs) result.push(fmt(ts))
    k += 1
  }
  return result
}
