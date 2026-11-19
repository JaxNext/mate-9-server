import dayjs from 'dayjs'
import { useDb } from '../../utils/db'
import { expandOccurrences } from '../../utils/recurrence'
import type { EventRow } from '../../utils/event-input'
import type { MemberRow } from '../../utils/members'
import { mapEventTags } from '../../utils/tags'

const LOOKBACK_DAYS = 30
const LOOKAHEAD_DAYS = 366

/**
 * 列表页数据源：按事项定义返回，附带「下一次未完成实例」。
 * 重复事项只看过去 30 天到未来 366 天，与首页逾期窗口保持一致，避免无界扫描。
 */
export default defineEventHandler((event) => {
  const params = getQuery(event)

  const memberId = params.member ? Number(params.member) : null
  if (memberId !== null && !Number.isInteger(memberId)) {
    throw createError({ statusCode: 400, statusMessage: '成员不正确' })
  }

  const tagId = params.tag ? Number(params.tag) : null
  if (tagId !== null && !Number.isInteger(tagId)) {
    throw createError({ statusCode: 400, statusMessage: '标签不正确' })
  }

  const today = dayjs().format('YYYY-MM-DD')
  const from = dayjs(today).subtract(LOOKBACK_DAYS, 'day').format('YYYY-MM-DD')
  const to = dayjs(today).add(LOOKAHEAD_DAYS, 'day').format('YYYY-MM-DD')

  const db = useDb()
  const sqlParams: Array<number> = []
  let sql = 'SELECT e.* FROM event e WHERE e.archived = 0'
  if (memberId !== null) {
    sql += `
      AND (
        NOT EXISTS (SELECT 1 FROM event_member em WHERE em.event_id = e.id)
        OR EXISTS (SELECT 1 FROM event_member em WHERE em.event_id = e.id AND em.member_id = ?)
      )`
    sqlParams.push(memberId)
  }
  if (tagId !== null) {
    sql += ' AND EXISTS (SELECT 1 FROM event_tag et WHERE et.event_id = e.id AND et.tag_id = ?)'
    sqlParams.push(tagId)
  }
  sql += ' ORDER BY e.start_date DESC, e.id DESC'

  const rows = db.prepare(sql).all(...sqlParams) as unknown as EventRow[]
  const eventIds = rows.map((row) => row.id)

  const membersMap = new Map<number, MemberRow[]>()
  if (eventIds.length) {
    const placeholders = eventIds.map(() => '?').join(',')
    const links = db
      .prepare(
        `SELECT em.event_id AS event_id, m.id, m.name, m.color
         FROM event_member em JOIN member m ON m.id = em.member_id
         WHERE em.event_id IN (${placeholders})
         ORDER BY m.id`,
      )
      .all(...eventIds) as Array<MemberRow & { event_id: number }>

    for (const link of links) {
      const list = membersMap.get(link.event_id) ?? []
      list.push({ id: link.id, name: link.name, color: link.color })
      membersMap.set(link.event_id, list)
    }
  }

  const tagsMap = mapEventTags(db, eventIds)

  const resolved = new Set(
    (
      db.prepare('SELECT event_id, date FROM occurrence_state WHERE date BETWEEN ? AND ?').all(from, to) as Array<{
        event_id: number
        date: string
      }>
    ).map((row) => `${row.event_id}|${row.date}`),
  )

  const items = rows.map((row) => {
    let nextDate: string | null = null

    if (row.freq === 'none') {
      nextDate = resolved.has(`${row.id}|${row.start_date}`) ? null : row.start_date
    } else if (row.start_date > to) {
      nextDate = row.start_date
    } else {
      const scanFrom = row.start_date > from ? row.start_date : from
      for (const date of expandOccurrences(row, scanFrom, to)) {
        if (!resolved.has(`${row.id}|${date}`)) {
          nextDate = date
          break
        }
      }
    }

    return {
      id: row.id,
      title: row.title,
      allDay: !!row.all_day,
      startTime: row.start_time,
      freq: row.freq,
      interval: row.interval,
      startDate: row.start_date,
      endDate: row.end_date,
      members: membersMap.get(row.id) ?? [],
      tags: tagsMap.get(row.id) ?? [],
      nextDate,
      overdue: !!nextDate && nextDate < today,
    }
  })

  items.sort((a, b) => {
    if (a.nextDate === b.nextDate) return a.title.localeCompare(b.title)
    if (a.nextDate === null) return 1
    if (b.nextDate === null) return -1
    return a.nextDate < b.nextDate ? -1 : 1
  })

  return { today, items }
})
