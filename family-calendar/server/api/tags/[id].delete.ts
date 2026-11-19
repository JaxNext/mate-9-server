import { useDb } from '../../utils/db'
import { requireMember } from '../../utils/auth'

export default defineEventHandler((event) => {
  requireMember(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '标签 ID 不正确' })
  }

  const db = useDb()
  // 外键级联在部分环境可能未生效，这里显式解除关联
  db.prepare('DELETE FROM event_tag WHERE tag_id = ?').run(id)
  const info = db.prepare('DELETE FROM tag WHERE id = ?').run(id)
  if (!Number(info.changes)) {
    throw createError({ statusCode: 404, statusMessage: '标签不存在' })
  }

  return { ok: true }
})
