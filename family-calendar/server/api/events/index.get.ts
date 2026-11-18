import dayjs from 'dayjs'
import { useDb } from '../../utils/db'
import { expandOccurrences } from '../../utils/recurrence'
import { isDate, type EventRow } from '../../utils/event-input'
import type { MemberRow } from '../../utils/members'

export default defineEventHandler((event) => {
  const params = getQuery(event)
  const from = isDate(params.from) ? params.from : dayjs().startOf('month').format('YYYY-MM-DD')
  const to = isDate(params.to) ? params.to : dayjs().endOf('month').format('YYYY-MM-DD')
  if (from > to) {
    throw createError({ statusCode: 400, statusMessage: '日期区间不正确' })
  }
  if (dayjs(to).diff(dayjs(from), 'day') > 400) {
    throw createError({ statusCode: 400, statusMessage: '查询区间不能超过 400 天' })
  }

  const memberId = params.member ? Number(params.member) : null
  if (memberId !== null && !Number.isInteger(memberId)) {
    throw createError({ statusCode: 400, statusMessage: '成员不正确' })
  }

  const db = useDb()
  const sqlParams: Array<string | number> = [to, from]
  let sql = `SELECT e.* FROM event e WHERE e.archived = 0 AND e.start_date <= ? AND (e.end_date IS NULL OR e.end_date >= ?)`
  if (memberId !== null) {
    sql += `
      AND (
        NOT EXISTS (SELECT 1 FROM event_member em WHERE em.event_id = e.id)
        OR EXISTS (SELECT 1 FROM event_member em WHERE em.event_id = e.id AND em.member_id = ?)
      )`
    sqlParams.push(memberId)
  }
  const rows = db.prepare(sql).all(...sqlParams) as unknown as EventRow[]

  const membersMap = new Map<number, MemberRow[]>()
  if (rows.length) {
    const placeholders = rows.map(() => '?').join(',')
    const links = db
      .prepare(
        `SELECT em.event_id AS event_id, m.id, m.name, m.color
         FROM event_member em JOIN member m ON m.id = em.member_id
         WHERE em.event_id IN (${placeholders})
         ORDER BY m.id`,
      )
      .all(...rows.map((row) => row.id)) as Array<MemberRow & { event_id: number }>

    for (const link of links) {
      const list = membersMap.get(link.event_id) ?? []
      list.push({ id: link.id, name: link.name, color: link.color })
      membersMap.set(link.event_id, list)
    }
  }

  const stateRows = db
    .prepare('SELECT event_id, date, state FROM occurrence_state WHERE date BETWEEN ? AND ?')
    .all(from, to) as Array<{ event_id: number; date: string; state: string }>
  const stateMap = new Map(stateRows.map((row) => [`${row.event_id}|${row.date}`, row.state]))

  const items = rows.flatMap((row) =>
    expandOccurrences(row, from, to).map((date) => ({
      eventId: row.id,
      date,
      state: stateMap.get(`${row.id}|${date}`) ?? null,
      title: row.title,
      note: row.note,
      allDay: !!row.all_day,
      startTime: row.start_time,
      members: membersMap.get(row.id) ?? [],
      freq: row.freq,
      interval: row.interval,
      startDate: row.start_date,
      endDate: row.end_date,
    })),
  )

  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.eventId - b.eventId
  })

  return { from, to, items }
})
