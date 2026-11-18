import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { useDb } from './db'
import type { MemberRow } from './members'

/**
 * 写操作必须带 x-member-id。无密码体系下这只是行为约束，不是权限控制。
 */
export function requireMember(event: H3Event): MemberRow {
  const raw = getHeader(event, 'x-member-id')
  const id = raw ? Number(raw) : Number.NaN
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 401, statusMessage: '请先输入你的名字' })
  }

  const row = useDb().prepare('SELECT id, name, color FROM member WHERE id = ?').get(id) as unknown as
    | MemberRow
    | undefined
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: '身份已失效，请重新输入名字' })
  }
  return row
}
