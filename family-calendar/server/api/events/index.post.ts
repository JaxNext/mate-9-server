import { useDb } from '../../utils/db'
import { requireMember } from '../../utils/auth'
import { assertMembers, parseEventInput, setEventMembers } from '../../utils/event-input'
import { assertTags, setEventTags } from '../../utils/tags'

export default defineEventHandler(async (event) => {
  requireMember(event)

  const db = useDb()
  const input = parseEventInput(await readBody(event))
  assertMembers(db, input.memberIds)
  assertTags(db, input.tagIds)

  const info = db
    .prepare(
      `INSERT INTO event (title, note, all_day, start_time, freq, interval, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.note,
      input.allDay ? 1 : 0,
      input.startTime,
      input.freq,
      input.interval,
      input.startDate,
      input.endDate,
    )

  const id = Number(info.lastInsertRowid)
  setEventMembers(db, id, input.memberIds)
  setEventTags(db, id, input.tagIds)

  setResponseStatus(event, 201)
  return { id }
})
