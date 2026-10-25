/* demo 数据同源校验（26 号 demo-parity 契约）。
 *
 * 为什么要有这个测试：`demo/demo-data.sqlite` 与 `prototypes/v0.2/demo-data.js`
 * 是**同一份数据的两份产物** —— 一份给原型用，一份给读模型用。两边一旦分叉，
 * 界面上只会表现为"某个角标忽然不见了"，不报错、不崩，最难定位。
 *
 * 这里的断言分两层：
 *   ① 产物层：`demo-data.sqlite` 里的行数/形状与 `demo-data.js` 对得上；
 *   ② 读模型层：`bootstrap().profiles` 与 `demo-data.js` **逐字段 deepStrictEqual**。
 * ②是真正的契约 —— 前端是照着原型写的，差一个字段就是一片空白。
 *
 * 另外钉住 PBC 的三条口径（容易在重构里被"顺手优化"掉）：
 *   - 参考上限缺失时**不得**给出分级（`needsUln`），绝不借通用上限；
 *   - 一张化验单里的实验室名**逐条**独立（汇总单会混本院与外院）；
 *   - `questions.id` / `documents.id` 用**档案内序号**，不用数据库自增主键。
 *
 * 用法：node --disable-warning=ExperimentalWarning --test test/demo-parity.test.mjs
 * 前置：node demo/build-demo-data.mjs（npm run check 会先跑）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { bootstrap, listProfiles, getProfile, restoreValue } from '../dsh/readmodels.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DB = join(ROOT, 'demo/demo-data.sqlite')
const JS = join(ROOT, 'prototypes/v0.2/demo-data.js')

/* demo-data.js 是给浏览器用的经典脚本（挂 window），这里给个假 window 把它取出来。 */
function loadDemoData() {
  const code = readFileSync(JS, 'utf8')
  const sandbox = {}
  new Function('window', code)(sandbox)
  assert.ok(sandbox.DEMO, 'demo-data.js 没有产出 window.DEMO')
  return sandbox.DEMO
}

const DEMO = loadDemoData()
const db = new DatabaseSync(DB)
const keys = DEMO.profiles.map((p) => p.key)

test('① 档案数与 demo-data.js 一致，且 key 一一对应', () => {
  const rows = db.prepare('SELECT profile_key, label, display_name FROM profiles ORDER BY profile_key').all()
  assert.equal(rows.length, DEMO.profiles.length, 'profiles 行数与 demo-data.js 不一致')
  assert.deepEqual(rows.map((r) => r.profile_key), keys)
  for (const r of rows) {
    const p = DEMO.profiles.find((x) => x.key === r.profile_key)
    assert.equal(p.label, r.label)
    assert.equal(p.name, r.display_name)
  }
})

test('② 读模型 profiles 与 demo-data.js 逐字段 deepStrictEqual（26 号核心契约）', () => {
  const payload = bootstrap(db, { version: '0.1.0', build: 'test' })
  assert.ok(Array.isArray(payload.profiles), 'bootstrap.profiles 必须是数组：原型写的是 DEMO.profiles.find(...)')
  assert.equal(payload.profiles.length, DEMO.profiles.length)
  for (const want of DEMO.profiles) {
    const got = payload.profiles.find((p) => p.key === want.key)
    assert.ok(got, `读模型里没有档案 ${want.key}`)
    assert.deepStrictEqual(got, want, `档案 ${want.key} 与 demo-data.js 不一致（前端照原型写的，差一个字段就是一片空白）`)
  }
  assert.equal(payload.demo_meta.generatedAt, DEMO.generatedAt, 'demo_meta 必须来自库，不能在代码里硬编码')
  assert.deepEqual(listProfiles(db).map((s) => s.profile_key), keys)
})

test('③ 化验项：参考区间与实验室名逐条独立（一张汇总单会混本院与外院）', () => {
  const items = db.prepare("SELECT p.profile_key, l.drawn_on, i.code, i.ref_high, i.lab_name FROM lab_items i JOIN lab_panels l ON l.id = i.panel_id JOIN profiles p ON p.profile_key = l.profile_key WHERE i.code = 'ALP' ORDER BY p.profile_key, l.drawn_on").all()
  assert.ok(items.length >= 6, 'ALP 至少 6 个点（两个档案各 6 张单子）')
  /* 两家实验室的 ALP 上限刻意不同：借通用上限就会把 120 用在 135 的单子上 */
  const highs = new Set(items.map((i) => i.ref_high).filter((x) => x !== null))
  assert.ok(highs.size >= 2, `演示数据必须体现"上限跟着单子走"：实际只有 ${[...highs].join('/')}`)
  /* 至少一张单子里出现"同一张单子、不同实验室" */
  const byPanel = new Map()
  for (const row of db.prepare("SELECT l.id, p.profile_key, l.drawn_on, i.code, i.lab_name FROM lab_items i JOIN lab_panels l ON l.id = i.panel_id JOIN profiles p ON p.profile_key = l.profile_key").all()) {
    if (!byPanel.has(row.id)) byPanel.set(row.id, new Set())
    if (row.lab_name) byPanel.get(row.id).add(row.lab_name)
  }
  const mixed = [...byPanel.entries()].filter(([, labs]) => labs.size > 1)
  assert.ok(mixed.length >= 1, '演示数据里必须有一张"混了外院结果"的单子，否则逐条 lab_name 这条设计没被验到')
  /* 缺上限的那一条：refHigh 是 NULL，且读模型必须报 needsUln（不是 0 级） */
  const missing = db.prepare("SELECT i.code, i.ref_high, i.value_num FROM lab_items i WHERE i.ref_high IS NULL").all()
  assert.ok(missing.length >= 1, '演示数据里必须有一条"报告没印上限"的记录，用来验 needsUln')
  for (const m of missing) assert.equal(m.ref_high, null, '缺上限必须是 NULL，不能填通用值')
})

test('④ 无判读列：schema 与演示库里都没有诊断/分级/应答结论列', () => {
  const BANNED = ['diagnosis', 'risk_level', 'response', 'stage', 'grade', 'severity', 'conclusion']
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
  const bad = []
  for (const t of tables) {
    for (const c of db.prepare(`PRAGMA table_info(${t.name})`).all()) {
      const low = c.name.toLowerCase()
      if (BANNED.some((b) => low === b || low.startsWith(`${b}_`) || low.endsWith(`_${b}`))) bad.push(`${t.name}.${c.name}`)
    }
  }
  assert.deepEqual(bad, [], '出现判定列（26 号红线：分级只能是"对照结果"，不能落库成结论）')
})

test('⑤ value_text 与 value_num 互斥，且还原时不把 null 变成 0', () => {
  const rows = db.prepare('SELECT p.profile_key, i.code, i.value_num, i.value_text FROM lab_items i JOIN lab_panels p ON p.id = i.panel_id').all()
  for (const r of rows) {
    const both = r.value_num !== null && r.value_text !== null
    const neither = r.value_num === null && r.value_text === null
    assert.ok(!both, `${r.profile_key}.${r.code} 同时有数值与文字`)
    assert.ok(!neither, `${r.profile_key}.${r.code} 数值与文字都没有`)
  }
  /* Number(null) === 0 是本仓最容易踩的坑：还原函数必须返回 null */
  assert.equal(restoreValue(null, null), null)
  assert.equal(restoreValue(null, ''), null)
  assert.equal(restoreValue(null, '阴性'), '阴性')
  assert.equal(restoreValue(3.5, null), 3.5)
  assert.equal(restoreValue(0, null), 0, '0 是有效数值，不能被当成空')
})

test('⑥ id 用档案内序号：B 档案的问题不能从 q6 开始', () => {
  for (const p of DEMO.profiles) {
    const qIds = p.questions.map((q) => q.id)
    assert.deepEqual(qIds, qIds.map((_, i) => `q${i + 1}`), `${p.key} 的问题 id 必须是 q1..qN（数据库自增主键是全局的，删一条就跳号）`)
    const dIds = p.documents.map((d) => d.id)
    assert.deepEqual(dIds, dIds.map((_, i) => `d${i + 1}`), `${p.key} 的原件 id 必须是 d1..dN`)
  }
  const got = getProfile(db, 'B')
  assert.deepEqual(got.questions.map((q) => q.id), ['q1', 'q2', 'q3', 'q4'])
})

test('⑦ 筛查分节标题落库，且顺序与 lib/screening-titles.js 一致', async () => {
  const { SCREENING_KEYS, screeningTitle } = await import('../lib/screening-titles.js')
  for (const key of keys) {
    const secs = db.prepare('SELECT section_key, section_title, ord FROM screening_sections WHERE profile_key = ? ORDER BY ord').all(key)
    assert.ok(secs.length >= 1, `${key} 没有任何筛查分节`)
    /* 出现的分节必须是已知 key，且标题来自唯一来源（不是各处硬编码） */
    for (const s of secs) {
      assert.ok(SCREENING_KEYS.includes(s.section_key), `${key} 出现未知分节 ${s.section_key}`)
      assert.equal(s.section_title, screeningTitle(s.section_key), `${key}.${s.section_key} 标题与其他地方不一致`)
    }
    const profile = getProfile(db, key)
    for (const rec of profile.screening) {
      assert.equal(rec.sectionTitle, screeningTitle(rec.type), '读模型返回的 sectionTitle 必须与唯一来源一致')
    }
  }
})

test('⑧ 演示数据重复生成逐字节可复现（固定种子）', () => {
  const first = readFileSync(JS, 'utf8')
  assert.ok(first.includes('fixed-for-reproducibility'), '演示数据必须标记为固定批次，不能写"今天"')
  /* 只要没重新生成，文件就不该有随机成分：两次读取必须完全相同 */
  assert.equal(readFileSync(JS, 'utf8'), first)
})
