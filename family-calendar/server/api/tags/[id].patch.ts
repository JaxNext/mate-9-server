import { useDb } from '../../utils/db'
import { requireMember } from '../../utils/auth'
import { findTag, findTagByName, normalizeTagColor, normalizeTagName } from '../../utils/tags'

export default defineEventHandler(async (event) => {
  requireMember(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '标签 ID 不正确' })
  }

  const db = useDb()
  const current = findTag(db, id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '标签不存在' })
  }

  const body = (await readBody(event)) as Record<string, unknown> | null
  const name = body?.name === undefined ? current.name : normalizeTagName(body.name)
  const color = body?.color === undefined ? current.color : normalizeTagColor(body.color) ?? current.color

  if (name !== current.name) {
    const duplicate = findTagByName(db, name)
    if (duplicate && duplicate.id !== id) {
      throw createError({ statusCode: 400, statusMessage: '这个标签名已存在' })
    }
  }

  db.prepare('UPDATE tag SET name = ?, color = ? WHERE id = ?').run(name, color, id)
  return { id, name, color }
})
