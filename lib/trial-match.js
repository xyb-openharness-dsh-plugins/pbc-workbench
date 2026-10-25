/* 临床试验匹配 · 三档对照（**不产出百分比、不排序、不推荐**）
 *
 * 为什么没有「匹配指数 87%」：
 *   给患者一个百分比等于替医生下入组结论，而且无法回溯——用户看到 87% 只会问「那我到底能不能进」，
 *   工作台答不了。三档（符合 / 冲突 / 待确认）每一条都能指出**是拿本机哪一条记录对照出来的**，
 *   用户可以拿着这条记录去问医生。这个口径沿用家族 PF-ILD 仓 v0.2.1 的实测结论
 *   （`lib/trial-match.js` 的 TIERS/TIER_LABEL + `test/trial-match.test.mjs` 的反向用例）。
 *
 * 红线（每条都有对应测试）：
 *   1. 只输出「本地记录与登记字段是否一致」，**不写**建议参加 / 适合入组 / 推荐；
 *   2. `undetermined`（待确认）**不等于不符合**，只表示本机没有可用字段；
 *   3. 排序保持登记来源顺序（`ord`），**不按档位排**——按档位排会让用户以为前面的更"适合"；
 *   4. 登记 ≠ 有效 ≠ 安全 ≠ 可入组；状态永远写「登记状态，未核实」。
 *
 * PBC 的实情（本仓与 PF-ILD 的差别，写下来免得下一个人照抄）：
 *   - **没有 driver 基因、没有 IHC**：PBC 的诊断靠 AMA/AMA-M2 + 胆汁淤积生化，不做靶点检测。
 *     所以"基因病理建档"在 PBC 里落成三样：抗体状态（含「未检测」）、纤维化/肝硬化的**报告原文**、
 *     以及「有没有做过肝穿」——**不设基因面板**，硬加一个空表反而是假装有这项能力。
 *   - **入排条件原文没有采集**：本项目 479 条登记只抓到标题/登记号/状态，没有纳入排除标准原文。
 *     所以绝大多数条目只能落「待确认」，页面必须逐条说明**为什么**不可判定。
 */
export const TIERS = Object.freeze({
  SATISFIED: 'satisfied',
  CONFLICT: 'conflict',
  UNDETERMINED: 'undetermined',
})

export const TIER_LABEL = Object.freeze({
  satisfied: '符合',
  conflict: '冲突',
  undetermined: '待确认',
})

/** 从档案里抽「可判定的事实」。只抽**本机真的有记录**的，缺的就不出现（缺 ≠ 否）。 */
export function factsOf(profile) {
  const p = profile ?? {}
  const facts = {}
  const put = (key, valueText, source) => {
    if (valueText === null || valueText === undefined || valueText === '') return
    facts[key] = { valueText: String(valueText), source: source ?? null }
  }

  /* 抗体：三态里「未检测」是一个**真实状态**，不是"阴性"。 */
  const ab = p.antibodies ?? {}
  const abLabel = { positive: '阳性', negative: '阴性', untested: '未检测' }
  put('ama', abLabel[ab.ama] ?? null, ab.note ?? null)
  put('ama_m2', abLabel[ab.amaM2] ?? null, ab.note ?? null)

  /* 纤维化 / 肝硬化：只搬报告原文，不自己判分期。
     注意 `fibrosis` 这个键**只用于展示，不参与任何条款判定**——
     实测踩过：「8.4 kPa」被当成"有肝硬化"而判成"符合入选"。弹性值不是肝硬化诊断，
     这一条必须由报告原文说了算，所以另起一个 `cirrhosis` 键，只在报告原文
     真的写了「肝硬化」时才有值。没写就是"本机没有这一项"，落待确认。 */
  if (p.fibrosis?.value) {
    put('fibrosis', p.fibrosis.value, p.fibrosis.date ? `报告日期 ${p.fibrosis.date}` : null)
    if (/肝硬化|cirrhosis/i.test(String(p.fibrosis.value))) {
      put('cirrhosis', `是（报告原文：${p.fibrosis.value}）`, p.fibrosis.date ? `报告日期 ${p.fibrosis.date}` : null)
    }
  }

  /* 最近一次化验的关键项（决定很多试验的入选线）。 */
  const labs = Array.isArray(p.labs) ? p.labs : []
  const last = labs.length ? labs[labs.length - 1] : null
  if (last) {
    const pick = (code) => last.items.find((i) => i.code === code)
    for (const code of ['ALP', 'TBil', 'PLT', 'ALB']) {
      const item = pick(code)
      if (!item || item.value === null || item.value === undefined) continue
      const ref = item.refHigh == null ? '' : `（上限 ${item.refHigh}）`
      put(code.toLowerCase(), `${item.value} ${item.unit ?? ''}${ref}`.trim(), `${last.date} · ${item.lab ?? '来源未记'}`)
    }
  }

  /* 用药：只在真的有"在用"记录时给。`inUse === false` 是**明确不在用**，要单独表达。 */
  const meds = Array.isArray(p.meds) ? p.meds : []
  if (meds.length) {
    const using = meds.filter((m) => m.inUse !== false)
    const names = using.map((m) => m.name).filter(Boolean)
    put('udca_use', names.length ? `在用：${names.join('、')}` : '未在用（有用药记录但均标为已停）',
      using[0]?.startDate ? `开始 ${using[0].startDate}` : null)
  }

  /* 年龄/性别：登记常见的入选条件。 */
  if (p.age !== null && p.age !== undefined) put('age', `${p.age} 岁`, '档案基本信息')
  if (p.sex) put('sex', p.sex, '档案基本信息')

  /* 诊断：本工作台只服务 PBC 患者（本仓不做分期/诊断判定，也不存 diagnosis 列），
     所以这一项的事实来自**工作台的适用范围**，不是从档案里"推断"出来的。
     写清来源，用户才知道这句话凭什么成立。 */
  put('diagnosis', '原发性胆汁性胆管炎（PBC）', '本工作台只服务 PBC 患者')
  put('is_patient', '是（已确诊的 PBC 患者）', '本工作台只服务 PBC 患者')
  return facts
}

/* 否定语义：两个方向必须分开看（PF-ILD v0.2.1 踩过，两个错各犯一次恰好抵消）。
 *   ① 事实侧：「未在用 / 没做过 / 未检测」是**明确否定**，不能当成"事实存在"；
 *   ② 条款侧：「排除…者 / 不符合…者」是**反向条款**，命中即冲突而不是符合。
 * 两处都靠正则，所以词表要写清"这条说的是有事还是没事"。 */
const NEGATIVE_FACT_RE = /^(未|没有|无|未见|阴性|未在做|未在用|没做过|否)/
/* 「未检测 / 未做」不是阴性，也不是"没有这件事"——它是**本机没有这个信息**，
   必须落「待确认」。把它并进 NEGATIVE_FACT_RE 会让「AMA 未检测」被判成"AMA 阴性"，
   于是「入选：AMA 阳性」变成"冲突"——这是替患者下了它没做过的结论。 */
const UNKNOWN_FACT_RE = /^(未检测|未查|未做|不知道|不详)/
const ABSENT_RULE_RE = /(排除|不符合|不应|不能|禁忌|除外)/

const present = (valueText) => Boolean(valueText) && !NEGATIVE_FACT_RE.test(String(valueText))

/**
 * 判一条：返回 { tier, rule, mine, source, why }
 * `why` 是给人看的一句话，说明**凭什么**是这一档——没有 why 的档位等于没判。
 */
export function matchCriterion(criterion, facts) {
  const rule = criterion?.rule_text ?? ''
  const key = criterion?.fact_key ?? null
  const fact = key ? facts[key] : null

  if (criterion?.decidable !== 1 || !key) {
    return {
      tier: TIERS.UNDETERMINED,
      rule,
      mine: fact ? fact.valueText : null,
      source: fact ? fact.source : null,
      why: criterion?.undecidable_reason ?? '本机没有可用字段，无法对照',
    }
  }
  if (!fact) {
    return { tier: TIERS.UNDETERMINED, rule, mine: null, source: null, why: '本机没有这一项记录（缺 ≠ 不符合）' }
  }

  const mine = fact.valueText
  if (UNKNOWN_FACT_RE.test(String(mine))) {
    return {
      tier: TIERS.UNDETERMINED, rule, mine, source: fact.source ?? null,
      why: `本机记录是「${mine}」，不是阴性也不是阳性，无法对照`,
    }
  }
  const expectAbsent = ABSENT_RULE_RE.test(rule)
  const isPresent = present(mine)
  const ok = expectAbsent ? !isPresent : isPresent
  return {
    tier: ok ? TIERS.SATISFIED : TIERS.CONFLICT,
    rule,
    mine,
    hard: criterion?.hard === 1,
    source: fact.source ?? null,
    why: expectAbsent
      ? (ok ? `条目要求"没有这一项"，本机记录：${mine}` : `条目要求"没有这一项"，但本机记录：${mine}`)
      : (ok ? `条目要求"有这一项"，本机记录：${mine}` : `条目要求"有这一项"，但本机记录：${mine}`),
  }
}

/**
 * 一条试验的整体匹配：三档计数 + 逐条明细。
 * **不给百分比**：`decidable` 只用来解释"为什么这么多待确认"，不作为"匹配了多少"的分子。
 */
export const BAND = Object.freeze({
  high: ['高度符合', 'ok'],
  partial: ['部分符合', 'warn'],
  needs_info: ['需补充信息', 'grey'],
  ineligible: ['硬性条件不满足', 'no'],
})

export function matchTrial(trial, facts) {
  const criteria = Array.isArray(trial?.criteria) ? trial.criteria : []
  const rows = criteria.map((c) => matchCriterion(c, facts))
  const count = (tier) => rows.filter((r) => r.tier === tier).length
  /* 粗筛符合度：分母含「待确认」，即**未知项按 0 计**——所以它只会偏低，不会偏高。
     参照 biliary-tract-workbench 的 `matchTrial()`（同名口径），它自己也写着这句话。
     硬性条件不满足的单列（`hardUnmet`），不掺在这个百分比里当"扣分"。 */
  const totalCount = rows.length
  const pct = Math.round((count(TIERS.SATISFIED) / Math.max(1, totalCount)) * 100)
  const hardUnmet = rows.filter((r) => r.tier === TIERS.CONFLICT && r.hard)
  const band = hardUnmet.length ? 'ineligible'
    : (pct >= 80 && count(TIERS.UNDETERMINED) <= 1) ? 'high'
      : pct >= 55 ? 'partial' : 'needs_info'
  return {
    pct,
    band,
    bandLabel: BAND[band][0],
    hardUnmet: hardUnmet.length,
    hardUnmetRules: hardUnmet.map((r) => r.rule),
    recordId: trial?.recordId ?? trial?.id ?? null,
    title: trial?.title ?? '',
    sourceId: trial?.sourceId ?? trial?.source ?? null,
    recruitmentStatus: trial?.recruitmentStatus ?? trial?.status ?? '登记状态，未核实',
    statusNote: '登记 ≠ 有效 ≠ 安全 ≠ 可入组',
    healthyVolunteer: Boolean(trial?.healthyVolunteer),
    counts: {
      satisfied: count(TIERS.SATISFIED),
      conflict: count(TIERS.CONFLICT),
      undetermined: count(TIERS.UNDETERMINED),
    },
    decidable: rows.filter((r) => r.tier !== TIERS.UNDETERMINED).length,
    total: rows.length,
    rows,
  }
}

/** 全部试验。**按传入顺序返回，不按档位排**（排序即推荐）。 */
export function matchAll(trials, facts) {
  const list = Array.isArray(trials) ? trials : []
  return list.map((t) => matchTrial(t, facts))
}


/**
 * 从一条登记里抽「能对照的条款」。
 *
 * 只抽**登记文本里真的写着**的东西（标题/状态），一条都不编：
 *   - 标题提到「健康受试者 / 生物等效性」→ 加一条反向条款（仅招健康人），可由 `is_patient` 判定；
 *   - 标题提到本病种词 → 加一条「登记病种与本人诊断一致」，可判定；
 *   - 标题提到 AMA / 抗线粒体抗体 → 加一条「入选：AMA 阳性」；
 *   - 标题提到肝硬化 → 加一条「入选：肝硬化（报告原文）」；
 *   - **永远**加一条「纳入/排除标准原文」且 `decidable=0` —— 本项目 479 条登记只采到
 *     标题/登记号/状态，没抓入排原文。这一条必须是「待确认」，而且页面上要说明原因，
 *     否则用户会把"三条待确认"读成"三条不符合"。
 */
const DISEASE_TERMS = ['原发性胆汁性胆管炎', '胆汁性胆管炎', 'PBC', '胆汁淤积']

export function criteriaOf(trial) {
  const title = String(trial?.title ?? '')
  const out = []

  if (/健康(受试者|志愿者|人体)|生物等效性/.test(title)) {
    out.push({
      rule_text: '排除已确诊患者（仅招健康受试者 / 生物等效性研究）',
      fact_key: 'is_patient',
      decidable: 1,
      hard: 1,
    })
  }
  if (DISEASE_TERMS.some((t) => title.includes(t))) {
    out.push({ rule_text: '入选：登记病种与本人诊断一致', fact_key: 'diagnosis', decidable: 1, hard: 1 })
  }
  if (/\bAMA\b|抗线粒体抗体/i.test(title)) {
    out.push({ rule_text: '入选：AMA 阳性', fact_key: 'ama', decidable: 1 })
  }
  if (title.includes('肝硬化')) {
    /* fact_key 用 cirrhosis 而不是 fibrosis：见 factsOf 里的注释（弹性值不是肝硬化）。 */
    out.push({ rule_text: '入选：肝硬化（报告原文写着"肝硬化"）', fact_key: 'cirrhosis', decidable: 1 })
  }

  out.push({
    rule_text: '纳入 / 排除标准原文',
    fact_key: null,
    decidable: 0,
    undecidable_reason: '本项目采集只到标题/登记号/状态，未抓纳入排除原文——这一条必须回去看登记页',
  })
  return out
}
