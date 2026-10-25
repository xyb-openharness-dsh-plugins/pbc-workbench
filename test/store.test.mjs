/* 数据层：迁移幂等 / 播种幂等 / 资料目录校验 / 读模型契约 / 无判读列。
 *
 * 这一层是最容易被"顺手优化"改坏的地方，所以断言写得很直：
 *   - 迁移跑两次不能重跑已应用的；
 *   - 播种跑两次不能把用户的档案冲掉（幂等）；
 *   - 资料目录不能是家目录 / 下载 / 桌面 / tmp 根（写满用户的盘，且找不到）；
 *   - 没有这一节就返回 null 而不是 []（前端写的是 `p.fibrosis && ...`）。
 *
 * 用法：node --disable-warning=ExperimentalWarning --test test/store.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { close, migrate, migrationFiles, openDatabase } from '../dsh/store.js'
import { hasDemoData, seedDemo } from '../dsh/demo.js'
import { bootstrap, getProfile, listProfiles, restoreValue } from '../dsh/readmodels.js'
import { assertWorkspacePath, workspaceProblems } from '../dsh/server.js'

const tmp = mkdtempSync(join(homedir(), '.ductpal-test-'))
after(() => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 清理失败不影响结论 */ } })

test('① migrate 幂等：第二次不重跑已应用的迁移', () => {
  const db = openDatabase(':memory:')
  const first = migrate(db)
  const second = migrate(db)
  assert.deepEqual(first.executed, migrationFiles(), '首次应执行全部迁移')
  assert.deepEqual(second.executed, [], '第二次不应重跑任何迁移')
  assert.equal(second.applied.length, first.applied.length)
  close(db)
})

test('② seedDemo 幂等：跑两次只有一份档案', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  assert.equal(hasDemoData(db), false)
  const a = seedDemo(db)
  const b = seedDemo(db)
  assert.equal(a.seeded, true)
  assert.equal(a.profiles, 2)
  assert.equal(b.seeded, false, '第二次应整批跳过，绝不覆盖已有行')
  assert.match(b.reason, /跳过/)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n, 2)
  close(db)
})

test('③ 播种是单事务：中途失败不留半份档案', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  /* 传一份畸形的演示数据：第二条档案的必填字段为空 → 应整体回滚 */
  const broken = [
    { key: 'A', label: 'ok', name: '甲', diagnosedAt: '2024-01-01', antibodies: {} },
    { key: 'B', label: null, name: null, diagnosedAt: null, antibodies: {} },
  ]
  assert.throws(() => seedDemo(db, broken), /播种演示数据失败（已回滚）/)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n, 0, '回滚后不应留下第一条档案')
  close(db)
})

test('④ 资料目录校验：拒绝家目录 / 下载 / 桌面 / tmp 根与不存在的上级', () => {
  const home = homedir()
  for (const bad of [home, '/tmp', '/var', join(home, 'Downloads'), join(home, 'Desktop'), join(home, 'Documents'), '']) {
    assert.ok(workspaceProblems(bad).length > 0, `${bad || '(空)'} 应该被拒绝`)
  }
  assert.deepEqual(workspaceProblems(join(tmp, '资料')), [], '普通子目录应通过')
  assert.throws(() => assertWorkspacePath(home), (e) => e.code === 'WORKSPACE_PATH_INVALID')
})

test('⑤ 读模型：没有这一节返回 null 而不是空数组', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db)
  /* 两个演示档案都有纤维化记录；造一个没有的档案来验 null 分支 */
  db.prepare(`INSERT INTO profiles (profile_key, label, display_name, age, sex, diagnosed_on, antibody_ama, antibody_ama_m2, antibody_ana, created_at, updated_at)
    VALUES ('X','档案 X · 空','虚构',40,'女','2025-01-01','untested','untested','untested','2025-01-01','2025-01-01')`).run()
  const p = getProfile(db, 'X')
  assert.equal(p.fibrosis, null, '没有纤维化记录必须是 null，前端才写得出 p.fibrosis && ...')
  assert.deepEqual(p.labs, [], '没有化验必须是 []，前端才 map 得动')
  assert.deepEqual(p.trials, [])
  close(db)
})

test('⑥ bootstrap 的形状：profiles 是数组、字段齐全、version/build 由调用方注入', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db)
  const payload = bootstrap(db, { version: '9.9.9', build: '2099-01-01' })
  assert.ok(Array.isArray(payload.profiles))
  assert.equal(payload.version, '9.9.9', 'version 必须由调用方注入（唯一来源 lib/version.js），不能在读模型里写死')
  assert.equal(payload.build, '2099-01-01')
  for (const k of ['version', 'build', 'profiles', 'sourceStates', 'demo_meta', 'agent', 'layout']) {
    assert.ok(k in payload, `bootstrap 缺字段 ${k}`)
  }
  assert.equal(payload.layout.agentPane.default, 0.35, '面板宽度来自 lib/layout.js 的唯一来源')
  assert.deepEqual(listProfiles(db).map((s) => s.profile_key), ['A', 'B'])
  close(db)
})

test('⑦ restoreValue 绝不把 null 变成 0（Number(null) === 0 是本仓第一号坑）', () => {
  assert.equal(restoreValue(null, null), null)
  assert.equal(restoreValue(undefined, undefined), null)
  assert.equal(restoreValue(null, ''), null)
  assert.equal(restoreValue(0, null), 0)
  assert.equal(restoreValue(null, '阴性'), '阴性')
})

test('⑧ 打开真实文件库：目录自动创建，迁移落盘，关库后可重开', () => {
  const dir = join(tmp, '库')
  /* 真实用法里是 Workbench.open() 先建目录再开库 —— 库文件不会自己长出目录 */
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'xyb-pbc.sqlite')
  const db = openDatabase(file)
  migrate(db)
  seedDemo(db)
  const n = db.prepare('SELECT COUNT(*) AS n FROM lab_items').get().n
  close(db)
  const again = openDatabase(file)
  assert.equal(migrate(again).executed.length, 0, '重开不该重跑迁移')
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM lab_items').get().n, n)
  close(again)
})
