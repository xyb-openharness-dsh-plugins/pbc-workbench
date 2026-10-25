/* 临床试验匹配：建档 → 检索 → 分层线索（starter 35 号契约）。
 *
 * 一句话定位：**产出的不是「你能入组」，是带证据链的检索线索**。判定归医生与研究中心。
 *
 * 三条硬约束（35 号 §二/§三/§四，逐条有断言）：
 * 1. **不产出数值化综合分**（"匹配度 87%" 这类）。用透明分层 + 证据链代替：
 *    结构化命中 / 文本命中 / 宽口径命中，层内按"证据条数"排，层间固定顺序。
 * 2. **缺字段判「无法自动匹配」，不判「不适用」**（25 号 L2-3）。工作台永不写
 *    "你不适合 / 你能入组"。
 * 3. **每条结果固定带**：来源通道与终态、快照日期、「登记状态，未核实」、
 *    "登记 ≠ 有效 ≠ 安全 ≠ 可入组"声明。
 *
 * PBC 的特殊处（这一条必须写在界面上，不能只写在文档里）：
 * **PBC 没有常规基因检测、没有 IHC**。可用来匹配的"建档"只有三样：
 * ① 抗体谱（AMA / AMA-M2 / ANA）② 肝活检病理原文（有就抄，没有就是没有）
 * ③ 生化（ALP 相对上限的倍数、总胆红素）。所以本模块的建档只有这三样，
 * 不假装有分子分型。
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

/* 快照目录以**包根**为准（`<pkg>/research/pbc-cancer/`），不按 cwd ——
   装机后 cwd 是宿主进程的工作目录，跟插件包没关系。 */
const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/* 宽口径词：命中它们只能说明"大方向沾边"，必须显式标注并排最后。
   第一版没分宽窄，于是"健康受试者生物等效性试验"和真正的患者研究并排，
   患者会以为那是给他看的。 */
const BROAD_TERMS = ['罕见病', '实体瘤', '慢性肝病', '肝脏疾病', '自身免疫性疾病', '肝病']

/* 文本命中的题材词：出现在标题里说明这条登记至少在讲这个病/这类药。 */
const TOPIC_TERMS = [
  '原发性胆汁性胆管炎', '胆汁性胆管炎', 'PBC', '胆汁淤积',
  '熊去氧胆酸', 'UDCA', '奥贝胆酸', 'OCA', '贝特类', '非诺贝特', '苯扎贝特',
  'PPAR', '法尼醇', 'FXR', '肝硬化', '瘙痒', '抗线粒体抗体', 'AMA',
]

/* 结构化字段：只有「已确认入库」的值参与匹配（35 号 §一 段 1）。 */
function buildDossier(profile) {
  if (!profile) return null
  const ab = profile.antibodies ?? {}
  const lastLab = (profile.labs ?? [])[profile.labs.length - 1] ?? null
  const alp = lastLab?.items?.find((i) => i.code === 'ALP') ?? null
  const tbil = lastLab?.items?.find((i) => i.code === 'TBil') ?? null
  const biopsy = (profile.fibrosis && /活检|穿刺|biopsy/i.test(String(profile.fibrosis.method ?? '')))
    ? profile.fibrosis
    : null

  /* 每个字段都带 `source`：匹配结果要能回答"这个结论是从哪份报告来的"。 */
  const fields = [
    { key: 'ama', label: 'AMA', value: ab.ama ?? 'untested', source: ab.note || '抗体报告' },
    { key: 'amaM2', label: 'AMA-M2', value: ab.amaM2 ?? 'untested', source: ab.note || '抗体报告' },
    { key: 'ana', label: 'ANA', value: ab.ana ?? 'untested', source: ab.note || '抗体报告' },
  ]
  if (biopsy) {
    fields.push({
      key: 'pathology',
      label: '肝活检（病理原文）',
      value: biopsy.value ?? '',
      source: `${biopsy.date ?? ''} ${biopsy.method ?? ''}`.trim(),
    })
  }
  if (alp && alp.value != null) {
    const multiple = alp.refHigh ? Number(alp.value) / Number(alp.refHigh) : null
    fields.push({
      key: 'alp',
      label: 'ALP',
      value: multiple == null ? `${alp.value} U/L（这张单子未印上限）` : `${alp.value} U/L（${multiple.toFixed(1)}×ULN）`,
      source: `${lastLab.date} ${alp.lab ?? ''}`.trim(),
    })
  }
  if (tbil && tbil.value != null) {
    fields.push({ key: 'tbil', label: '总胆红素', value: `${tbil.value} ${tbil.unit ?? ''}`.trim(), source: `${lastLab.date} ${tbil.lab ?? ''}`.trim() })
  }
  fields.push({ key: 'age', label: '年龄', value: profile.age != null ? String(profile.age) : '未填', source: '档案' })

  /* 本地**没有**建档的字段：这些会让"命中"永远不完整，必须逐条列出来，
     而不是假装已经比对过。 */
  const missing = [
    '入排条件原文（本登记的纳入/排除标准尚未采集）',
    'ECOG / 体力状态评分',
    '既往 UDCA 疗程与剂量',
    '近 3 个月合并用药与剂量',
  ]
  if (!biopsy) missing.push('肝活检病理（本档案没有活检记录）')

  return {
    profileKey: profile.key,
    label: profile.label,
    fields,
    missing,
    /* 说清楚"为什么建档只有这些"——PBC 没有分子分型可建 */
    note: 'PBC 没有常规基因检测、也没有 IHC；可用于匹配的建档只有抗体谱、肝活检原文与生化。不假装有分子分型。',
  }
}

const CONF = { positive: '阳性', negative: '阴性', untested: '未检测' }

/** 结构化命中：建档里的明确实体与登记标题里的明确实体重合。 */
function structuredHits(dossier, title) {
  const hits = []
  for (const f of dossier.fields) {
    if (f.key === 'ama' || f.key === 'amaM2' || f.key === 'ana') {
      if (f.value !== 'positive') continue
      const token = f.key === 'amaM2' ? /AMA[-\s]?M2/i : f.key === 'ama' ? /\bAMA\b/i : /\bANA\b/i
      if (token.test(title)) hits.push({ field: f.label, value: CONF[f.value], source: f.source, matchedIn: '标题' })
    }
    if (f.key === 'pathology') {
      /* 病理原文里的关键词（肝硬化、纤维化分期）出现在标题里 */
      const m = String(f.value).match(/肝硬化|纤维化|F[0-4]|Scheuer|Ludwig/)
      if (m && title.includes(m[0])) hits.push({ field: f.label, value: m[0], source: f.source, matchedIn: '标题' })
    }
  }
  return hits
}

/** 文本命中：题材词重合，逐词给出现位置。 */
function textHits(title) {
  const hits = []
  for (const term of TOPIC_TERMS) {
    if (title.includes(term)) hits.push({ term, matchedIn: '标题' })
  }
  return hits
}

function broadHits(title) {
  return BROAD_TERMS.filter((t) => title.includes(t)).map((term) => ({ term, matchedIn: '标题' }))
}

/* 登记对象是"健康受试者"时，标题原文里就写着。这不是"你不适用"，
   而是"这条登记的对象不是你这类人"——把原文摘出来，让患者自己看见。 */
const HEALTHY_VOLUNTEER = /健康(受试者|人体|志愿者)|生物等效性|药代动力/

function snapshotPath() {
  const p = join(PKG_ROOT, 'research', 'pbc-cancer', 'pbc_cancer_trials_2026.sqlite')
  return existsSync(p) ? p : null
}

/** 读本地快照（只读打开，绝不写）。没有快照就如实说"未配置"，不当成 0 条结果。 */
export function readSnapshot() {
  const file = snapshotPath()
  if (!file) {
    return {
      available: false,
      snapshotDate: null,
      reason: '离线快照未随包提供（research/pbc-cancer/ 下的 sqlite 不在包里）——这是「未配置」，不是「0 条结果」',
      trials: [],
      sources: [],
    }
  }
  let db = null
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const trials = db.prepare(`SELECT record_id, source_id, title, recruitment_status, source_url, snapshot_date, status_note
      FROM trials ORDER BY rowid`).all().map((r) => ({ ...r }))
    const sources = db.prepare('SELECT source_id, state, upstream_state, reason_code, coverage, completeness, queried, checked_on, note FROM source_states').all()
      .map((r) => ({ ...r }))
    const snapshotDate = trials.reduce((acc, t) => (t.snapshot_date && (!acc || t.snapshot_date > acc) ? t.snapshot_date : acc), null)
    return { available: true, snapshotDate, reason: null, trials, sources }
  } catch (error) {
    return { available: false, snapshotDate: null, reason: `快照打不开：${error.message}`, trials: [], sources: [] }
  } finally {
    try { db?.close() } catch { /* 见上 */ }
  }
}

/**
 * 跑一次匹配。
 * @returns {{dossier, layers, unmatched, sources, snapshotDate, available, disclaimer, gaps}}
 */
export function matchTrials(profile) {
  const snap = readSnapshot()
  const dossier = buildDossier(profile)
  const disclaimer = {
    triState: ['命中（结构化 / 文本 / 宽口径）', '无法自动匹配', '不适用：本工作台不产出'],
    lines: [
      '登记状态，未核实；登记 ≠ 有效 ≠ 安全 ≠ 可入组。',
      '本工作台不判断你是否符合条件，也不写"建议参加 / 适合你"。带去医院问主诊医生与研究中心。',
    ],
  }
  if (!snap.available) {
    return {
      available: false,
      reason: snap.reason,
      dossier,
      layers: [],
      unmatched: dossier?.missing ?? [],
      sources: [],
      snapshotDate: null,
      disclaimer,
    }
  }

  const buckets = { structured: [], text: [], broad: [] }
  let healthyVolunteerOnly = 0
  for (const t of snap.trials) {
    const title = String(t.title ?? '')
    const s = structuredHits(dossier, title)
    const x = textHits(title)
    const b = broadHits(title)
    const healthy = HEALTHY_VOLUNTEER.test(title)
    if (healthy && !s.length && !x.length) healthyVolunteerOnly += 1
    const row = {
      recordId: t.record_id,
      sourceId: t.source_id,
      title,
      recruitmentStatus: t.recruitment_status,
      sourceUrl: t.source_url,
      snapshotDate: t.snapshot_date,
      statusNote: t.status_note || '登记状态，未核实',
      healthyVolunteer: healthy,
      structured: s,
      text: x,
      broad: b,
    }
    if (s.length) buckets.structured.push(row)
    else if (x.length) buckets.text.push(row)
    else if (b.length) buckets.broad.push(row)
  }

  /* 层内排序：证据多的在前；同分按登记号稳定排序（不按"看起来更像"排）。 */
  const byEvidence = (a, b) => (b.structured.length + b.text.length) - (a.structured.length + a.text.length)
    || String(a.recordId).localeCompare(String(b.recordId))
  buckets.structured.sort(byEvidence)
  buckets.text.sort(byEvidence)
  buckets.broad.sort((a, b) => a.broad.length - b.broad.length || String(a.recordId).localeCompare(String(b.recordId)))

  return {
    available: true,
    snapshotDate: snap.snapshotDate,
    trialCount: snap.trials.length,
    dossier,
    layers: [
      { key: 'structured', title: '结构化命中', hint: '建档里的明确实体出现在登记标题里', rows: buckets.structured },
      { key: 'text', title: '文本命中', hint: '题材词重合，逐词给出现位置', rows: buckets.text },
      { key: 'broad', title: '宽口径命中', hint: '只沾到"肝病/罕见病"这类大词，排最后', rows: buckets.broad },
    ],
    counts: { structured: buckets.structured.length, text: buckets.text.length, broad: buckets.broad.length, healthyVolunteerOnly },
    unmatched: dossier?.missing ?? [],
    sources: snap.sources,
    disclaimer,
  }
}
