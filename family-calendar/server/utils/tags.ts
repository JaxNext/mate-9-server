import type { DatabaseSync } from 'node:sqlite'
import { fail } from './event-input'

export interface TagRow {
  id: number
  name: string
  color: string
}

export const TAG_PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
]

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function normalizeTagName(raw: unknown): string {
  if (typeof raw !== 'string') fail('请输入标签名')
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) fail('请输入标签名')
  if (Array.from(name).length > 12) fail('标签名最多 12 个字')
  return name
}

export function normalizeTagColor(raw: unknown): string | null {
  if (typeof raw !== 'string' || !COLOR_RE.test(raw)) return null
  return raw.toLowerCase()
}

export function findTag(db: DatabaseSync, id: number): TagRow | undefined {
  return db.prepare('SELECT id, name, color FROM tag WHERE id = ?').get(id) as unknown as TagRow | undefined
}

export function findTagByName(db: DatabaseSync, name: string): TagRow | undefined {
  return db
    .prepare('SELECT id, name, color FROM tag WHERE name = ? COLLATE NOCASE')
    .get(name) as unknown as TagRow | undefined
}

export function listTags(db: DatabaseSync) {
  return db
    .prepare(
      `SELECT t.id, t.name, t.color, COUNT(e.id) AS count
       FROM tag t
       LEFT JOIN event_tag et ON et.tag_id = t.id
       LEFT JOIN event e ON e.id = et.event_id AND e.archived = 0
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all() as unknown as Array<TagRow & { count: number }>
}

/**
 * 同名（忽略大小写）标签直接复用，避免表单里重复创建。
 */
export function findOrCreateTag(
  db: DatabaseSync,
  name: string,
  color?: string | null,
): { tag: TagRow; created: boolean } {
  const existing = findTagByName(db, name)
  if (existing) return { tag: existing, created: false }

  let finalColor = color ?? null
  if (!finalColor) {
    const count = (db.prepare('SELECT COUNT(*) AS n FROM tag').get() as { n: number }).n
    finalColor = TAG_PALETTE[count % TAG_PALETTE.length]
  }
  const info = db.prepare('INSERT INTO tag (name, color) VALUES (?, ?)').run(name, finalColor)
  return { tag: findTag(db, Number(info.lastInsertRowid))!, created: true }
}

export function assertTags(db: DatabaseSync, tagIds: number[]) {
  if (!tagIds.length) return
  const placeholders = tagIds.map(() => '?').join(',')
  const found = db.prepare(`SELECT id FROM tag WHERE id IN (${placeholders})`).all(...tagIds) as Array<{ id: number }>
  if (found.length !== tagIds.length) fail('标签不存在')
}

export function setEventTags(db: DatabaseSync, eventId: number, tagIds: number[]) {
  db.prepare('DELETE FROM event_tag WHERE event_id = ?').run(eventId)
  const insert = db.prepare('INSERT OR IGNORE INTO event_tag (event_id, tag_id) VALUES (?, ?)')
  for (const tagId of tagIds) insert.run(eventId, tagId)
}

export function getEventTags(db: DatabaseSync, eventId: number): TagRow[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.color
       FROM event_tag et JOIN tag t ON t.id = et.tag_id
       WHERE et.event_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(eventId) as unknown as TagRow[]
}

export function mapEventTags(db: DatabaseSync, eventIds: number[]): Map<number, TagRow[]> {
  const map = new Map<number, TagRow[]>()
  if (!eventIds.length) return map

  const placeholders = eventIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT et.event_id AS event_id, t.id, t.name, t.color
       FROM event_tag et JOIN tag t ON t.id = et.tag_id
       WHERE et.event_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(...eventIds) as Array<TagRow & { event_id: number }>

  for (const row of rows) {
    const list = map.get(row.event_id) ?? []
    list.push({ id: row.id, name: row.name, color: row.color })
    map.set(row.event_id, list)
  }
  return map
}
