/**
 * 演示数据播种（幂等 + 单事务）。
 *
 * 数据来源只有一个：`demo/build-demo-data.mjs` 导出的 `buildDemoProfiles()` 纯函数。
 * 本文件**不自己编任何数字**，只负责把那份内存数据翻译成 schema/0001+0002 的行。
 *
 * 三条纪律：
 * 1. **幂等**：`profiles` 已有行就整体跳过（不删不覆盖）。重复启动不会把用户的真实记录冲掉。
 * 2. **单事务**：整批写在一个事务里，任何一条失败整体 ROLLBACK 并抛出原因，
 *    绝不允许留下"一半档案"——半份演示数据比没有更难排查。
 * 3. **翻译而非猜**：`fibrosis.method` 是 CHECK 枚举，`demo-data` 里存的是中文原文。
 *    枚举由本文件按固定映射给出，原文原样进 `method_text`；
 *    映射不到就落 `other`，**绝不丢弃原文**。
 */
import { buildDemoProfiles } from '../demo/build-demo-data.mjs'

const DB_FILE = 'xyb-pbc.sqlite'

/** 一张单子的主实验室 = 出现次数最多的那个（并列取先出现的）。空数组返回 null。 */
function primaryLab(items) {
  if (!items || !items.length) return null
  const count = new Map()
  for (const it of items) {
    if (!it.lab) continue
    count.set(it.lab, (count.get(it.lab) ?? 0) + 1)
  }
  let best = null
  let bestN = 0
  for (const [lab, n] of count) {
    if (n > bestN) { best = lab; bestN = n }
  }
  return best
}

/** 检查方式：中文原文 → CHECK 枚举。映射不到就 other，但 method_text 一定保留原文。 */
const METHOD_ENUM = [
  [/弹性|elasto|fibroscan/i, 'elastography'],
  [/影像|超声|CT|MRI|临床/i, 'imaging'],
  [/穿刺|活检|biopsy/i, 'biopsy'],
]

export function methodToEnum(text) {
  if (!text) return 'unknown'
  for (const [re, value] of METHOD_ENUM) if (re.test(text)) return value
  return 'other'
}

/** 试验来源：demo 里只有 ctv / ictrp / chictr_online 三种，其余按 CHECK 域兜底。 */
const SOURCE_SET = new Set(['ictrp', 'ctv', 'chictr_online', 'chictr_offline', 'chinadrugtrials', 'xyb_archive'])
const sourceOf = (s) => (SOURCE_SET.has(s) ? s : 'ctv')

const j = (v) => JSON.stringify(v)
const flag = (v) => (v === null || v === undefined ? null : v ? 1 : 0)

/** 库里是否已有档案。有一行就算有——演示播种不判断"完整度"，那是读模型的活。 */
export function hasDemoData(db) {
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n > 0
  } catch {
    return false
  }
}

/**
 * 播种。`input` 默认现算（固定种子，逐字节可复现）；
 * 测试可以传入固定数组，避免依赖 demo 构建脚本的当前状态。
 */
export function seedDemo(db, input = buildDemoProfiles()) {
  if (hasDemoData(db)) return { seeded: false, reason: 'profiles 已有数据，跳过' }

  const now = '2026-10-25T00:00:00.000Z'
  const stmts = {
    profile: db.prepare(`INSERT INTO profiles
      (profile_key, label, display_name, age, sex, diagnosed_on, started_on, weight_kg,
       antibody_ama, antibody_ama_m2, antibody_ana, antibody_note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
    fibrosis: db.prepare(`INSERT INTO fibrosis_records
      (profile_key, method, method_text, result_text, measured_on, note, ord) VALUES (?,?,?,?,?,?,?)`),
    comorbidity: db.prepare(`INSERT INTO comorbidities
      (profile_key, name, since_text, note, dept, visibility, ord) VALUES (?,?,?,?,?,?,?)`),
    panel: db.prepare(`INSERT INTO lab_panels
      (profile_key, drawn_on, lab_name, src_doc, source_kind, created_at) VALUES (?,?,?,NULL,'demo',?)`),
    item: db.prepare(`INSERT INTO lab_items
      (panel_id, code, value_num, value_text, unit_text, ref_low, ref_high, lab_name, ord)
      VALUES (?,?,?,?,?,?,?,?,?)`),
    symptom: db.prepare(`INSERT INTO symptom_logs
      (profile_key, logged_on, itch_0_10, fatigue_1_3, night_worse, scratch_skin, sleep_breaks, note, visibility, created_at, ord)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
    med: db.prepare(`INSERT INTO medications
      (profile_key, name, dose_text, freq_text, start_on, stop_on, prescriber_dept, approval_state, in_use, ord)
      VALUES (?,?,?,?,?,NULL,NULL,?,1,?)`),
    adherence: db.prepare(`INSERT INTO adherence_events
      (profile_key, month, missed_count, note, ord) VALUES (?,?,?,NULL,?)`),
    regimen: db.prepare(`INSERT INTO regimen_changes
      (profile_key, changed_on, doctor_text, my_state, visibility, ord) VALUES (?,?,?,?,?,?)`),
    section: db.prepare(`INSERT INTO screening_sections
      (profile_key, section_key, section_title, ord) VALUES (?,?,?,?)`),
    screening: db.prepare(`INSERT INTO screening_records
      (profile_key, section_key, done_on, result_text, detail_text, dept, src_doc, ord)
      VALUES (?,?,?,?,?,NULL,NULL,?)`),
    question: db.prepare(`INSERT INTO questions
      (profile_key, text, asked, created_at, ord) VALUES (?,?,?,?,?)`),
    pathway: db.prepare(`INSERT INTO pathway_phases
      (profile_key, phase_on, phase_name, summary_text, detail_json, ord) VALUES (?,?,?,?,?,?)`),
    trial: db.prepare(`INSERT OR IGNORE INTO trial_records
      (profile_key, source, record_id, title, phase_text, area_text, status_text, coverage_note, fetched_on, ord)
      VALUES (?,?,?,?,?,?,?,?,?,?)`),
    doc: db.prepare(`INSERT INTO documents
      (profile_key, name, rel_path, mime, sha256, doc_date, origin, parse_state, created_at)
      VALUES (?,?,?,NULL,NULL,?, 'demo', ?, ?)`),
    meta: db.prepare('INSERT OR REPLACE INTO demo_meta (key, value) VALUES (?,?)'),
  }

  db.exec('BEGIN')
  try {
    for (const p of input) {
      stmts.profile.run(
        p.key, p.label, p.name, p.age ?? null, p.sex ?? null, p.diagnosedAt, p.startedAt ?? null,
        p.weightKg ?? null,
        p.antibodies?.ama ?? 'untested', p.antibodies?.amaM2 ?? 'untested', p.antibodies?.ana ?? 'untested',
        p.antibodies?.note ?? null, now, now,
      )

      /* 纤维化：原文进 method_text，枚举由映射给出（映射不到 other，原文绝不丢） */
      if (p.fibrosis) {
        const f = p.fibrosis
        stmts.fibrosis.run(p.key, methodToEnum(f.method), f.method ?? null, f.value, f.date, f.note ?? null, 1)
      }

      p.comorbidity?.forEach((c, i) => stmts.comorbidity.run(
        p.key, c.name, c.since ?? null, c.note ?? null, c.dept ?? null, c.visibility ?? 'shared', i + 1,
      ))

      p.labs?.forEach((l) => {
        /* 面板级实验室名取**多数**，不取第一条：
           一张汇总单里可能只有一条是外院补抄的（演示数据里 2026-09 那张就是 ALP 来自外院），
           取第一条会把整张单子的来源写成外院。逐条 lab_name 才是每行数值的真实来源。 */
        const info = stmts.panel.run(p.key, l.date, primaryLab(l.items), now)
        const panelId = Number(info.lastInsertRowid)
        l.items?.forEach((it, i) => {
          /* 数值与文字互斥：文字型结果 value_num 必须 NULL（否则 Number('阴性')→NaN→null 也救不回来） */
          const numeric = typeof it.value === 'number' && Number.isFinite(it.value)
          stmts.item.run(
            panelId, it.code, numeric ? it.value : null, numeric ? null : String(it.value ?? ''),
            it.unit ?? null,
            it.refLow === null || it.refLow === undefined ? null : it.refLow,
            it.refHigh === null || it.refHigh === undefined ? null : it.refHigh,
            it.lab ?? null,
            i + 1,
          )
        })
      })

      p.symptoms?.forEach((s, i) => stmts.symptom.run(
        p.key, s.date, s.itch ?? null, s.fatigue ?? null,
        flag(s.nightWorse), flag(s.scratch), s.sleepBreaks ?? null, s.note ?? null,
        s.visibility ?? 'shared', now, i + 1,
      ))

      p.meds?.forEach((m, i) => stmts.med.run(
        p.key, m.name, m.doseText ?? null, m.freq ?? null, m.startDate ?? null,
        m.approval ?? 'unverified', i + 1,
      ))

      p.adherence?.forEach((a, i) => stmts.adherence.run(p.key, a.month, a.missed ?? 0, i + 1))

      p.regimenChanges?.forEach((c, i) => stmts.regimen.run(
        p.key, c.date, c.text,
        /* demo 里是中文「已理解/待我确认理解」，库里是枚举。反向映射在这里，不在读模型里。 */
        c.status === '已理解' ? 'understood' : 'unclear',
        c.visibility ?? 'shared', i + 1,
      ))

      /* 筛查分节：section_title 落库（读模型直接取，不靠前端硬编码）。
         demo 里 screening 是平铺数组，分节 key 取 type，标题在 demo 侧没存 → 用固定中文名。
         注意：固定中文名是**演示口径**，真实档案的分节标题由录入时写进 screening_sections。 */
      const sectionTitles = []
      p.screening?.forEach((s) => {
        if (!sectionTitles.some((x) => x.key === s.type)) {
          sectionTitles.push({ key: s.type, title: SCREENING_TITLES[s.type] ?? s.type })
        }
      })
      sectionTitles.forEach((s, i) => stmts.section.run(p.key, s.key, s.title, i + 1))
      p.screening?.forEach((s, i) => stmts.screening.run(
        p.key, s.type, s.date, s.result, s.detail ?? null, i + 1,
      ))

      p.questions?.forEach((q, i) => stmts.question.run(
        p.key, q.text, q.done ? 1 : 0, now, i + 1,
      ))

      p.pathway?.forEach((ph, i) => stmts.pathway.run(
        p.key, ph.d, ph.phase, ph.text ?? null, j(ph.detail ?? {}), i + 1,
      ))

      p.trials?.forEach((t, i) => stmts.trial.run(
        p.key, sourceOf(t.source), t.id, t.title, t.phase ?? null, t.area ?? null,
        /* 状态一律说"未核实"：演示数据里写的就是这个，不许升格成"招募中" */
        t.status ?? '登记状态，未核实',
        null, now, i + 1,
      ))

      p.documents?.forEach((d) => stmts.doc.run(
        p.key, d.name, `demo/${d.id}.pdf`, d.date || null, d.parsed ? 'parsed' : 'unparsed', now,
      ))
    }

    stmts.meta.run('generatedAt', 'fixed-for-reproducibility')
    db.exec('COMMIT')
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* 回滚失败时保留原始错误更有用 */ }
    throw new Error(`播种演示数据失败（已回滚）：${error.message}`, { cause: error })
  }

  return { seeded: true, profiles: input.length }
}

/** 筛查分节的演示中文标题。真实档案的分节标题来自录入，不从这里取。 */
export const SCREENING_TITLES = Object.freeze({
  bone: '骨密度',
  thyroid: '甲状腺功能',
  endoscopy: '胃镜（静脉曲张）',
  vitamin: '脂溶性维生素',
  liver: '肝脏影像',
})

export { DB_FILE }
