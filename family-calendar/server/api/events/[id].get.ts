import { useDb } from '../../utils/db'
import type { MemberRow } from '../../utils/members'
import { toEventDto, type EventRow } from '../../utils/event-input'
import { getEventTags } from '../../utils/tags'

export default defineEventHandler((event) => {
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

  const members = db
    .prepare(
      `SELECT m.id, m.name, m.color
       FROM event_member em JOIN member m ON m.id = em.member_id
       WHERE em.event_id = ?
       ORDER BY m.id`,
    )
    .all(id) as unknown as MemberRow[]

  return toEventDto(row, members, getEventTags(db, id))
})
