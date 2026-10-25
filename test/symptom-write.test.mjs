/* 症状写入通路——闭环的"记录"半环。
 *
 * 为什么单独一个文件：独立评审实测出「患者记一次痒，刷新即丢」——
 * 前端只有 1 个 fetch(/bootstrap)，后端 5 个路由全 GET，`dsh/workbench.js` 没有写入方法，
 * 前端"保存"是内存假动作（toast 自己承认不落库）。这类缺口不能靠"文档写了"补上，
 * 必须有能证明"写完再读还在"的测试。
 *
 * 四条断言轴：①真的进了库并能读回 ②0 分 ≠ 没记 ③坏输入必须 400 而不是静默存进去
 * ④删掉就是真删（更正语义）。全程真库、真 HTTP，不 mock。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { Workbench } from '../dsh/workbench.js'
import { startWorkbenchServer } from '../dsh/server.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

async function withServer(fn) {
  const tmp = mkdtempSync(join(homedir(), '.ductpal-sym-'))
  const wb = await Workbench.open(join(tmp, 'ws'))
  const started = await startWorkbenchServer({ port: 0, workbench: wb })
  const base = `${started.url.replace(/\/$/, '')}/api/pbc-workbench`
  try {
    await fn({ wb, base, tmp })
  } finally {
    started.server.closeAllConnections()
    await new Promise((r) => started.server.close(r))
    wb.close()
    rmSync(tmp, { recursive: true, force: true })
  }
}

const postJson = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('① 记一条痒 → 真进库 → 读回能看到（刷新不丢）', async () => {
  await withServer(async ({ wb, base }) => {
    const before = wb.getProfile('A', { includePrivate: true }).symptoms.length
    const res = await postJson(`${base}/symptoms`, {
      profileKey: 'A', date: '2026-10-25', itch: 7, fatigue: 2, nightWorse: true, note: '夜里痒醒了两次',
    })
    assert.equal(res.status, 201)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.saved.persisted, true, '有资料目录时必须真的落盘')

    /* 从**库**读回来，不从响应里读——响应只能证明接口没挂 */
    const after = wb.getProfile('A', { includePrivate: true }).symptoms
    assert.equal(after.length, before + 1)
    const newest = after[0]
    assert.equal(newest.date, '2026-10-25')
    assert.equal(newest.itch, 7)
    assert.equal(newest.fatigue, 2)
    assert.equal(newest.nightWorse, true)
    assert.equal(newest.note, '夜里痒醒了两次')
  })
})

test('② 0 分是有效记录，不是"没记"；没填的字段必须是 null 而不是 false/0', async () => {
  await withServer(async ({ wb, base }) => {
    await postJson(`${base}/symptoms`, { profileKey: 'A', date: '2026-10-24', itch: 0 })
    const newest = wb.getProfile('A', { includePrivate: true }).symptoms[0]
    /* 关键：0 是"我今天不痒"，和 null"没记"在临床回顾里完全不同 */
    assert.equal(newest.itch, 0)
    assert.equal(newest.fatigue, null, '没填的累必须是 null，不能变成 0 或 false')
    assert.equal(newest.nightWorse, null, '没勾的夜间加重是"没记"，不是"否"')
    assert.equal(newest.scratch, null)
    assert.equal(newest.sleepBreaks, null)
    assert.equal(newest.note, '')
  })
})

test('③ 坏输入必须 400 且带字段名，不能静默存进去', async () => {
  await withServer(async ({ wb, base }) => {
    const before = wb.getProfile('A', { includePrivate: true }).symptoms.length
    const cases = [
      [{ itch: 11 }, 'itch'],
      [{ itch: -1 }, 'itch'],
      [{ fatigue: 4 }, 'fatigue'],
      [{ date: '2026-02-30' }, 'date'],
      [{ date: '2026/10/25' }, 'date'],
      [{ date: '' }, 'date'],
    ]
    for (const [patch, field] of cases) {
      const res = await postJson(`${base}/symptoms`, { profileKey: 'A', date: '2026-10-25', itch: 3, ...patch })
      assert.equal(res.status, 400, `应回 400：${JSON.stringify(patch)}`)
      const body = await res.json()
      assert.equal(body.error, 'VALIDATION_FAILED')
      assert.equal(body.field, field, `错误要挂到具体控件上：${JSON.stringify(patch)}`)
    }
    /* 一条都没填也是错：空记录会让"今天记过"变成假事实 */
    const empty = await postJson(`${base}/symptoms`, { profileKey: 'A', date: '2026-10-25' })
    assert.equal(empty.status, 400)
    /* 不存在的档案 */
    const noProf = await postJson(`${base}/symptoms`, { profileKey: 'ZZZ', date: '2026-10-25', itch: 3 })
    assert.equal(noProf.status, 400)
    /* 关键：这些失败一条都不能落地 */
    assert.equal(wb.getProfile('A', { includePrivate: true }).symptoms.length, before, '坏输入被写进了库')
  })
})

test('④ 私密标记是数据结构属性：落库可查，但默认读模型不给', async () => {
  await withServer(async ({ wb, base }) => {
    await postJson(`${base}/symptoms`, {
      profileKey: 'A', date: '2026-10-23', itch: 5, note: '不想让别人看见的一句', visibility: 'private',
    })
    const shared = wb.getProfile('A', { includePrivate: false }).symptoms
    const full = wb.getProfile('A', { includePrivate: true }).symptoms
    assert.ok(full.some((s) => s.note === '不想让别人看见的一句'), '私密记录必须真的存下来')
    assert.ok(!shared.some((s) => s.note === '不想让别人看见的一句'), '默认读取不该给私密记录')
  })
})

test('⑤ 删掉就是真删（更正语义），删不存在的回 404', async () => {
  await withServer(async ({ wb, base }) => {
    const created = await (await postJson(`${base}/symptoms`, {
      profileKey: 'A', date: '2026-10-22', itch: 9, note: '记错了一条',
    })).json()
    const id = created.saved.id
    assert.ok(wb.getProfile('A', { includePrivate: true }).symptoms.some((s) => s.note === '记错了一条'))

    const del = await fetch(`${base}/symptoms/${id}`, { method: 'DELETE' })
    assert.equal(del.status, 200)
    assert.ok(!wb.getProfile('A', { includePrivate: true }).symptoms.some((s) => s.note === '记错了一条'))

    const again = await fetch(`${base}/symptoms/${id}`, { method: 'DELETE' })
    assert.equal(again.status, 404)
  })
})

test('⑥ 重开库之后记录还在（真的落盘，不是内存幻觉）', async () => {
  const tmp = mkdtempSync(join(homedir(), '.ductpal-sym2-'))
  let dir = ''
  try {
    dir = join(tmp, 'ws')
    const wb = await Workbench.open(dir)
    wb.addSymptom({ profileKey: 'A', date: '2026-10-21', itch: 4, note: '重启也要在' })
    wb.close()

    const wb2 = await Workbench.open(dir)
    const found = wb2.getProfile('A', { includePrivate: true }).symptoms.some((s) => s.note === '重启也要在')
    wb2.close()
    assert.ok(found, '关库再开，刚记的那条不见了——说明写的是内存')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('⑦ 演示模式（内存库）也能写，但必须如实回报 persisted=false', async () => {
  const wb = await Workbench.open(null)
  try {
    assert.equal(wb.isDemo, true)
    const saved = wb.addSymptom({ profileKey: 'A', date: '2026-10-25', itch: 6 })
    assert.equal(saved.persisted, false, '内存库不能假装写盘成功了')
    assert.equal(wb.getProfile('A', { includePrivate: true }).symptoms[0].itch, 6)
  } finally {
    wb.close()
  }
})
