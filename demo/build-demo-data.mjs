#!/usr/bin/env node
/**
 * 演示数据唯一来源（ZERO-TO-DEV §1.4 / 总原则②「数据只有一个来源」）。
 *
 * 一个文件同时产出两件产物，两者必须同构：
 *   1) prototypes/v0.2/demo-data.js   —— 原型 `file://` 直接引用（ESM，纯数据）
 *   2) demo/demo-data.sqlite          —— schema/0001 的演示库（M3 起与真实 schema 对齐）
 *
 * 纪律：
 * - 被 import 时只导出 `buildDemoProfiles()` 纯数据，**不碰磁盘**（`import.meta.main` 才写文件）。
 * - 不使用 Math.random：用固定种子的 LCG，重跑逐字节可复现（`npm run demo:data` 后 diff 为空）。
 * - 演示人名与数值全部虚构，页面必须显著标「虚构示例」。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/** 固定种子线性同余：保证重跑一致。 */
function lcg(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']

// 参考区间取"演示化验单自带的"值，刻意让两家实验室的上限不同（ALP 120 vs 135），
// 用来证明 ×ULN 必须用当次单据的上限，不能借通用值。
const LAB_DEFS = {
  A: { name: '市一院检验科', refs: { ALP: [35, 120], GGT: [7, 45], ALT: [7, 40], AST: [13, 35], TBil: [0, 21], ALB: [40, 55], PLT: [125, 350], Hb: [115, 150], WBC: [3.5, 9.5], ANC: [1.8, 6.3], Cr: [41, 81] } },
  B: { name: '区中心医院', refs: { ALP: [40, 135], GGT: [8, 50], ALT: [8, 45], AST: [14, 40], TBil: [0, 23], ALB: [39, 54], PLT: [120, 340], Hb: [112, 148], WBC: [3.4, 9.2], ANC: [1.7, 6.0], Cr: [40, 84] } },
}

/** 一条化验：items 里缺 refHigh 的那条刻意留 null，用来演示「需参考上限」徽章。 */
function makeLabs(profileKey, seed, trend) {
  const rnd = lcg(seed)
  const def = LAB_DEFS[profileKey]
  return MONTHS.map((m, i) => {
    const jitter = () => 1 + (rnd() - 0.5) * 0.08
    const base = {
      ALP: trend.alp[i] * jitter(),
      GGT: trend.ggt[i] * jitter(),
      ALT: trend.alt[i] * jitter(),
      AST: trend.ast[i] * jitter(),
      TBil: trend.tbil[i] * jitter(),
      ALB: trend.alb[i] * jitter(),
      PLT: trend.plt[i] * jitter(),
      Hb: trend.hb[i] * jitter(),
      WBC: trend.wbc[i] * jitter(),
      ANC: trend.anc[i] * jitter(),
      Cr: trend.cr[i] * jitter(),
    }
    const items = Object.entries(base).map(([code, value]) => {
      const ref = def.refs[code]
      // 2026-09 那一张：模拟"外院单子没印上限"——只给下限，上限 null（不许用通用值补）
      const missingHigh = m === '2026-09' && code === 'ALP'
      return {
        code,
        value: Number(value.toFixed(code === 'ALB' ? 1 : 0)),
        unit: { ALP: 'U/L', GGT: 'U/L', ALT: 'U/L', AST: 'U/L', TBil: 'µmol/L', ALB: 'g/L', PLT: '10⁹/L', Hb: 'g/L', WBC: '10⁹/L', ANC: '10⁹/L', Cr: 'µmol/L' }[code],
        refLow: ref[0],
        refHigh: missingHigh ? null : ref[1],
        lab: missingHigh ? '外院报告（未印上限）' : def.name,
      }
    })
    return { date: `${m}-08`, items }
  })
}

function buildProfileA() {
  return {
    key: 'A',
    label: '档案 A · 部分应答',
    name: '虚构患者甲',
    age: 52,
    sex: '女',
    diagnosedAt: '2024-03-12',
    startedAt: '2024-03-20',
    weightKg: 58,
    antibodies: { ama: 'positive', amaM2: 'positive', ana: 'negative', note: '2024-03 首诊报告抄录' },
    fibrosis: { method: '瞬时弹性成像', value: '8.4 kPa', date: '2026-04-18', note: '报告原文抄录，未判读' },
    comorbidity: [{ name: '干燥症状', since: '2024', note: '未做唇腺活检' }],
    meds: [{ name: '熊去氧胆酸片', doseText: '250 mg × 5 片/日（按 13–15 mg/kg 由医生确定）', freq: '每日 2–3 次', startDate: '2024-03-20', approval: 'unverified' }],
    adherence: [{ month: '2026-05', missed: 1 }, { month: '2026-06', missed: 0 }, { month: '2026-07', missed: 2 }, { month: '2026-08', missed: 0 }, { month: '2026-09', missed: 1 }, { month: '2026-10', missed: 0 }],
    regimenChanges: [{ date: '2025-11-06', text: '医生提到"如果 ALP 还降不下来，可以考虑加一种药"，药名当时没记住', status: '待我确认理解' }],
    symptoms: [
      { date: '2026-10-03', itch: 7, nightWorse: true, scratch: true, sleepBreaks: 3, fatigue: 2, note: '夜里最痒，小腿外侧' },
      { date: '2026-09-21', itch: 5, nightWorse: true, scratch: false, sleepBreaks: 1, fatigue: 2, note: '' },
      { date: '2026-09-02', itch: 3, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 3, note: '这周加班，走两层楼要歇' },
      { date: '2026-08-14', itch: 6, nightWorse: true, scratch: true, sleepBreaks: 2, fatigue: 2, note: '' },
      { date: '2026-07-19', itch: 4, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 1, note: '' },
      { date: '2026-06-27', itch: 2, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 2, note: '' },
      { date: '2026-05-30', itch: 5, nightWorse: true, scratch: false, sleepBreaks: 1, fatigue: 2, note: '' },
    ],
    screening: [
      { type: 'bone', date: '2026-04-18', result: '腰椎 T 值 -1.8（报告原文）', detail: '医生说"有点低"，未给用药方案' },
      { type: 'thyroid', date: '2026-03-02', result: 'TSH 4.9 mIU/L（参考 0.35–4.94）', detail: '内分泌科随访，未用药' },
      { type: 'endoscopy', date: '2025-04-10', result: '未见静脉曲张（报告原文）', detail: '' },
      { type: 'vitamin', date: '2026-04-18', result: '25-OH 维生素 D 22 ng/mL', detail: '医生建议补充，剂量未记' },
      { type: 'liver', date: '2026-04-18', result: '超声：肝表面尚光滑，未见明确占位', detail: '' },
    ],
    questions: [
      { id: 'q1', text: '这次的 ALP 比上次降了多少？离"控制住"还差多少？', done: false },
      { id: 'q2', text: '夜里痒得厉害，和这个病有关系吗？要不要处理？', done: false },
      { id: 'q3', text: '上次说可能加药，现在需要加吗？', done: false },
      { id: 'q4', text: '胃镜多久复查一次？', done: true },
      { id: 'q5', text: '骨密度这个数值需要处理吗？', done: false },
    ],
    documents: [
      { id: 'd1', name: '2026-10 肝功能.pdf', date: '2026-10-08', parsed: true },
      { id: 'd2', name: '骨密度报告.jpg', date: '2026-04-18', parsed: true },
      { id: 'd3', name: '2025-04 胃镜.pdf', date: '2025-04-10', parsed: false },
    ],
    trials: [
      { id: 't1', title: '【虚构示例】某二线药物在 PBC 中的随机对照研究', source: 'ctv', phase: '3 期', status: '登记状态，未核实', area: '上海' },
      { id: 't2', title: '【虚构示例】PBC 瘙痒症状管理研究', source: 'chictr_online', phase: '不适用', status: '登记状态，未核实', area: '北京' },
    ],
    pathway: [
      {
        d: '2024-03-12', phase: '确诊', text: '体检发现 ALP 升高，抗体阳性后确诊',
        detail: {
          regimen: { summary: '尚未开始用药', items: [['方案', '无'], ['说明', '确诊当次未开药']] },
          metrics: { summary: 'ALP 286 U/L（参考上限 120）', items: [['ALP', '286 U/L，约 2.4×ULN'], ['GGT', '198 U/L']] },
          imaging: { summary: '超声：肝实质回声稍增粗', items: [['报告原文', '肝实质回声稍增粗，未见占位']] },
          ae: { summary: '无记录', items: [['说明', '此阶段未开始用药，未记副作用']] },
          support: { summary: '无记录', items: [['说明', '未记录支持措施']] },
        },
      },
      {
        d: '2024-03-20', phase: '开始 UDCA', text: '医生按体重定的剂量，每日分次口服',
        detail: {
          regimen: { summary: '熊去氧胆酸 250 mg × 5 片/日', items: [['药名', '熊去氧胆酸片'], ['剂量原文', '250 mg × 5 片/日'], ['频次', '每日 2–3 次'], ['获批状态', '未核实']] },
          metrics: { summary: 'ALP 从 286 降到 210（3 个月）', items: [['2024-06 ALP', '210 U/L，约 1.75×ULN'], ['2024-06 GGT', '142 U/L']] },
          imaging: { summary: '本阶段未复查影像', items: [['说明', '无记录，不等于没做']] },
          ae: { summary: '偶有腹胀，未处理', items: [['记录', '服药后腹胀，程度自评轻'], ['处理原文', '未处理']] },
          support: { summary: '"先把药吃顺了再说"', items: [['患者原话', '先把药吃顺了再说']] },
        },
      },
      {
        d: '2025-11-06', phase: '讨论加药', text: '医生提到"还可以加一种药"，当时没记住名字',
        detail: {
          regimen: { summary: '仍在 UDCA 单药', items: [['方案', '未变更'], ['医生原话', '如果 ALP 还降不下来，可以考虑加一种药']] },
          metrics: { summary: 'ALP 在 1.8–2.2×ULN 波动', items: [['近三次 ALP', '214 / 246 / 231 U/L']] },
          imaging: { summary: '无新增影像', items: [['说明', '无记录']] },
          ae: { summary: '无新增', items: [['说明', '无记录']] },
          support: { summary: '"不知道该问什么"', items: [['患者原话', '不知道该问什么，就点头了']] },
        },
      },
    ],
  }
}

function buildProfileB() {
  return {
    key: 'B',
    label: '档案 B · 肝硬化随访',
    name: '虚构患者乙',
    age: 61,
    sex: '女',
    diagnosedAt: '2018-09-05',
    startedAt: '2018-09-18',
    weightKg: 64,
    antibodies: { ama: 'positive', amaM2: 'untested', ana: 'positive', note: '2018 年报告，AMA-M2 未做' },
    fibrosis: { method: '影像 + 临床', value: '肝硬化（报告原文）', date: '2026-02-11', note: '由报告原文抄录' },
    comorbidity: [{ name: '甲状腺功能减退', since: '2021', note: '内分泌科，左甲状腺素 50 µg' }, { name: '骨质疏松', since: '2023', note: '未规律治疗' }],
    meds: [
      { name: '熊去氧胆酸胶囊', doseText: '250 mg × 6 粒/日', freq: '每日 3 次', startDate: '2018-09-18', approval: 'unverified' },
      { name: '左甲状腺素钠片', doseText: '50 µg 每日 1 次', freq: '每日 1 次（另一科开）', startDate: '2021-05-01', approval: 'unverified' },
    ],
    adherence: [{ month: '2026-05', missed: 0 }, { month: '2026-06', missed: 1 }, { month: '2026-07', missed: 0 }, { month: '2026-08', missed: 3 }, { month: '2026-09', missed: 0 }, { month: '2026-10', missed: 1 }],
    regimenChanges: [],
    symptoms: [
      { date: '2026-10-05', itch: 3, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 3, note: '下午就没劲了' },
      { date: '2026-09-18', itch: 2, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 3, note: '' },
      { date: '2026-08-22', itch: 4, nightWorse: true, scratch: false, sleepBreaks: 1, fatigue: 2, note: '' },
      { date: '2026-07-11', itch: 2, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 2, note: '' },
      { date: '2026-06-09', itch: 5, nightWorse: true, scratch: true, sleepBreaks: 2, fatigue: 3, note: '天热更痒' },
      { date: '2026-05-16', itch: 3, nightWorse: false, scratch: false, sleepBreaks: 0, fatigue: 2, note: '' },
    ],
    screening: [
      { type: 'bone', date: '2026-02-11', result: '股骨颈 T 值 -2.6（报告原文）', detail: '骨科建议用药，尚未开始' },
      { type: 'thyroid', date: '2026-09-02', result: 'TSH 2.1 mIU/L（参考 0.35–4.94）', detail: '维持原剂量' },
      { type: 'endoscopy', date: '2024-11-20', result: '食管下段轻度静脉曲张（报告原文）', detail: '医生建议定期复查' },
      { type: 'vitamin', date: '2026-02-11', result: '25-OH 维生素 D 14 ng/mL', detail: '' },
      { type: 'liver', date: '2026-09-02', result: '超声：肝表面不平，脾大；未见明确占位', detail: '医生提到半年复查' },
    ],
    questions: [
      { id: 'q1', text: '静脉曲张这次要不要再查胃镜？', done: false },
      { id: 'q2', text: '骨密度 -2.6，需要开始用药吗？', done: false },
      { id: 'q3', text: '甲状腺的药和肝的药一起吃要注意什么？', done: false },
      { id: 'q4', text: '肝脏超声多久做一次？', done: true },
    ],
    documents: [
      { id: 'd1', name: '2026-09 超声.pdf', date: '2026-09-02', parsed: true },
      { id: 'd2', name: '2026-02 骨密度.pdf', date: '2026-02-11', parsed: true },
    ],
    trials: [
      { id: 't1', title: '【虚构示例】PBC 肝硬化患者长期随访观察研究', source: 'ictrp', phase: '观察性', status: '登记状态，未核实', area: '广州' },
    ],
    pathway: [
      {
        d: '2018-09-18', phase: '开始 UDCA', text: '确诊后即开始单药治疗',
        detail: {
          regimen: { summary: '熊去氧胆酸 250 mg × 6 粒/日', items: [['药名', '熊去氧胆酸胶囊'], ['剂量原文', '250 mg × 6 粒/日'], ['获批状态', '未核实']] },
          metrics: { summary: 'ALP 从 310 降到 168（6 个月）', items: [['2019-03 ALP', '168 U/L'], ['2019-03 TBil', '18 µmol/L']] },
          imaging: { summary: '超声：肝回声增粗', items: [['报告原文', '肝实质回声增粗，脾不大']] },
          ae: { summary: '无记录', items: [['说明', '无记录']] },
          support: { summary: '无记录', items: [['说明', '无记录']] },
        },
      },
      {
        d: '2024-11-20', phase: '发现静脉曲张', text: '胃镜提示轻度静脉曲张，进入并发症随访',
        detail: {
          regimen: { summary: '维持 UDCA，未加药', items: [['方案', '未变更']] },
          metrics: { summary: '血小板 96–118，白蛋白 38–41', items: [['PLT', '96 10⁹/L'], ['ALB', '39 g/L']] },
          imaging: { summary: '胃镜：食管下段轻度静脉曲张', items: [['报告原文', '食管下段可见轻度静脉曲张，红色征阴性']] },
          ae: { summary: '无记录', items: [['说明', '无记录']] },
          support: { summary: '"医生让少吃硬的东西"', items: [['患者原话', '医生让少吃硬的东西']] },
        },
      },
      {
        d: '2026-02-11', phase: '骨质疏松评估', text: '骨密度提示骨质疏松，骨科建议用药',
        detail: {
          regimen: { summary: '加左甲状腺素（另一科）', items: [['方案变更', '内分泌科加左甲状腺素 50 µg'], ['说明', '与肝病科分开开药']] },
          metrics: { summary: 'ALP 1.3–1.5×ULN，PLT 92', items: [['ALP', '178 U/L'], ['PLT', '92 10⁹/L']] },
          imaging: { summary: '骨密度：股骨颈 T -2.6', items: [['报告原文', '股骨颈 T 值 -2.6']] },
          ae: { summary: '乏力加重', items: [['记录', '自评乏力 3 档（做不了日常）']] },
          support: { summary: '"两个科各说各的"', items: [['患者原话', '两个科各说各的，我自己记']] },
        },
      },
    ],
  }
}

/** 纯函数：被 import 时只返回数据，不写盘。 */
export function buildDemoProfiles() {
  const A = buildProfileA()
  const B = buildProfileB()
  A.labs = makeLabs('A', 20240501, {
    alp: [286, 262, 246, 231, 214, 246], ggt: [198, 186, 175, 168, 158, 171],
    alt: [58, 54, 49, 46, 44, 51], ast: [42, 40, 37, 35, 33, 38],
    tbil: [14, 13, 13, 12, 12, 13], alb: [43, 43, 44, 44, 44, 43],
    plt: [198, 201, 196, 205, 199, 203], hb: [128, 129, 127, 130, 129, 128],
    wbc: [5.2, 5.0, 5.4, 5.1, 5.3, 5.0], anc: [2.9, 2.8, 3.0, 2.7, 2.9, 2.8],
    cr: [62, 63, 61, 62, 64, 63],
  })
  B.labs = makeLabs('B', 20240502, {
    alp: [310, 245, 198, 188, 179, 178], ggt: [220, 186, 160, 151, 143, 146],
    alt: [52, 46, 41, 38, 36, 40], ast: [48, 43, 39, 36, 34, 37],
    tbil: [21, 19, 18, 17, 17, 18], alb: [40, 40, 39, 40, 39, 39],
    plt: [118, 110, 101, 96, 94, 92], hb: [119, 117, 115, 116, 114, 115],
    wbc: [4.1, 3.9, 4.0, 3.8, 4.0, 3.9], anc: [2.2, 2.1, 2.2, 2.0, 2.1, 2.1],
    cr: [70, 71, 69, 72, 70, 71],
  })
  return [A, B]
}

/* ------------------------------- 产物 1：ESM ------------------------------- */
const HEADER = `/* 由 demo/build-demo-data.mjs 生成，勿手改。重跑：npm run demo:data */\n`

export function renderDemoModule(profiles) {
  // 原型用 **经典脚本**（file:// 下 ESM import 会被 CORS 拦），所以产物挂全局而不是 export。
  const payload = JSON.stringify({ generatedAt: 'fixed-for-reproducibility', profiles }, null, 2)
  return `${HEADER}(function (root) {\n  const DEMO = ${payload}\n  root.DEMO = DEMO\n})(typeof window !== 'undefined' ? window : globalThis)\n`
}

/* ------------------------------ 产物 2：SQLite ----------------------------- */
export async function buildDemoDatabase(file, profiles) {
  const { DatabaseSync } = await import('node:sqlite')
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    DROP TABLE IF EXISTS subjects; DROP TABLE IF EXISTS lab_results; DROP TABLE IF EXISTS lab_items;
    DROP TABLE IF EXISTS symptom_logs; DROP TABLE IF EXISTS medications; DROP TABLE IF EXISTS adherence;
    DROP TABLE IF EXISTS regimen_changes; DROP TABLE IF EXISTS screening_records; DROP TABLE IF EXISTS questions;
    DROP TABLE IF EXISTS trials; DROP TABLE IF EXISTS documents; DROP TABLE IF EXISTS pathway_phases;
    CREATE TABLE subjects (profile_key TEXT PRIMARY KEY, label TEXT NOT NULL, name TEXT NOT NULL, age INTEGER,
      sex TEXT, diagnosed_at TEXT NOT NULL, started_at TEXT, weight_kg REAL, antibody_json TEXT NOT NULL,
      fibrosis_json TEXT NOT NULL, comorbidity_json TEXT);
    CREATE TABLE lab_results (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, drawn_at TEXT NOT NULL, lab TEXT);
    CREATE TABLE lab_items (id INTEGER PRIMARY KEY, result_id INTEGER NOT NULL, code TEXT NOT NULL, value REAL,
      unit TEXT, ref_low REAL, ref_high REAL, ord INTEGER NOT NULL);
    CREATE TABLE symptom_logs (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, logged_on TEXT NOT NULL,
      itch_0_10 INTEGER, night_worse INTEGER, scratch INTEGER, sleep_breaks INTEGER, fatigue_1_3 INTEGER,
      note TEXT);
    CREATE TABLE medications (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, name TEXT NOT NULL,
      dose_text TEXT, freq TEXT, start_date TEXT, approval TEXT NOT NULL DEFAULT 'unverified');
    CREATE TABLE adherence (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, month TEXT NOT NULL, missed INTEGER NOT NULL);
    CREATE TABLE regimen_changes (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, changed_on TEXT NOT NULL,
      doctor_text TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE screening_records (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, kind TEXT NOT NULL,
      done_on TEXT NOT NULL, result_text TEXT, detail_text TEXT);
    CREATE TABLE questions (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, qid TEXT NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL);
    CREATE TABLE trials (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, tid TEXT NOT NULL, title TEXT NOT NULL,
      source TEXT, phase TEXT, status_text TEXT, area TEXT);
    CREATE TABLE documents (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, did TEXT NOT NULL, name TEXT NOT NULL,
      doc_date TEXT, parsed INTEGER NOT NULL);
    CREATE TABLE pathway_phases (id INTEGER PRIMARY KEY, profile_key TEXT NOT NULL, d TEXT NOT NULL,
      phase TEXT NOT NULL, summary_text TEXT, detail_json TEXT NOT NULL, ord INTEGER NOT NULL);
  `)
  db.exec('BEGIN')
  try {
    const ins = {
      subject: db.prepare('INSERT INTO subjects VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
      labResult: db.prepare('INSERT INTO lab_results (profile_key, drawn_at, lab) VALUES (?,?,?)'),
      labItem: db.prepare('INSERT INTO lab_items (result_id, code, value, unit, ref_low, ref_high, ord) VALUES (?,?,?,?,?,?,?)'),
      symptom: db.prepare('INSERT INTO symptom_logs (profile_key, logged_on, itch_0_10, night_worse, scratch, sleep_breaks, fatigue_1_3, note) VALUES (?,?,?,?,?,?,?,?)'),
      med: db.prepare('INSERT INTO medications (profile_key, name, dose_text, freq, start_date, approval) VALUES (?,?,?,?,?,?)'),
      adh: db.prepare('INSERT INTO adherence (profile_key, month, missed) VALUES (?,?,?)'),
      change: db.prepare('INSERT INTO regimen_changes (profile_key, changed_on, doctor_text, status) VALUES (?,?,?,?)'),
      screen: db.prepare('INSERT INTO screening_records (profile_key, kind, done_on, result_text, detail_text) VALUES (?,?,?,?,?)'),
      question: db.prepare('INSERT INTO questions (profile_key, qid, text, done) VALUES (?,?,?,?)'),
      trial: db.prepare('INSERT INTO trials (profile_key, tid, title, source, phase, status_text, area) VALUES (?,?,?,?,?,?,?)'),
      doc: db.prepare('INSERT INTO documents (profile_key, did, name, doc_date, parsed) VALUES (?,?,?,?,?)'),
      phase: db.prepare('INSERT INTO pathway_phases (profile_key, d, phase, summary_text, detail_json, ord) VALUES (?,?,?,?,?,?)'),
    }
    for (const p of profiles) {
      ins.subject.run(p.key, p.label, p.name, p.age, p.sex, p.diagnosedAt, p.startedAt, p.weightKg,
        JSON.stringify(p.antibodies), JSON.stringify(p.fibrosis), JSON.stringify(p.comorbidity))
      for (const r of p.labs) {
        const info = ins.labResult.run(p.key, r.date, r.items[0]?.lab ?? null)
        const resultId = Number(info.lastInsertRowid)
        r.items.forEach((it, i) => ins.labItem.run(resultId, it.code, it.value, it.unit, it.refLow, it.refHigh, i + 1))
      }
      for (const s of p.symptoms) {
        ins.symptom.run(p.key, s.date, s.itch, s.nightWorse ? 1 : 0, s.scratch ? 1 : 0, s.sleepBreaks, s.fatigue, s.note ?? null)
      }
      for (const m of p.meds) ins.med.run(p.key, m.name, m.doseText, m.freq, m.startDate, m.approval)
      for (const a of p.adherence) ins.adh.run(p.key, a.month, a.missed)
      for (const c of p.regimenChanges) ins.change.run(p.key, c.date, c.text, c.status)
      for (const s of p.screening) ins.screen.run(p.key, s.type, s.date, s.result, s.detail ?? null)
      for (const q of p.questions) ins.question.run(p.key, q.id, q.text, q.done ? 1 : 0)
      for (const t of p.trials) ins.trial.run(p.key, t.id, t.title, t.source, t.phase, t.status, t.area)
      for (const d of p.documents) ins.doc.run(p.key, d.id, d.name, d.date, d.parsed ? 1 : 0)
      p.pathway.forEach((ph, i) => ins.phase.run(p.key, ph.d, ph.phase, ph.text, JSON.stringify(ph.detail), i + 1))
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  } finally {
    db.close()
  }
}

async function main() {
  const profiles = buildDemoProfiles()
  const jsOut = join(ROOT, 'prototypes/v0.2/demo-data.js')
  const dbOut = join(ROOT, 'demo/demo-data.sqlite')
  mkdirSync(dirname(jsOut), { recursive: true })
  writeFileSync(jsOut, renderDemoModule(profiles))
  await buildDemoDatabase(dbOut, profiles)
  console.log(JSON.stringify({ ok: true, js: jsOut, db: dbOut, profiles: profiles.length }, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
