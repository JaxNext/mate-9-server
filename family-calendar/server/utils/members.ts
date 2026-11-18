import type { DatabaseSync } from 'node:sqlite'
import { fail } from './event-input'

export interface MemberRow {
  id: number
  name: string
  color: string
}

const PALETTE = ['#6366f1', '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316']
const RESERVED = ['全家', '全部', '系统']

export function normalizeMemberName(raw: unknown): string {
  if (typeof raw !== 'string') fail('请输入你的名字')
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) fail('请输入你的名字')
  if (Array.from(name).length > 12) fail('名字最多 12 个字')
  if (RESERVED.includes(name)) fail('这个名字不能使用')
  return name
}

export function listMembers(db: DatabaseSync): MemberRow[] {
  return db.prepare('SELECT id, name, color FROM member ORDER BY id').all() as unknown as MemberRow[]
}

export function findMember(db: DatabaseSync, id: number): MemberRow | undefined {
  return db.prepare('SELECT id, name, color FROM member WHERE id = ?').get(id) as unknown as MemberRow | undefined
}

/**
 * 名字即身份：存在同名（不区分大小写）直接复用，否则新建并按调色板分配颜色。
 */
export function findOrCreateMember(db: DatabaseSync, name: string): { member: MemberRow; created: boolean } {
  const existing = db.prepare('SELECT id, name, color FROM member WHERE name = ? COLLATE NOCASE').get(name) as unknown as
    | MemberRow
    | undefined
  if (existing) return { member: existing, created: false }

  const count = (db.prepare('SELECT COUNT(*) AS n FROM member').get() as { n: number }).n
  const color = PALETTE[count % PALETTE.length]
  const info = db.prepare('INSERT INTO member (name, color) VALUES (?, ?)').run(name, color)
  const member = findMember(db, Number(info.lastInsertRowid))!
  return { member, created: true }
}
