/* 读模型（PBC）：把库里的行还原成**前端要的形状**。
 *
 * 契约：`GET /api/pbc-workbench/bootstrap` 的 profiles 必须与
 * `prototypes/v0.2/demo-data.js` 里的同名档案逐字段一致（test/demo-parity.test.mjs 与
 * test/store.test.mjs 都是 deepStrictEqual）。所以这里不做任何"顺手优化"：
 * 字段名、数组层级、null 与缺失的语义都跟着 demo-data.js 走。
 *
 * 六条容易踩的（每条都有一次真实返工）：
 * 1. **`Number(null) === 0`**：`lab_items.value_num` 为 NULL 时必须保留 null，
 *    不能 `Number(x)` 一把梭，否则文字型结果（"阴性"）会变成 0 并进趋势线。
 * 2. **camelCase 是数据合同**：库里是 snake_case（`ref_high` / `drawn_on`），
 *    demo-data 是 camelCase（`refHigh` / `date`）。转换只在这一层做，且方向唯一。
 * 3. **排序**：有 ord 的表按 ord；**复合主键/无 ord 的表必须 `ORDER BY rowid`**，
 *    否则裸 SELECT 会按索引字母序返回（家族里 metrics / trials 都踩过）。
 * 4. **没有这一节就返回 null，不返回 []**：前端写的是 `p.fibrosis && ...`，
 *    "有但是空数组"会让整节从"没有"变成"有但空白"，两处渲染分歧。
 * 5. **参考区间逐条 item 自带**（来自 `lab_items.ref_low/ref_high`），
 *    不是档案级常量：同一患者在不同医院的上限不同，借了下限不等于借了上限。
 * 6. **不在这里算任何医学判定**：不判应答、不算 GLOBE/UK-PBC、不解释痒累病因。
 *    这里是抄录器，不是判读器。
 */

import { AGENT_PANE } from '../lib/layout.js'

const jp = (s, fallback = null) => {
  if (s === null || s === undefined) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}

/* node:sqlite 返回 null-prototype 行对象，直接 deepStrictEqual 会因原型不同而失败。统一摊平。 */
const rows = (db, sql, ...args) => db.prepare(sql).all(...args).map((r) => ({ ...r }))

/** 分节 key：与 demo/build-demo-data.mjs 的 screening 顺序、screening_sections 表三处一致。 */
export const SCREENING_KEYS = ['bone', 'thyroid', 'endoscopy', 'vitamin', 'liver']

/* 私密分节：默认不返回原文。调用方要原文必须显式 includePrivate=true。
   本仓的私密面 = 痒累记录的细粒度自述 + 合并症里患者标了 private 的条目。
   注意：这是**数据结构属性**（visibility 列），不是前端开关。 */
export const PRIVATE_FIELDS = Object.freeze({ symptoms: 'visibility', comorbidity: 'visibility', regimenChanges: 'visibility' })

/**
 * 数值/文字二选一的还原。
 * `value_text` 有值 → 原样返回字符串；否则返回数值（含 null）。
 * 绝不用 `Number(x)` 兜底：`Number(null) === 0` 会把"没测"写成"测出来是 0"。
 */
export function restoreValue(valueNum, valueText) {
  if (valueText !== null && valueText !== undefined && valueText !== '') return String(valueText)
  if (valueNum === null || valueNum === undefined) return null
  const n = Number(valueNum)
  return Number.isFinite(n) ? n : null
}

function readLabs(db, key) {
  const panels = rows(db, 'SELECT * FROM lab_panels WHERE profile_key = ? ORDER BY drawn_on, rowid', key)
  const items = rows(db, 'SELECT * FROM lab_items ORDER BY panel_id, ord, rowid')
  const byPanel = new Map()
  for (const it of items) {
    if (!byPanel.has(it.panel_id)) byPanel.set(it.panel_id, [])
    byPanel.get(it.panel_id).push({
      code: it.code,
      value: restoreValue(it.value_num, it.value_text),
      unit: it.unit_text ?? null,
      /* 参考区间逐条自带：这一条的上下限来自**这一张报告**，不是档案级常量 */
      refLow: it.ref_low === null || it.ref_low === undefined ? null : Number(it.ref_low),
      refHigh: it.ref_high === null || it.ref_high === undefined ? null : Number(it.ref_high),
      /* 实验室名逐条优先取自 `lab_items.lab_name`（0004），为空才回落到面板级。
         一张汇总单里可能同时抄了本院与外院结果，参考区间不同、来源必须跟着每行走。 */
      lab: it.lab_name ?? panels.find((p) => p.id === it.panel_id)?.lab_name ?? null,
    })
  }
  return panels.map((p) => ({ date: p.drawn_on, items: byPanel.get(p.id) ?? [] }))
}

function readSymptoms(db, key, includePrivate) {
  const list = rows(db, 'SELECT * FROM symptom_logs WHERE profile_key = ? ORDER BY logged_on DESC, rowid DESC', key)
  return list
    .filter((r) => includePrivate || r.visibility !== 'private')
    .map((r) => ({
      date: r.logged_on,
      itch: r.itch_0_10,
      nightWorse: r.night_worse === null ? null : !!r.night_worse,
      scratch: r.scratch_skin === null ? null : !!r.scratch_skin,
      sleepBreaks: r.sleep_breaks,
      fatigue: r.fatigue_1_3,
      note: r.note ?? '',
      /* private 只是可见性，不改变内容；带上它前端才能显示"这一条是本人才可见" */
      visibility: r.visibility,
    }))
}

function readScreening(db, key) {
  const secs = rows(db, 'SELECT section_key, section_title, ord FROM screening_sections WHERE profile_key = ? ORDER BY ord', key)
  const recs = rows(db, 'SELECT * FROM screening_records WHERE profile_key = ? ORDER BY ord, done_on DESC', key)
  return recs.map((r) => ({
    type: r.section_key,
    date: r.done_on,
    result: r.result_text,
    detail: r.detail_text ?? '',
    /* 分节标题落库（section_title），不写死在前端 */
    sectionTitle: secs.find((s) => s.section_key === r.section_key)?.section_title ?? null,
  }))
}

function readPathway(db, key) {
  return rows(db, 'SELECT * FROM pathway_phases WHERE profile_key = ? ORDER BY ord, phase_on', key)
    .map((r) => ({
      d: r.phase_on,
      phase: r.phase_name,
      text: r.summary_text ?? '',
      /* detail_json 是 {regimen,metrics,imaging,ae,support}，每块 {summary, items[]} */
      detail: jp(r.detail_json, {}),
    }))
}

/** 读一个档案。 */
function readProfile(db, key, { includePrivate = false } = {}) {
  const s = db.prepare('SELECT * FROM profiles WHERE profile_key = ?').get(key)
  if (!s) return null

  const labRows = readLabs(db, key)
  const fib = rows(db, 'SELECT * FROM fibrosis_records WHERE profile_key = ? ORDER BY ord, measured_on DESC', key)
  const comorb = rows(db, 'SELECT * FROM comorbidities WHERE profile_key = ? ORDER BY ord', key)
  const meds = rows(db, 'SELECT * FROM medications WHERE profile_key = ? ORDER BY in_use DESC, ord', key)
  const adh = rows(db, 'SELECT * FROM adherence_events WHERE profile_key = ? ORDER BY ord, month', key)
  const reg = rows(db, 'SELECT * FROM regimen_changes WHERE profile_key = ? ORDER BY ord, changed_on DESC', key)
  const syn = readSymptoms(db, key, includePrivate)
  const scr = readScreening(db, key)
  const qs = rows(db, 'SELECT * FROM questions WHERE profile_key = ? ORDER BY ord, rowid', key)
  /* documents 没有 ord 列（原件按录入顺序即可）→ 必须显式 ORDER BY rowid，
     否则裸 SELECT 会按索引顺序返回，界面上"最近上传"会乱序。 */
  const docs = rows(db, 'SELECT * FROM documents WHERE profile_key = ? ORDER BY rowid', key)
  const trials = rows(db, "SELECT * FROM trial_records WHERE profile_key = ? OR profile_key IS NULL ORDER BY ord, rowid", key)
  const pw = readPathway(db, key)

  const profile = {
    key: s.profile_key,
    label: s.label,
    name: s.display_name,
    age: s.age,
    sex: s.sex,
    diagnosedAt: s.diagnosed_on,
    startedAt: s.started_on ?? null,
    weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
    antibodies: {
      ama: s.antibody_ama,
      amaM2: s.antibody_ama_m2,
      ana: s.antibody_ana,
      note: s.antibody_note ?? '',
    },
    /* 纤维化只给原文，不给分级（无判读列契约） */
    fibrosis: fib.length
      ? { method: fib[0].method_text ?? fib[0].method, value: fib[0].result_text, date: fib[0].measured_on, note: fib[0].note ?? '' }
      : null,
    comorbidity: comorb
      .filter((r) => includePrivate || r.visibility !== 'private')
      .map((r) => ({ name: r.name, since: r.since_text ?? '', note: r.note ?? '', dept: r.dept ?? null, visibility: r.visibility })),
    meds: meds.map((r) => ({
      name: r.name,
      doseText: r.dose_text ?? '',
      freq: r.freq_text ?? '',
      startDate: r.start_on ?? null,
      /* 获批状态：未核实时就说未核实，不写成"已获批" */
      approval: r.approval_state,
      inUse: !!r.in_use,
    })),
    adherence: adh.map((r) => ({ month: r.month, missed: r.missed_count })),
    regimenChanges: reg
      .filter((r) => includePrivate || r.visibility !== 'private')
      .map((r) => ({
        date: r.changed_on,
        text: r.doctor_text,
        /* 我理解到什么程度：只有 unclear/understood 两态，没有"应答判定" */
        status: r.my_state === 'understood' ? '已理解' : '待我确认理解',
      })),
    symptoms: syn,
    screening: scr,
    /* id 用**档案内序号**（questions.ord / documents 的行序），不用数据库自增主键：
       自增 id 是全局的，B 档案的问题会从 q6 开始，界面上看像"我丢过 5 条问题"；
       而且删一条再加一条，id 就跳号，导出的快照与旧快照对不上。
       档案内序号是稳定的，删掉中间一条也只影响它后面的排序，不影响身份。 */
    questions: qs.map((r) => ({ id: `q${r.ord}`, text: r.text, done: !!r.asked })),
    documents: docs.map((r, i) => ({
      id: `d${i + 1}`,
      name: r.name,
      date: r.doc_date ?? '',
      parsed: r.parse_state === 'parsed',
      parseState: r.parse_state,
    })),
    trials: trials.map((r) => ({
      id: String(r.record_id),
      title: r.title,
      source: r.source,
      phase: r.phase_text ?? '',
      status: r.status_text,
      area: r.area_text ?? '',
    })),
    pathway: pw,
    labs: labRows,
  }

  /* 没有这一节就返回 null（不是 []）：前端写的是 `p.fibrosis && ...` */
  if (!labRows.length) profile.labs = []
  return profile
}

export function listProfiles(db) {
  return rows(db, 'SELECT profile_key, label, display_name FROM profiles ORDER BY profile_key')
}

export function getProfile(db, key, opts = {}) {
  return readProfile(db, key, opts)
}

/** `/api/pbc-workbench/bootstrap` 的 payload。version/build 由调用方注入（唯一来源 lib/version.js）。 */
export function bootstrap(db, { version, build } = {}) {
  /* profiles 是**数组**，与 prototypes/v0.2/demo-data.js 的顶层形状一致：
     原型里写的是 `DEMO.profiles.find(p => p.key === ...)`，返回对象会让开发版
     静默变成"没有档案"（find 不是对象的方法，前端要么崩要么显示空态）。
     形状由 demo-data 决定，不由这里的实现方便决定。 */
  const profiles = listProfiles(db).map((s) => readProfile(db, s.profile_key))

  /* 来源终态：界面必须能显示"哪几个通道本轮没查" */
  const sourceStates = rows(db, 'SELECT * FROM source_states WHERE scope = ? ORDER BY source', 'trials')
    .map((r) => ({
      source: r.source,
      state: r.state,
      coverage: jp(r.coverage),
      completeness: jp(r.completeness),
      checkedOn: r.checked_on,
      note: r.note ?? null,
    }))

  const meta = {}
  for (const r of rows(db, 'SELECT key, value FROM demo_meta')) meta[r.key] = r.value

  return {
    version: version ?? null,
    build: build ?? null,
    profiles,
    sourceStates,
    /* 试验记录是全局池 + 档案收藏，界面按档案取 */
    demo_meta: meta,
    /* 宿主未提供原生会话时这里会是 available:false；开发版自带挂载位演示，所以默认 true。 */
    agent: { available: true, mode: 'dev-mount' },
    layout: { agentPane: AGENT_PANE },
  }
}
