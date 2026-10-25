#!/usr/bin/env node
/* 演示库与 schema 同构校验。
 *
 * 与宫颈癌仓的那一版不同：那一版逐表比 `PRAGMA table_info` 的列名/顺序/类型，
 * 因为它的演示库是**手写 DDL** 建的，天然会和 schema 分叉。
 * 本仓的演示库改成了「按编号跑 schema/00*.sql + 真实 seedDemo」，
 * 列必然一致 —— 所以这里不再重复比列，只查手抄 DDL 时代查不出、现在仍会出问题的三件事：
 *
 *   ① 表集合双向一致（演示库里多了一张 schema 没有的表，说明有人偷偷手建了表）；
 *   ② 空表告警（演示库存在的意义是"能看见东西"，一张表 0 行等于界面上那块永远空着）；
 *   ③ `value_num` / `value_text` 互斥（两列同时有值，界面就不知道该显示哪个）。
 *
 * 用法：node scripts/check-demo-columns.mjs   （前置 npm run build:demo）
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_DIR = join(ROOT, 'schema')
const DEMO_DB = join(ROOT, 'demo/demo-data.sqlite')

if (!existsSync(DEMO_DB)) {
  console.error('✗ 演示库不存在：demo/demo-data.sqlite（先跑 npm run build:demo）')
  process.exit(1)
}

/* ① 把 schema 全执行进内存库，取表集合 */
const memory = new DatabaseSync(':memory:')
for (const file of readdirSync(SCHEMA_DIR).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort()) {
  const sql = readFileSync(join(SCHEMA_DIR, file), 'utf8')
  /* journal_mode 不能在事务里跑，也不影响表结构，跳过 */
  memory.exec(sql.split('\n').filter((l) => !/^\s*PRAGMA\s+journal_mode/i.test(l)).join('\n'))
}
const tablesOf = (db) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name).sort()

const want = tablesOf(memory)
const demo = new DatabaseSync(DEMO_DB)
const got = tablesOf(demo)

const errors = []

const missing = want.filter((t) => !got.includes(t))
const extra = got.filter((t) => !want.includes(t))
if (missing.length) errors.push(`演示库缺表：${missing.join(', ')}（说明 build:demo 没按 schema 跑）`)
if (extra.length) errors.push(`演示库多了 schema 里没有的表：${extra.join(', ')}（不许手建表：演示库必须与真实库同构）`)

/* ② 空表：不是所有空表都是问题，但每张允许空的表都必须写清理由 ——
   否则"这张表为什么空着"下一轮要重新查一遍（而且很可能被顺手删掉）。
   演示库存在的意义是"能看见东西"，所以默认口径是「空表就是漏了」。 */
const ALLOW_EMPTY = new Map([
  ['migrations', '业务迁移台账：演示库是新建的，没有历史迁移'],
  ['schema_migrations', '迁移台账，演示库只记当前版本'],
  ['parse_jobs', '解析台账：演示数据不跑 MinerU，没有真实解析任务（跑一次导入才会有）'],
  ['parse_candidates', '候选指标：只有真的上传原件解析过才有，演示不假装有'],
  ['source_states', '试验来源终态：演示库不播来源状态，界面走"未查过"文案（这是刻意的诚实口径）'],
  ['trial_records', '试验记录：真实检索结果进 research/，演示档案里的 trials 是抄录示例，不进这张表'],
  ['trial_bookmarks', '收藏：用户动作，演示不预置'],
  ['export_snapshots', '导出快照：用户动作，演示不预置'],
  ['adherence_events', '漏服事件：原型里"记一次漏服"是 toast，不落库，演示库自然为空（adherence 月度摘要走 medications 侧）'],
  ['section_titles', '通用分节标题表：本仓筛查分节走 screening_sections，这张表是给未来"化验/症状分节"预留的，当前 0 行属正常'],
  ['todos', '待办：原型里待办恒 0 条（due 恒 NULL，不设截止提醒），演示数据不预置'],
])
const warnings = []
const counts = {}
for (const t of got) {
  const n = demo.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
  counts[t] = n
  if (n === 0 && !ALLOW_EMPTY.has(t)) warnings.push(`${t} 是空表（界面上那一块会一直空着；若确实该空，在 ALLOW_EMPTY 里写清理由）`)
}

/* ③ 互斥：value_num / value_text 只能有一个 */
const both = demo.prepare('SELECT COUNT(*) AS n FROM lab_items WHERE value_num IS NOT NULL AND value_text IS NOT NULL').get().n
if (both > 0) errors.push(`${both} 条化验项同时有数值和文字（界面不知道显示哪个）`)
const neither = demo.prepare('SELECT COUNT(*) AS n FROM lab_items WHERE value_num IS NULL AND value_text IS NULL').get().n
if (neither > 0) errors.push(`${neither} 条化验项数值和文字都没有（等于空行）`)

memory.close()
demo.close()

const summary = `演示库 ${got.length} 表 / 化验项 ${counts.lab_items ?? 0} 行 / 症状 ${counts.symptom_logs ?? 0} 行 / 疗程阶段 ${counts.pathway_phases ?? 0} 行`

if (errors.length) {
  console.error(`✗ 演示库与 schema 不一致（${errors.length} 处）：\n`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

if (warnings.length) {
  console.log(`✓ 演示库与 schema 同构（${summary}）`)
  for (const w of warnings) console.log(`  ! ${w}`)
  process.exit(0)
}

console.log(`✓ 演示库与 schema 同构，无空表（${summary}）`)
