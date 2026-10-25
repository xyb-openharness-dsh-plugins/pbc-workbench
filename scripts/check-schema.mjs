#!/usr/bin/env node
/**
 * schema 检查：把 schema/00N_*.sql **全部**迁移应用到内存库，然后
 *   1) 断言表清单与 schema/freeze-contract.md 记录的一致（多一张少一张都红）
 *   2) 断言「判读列」不存在（diagnosis / risk_level / response / stage / grade / severity / conclusion）
 *   3) 断言分节标题列存在
 *   4) 断言 0001 的 sha256 与冻结合同记录一致（防"偷偷改初始迁移"）
 * 只读，不写磁盘。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_DIR = join(ROOT, 'schema')
const BANNED = ['diagnosis', 'risk_level', 'response', 'stage', 'grade', 'severity', 'conclusion']
const errors = []
const notes = []

const files = readdirSync(SCHEMA_DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()
if (!files.length) {
  console.error('✗ schema/ 下没有 000N_*.sql')
  process.exit(1)
}

const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON')
for (const f of files) {
  const sql = readFileSync(join(SCHEMA_DIR, f), 'utf8')
  try {
    db.exec(sql)
  } catch (err) {
    errors.push(`应用 ${f} 失败：${err.message}`)
  }
}
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2))
  process.exit(1)
}

const tables = db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name").all().map((r) => r.name)

// 1) 与合同一致
const contract = readFileSync(join(SCHEMA_DIR, 'freeze-contract.md'), 'utf8')
const claimed = (contract.match(/表清单（\d+ 张）\*\*：([\s\S]*?)2\. /) || [])[1] || ''
const claimedTables = claimed.replace(/\n/g, ' ').split('/').map((s) => s.trim()).filter(Boolean)
const missing = claimedTables.filter((t) => !tables.includes(t))
const extra = tables.filter((t) => !claimedTables.includes(t))
if (missing.length) errors.push(`合同列了但库里没有：${missing.join(', ')}`)
if (extra.length) errors.push(`库里有但合同没列：${extra.join(', ')}`)

// 2) 判读列
const judgement = []
for (const t of tables) {
  const cols = db.prepare(`pragma table_info(${t})`).all()
  for (const c of cols) {
    const n = c.name.toLowerCase()
    if (BANNED.some((b) => n === b || n.startsWith(b + '_') || n.endsWith('_' + b))) judgement.push(`${t}.${c.name}`)
  }
}
if (judgement.length) errors.push(`出现判定列（禁止）：${judgement.join(', ')}`)

// 3) 分节标题
const titleCols = db.prepare('pragma table_info(section_titles)').all().map((c) => c.name)
for (const need of ['scope', 'section_key', 'section_title', 'ord']) {
  if (!titleCols.includes(need)) errors.push(`section_titles 缺少列 ${need}`)
}

// 4) 0001 sha256 与合同一致
const first = files[0]
const sha = createHash('sha256').update(readFileSync(join(SCHEMA_DIR, first))).digest('hex')
const recorded = (contract.match(/`sha256`：`([0-9a-f]{64})`/) || [])[1]
if (!recorded) errors.push('冻结合同没有记录 sha256')
else if (recorded !== sha) errors.push(`0001 sha256 不一致：合同 ${recorded.slice(0, 12)}… 实际 ${sha.slice(0, 12)}…（禁止改初始迁移）`)
else notes.push(`${first} sha256 与合同一致`)

// 5) ref_low/ref_high 必须存在且可空
const labCols = db.prepare('pragma table_info(lab_items)').all()
for (const need of ['ref_low', 'ref_high']) {
  const col = labCols.find((c) => c.name === need)
  if (!col) errors.push(`lab_items 缺少 ${need}`)
  else if (col.notnull) errors.push(`lab_items.${need} 不应为 NOT NULL（缺上限是合法状态）`)
}

const out = { ok: errors.length === 0, migrations: files, tables: tables.length, judgementColumns: judgement.length, notes, errors }
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
