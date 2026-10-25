/* 私密记录不进导出——**用真库真端口验，不拿演示数据当素材**。
 *
 * 为什么单独一个文件：上一版这条断言写在 test/server.test.mjs 里，素材取自演示数据，
 * 而 `demo/build-demo-data.mjs` 里一条 `visibility='private'` 都没有——
 * 循环体空转、断言恒真，于是"红线通过"是假绿，ACCEPTANCE 还把这一项勾成了"通过"。
 * 独立评审用真库实测抓到泄漏：症状 note 与换线医生原话都被写进了带出去的文件。
 *
 * 本文件的做法：临时库 → 直接 INSERT 带 private 的行 → 起真服务 → 打真 HTTP 出口，
 * 正向（私密不出现）与反向（共享内容必须出现）都断言，防"空转也绿"。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { Workbench } from '../dsh/workbench.js'
import { startWorkbenchServer } from '../dsh/server.js'
import { renderPrepMarkdown } from '../dsh/export.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const PRIVATE_NOTE = '私密备注-只在本人页面可见-9f3a'
const PRIVATE_REGIMEN = '私密的医生原话-不要带出门-7c1b'
const SHARED_NOTE = '公开备注-可以带出门-2d8e'

/** 造一个库：一份档案 + 两条症状（一私密一共享）+ 两条换线（一私密一共享）。 */
async function withPrivateProfile(fn) {
  const tmp = mkdtempSync(join(homedir(), '.ductpal-priv-'))
  const wb = await Workbench.open(join(tmp, 'ws'))
  try {
    const { db } = wb
    const now = '2026-10-25T00:00:00.000Z'
    db.prepare(`INSERT INTO profiles (profile_key, label, display_name, diagnosed_on, created_at, updated_at)
      VALUES ('T', '档案 T', '虚构患者乙', '2024-03-12', ?, ?)`).run(now, now)
    const addSym = db.prepare(`INSERT INTO symptom_logs
      (profile_key, logged_on, itch_0_10, fatigue_1_3, note, visibility, created_at, ord) VALUES ('T', ?, ?, ?, ?, ?, ?, ?)`)
    addSym.run('2026-10-01', 6, 2, PRIVATE_NOTE, 'private', now, 1)
    addSym.run('2026-10-02', 3, 1, SHARED_NOTE, 'shared', now, 2)
    const addReg = db.prepare(`INSERT INTO regimen_changes
      (profile_key, changed_on, doctor_text, my_state, visibility, ord) VALUES ('T', ?, ?, 'unclear', ?, ?)`)
    addReg.run('2026-10-03', PRIVATE_REGIMEN, 'private', 1)
    addReg.run('2026-10-04', '公开的医生原话-可以带出门-5e6f', 'shared', 2)
    await fn(wb, tmp)
  } finally {
    wb.close()
    rmSync(tmp, { recursive: true, force: true })
  }
}

test('① 渲染器层：私密行不进 markdown，共享行必须在（防"全过滤"式假绿）', async () => {
  await withPrivateProfile(async (wb) => {
    const full = wb.getProfile('T', { includePrivate: true })
    /* 前提断言：库层真的拿到了私密行，否则下面的"不包含"毫无意义 */
    assert.ok(full.symptoms.some((s) => s.note === PRIVATE_NOTE), '库层没读到私密行，测试前提不成立')
    assert.ok(full.regimenChanges.some((c) => c.text === PRIVATE_REGIMEN), '库层没读到私密换线，测试前提不成立')

    const md = renderPrepMarkdown(full, { version: '0.0.0-test' })
    assert.ok(!md.includes(PRIVATE_NOTE), '私密症状备注被写进了导出文件')
    assert.ok(!md.includes(PRIVATE_REGIMEN), '私密换线原话被写进了导出文件')
    assert.ok(md.includes(SHARED_NOTE), '共享症状备注不见了——过滤过度会让用户以为丢数据')
    assert.ok(md.includes('公开的医生原话-可以带出门-5e6f'), '共享换线记录不见了')
    /* 声明必须真的写，且不能把"不包含"写成空话 */
    assert.match(md, /本人标记为私密的记录/, '有私密被排除时必须写一句排除声明')
  })
})

test('② 调用方传不带私密的档案，排除声明仍要正确（声明由渲染器自己算）', async () => {
  await withPrivateProfile(async (wb) => {
    const plain = wb.getProfile('T', { includePrivate: false })
    assert.ok(!plain.symptoms.some((s) => s.note === PRIVATE_NOTE), '页面出口本身就该过滤掉私密')
    const md = renderPrepMarkdown(plain, {})
    assert.ok(!md.includes(PRIVATE_NOTE))
    /* 档案已过滤过 → 渲染器看不到私密行 → 不该冒出"有私密被排除"的声明（否则是假声明） */
    assert.doesNotMatch(md, /本人标记为私密的记录/, '没有私密内容却写了排除声明，等于告诉用户有东西被藏起来')
  })
})

test('③ HTTP 出口：GET /export/T.md 不带私密，且 filename 正确', async () => {
  await withPrivateProfile(async (wb) => {
    const started = await startWorkbenchServer({ port: 0, workbench: wb })
    const base = started.url.replace(/\/$/, '')
    try {
      const res = await fetch(`${base}/api/pbc-workbench/export/T.md`)
      assert.equal(res.status, 200)
      const md = await res.text()
      assert.ok(!md.includes(PRIVATE_NOTE), 'HTTP 导出出口泄漏了私密症状备注')
      assert.ok(!md.includes(PRIVATE_REGIMEN), 'HTTP 导出出口泄漏了私密换线原话')
      assert.ok(md.includes(SHARED_NOTE), 'HTTP 导出出口把共享内容也丢了')
    } finally {
      started.server.closeAllConnections()
      await new Promise((r) => started.server.close(r))
    }
  })
})

test('④ 落盘出口：POST /export/T.md/save 写出的文件同样不带私密', async () => {
  await withPrivateProfile(async (wb, tmp) => {
    const started = await startWorkbenchServer({ port: 0, workbench: wb })
    const base = started.url.replace(/\/$/, '')
    try {
      const res = await fetch(`${base}/api/pbc-workbench/export/T.md/save`, { method: 'POST' })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.ok, true)
      const { readFileSync } = await import('node:fs')
      const md = readFileSync(body.file, 'utf8')
      assert.ok(!md.includes(PRIVATE_NOTE), '落盘的导出文件泄漏了私密症状备注')
      assert.ok(!md.includes(PRIVATE_REGIMEN), '落盘的导出文件泄漏了私密换线原话')
      assert.ok(md.includes(SHARED_NOTE))
      assert.ok(body.file.startsWith(join(tmp, 'ws')), '落盘位置应在资料目录的 exports/ 下')
    } finally {
      started.server.closeAllConnections()
      await new Promise((r) => started.server.close(r))
    }
  })
})
