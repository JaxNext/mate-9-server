import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { homedir } from 'node:os'

const configured = process.env.FAMILY_DB_PATH || 'data/family.db'
const dbPath = isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
const dir = process.env.FAMILY_BACKUP_DIR || join(homedir(), 'backup')
const keep = Number(process.env.FAMILY_BACKUP_KEEP || 7)

mkdirSync(dir, { recursive: true })

const now = new Date()
const pad = (value) => String(value).padStart(2, '0')
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
const dest = join(dir, `family-${stamp}.db`)

const db = new DatabaseSync(dbPath)
db.exec(`VACUUM INTO '${dest.replaceAll("'", "''")}'`)
db.close()

const backups = readdirSync(dir)
  .filter((name) => /^family-.*\.db$/.test(name))
  .map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

for (const item of backups.slice(keep)) unlinkSync(join(dir, item.name))

console.log(`[backup] ${dest}（保留最近 ${keep} 份）`)
