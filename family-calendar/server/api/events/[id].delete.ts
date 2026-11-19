import { useDb } from '../../utils/db'
import { requireMember } from '../../utils/auth'

export default defineEventHandler((event) => {
  requireMember(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '事项 ID 不正确' })
  }

  const db = useDb()
  const info = db.prepare('DELETE FROM event WHERE id = ?').run(id)
  if (!Number(info.changes)) {
    throw createError({ statusCode: 404, statusMessage: '事项不存在' })
  }

  // 外键级联在部分环境可能未生效，这里显式清理完成记录与标签关联
  db.prepare('DELETE FROM occurrence_state WHERE event_id = ?').run(id)
  db.prepare('DELETE FROM event_tag WHERE event_id = ?').run(id)
  return { ok: true }
})
