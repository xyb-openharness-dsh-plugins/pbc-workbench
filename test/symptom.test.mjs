/* 痒与累的表达面（HVT-REVIEW §3 的 A 层缺口之一）。
 *
 * 这一节最容易做错的地方不是"记不下来"，而是**记下来之后悄悄变了味道**：
 *   ① 瘙痒/乏力被套上 CTCAE 分级（本仓口径：不套，因为这两项没有绝对数值界限，
 *      界面不许出现「N 级」）；
 *   ② 自由描述被强行必填、或被截断（患者写"夜里三点痒醒，抓破了小腿"这种句子，
 *      是这一节最有价值的东西，不能因为它是自由文本就丢）；
 *   ③ 0 分与"没记"混为一谈（0 是"今天完全不痒"，null 是"今天没记"，
 *      两者在趋势图上是一条贴底线和一段空缺，含义完全不同）；
 *   ④ 私密记录（visibility='private'）在默认视图里被漏出来。
 *
 * 用法：node --test test/symptom.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { dirname } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { getProfile } from '../dsh/readmodels.js'
import { migrate } from '../dsh/store.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCHEMA = join(ROOT, 'schema')
const tmp = mkdtempSync(join(homedir(), '.ductpal-sym-'))
process.on('exit', () => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 忽略 */ } })

function freshDb() {
  const db = new DatabaseSync(join(tmp, `t-${Math.random().toString(36).slice(2)}.sqlite`))
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db, { dir: SCHEMA })
  db.prepare("INSERT INTO profiles (profile_key, label, display_name, age, sex, diagnosed_on, started_on, weight_kg, created_at, updated_at) VALUES ('A','档案 A','虚构患者甲',52,'女','2024-03-12','2024-03-20',58,'2026-10-25','2026-10-25')").run()
  return db
}

let ord = 0
function addSymptom(db, fields) {
  ord += 1
  db.prepare(`INSERT INTO symptom_logs
    (profile_key, logged_on, itch_0_10, fatigue_1_3, night_worse, scratch_skin, sleep_breaks, note, visibility, created_at, ord)
    VALUES ('A',?,?,?,?,?,?,?,?, '2026-10-25T00:00:00Z', ?)`).run(
    fields.date, fields.itch ?? null, fields.fatigue ?? null,
    fields.nightWorse ?? null, fields.scratch ?? null, fields.sleepBreaks ?? null,
    fields.note ?? null, fields.visibility ?? 'shared', ord,
  )
}

test('① 0 分与「没记」必须区分：0 是贴底的一条线，null 是空缺', () => {
  const db = freshDb()
  addSymptom(db, { date: '2026-10-01', itch: 0, fatigue: 1 })
  addSymptom(db, { date: '2026-10-02', note: '今天没记分数，只写了句子' })
  const p = getProfile(db, 'A')
  const zero = p.symptoms.find((s) => s.date === '2026-10-01')
  const blank = p.symptoms.find((s) => s.date === '2026-10-02')
  assert.equal(zero.itch, 0, '0 分必须原样保留，不能被当成"空"')
  assert.equal(blank.itch, null, '"没记"必须是 null，不能补成 0')
  assert.notEqual(zero.itch, blank.itch, '两者在数据结构上必须可分')
  db.close()
})

test('② 自由描述可空、可长、原样保留（不截断、不总结）', () => {
  const db = freshDb()
  const long = '夜里三点痒醒，抓破了小腿外侧，抹了润肤的才睡着；早上起来看有两条血印子，白天还行，傍晚又开始痒'
  addSymptom(db, { date: '2026-10-03', itch: 7, fatigue: 3, note: long })
  addSymptom(db, { date: '2026-10-04', itch: 3, fatigue: 2 })
  const p = getProfile(db, 'A')
  const withNote = p.symptoms.find((s) => s.date === '2026-10-03')
  const noNote = p.symptoms.find((s) => s.date === '2026-10-04')
  assert.equal(withNote.note, long, '自由描述必须原样保留')
  assert.ok(withNote.note.length > 40)
  assert.equal(noNote.note, '', '没写就回空串，不是 null 也不是"无"')
  db.close()
})

test('③ 未记的布尔项是 null，不是 false（"没勾"与"勾了没有"是两件事）', () => {
  const db = freshDb()
  addSymptom(db, { date: '2026-10-05', itch: 5, fatigue: 2 })
  addSymptom(db, { date: '2026-10-06', itch: 5, fatigue: 2, nightWorse: 0, scratch: 0, sleepBreaks: 0 })
  const p = getProfile(db, 'A')
  const unset = p.symptoms.find((s) => s.date === '2026-10-05')
  const set0 = p.symptoms.find((s) => s.date === '2026-10-06')
  assert.equal(unset.nightWorse, null, '没记 → null')
  assert.equal(set0.nightWorse, false, '记了"没有" → false')
  assert.equal(unset.sleepBreaks, null)
  assert.equal(set0.sleepBreaks, 0, '睡被打断 0 次是有效数值')
  db.close()
})

test('④ 瘙痒 0–10、乏力 1–3 由库层拦越界（界面拦不住手输）', () => {
  const db = freshDb()
  for (const [field, value] of [['itch', 11], ['itch', -1], ['fatigue', 0], ['fatigue', 4]]) {
    assert.throws(
      () => addSymptom(db, { date: '2026-10-07', [field]: value }),
      /CHECK|constraint/i,
      `${field}=${value} 应该被库层拦住`,
    )
  }
  /* 边界值本身合法 */
  assert.doesNotThrow(() => addSymptom(db, { date: '2026-10-08', itch: 10, fatigue: 3 }))
  assert.doesNotThrow(() => addSymptom(db, { date: '2026-10-09', itch: 0, fatigue: 1 }))
  db.close()
})

test('⑤ 私密记录默认不出现，显式 includePrivate 才出现', () => {
  const db = freshDb()
  addSymptom(db, { date: '2026-10-10', itch: 4, fatigue: 1, note: '可以给医生看的' })
  addSymptom(db, { date: '2026-10-11', itch: 9, fatigue: 3, note: '这条只给自己看', visibility: 'private' })
  const plain = getProfile(db, 'A')
  const full = getProfile(db, 'A', { includePrivate: true })
  assert.equal(plain.symptoms.length, 1, '默认视图漏出了私密记录')
  assert.ok(!plain.symptoms.some((s) => s.note === '这条只给自己看'))
  assert.equal(full.symptoms.length, 2)
  assert.ok(full.symptoms.some((s) => s.note === '这条只给自己看'), '显式要求私密时必须给')
  /* private 只是可见性，内容不变（不能因为私密就抹掉分数） */
  const priv = full.symptoms.find((s) => s.note === '这条只给自己看')
  assert.equal(priv.itch, 9)
  assert.equal(priv.visibility, 'private')
  db.close()
})

test('⑥ 记录按日期倒序（最近一次在最上面），同日按录入顺序倒序', () => {
  const db = freshDb()
  addSymptom(db, { date: '2026-10-01', itch: 2 })
  addSymptom(db, { date: '2026-10-15', itch: 6 })
  addSymptom(db, { date: '2026-10-01', itch: 3 })
  const p = getProfile(db, 'A')
  assert.deepEqual(p.symptoms.map((s) => s.date), ['2026-10-15', '2026-10-01', '2026-10-01'])
  /* 同一天两条：后录的那条在前（rowid DESC），否则"今天补记"会藏在中间 */
  assert.deepEqual(p.symptoms.filter((s) => s.date === '2026-10-01').map((s) => s.itch), [3, 2])
  db.close()
})

test('⑦ 痒/累的记录里不产生任何分级字段（不套 CTCAE）', () => {
  const db = freshDb()
  addSymptom(db, { date: '2026-10-12', itch: 10, fatigue: 3, note: '很难受' })
  const s = getProfile(db, 'A').symptoms[0]
  for (const banned of ['grade', 'severity', 'ctcae', 'level', 'risk']) {
    assert.ok(!(banned in s), `痒/累记录里出现了 ${banned}：本仓口径是不套 CTCAE，界面不许出现「N 级」`)
  }
  db.close()
})
