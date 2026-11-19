import type { DatabaseSync } from 'node:sqlite'
import { createError } from 'h3'
import type { MemberRow } from './members'
import type { TagRow } from './tags'

export const FREQS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const
export type Freq = (typeof FREQS)[number]

export interface EventInput {
  title: string
  note: string | null
  memberIds: number[]
  tagIds: number[]
  allDay: boolean
  startTime: string | null
  freq: Freq
  interval: number
  startDate: string
  endDate: string | null
}

export interface EventRow {
  id: number
  title: string
  note: string | null
  all_day: number
  start_time: string | null
  freq: Freq
  interval: number
  start_date: string
  end_date: string | null
  archived: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function fail(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

/**
 * 把请求体合并到已有值上并做统一校验，创建与更新共用。
 */
export function parseEventInput(raw: Record<string, unknown> | null | undefined, base?: EventInput): EventInput {
  const pick = <T>(key: keyof EventInput, fallback: T): T => {
    const value = raw?.[key]
    return (value === undefined ? fallback : value) as T
  }

  const title = String(pick('title', base?.title ?? '')).trim()
  if (!title) fail('请填写事项标题')
  if (title.length > 60) fail('标题不能超过 60 个字')

  const startDate = String(pick('startDate', base?.startDate ?? ''))
  if (!isDate(startDate)) fail('请选择正确的日期')

  const freq = pick('freq', base?.freq ?? 'none')
  if (!FREQS.includes(freq)) fail('不支持的重复规则')

  let interval = Number(pick('interval', base?.interval ?? 1))
  if (freq === 'none') interval = 1
  if (!Number.isInteger(interval) || interval < 1 || interval > 99) fail('重复间隔不正确')

  const rawMembers = pick<unknown>('memberIds', base?.memberIds ?? [])
  if (!Array.isArray(rawMembers)) fail('成员格式不正确')
  const memberIds = [...new Set(rawMembers.map((value) => Number(value)))]
  if (memberIds.length > 10) fail('成员不能超过 10 个')
  if (memberIds.some((id) => !Number.isInteger(id))) fail('成员不正确')

  const rawTags = pick<unknown>('tagIds', base?.tagIds ?? [])
  if (!Array.isArray(rawTags)) fail('标签格式不正确')
  const tagIds = [...new Set(rawTags.map((value) => Number(value)))]
  if (tagIds.length > 10) fail('标签不能超过 10 个')
  if (tagIds.some((id) => !Number.isInteger(id))) fail('标签不正确')

  const allDay = Boolean(pick('allDay', base?.allDay ?? true))
  let startTime = pick('startTime', base?.startTime ?? null)
  startTime = startTime ? String(startTime) : null
  if (allDay) {
    startTime = null
  } else if (!startTime || !TIME_RE.test(startTime)) {
    fail('请选择具体时间')
  }

  let endDate = pick('endDate', base?.endDate ?? null)
  endDate = endDate ? String(endDate) : null
  if (freq === 'none') {
    endDate = null
  } else if (endDate) {
    if (!isDate(endDate)) fail('结束日期格式不正确')
    if (endDate < startDate) fail('结束日期不能早于开始日期')
  }

  const noteValue = pick('note', base?.note ?? null)
  const note = noteValue ? String(noteValue).trim().slice(0, 500) || null : null

  return { title, note, memberIds, tagIds, allDay, startTime, freq, interval, startDate, endDate }
}

export function assertMembers(db: DatabaseSync, memberIds: number[]) {
  if (!memberIds.length) return
  const placeholders = memberIds.map(() => '?').join(',')
  const found = db.prepare(`SELECT id FROM member WHERE id IN (${placeholders})`).all(...memberIds) as Array<{
    id: number
  }>
  if (found.length !== memberIds.length) fail('成员不存在')
}

export function setEventMembers(db: DatabaseSync, eventId: number, memberIds: number[]) {
  db.prepare('DELETE FROM event_member WHERE event_id = ?').run(eventId)
  const insert = db.prepare('INSERT OR IGNORE INTO event_member (event_id, member_id) VALUES (?, ?)')
  for (const memberId of memberIds) insert.run(eventId, memberId)
}

export function rowToInput(row: EventRow, memberIds: number[], tagIds: number[] = []): EventInput {
  return {
    title: row.title,
    note: row.note,
    memberIds,
    tagIds,
    allDay: !!row.all_day,
    startTime: row.start_time,
    freq: row.freq,
    interval: row.interval,
    startDate: row.start_date,
    endDate: row.end_date,
  }
}

export function toEventDto(row: EventRow, members: MemberRow[], tags: TagRow[] = []) {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    members: members.map((member) => ({ id: member.id, name: member.name, color: member.color })),
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    allDay: !!row.all_day,
    startTime: row.start_time,
    freq: row.freq,
    interval: row.interval,
    startDate: row.start_date,
    endDate: row.end_date,
  }
}
