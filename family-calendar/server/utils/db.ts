import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

let instance: DatabaseSync | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT,
  all_day INTEGER NOT NULL DEFAULT 1,
  start_time TEXT,
  freq TEXT NOT NULL DEFAULT 'none',
  interval INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_member (
  event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS occurrence_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  state TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, date)
);

CREATE INDEX IF NOT EXISTS idx_event_start_date ON event(start_date);
CREATE INDEX IF NOT EXISTS idx_state_event_date ON occurrence_state(event_id, date);
CREATE INDEX IF NOT EXISTS idx_event_member_member ON event_member(member_id);
`

/**
 * v0 -> v1：去掉预设成员与单成员字段，改为 event_member 多对多。
 * 只处理旧库（event 表还有 member_id 列）；新库直接建新结构。
 */
function migrate(db: DatabaseSync) {
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (version >= 1) return

  const eventColumns = db.prepare('PRAGMA table_info(event)').all() as Array<{ name: string }>
  if (eventColumns.some((column) => column.name === 'member_id')) {
    db.exec(`
      DELETE FROM member
      WHERE name IN ('爸爸', '妈妈', '孩子')
        AND NOT EXISTS (SELECT 1 FROM event WHERE event.member_id = member.id)
    `)
    db.exec(`
      INSERT OR IGNORE INTO event_member (event_id, member_id)
      SELECT id, member_id FROM event WHERE member_id IS NOT NULL
    `)
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_member_name ON member(name COLLATE NOCASE)')

  const memberColumns = db.prepare('PRAGMA table_info(member)').all() as Array<{ name: string }>
  if (memberColumns.some((column) => column.name === 'emoji')) {
    db.exec('ALTER TABLE member DROP COLUMN emoji')
  }

  db.exec('PRAGMA user_version = 1')
}

export function useDb(): DatabaseSync {
  if (instance) return instance

  const configured = process.env.FAMILY_DB_PATH || 'data/family.db'
  const file = isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
  mkdirSync(dirname(file), { recursive: true })

  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  migrate(db)

  instance = db
  return db
}
