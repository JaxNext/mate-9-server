import { requireMember } from '../../utils/auth'
import { useDb } from '../../utils/db'
import { findMember, normalizeMemberName } from '../../utils/members'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '成员 ID 不正确' })
  }

  const me = requireMember(event)
  if (me.id !== id) {
    throw createError({ statusCode: 403, statusMessage: '只能修改自己的名字' })
  }

  const body = (await readBody(event)) as Record<string, unknown> | null
  const name = normalizeMemberName(body?.name)

  const db = useDb()
  const duplicate = db
    .prepare('SELECT id FROM member WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(name, id)
  if (duplicate) {
    throw createError({ statusCode: 400, statusMessage: '这个名字已被使用' })
  }

  db.prepare('UPDATE member SET name = ? WHERE id = ?').run(name, id)
  return findMember(db, id)
})
