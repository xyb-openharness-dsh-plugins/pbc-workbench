/* 临床试验三档对照（lib/trial-match.js）——**逐条测档位，不只测最终结论**。
 *
 * 与 test/trial-match.test.mjs（分层匹配 dsh/match.js）的分工：
 *   - 分层匹配回答"这条登记跟我有没有关系"（结构化 > 文本 > 宽口径）；
 *   - 三档对照回答"登记的入排条款跟我的记录一致吗"（符合 / 冲突 / 待确认）。
 *
 * 为什么必须逐条测：家族 PF-ILD 仓踩过一次"两个错误恰好抵消"——事实侧把「未在用」
 * 当成事实存在、条款侧没识别「排除…者」，两边各错一次，四条全绿而结论相反。
 * 只测总数抓不到这种错，所以这里每个用例都断言到 `rows[i].tier` 与 `why`。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TIERS, factsOf, criteriaOf, matchCriterion, matchTrial, matchAll } from '../lib/trial-match.js'

const facts = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { valueText: v, source: 'test' }]))

test('① 抗体「未检测」是一个真实状态，不能变成阴性', () => {
  const f = factsOf({ antibodies: { ama: 'untested', amaM2: 'untested', note: '未查' } })
  assert.equal(f.ama.valueText, '未检测')
  assert.equal(f.ama_m2.valueText, '未检测')
})

test('② 没记录的事实不出现（缺 ≠ 否）', () => {
  const f = factsOf({ antibodies: {}, labs: [], meds: [] })
  assert.equal(f.alp, undefined)
  assert.equal(f.udca_use, undefined)
  assert.equal(f.cirrhosis, undefined)
})

test('③ 弹性成像 8.4 kPa 不等于肝硬化（真实误判，实测踩过）', () => {
  const f = factsOf({ fibrosis: { value: '8.4 kPa', date: '2026-04-18' } })
  assert.equal(f.fibrosis.valueText, '8.4 kPa', '原文要留着展示')
  assert.equal(f.cirrhosis, undefined, '8.4 kPa 不能派生出"肝硬化"这个事实')
})

test('④ 只有报告原文写了「肝硬化」才有 cirrhosis 事实', () => {
  const f = factsOf({ fibrosis: { value: '肝硬化（报告原文）', date: '2026-01-02' } })
  assert.match(f.cirrhosis.valueText, /是/)
  assert.match(f.cirrhosis.valueText, /肝硬化/)
})

test('⑤ 用药「全标已停」要表达成未在用，不能消失', () => {
  const f = factsOf({ meds: [{ name: 'UDCA', inUse: false }] })
  assert.match(f.udca_use.valueText, /未在用/)
})

test('⑥ decidable=0 的条款永远落「待确认」，且 why 必须说清原因', () => {
  const r = matchCriterion({ rule_text: '纳入/排除原文', fact_key: null, decidable: 0, undecidable_reason: '未采集' }, {})
  assert.equal(r.tier, TIERS.UNDETERMINED)
  assert.equal(r.why, '未采集')
})

test('⑦ 本机没有这一项 → 待确认，不是冲突', () => {
  const r = matchCriterion({ rule_text: '入选：AMA 阳性', fact_key: 'ama', decidable: 1 }, {})
  assert.equal(r.tier, TIERS.UNDETERMINED)
  assert.match(r.why, /缺 ≠ 不符合/)
})

test('⑧ 「未检测」落待确认，不许判成冲突（那是替患者下它没做过的结论）', () => {
  const r = matchCriterion({ rule_text: '入选：AMA 阳性', fact_key: 'ama', decidable: 1 }, facts({ ama: '未检测' }))
  assert.equal(r.tier, TIERS.UNDETERMINED)
  assert.match(r.why, /不是阴性也不是阳性/)
})

test('⑨ 正向条款：阳性→符合，阴性→冲突', () => {
  const c = { rule_text: '入选：AMA 阳性', fact_key: 'ama', decidable: 1 }
  assert.equal(matchCriterion(c, facts({ ama: '阳性' })).tier, TIERS.SATISFIED)
  assert.equal(matchCriterion(c, facts({ ama: '阴性' })).tier, TIERS.CONFLICT)
})

test('⑩ 反向条款「排除…者」：事实存在→冲突，不存在→符合', () => {
  const c = { rule_text: '排除已确诊患者（仅招健康受试者）', fact_key: 'is_patient', decidable: 1 }
  assert.equal(matchCriterion(c, facts({ is_patient: '是（已确诊）' })).tier, TIERS.CONFLICT)
  assert.equal(matchCriterion(c, facts({ is_patient: '否' })).tier, TIERS.SATISFIED)
})

test('⑪ 事实侧的「未在用」不能当成事实存在', () => {
  const c = { rule_text: '入选：正在使用 UDCA', fact_key: 'udca_use', decidable: 1 }
  assert.equal(matchCriterion(c, facts({ udca_use: '未在用（已停）' })).tier, TIERS.CONFLICT)
  assert.equal(matchCriterion(c, facts({ udca_use: '在用：UDCA' })).tier, TIERS.SATISFIED)
})

test('⑫ 三档计数之和 = 条目总数；粗筛符合度把未知项按 0 计（只会偏低）', () => {
  const criteria = [
    { rule_text: '入选：AMA 阳性', fact_key: 'ama', decidable: 1 },
    { rule_text: '纳入原文', fact_key: null, decidable: 0, undecidable_reason: '未采集' },
  ]
  const r = matchTrial({ recordId: 'T1', title: 'x', criteria }, facts({ ama: '阳性' }))
  assert.equal(r.counts.satisfied + r.counts.conflict + r.counts.undetermined, r.total)
  assert.equal(r.total, 2)
  assert.equal(r.decidable, 1)
  /* 参照 biliary-tract-workbench 改用「粗筛符合度」后，这里守的**不是"没有数字"**，
     而是"数字不许虚高"：分母含待确认，未确认的算 0 分。1 条符合 / 2 条总数 = 50%。 */
  assert.equal(r.pct, 50, '未知项必须按 0 计，否则符合度会虚高')
  assert.equal(r.band, 'needs_info')
  /* 仍然不许出现这些词：它们会把粗筛读成资格判定 */
  for (const banned of ['suitability', 'eligible', 'enrollable', 'recommendation']) {
    assert.ok(!(banned in r), `结果里不该有 ${banned}`)
  }
})

test('⑫b 硬性条件不满足 → 单列 ineligible，且不从三档里删掉', () => {
  const criteria = [{ rule_text: '排除已确诊患者', fact_key: 'is_patient', decidable: 1, hard: 1 }]
  const r = matchTrial({ recordId: 'T', title: 'x', criteria }, facts({ is_patient: '是（已确诊）' }))
  assert.equal(r.band, 'ineligible')
  assert.equal(r.hardUnmet, 1)
  assert.equal(r.counts.conflict, 1, '三档计数照旧，硬性单列只是视图分组')
})

test('⑬ 按传入顺序返回，不按档位排（排序即推荐）', () => {
  const trials = [
    { recordId: 'T-conflict', title: 'b', criteria: [{ rule_text: '排除已确诊患者', fact_key: 'is_patient', decidable: 1 }] },
    { recordId: 'T-satisfied', title: 'a', criteria: [{ rule_text: '入选：AMA 阳性', fact_key: 'ama', decidable: 1 }] },
  ]
  const out = matchAll(trials, facts({ is_patient: '是', ama: '阳性' }))
  assert.deepEqual(out.map((x) => x.recordId), ['T-conflict', 'T-satisfied'])
})

test('⑭ 健康受试者登记 → 抽出一条反向条款', () => {
  const c = criteriaOf({ title: '某某片健康受试者生物等效性试验' })
  assert.ok(c.some((x) => /排除已确诊患者/.test(x.rule_text)))
})

test('⑮ 未写病种词的登记 → 不硬造"病种一致"条款', () => {
  const c = criteriaOf({ title: '某药治疗慢性肝病的 II 期研究' })
  assert.ok(!c.some((x) => /登记病种与本人诊断一致/.test(x.rule_text)))
})

test('⑯ 永远有一条「纳入/排除原文」且 decidable=0（本项目未采集）', () => {
  for (const title of ['PBC 研究', '健康受试者试验', '']) {
    const c = criteriaOf({ title })
    const last = c[c.length - 1]
    assert.equal(last.fact_key, null)
    assert.equal(last.decidable, 0)
    assert.match(last.undecidable_reason, /未抓纳入排除原文/)
  }
})

test('⑰ 标题提到肝硬化时认的是 cirrhosis 不是 fibrosis', () => {
  const c = criteriaOf({ title: '奥贝胆酸用于 PBC 肝硬化患者' }).find((x) => /肝硬化/.test(x.rule_text))
  assert.ok(c, '应抽出一条肝硬化条款')
  assert.equal(c.fact_key, 'cirrhosis', '用 fibrosis 会把弹性值当肝硬化')
})
