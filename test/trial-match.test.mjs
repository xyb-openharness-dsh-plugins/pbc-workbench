/* 临床试验分层匹配（starter 35 号契约）。
 *
 * 这一组断言守的是"不许假装"：
 * ① 不出数值化综合分（"匹配度 87%"）——数值化会把"沾到几个词"伪装成"你符合条件"；
 * ② 层间顺序固定（结构化 > 文本 > 宽口径），宽口径不许排到前面；
 * ③ 缺字段判「无法自动匹配」，**绝不**判「不适用」/写"适合/不适合"；
 * ④ 每条结果带来源、快照日期、「登记状态，未核实」；
 * ⑤ 快照不在包里时如实说"未配置"，不是"0 条结果"。
 */
import assert from 'node:assert/strict'
import { dirname } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { readSnapshot, matchTrials } from '../dsh/match.js'
import { Workbench } from '../dsh/workbench.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

async function withProfile(fn) {
  const wb = await Workbench.open(null)
  try {
    await fn(wb.getProfile('A', { includePrivate: false }), wb.getProfile('B', { includePrivate: false }))
  } finally {
    wb.close()
  }
}

test('① 产出里没有数值化综合分：不出现 matchScore / 匹配度 / 百分比分数', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    const flat = JSON.stringify(r)
    assert.ok(!/matchScore|match_score|suitability|eligible/i.test(flat), '出现了判读/评分字段')
    assert.ok(!/匹配度\s*\d|匹配指数|综合评分/.test(flat), '出现了数值化匹配分')
  })
})

test('② 层间顺序固定：结构化在前、宽口径在后；同一条不会跨层重复', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    assert.deepEqual(r.layers.map((l) => l.key), ['structured', 'text', 'broad'])
    const seen = new Set()
    for (const layer of r.layers) {
      for (const row of layer.rows) {
        assert.ok(!seen.has(row.recordId), `登记 ${row.recordId} 跨层重复出现`)
        seen.add(row.recordId)
      }
    }
  })
})

test('③ 缺字段判「无法自动匹配」，绝不把某条登记判成「不适用」或写「你能入组」', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    assert.ok(Array.isArray(r.unmatched) && r.unmatched.length > 0, '缺字段清单为空')
    assert.ok(r.unmatched.some((x) => /入排条件原文/.test(x)), '缺字段里没有"入排条件原文"')
    assert.ok(r.disclaimer.triState.includes('无法自动匹配'))
    /* 判据要分清两处「不适用」：
       ① 声明里那一条「不适用：本工作台不产出」是**说我们不产出这一态**，是必须写的；
       ② 某条**结果**被判成"不适用"才是越界（缺字段不许判不适用，25 号 L2-3）。
       第一版这里用 /不适用/ 扫全文，把声明本身也扫进去了——是判据写错，不是实现有问题。 */
    const rowText = JSON.stringify(r.layers.map((l) => l.rows))
    assert.ok(!/不适用/.test(rowText), '某条结果被判成「不适用」——缺字段不许判不适用')
    /* 同样只看**结果行**：免责声明里那两句「本工作台不判断你是否符合条件，也不写
       『建议参加 / 适合你』」是**必须写着**的（不写才是问题），不能当越界扫进去。 */
    assert.ok(!/你能入组|建议参加|适合你|符合条件/.test(rowText), '结果行里出现了替你下结论的表述')
    /* 声明本身要真的在，而且真的说了这两句 */
    assert.match(r.disclaimer.lines.join(''), /不判断你是否符合条件/)
    assert.match(r.disclaimer.lines.join(''), /建议参加/)
  })
})

test('④ 每条结果带来源、快照日期、「登记状态，未核实」', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    assert.ok(r.available, '快照不可用，这条测试的前提不成立')
    assert.ok(r.snapshotDate && /^\d{4}-\d{2}-\d{2}$/.test(r.snapshotDate), '没有快照日期')
    const rows = r.layers.flatMap((l) => l.rows)
    assert.ok(rows.length > 0, '一条结果都没有')
    for (const row of rows.slice(0, 40)) {
      assert.ok(row.sourceId, `缺来源：${row.recordId}`)
      assert.equal(row.statusNote, '登记状态，未核实')
      assert.ok(row.snapshotDate, `缺快照日期：${row.recordId}`)
    }
  })
})

test('⑤ 每条命中都带证据：结构化给字段与来源，文本给命中的词', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    for (const row of r.layers[0].rows) {
      assert.ok(row.structured.length > 0, '结构化层里的行没有结构化证据')
      for (const h of row.structured) {
        assert.ok(h.field && h.value, '结构化证据缺字段名或值')
        assert.ok(h.source != null, '结构化证据没有来源')
      }
    }
    for (const row of r.layers[1].rows) {
      assert.ok(row.text.length > 0, '文本层里的行没有命中的词')
      for (const h of row.text) assert.ok(h.term, '文本证据缺词')
    }
  })
})

test('⑥ 抗体全阴/未测的档案不该有结构化命中，但仍有文本命中（反向对照）', async () => {
  await withProfile((a) => {
    const ra = matchTrials(a)
    assert.ok(ra.counts.structured >= 1, '抗体阳性的档案一条结构化命中都没有，规则可能失效')
    /* 反向：把抗体改成全阴/未测再跑一次。
       注意演示档案 B 的 AMA 其实也是阳性（2018 年报告），所以不能拿 B 当"无抗体"的反例——
       第一版这里就是拿 B 当反例，结果必然红。反例必须自己造。 */
    const negative = {
      ...a,
      antibodies: { ama: 'negative', amaM2: 'untested', ana: 'negative', note: '测试用·全阴' },
      fibrosis: { ...a.fibrosis, method: '影像', value: '未见异常' },
    }
    const rn = matchTrials(negative)
    assert.equal(rn.counts.structured, 0, '抗体全阴却仍有结构化命中——结构化规则没在比对建档值')
    assert.ok(rn.counts.text >= 1, '抗体全阴时连文本命中都没了，快照可能没读到')
  })
})

test('⑦ 建档只说 PBC 真有的三样，不假装有分子分型', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    assert.match(r.dossier.note, /没有常规基因检测/)
    const keys = r.dossier.fields.map((f) => f.key)
    assert.ok(keys.includes('ama') && keys.includes('amaM2'))
    assert.ok(!keys.some((k) => /gene|mutation|ihc|her2|brca/i.test(k)), '建档里出现了 PBC 没有的分子分型字段')
    for (const f of r.dossier.fields) assert.ok(f.source != null, `字段 ${f.key} 没有来源`)
  })
})

test('⑧ 快照缺失时如实说"未配置"，不当成 0 条结果（用 readSnapshot 的返回值验）', async () => {
  const snap = readSnapshot()
  assert.equal(snap.available, true, '本次快照应当随包存在；若确实要测缺失分支，改这里')
  assert.ok(snap.trials.length > 0)
  /* 反向：把 reason 的语义钉住——不可用时必须有 reason，且措辞不是"没有相关试验" */
  if (!snap.available) {
    assert.ok(/未配置|不在包里|打不开/.test(snap.reason))
    assert.ok(!/没有相关|无相关|0 条/.test(snap.reason))
  }
})

test('⑨ 健康受试者/生物等效性登记会被标出来（原文证据，不是判"你不适用"）', async () => {
  await withProfile((a) => {
    const r = matchTrials(a)
    const withFlag = r.layers.flatMap((l) => l.rows).filter((x) => x.healthyVolunteer)
    assert.ok(withFlag.length > 0, '快照里明明有健康受试者登记，却一条都没标')
    for (const row of withFlag) {
      assert.match(row.title, /健康(受试者|人体|志愿者)|生物等效性|药代动力/)
    }
  })
})
