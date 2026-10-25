/* 分级对照的边界（HVT-REVIEW §3 列的 A 层缺口之一）。
 *
 * 本仓唯一会"算数"的地方就是这里，所以它必须逐点钉住。
 * 三条口径：
 *   ① ×ULN 型（ALP/ALT/AST/TBil/Cr）：`ratio > cut` 才算跨档，等于档位线仍留在下一档
 *      —— 120/40 = 3.0 恰好等于 3×ULN，属 1 级；120.1/40 才进 2 级。
 *   ② 缺参考上限 → `needsUln`，**绝不**用通用上限补（补了就是把别人的正常值当你家的）。
 *   ③ 绝对阈值型（PLT/Hb/WBC/ANC/ALB）：缺个人下限时用通用下限近似，但必须带 `approx:true`
 *      让界面写明"这是通用下限，不是你报告上的"。
 *
 * 用法：node --test test/ctcae.test.mjs   （读 public/app.js，前置 npm run build:public）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadDeclarations } from './_extract.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = readFileSync(join(ROOT, 'public/app.js'), 'utf8')
const { gradeOf, GRADE_CODES, GENERIC_LOW, num } = loadDeclarations(SRC, ['GENERIC_LOW', 'GRADE_CODES', 'gradeOf', 'num'])

const uln = (code, value, refHigh) => gradeOf({ code, value, refHigh })
const abs = (code, value, refLow) => gradeOf({ code, value, refLow })

test('① ×ULN：比值正好等于档位线仍留在下一档（3.0×ULN 是 1 级，不是 2 级）', () => {
  assert.deepEqual(uln('ALP', 120, 40).grade, 1, '120/40 = 3.0 → 1 级')
  assert.deepEqual(uln('ALP', 120.1, 40).grade, 2, '120.1/40 > 3 → 2 级（差 0.1 就要跨档）')
  assert.equal(uln('ALP', 40, 40).grade, 0, '等于上限是 0 级（未越出）')
  assert.equal(uln('ALP', 40.1, 40).grade, 1, '刚过上限就是 1 级')
})

test('② ×ULN 四档全覆盖（ALP 的 1/3/5/20 倍）', () => {
  const cases = [
    [40, 0], [80, 1], [120, 1], [121, 2], [200, 2], [201, 3], [400, 3], [801, 4], [10000, 4],
  ]
  for (const [value, want] of cases) {
    assert.equal(uln('ALP', value, 40).grade, want, `ALP ${value}/40 应为 ${want} 级`)
  }
  /* 4 级封顶：20 倍以上不再往上加（界面只有四级） */
  assert.equal(uln('ALP', 40 * 21, 40).grade, 4)
})

test('③ TBil 与 Cr 的档位与 ALP 不同，不能共用一张表', () => {
  assert.equal(uln('TBil', 20, 20).grade, 0)
  assert.equal(uln('TBil', 21, 20).grade, 1)
  assert.equal(uln('TBil', 31, 20).grade, 2, 'TBil 1.5 倍即 2 级')
  assert.equal(uln('TBil', 61, 20).grade, 3, 'TBil 3 倍即 3 级')
  assert.equal(uln('TBil', 201, 20).grade, 4, 'TBil 10 倍即 4 级')
  assert.equal(uln('Cr', 61, 60).grade, 1, 'Cr 刚过 1 倍线是 1 级')
  assert.equal(uln('Cr', 100, 60).grade, 2, 'Cr 越过 1.5 倍线是 2 级')
  assert.equal(uln('Cr', 200, 60).grade, 3, 'Cr 越过 3 倍线是 3 级')
  assert.equal(uln('Cr', 400, 60).grade, 4, 'Cr 越过 6 倍线是 4 级（ALP 要 20 倍才 4 级）')
  assert.equal(GRADE_CODES.TBil.cuts.join(','), '1,1.5,3,10')
  assert.equal(GRADE_CODES.Cr.cuts.join(','), '1,1.5,3,6')
})

test('④ 缺参考上限 → needsUln，绝不借用通用上限', () => {
  const got = uln('ALP', 212, null)
  assert.equal(got.state, 'needsUln')
  assert.ok(!('grade' in got), 'needsUln 不许带 grade：带了就会被界面画出颜色')
  /* undefined 与 null 都必须走同一个分支（演示数据里两种都出现过） */
  assert.equal(uln('ALP', 212, undefined).state, 'needsUln')
  assert.equal(gradeOf({ code: 'ALP', value: 212 }).state, 'needsUln')
})

test('⑤ 没有数值 / 没有分级标准，是两种不同的"没有级别"', () => {
  assert.deepEqual(gradeOf({ code: 'ALP', value: null, refHigh: 120 }), { state: 'none', reason: 'no-value' })
  assert.deepEqual(gradeOf({ code: 'ALP', value: '<5', refHigh: 120 }), { state: 'none', reason: 'no-value' }, '文字型结果不能硬转数字')
  assert.deepEqual(gradeOf({ code: 'GGT', value: 168, refHigh: 45 }), { state: 'none', reason: 'no-standard' }, 'GGT 本版不给级')
})

test('⑥ 绝对阈值型：缺个人下限时用通用下限近似，但必须标 approx', () => {
  assert.equal(abs('PLT', 92, null).approx, true, '缺下限时必须标 approx')
  assert.equal(abs('PLT', 92, 125).grade, abs('PLT', 92, null).grade, '有无个人下限，分级结果应一致')
  assert.equal(abs('PLT', 92, 125).approx, false, '有个人下限就不能再标 approx')
  assert.equal(GENERIC_LOW.PLT, 125, '通用下限表必须有 PLT，否则"借下限"其实是没借')
  const g = abs('PLT', 92, 125).grade
  assert.equal(g, 1, 'PLT 92 未低于 75 → 1 级')
  assert.equal(abs('PLT', 70, 125).grade, 2, 'PLT 70 < 75 → 2 级')
  assert.equal(abs('PLT', 40, 125).grade, 3)
  assert.equal(abs('PLT', 20, 125).grade, 4)
})

test('⑦ 绝对阈值型里 Hb / ALB 封顶 3 级（CTCAE 该两项没有 4 级界限）', () => {
  assert.equal(abs('Hb', 60, 130).grade, 3, 'Hb 再低也只有 3 级')
  assert.equal(abs('Hb', 95, 130).grade, 2)
  assert.equal(abs('Hb', 105, 130).grade, 1)
  assert.equal(abs('ALB', 18, 40).grade, 3, 'ALB 再低也只有 3 级')
  assert.equal(GRADE_CODES.Hb.maxGrade, 3)
  assert.equal(GRADE_CODES.ALB.maxGrade, 3)
})

test('⑧ num() 不把 null / 空串变成 0（Number(null)===0 是本仓最容易踩的坑）', () => {
  assert.equal(num(null), null)
  assert.equal(num(''), null)
  assert.equal(num(undefined), null)
  assert.equal(num(0), 0, '0 是有效数值')
  assert.equal(num('0'), 0)
  assert.equal(num(3.5), 3.5)
  assert.equal(num('3.5'), 3.5)
})
