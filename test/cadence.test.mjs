/* 复查节奏节点的边界（HVT-REVIEW §3 的 A 层缺口之一）。
 *
 * 这里要钉住的不是"能不能算出来"，而是**算出来的那一天用户会不会白跑一趟**：
 *   ① 月末夹取：1/31 + 1 个月 = 2 月末（不是 3/3 —— JS 原生 setMonth 会溢出）；
 *   ② 本地日期格式化：必须手拼 `YYYY-MM-DD`，不能用 toISOString()
 *      （东八区本地零点走 UTC 会退成前一天，用户按它约复查会早一天）；
 *   ③ 节点从"开始用药日"起算，不是"上次复查 + 间隔"（改起点整体平移，这是刻意的）；
 *   ④ 闰年 2/29 起算不得跳成 3/1 之后再也没回到月末。
 *
 * 用法：node --test test/cadence.test.mjs   （读 public/app.js）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadDeclarations } from './_extract.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = readFileSync(join(ROOT, 'public/app.js'), 'utf8')
const { cadenceNodes } = loadDeclarations(SRC, ['cadenceNodes'])

const nodesOf = (startedAt) => cadenceNodes({ startedAt })

test('① 起点 + 6 个月 / + 12 个月，日期逐字符正确', () => {
  const nodes = nodesOf('2024-03-20')
  assert.equal(nodes.length, 2)
  assert.equal(nodes[0].date, '2024-09-20')
  assert.equal(nodes[1].date, '2025-03-20')
  assert.match(nodes[0].label, /6 个月/)
  assert.match(nodes[1].label, /12 个月/)
  /* 备注必须写清"±30 天是显示带宽" —— 否则用户会把那天当成硬期限 */
  assert.match(nodes[0].note, /±30 天/)
})

test('② 月末夹取：1/31 + 1 月落到 2 月末，不溢出到 3 月', () => {
  /* 直接钉住最容易出事的形态：起点是 31 号、目标是 30 天或 31 天的月份 */
  assert.equal(nodesOf('2025-01-31')[0].date, '2025-07-31', '1/31 + 6 = 7/31')
  assert.equal(nodesOf('2025-08-31')[0].date, '2026-02-28', '8/31 + 6 = 2 月末（不是 3/3）')
  assert.equal(nodesOf('2025-03-31')[1].date, '2026-03-31', '+12 个月回到同一天')
})

test('③ 闰年 2/29 起算：+6 落在 8/29，+12 落在次年 2 月末（夹取），不是 3/1', () => {
  const nodes = nodesOf('2024-02-29')
  assert.equal(nodes[0].date, '2024-08-29')
  assert.equal(nodes[1].date, '2025-02-28', '闰日起算 +12 个月必须夹到 2 月末，不能溢出成 3/1')
})

test('④ 本地日期不许走 UTC：这些节点在 UTC 格式化下会少一天', () => {
  /* 东八区本地 00:00 的 Date，toISOString().slice(0,10) 会给出前一天。
     下面每一个都是"走 UTC 就会错"的样本，全部断言正确值。 */
  const cases = [
    ['2024-03-20', 0, '2024-09-20'],
    ['2024-01-01', 0, '2024-07-01'],
    ['2025-12-31', 0, '2026-06-30'],
  ]
  for (const [startedAt, i, want] of cases) {
    assert.equal(nodesOf(startedAt)[i].date, want, `${startedAt} +${i === 0 ? 6 : 12} 个月应为 ${want}`)
  }
  /* 反向证明：如果实现里用了 toISOString，下面这条会变成 2024-09-19 */
  assert.notEqual(nodesOf('2024-03-20')[0].date, '2024-09-19', '出现了 UTC 退一天的旧 bug')
})

test('⑤ 节点只由「开始用药日」决定，与今天、与上次复查无关', () => {
  /* 同一份数据跑两次必须一致（没有隐式 now） */
  assert.deepEqual(nodesOf('2024-03-20'), nodesOf('2024-03-20'))
  /* 备注里写明起点，用户才能理解"改起点会整体平移" */
  assert.match(nodesOf('2024-03-20')[0].note, /起点 2024-03-20/)
})

test('⑥ 起止日期跨年、跨闰年都不产生非法日期（无 0 月、无 32 日）', () => {
  for (const startedAt of ['2023-12-31', '2024-02-29', '2025-01-31', '2026-08-31']) {
    for (const n of nodesOf(startedAt)) {
      assert.match(n.date, /^\d{4}-\d{2}-\d{2}$/, `${startedAt} 产出了非法日期 ${n.date}`)
      const [y, m, d] = n.date.split('-').map(Number)
      assert.ok(m >= 1 && m <= 12, `${n.date} 月份非法`)
      assert.ok(d >= 1 && d <= 31, `${n.date} 日期非法`)
      /* 真正的合法性校验：往返一次必须相等（2/30 这种会被 Date 自动进位） */
      const back = new Date(`${n.date}T00:00:00`)
      assert.equal(
        `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}-${String(back.getDate()).padStart(2, '0')}`,
        n.date,
        `${n.date} 是不存在的日期`,
      )
    }
  }
})
