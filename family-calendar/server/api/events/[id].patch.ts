import { useDb } from '../../utils/db'
import { requireMember } from '../../utils/auth'
import { assertMembers, parseEventInput, rowToInput, setEventMembers, type EventRow } from '../../utils/event-input'
import { assertTags, getEventTags, setEventTags } from '../../utils/tags'

export default defineEventHandler(async (event) => {
  requireMember(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '事项 ID 不正确' })
  }

  const db = useDb()
  const row = db.prepare('SELECT * FROM event WHERE id = ? AND archived = 0').get(id) as unknown as
    | EventRow
    | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '事项不存在' })
  }

  const currentMemberIds = (
    db.prepare('SELECT member_id FROM event_member WHERE event_id = ?').all(id) as Array<{ member_id: number }>
  ).map((item) => item.member_id)

  const currentTagIds = getEventTags(db, id).map((tag) => tag.id)

  const body = (await readBody(event)) as Record<string, unknown> | null
  const input = parseEventInput(body, rowToInput(row, currentMemberIds, currentTagIds))
  assertMembers(db, input.memberIds)
  assertTags(db, input.tagIds)

  db.prepare(
    `UPDATE event
     SET title = ?, note = ?, all_day = ?, start_time = ?, freq = ?, interval = ?,
         start_date = ?, end_date = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    input.title,
    input.note,
    input.allDay ? 1 : 0,
    input.startTime,
    input.freq,
    input.interval,
    input.startDate,
    input.endDate,
    id,
  )

  setEventMembers(db, id, input.memberIds)
  setEventTags(db, id, input.tagIds)

  return { id, ...input }
})
