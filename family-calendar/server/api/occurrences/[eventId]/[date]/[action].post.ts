import { useDb } from '../../../../utils/db'
import { requireMember } from '../../../../utils/auth'
import { expandOccurrences } from '../../../../utils/recurrence'
import { isDate, type EventRow } from '../../../../utils/event-input'

const ACTIONS = ['complete', 'skip', 'undo'] as const

export default defineEventHandler((event) => {
  requireMember(event)

  const eventId = Number(getRouterParam(event, 'eventId'))
  const date = String(getRouterParam(event, 'date') ?? '')
  const action = String(getRouterParam(event, 'action') ?? '')

  if (!Number.isInteger(eventId)) {
    throw createError({ statusCode: 400, statusMessage: '事项 ID 不正确' })
  }
  if (!isDate(date)) {
    throw createError({ statusCode: 400, statusMessage: '日期格式不正确' })
  }
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    throw createError({ statusCode: 400, statusMessage: '不支持的操作' })
  }

  const db = useDb()
  const row = db.prepare('SELECT * FROM event WHERE id = ? AND archived = 0').get(eventId) as unknown as
    | EventRow
    | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '事项不存在' })
  }
  if (!expandOccurrences(row, date, date).length) {
    throw createError({ statusCode: 400, statusMessage: '这一天没有该事项' })
  }

  if (action === 'undo') {
    db.prepare('DELETE FROM occurrence_state WHERE event_id = ? AND date = ?').run(eventId, date)
    return { state: null }
  }

  const state = action === 'complete' ? 'done' : 'skipped'
  db.prepare(
    `INSERT INTO occurrence_state (event_id, date, state, completed_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (event_id, date) DO UPDATE SET state = excluded.state, completed_at = excluded.completed_at`,
  ).run(eventId, date, state)

  return { state }
})
