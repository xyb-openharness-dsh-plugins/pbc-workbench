/* 小管宝 DuctPal · PBC 原型 app.js（file:// 直接可开，无构建、无 ESM import） */
(function () {
  'use strict'
  /* 开发版：先取工作台接口。
     只有**接口不通**才回退演示数据；接口通但库空必须显示空态，
     否则用户看到的演示档案会被当成自己的病历（DATA_SOURCE 用来在界面上说清楚）。 */
  const API_PREFIX = '/api/pbc-workbench'
  const DEMO_FALLBACK = window.DEMO
  let DEMO = window.DEMO
  let DATA_SOURCE = 'pending'
  let DATA_NOTE = ''

  /* 挂载前缀只在"被宿主嵌在子路径下"时才有值：/w/abc/api/pbc-workbench/ui/index.html
     → base='/w/abc'。直接把 /api/pbc-workbench 当 base 会拼出
     /api/pbc-workbench/api/pbc-workbench/... 404，页面静默回退演示数据，
     看着有数据其实根本没连上库——这条踩过，别再犯。 */
  function apiBase() {
    const m = location.pathname.match(/^(.*)\/ui(?:\/|$)/)
    const base = m ? m[1] : ''
    /* 用 endsWith 而不是正则替换：脚本本身是模板字符串，正则字符类里的 $ 和花括号
       会被当成插值起点，写出来的代码会当场语法错误。 */
    return base.endsWith(API_PREFIX) ? base.slice(0, -API_PREFIX.length) : base
  }
  const apiUrl = (path) => apiBase() + API_PREFIX + path

  /* 接口通不通与"库里有没有东西"是两件事，必须分开表达：
     reachable=false → 用演示数据（并明说这是演示）
     reachable=true 且 profiles 为空 → 空态（不拿演示档案填满空工作区） */
  async function loadBootstrap() {
    try {
      const res = await fetch(apiUrl('/bootstrap'))
      if (!res.ok) return { reachable: false, data: null }
      return { reachable: true, data: await res.json() }
    } catch {
      return { reachable: false, data: null }
    }
  }

  let SOURCE_STATES = []

  /* 把接口数据摊进视图用的那份结构。字段逐个显式列出，
     不静默丢——少一个字段界面上就是一片空白，而空白最像"数据丢了"。 */
  function applyData(data) {
    if (!data || !Array.isArray(data.profiles)) return false
    DEMO = {
      generatedAt: (data.demo_meta && data.demo_meta.generatedAt) || '',
      profiles: data.profiles,
    }
    SOURCE_STATES = Array.isArray(data.sourceStates) ? data.sourceStates : []
    return true
  }
  const VERSION = 'v0.1.0'
  const EVT_DRAFT = 'pbc:agent-draft'

  const NAV = [
    { id: 'dashboard', label: '看板', subs: [['overview', '今日概览'], ['next', '接下来'], ['changes', '最近变化']] },
    { id: 'basics', label: '我的病底', subs: [['diagnosis', '诊断与抗体'], ['fibrosis', '纤维化与影像'], ['comorbidity', '合并症档案']] },
    { id: 'treatment', label: '用药与应答', subs: [['current', '当前用药'], ['pathway', '换线记录'], ['sideeffects', '副作用']] },
    { id: 'labs', label: '生化线', subs: [['cards', '指标卡'], ['chart', '一图秀'], ['grading', '分级说明']] },
    { id: 'symptoms', label: '痒与累', subs: [['itch', '今天的痒'], ['fatigue', '今天的累'], ['log', '我的记录'], ['impact', '影响与睡眠']] },
    { id: 'screening', label: '并发症筛查', subs: [['bone', '骨骼'], ['thyroid', '甲状腺'], ['endoscopy', '食管胃镜'], ['vitamins', '脂溶性维生素'], ['liver', '肝影像与 HCC 监测']] },
    { id: 'followup', label: '复查节奏', subs: [['cadence', '节奏卡'], ['prep', '就诊准备'], ['todos', '待办与问题']] },
    { id: 'records', label: '报告与资料', subs: [['import', '导入'], ['files', '原件'], ['export', '导出']] },
    { id: 'trials', label: '临床研究', subs: [['search', '检索'], ['saved', '收藏'], ['sources', '来源说明']] },
  ]

  /* 成人通用参考下限：只在报告没印下限时"借"来用，且结果必须标 approx。
     数值取自常规成人参考区间（各家实验室略有差异，所以界面必须写明是通用的）。 */
  const GENERIC_LOW = { PLT: 125, Hb: 115, WBC: 3.5, ANC: 1.8, ALB: 40 }

  const GRADE_CODES = {
    ALP: { kind: 'uln', cuts: [1, 3, 5, 20], note: '×ULN' },
    ALT: { kind: 'uln', cuts: [1, 3, 5, 20], note: '×ULN' },
    AST: { kind: 'uln', cuts: [1, 3, 5, 20], note: '×ULN' },
    TBil: { kind: 'uln', cuts: [1, 1.5, 3, 10], note: '×ULN' },
    Cr: { kind: 'uln', cuts: [1, 1.5, 3, 6], note: '×ULN' },
    PLT: { kind: 'abs', cuts: [75, 50, 25], dir: 'low', note: '10⁹/L' },
    Hb: { kind: 'abs', cuts: [100, 80], dir: 'low', note: 'g/L', maxGrade: 3 },
    WBC: { kind: 'abs', cuts: [3.0, 2.0, 1.0], dir: 'low', note: '10⁹/L' },
    ANC: { kind: 'abs', cuts: [1.5, 1.0, 0.5], dir: 'low', note: '10⁹/L' },
    ALB: { kind: 'abs', cuts: [30, 20], dir: 'low', note: 'g/L', maxGrade: 3 },
  }
  const LABELS = { ALP: '碱性磷酸酶 ALP', GGT: 'γ-谷氨酰转肽酶 GGT', ALT: '丙氨酸氨基转移酶 ALT', AST: '天门冬氨酸氨基转移酶 AST', TBil: '总胆红素 TBil', ALB: '白蛋白 ALB', PLT: '血小板 PLT', Hb: '血红蛋白 Hb', WBC: '白细胞 WBC', ANC: '中性粒细胞 ANC', Cr: '肌酐 Cr' }

  /* ------------------------------ 工具 ------------------------------ */
  const $ = (s, r) => (r || document).querySelector(s)
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s))
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  /* 文字型结果（`<5`、`阴性`、`未检出`）必须变成 null，不能变成 NaN：
     NaN 一路传进分级会算出 `ratio NaN` 并被判成 0 级 —— 界面上就是一片"正常"，
     而真实含义恰恰相反（工作人员把"低于检出下限"当成了正常值）。 */
  const num = (v) => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const pct = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10))

  /* 分级：只做「对照」，不做诊断（缺上限 → needsUln，绝不用通用上限补） */
  function gradeOf(item) {
    const def = GRADE_CODES[item.code]
    if (!def) return { state: 'none', reason: 'no-standard' }
    const v = num(item.value)
    if (v == null) return { state: 'none', reason: 'no-value' }
    if (def.kind === 'uln') {
      if (item.refHigh == null) return { state: 'needsUln' }
      const ratio = v / item.refHigh
      let g = 0
      for (const c of def.cuts) if (ratio > c) g++
      return { state: 'graded', grade: Math.min(g, 4), ratio }
    }
    /* 绝对阈值型：缺个人下限时借成人通用下限近似，但必须标 approx 让界面写「按通用下限」。
       口径是「下限可以借，上限不能借」—— 上限一项都不能补（补了就是把别人的正常值当你家的），
       下限补了只是让"偏低"这件事能被看见，而且补的时候界面会说明。 */
    const lower = item.refLow == null ? GENERIC_LOW[item.code] ?? null : item.refLow
    let g = 0
    if (def.dir === 'low') {
      if (lower != null && v < lower) g = 1
      for (const c of def.cuts) if (v < c) g++
    }
    const max = def.maxGrade || 4
    return { state: 'graded', grade: Math.min(g, max), approx: item.refLow == null }
  }

  /* Fritsch–Carlson 单调三次插值：保证不越过相邻数据点（一图秀硬要求） */
  function smoothPath(pts) {
    const n = pts.length
    if (n < 2) return ''
    const dx = [], m = []
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1].x - pts[i].x
      m[i] = dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i]
    }
    const t = new Array(n)
    t[0] = m[0]
    t[n - 1] = m[n - 2]
    for (let i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) t[i] = 0
      else {
        const w1 = 2 * dx[i] + dx[i - 1]
        const w2 = dx[i] + 2 * dx[i - 1]
        t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i])
      }
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 0; i < n - 1; i++) {
      const x1 = pts[i].x + dx[i] / 3
      const y1 = pts[i].y + (t[i] * dx[i]) / 3
      const x2 = pts[i + 1].x - dx[i] / 3
      const y2 = pts[i + 1].y - (t[i + 1] * dx[i]) / 3
      d += ` C ${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`
    }
    return d
  }

  function seriesFor(profile, code) {
    return profile.labs
      .map((r) => {
        const it = r.items.find((x) => x.code === code)
        return it ? { date: r.date, value: num(it.value), refHigh: it.refHigh, refLow: it.refLow, unit: it.unit, lab: it.lab } : null
      })
      .filter(Boolean)
  }

  /* ------------------------------ 状态 ------------------------------ */
  const state = {
    view: 'dashboard',
    sub: 'overview',
    profileKey: 'A',
    agentOpen: true,
    agentWidth: 35,
    page: null,
    draft: { itch: 5, nightWorse: false, scratch: false, sleepBreaks: 1, fatigue: 2, note: '' },
    localSymptoms: [],
  }
  const profile = () => DEMO.profiles.find((p) => p.key === state.profileKey)
  const allSymptoms = () => state.localSymptoms.concat(profile().symptoms).sort((a, b) => (a.date < b.date ? 1 : -1))

  /* ------------------------------ 顶栏 / 导航 ------------------------------ */
  function renderShell() {
    $('#version-chip').textContent = VERSION + ' · 开发版'
    $('#footer-built').textContent = '开发版 ' + VERSION
    $('#footer-profile').textContent = profile().label
    const nav = $('#sidenav')
    nav.innerHTML = NAV.map((n) => `<button class="nav-item" data-view="${n.id}" ${n.id === state.view ? 'aria-current="page"' : ''}><span class="dot"></span>${esc(n.label)}</button>`).join('')
    const cur = NAV.find((n) => n.id === state.view)
    $('#subtabs').innerHTML = cur.subs.map(([id, label]) => `<button class="subtab" role="tab" data-sub="${id}" aria-selected="${id === state.sub}">${esc(label)}</button>`).join('')
  }

  /* ------------------------------ 视图路由 ------------------------------ */
  const VIEWS = {
    'dashboard/overview': vDashboardOverview,
    'dashboard/next': vDashboardNext,
    'dashboard/changes': vDashboardChanges,
    'basics/diagnosis': vBasicsDiagnosis,
    'basics/fibrosis': vBasicsFibrosis,
    'basics/comorbidity': vBasicsComorbidity,
    'treatment/current': vTreatmentCurrent,
    'treatment/pathway': vTreatmentPathway,
    'treatment/sideeffects': vTreatmentSide,
    'labs/cards': vLabsCards,
    'labs/chart': vLabsChart,
    'labs/grading': vLabsGrading,
    'symptoms/itch': vSymptomItch,
    'symptoms/fatigue': vSymptomFatigue,
    'symptoms/log': vSymptomLog,
    'symptoms/impact': vSymptomImpact,
    'screening/bone': () => vScreeningType('bone', '骨骼', '骨密度与骨折风险的相关记录。只抄报告原文，不判读 T 值等级。'),
    'screening/thyroid': () => vScreeningType('thyroid', '甲状腺', '另一科开的检查与用药，在这里单独归集。'),
    'screening/endoscopy': () => vScreeningType('endoscopy', '食管胃镜', '静脉曲张筛查记录；显示距上次的月数，不替你决定何时复查。'),
    'screening/vitamins': () => vScreeningType('vitamin', '脂溶性维生素', '维生素 A/D/E/K 的记录；不推荐补剂、不给剂量。'),
    'screening/liver': () => vScreeningType('liver', '肝影像与 HCC 监测', '肝脏超声/影像的原话记录；不写"该做造影了"这类判断。'),
    'followup/cadence': vFollowupCadence,
    'followup/prep': vFollowupPrep,
    'followup/todos': vFollowupTodos,
    'records/import': vRecordsImport,
    'records/files': vRecordsFiles,
    'records/export': vRecordsExport,
    'trials/search': vTrialsSearch,
    'trials/saved': vTrialsSaved,
    'trials/sources': vTrialsSources,
  }

  function render() {
    renderShell()
    const fn = VIEWS[state.view + '/' + state.sub] || (() => '<div class="card">这一页还没实现</div>')
    $('#view').innerHTML = fn()
    bindViewEvents()
  }

  /* ------------------------------ 公用片段 ------------------------------ */
  function aiButton(prompt, ctxLabel) {
    return `<button class="btn ghost small" type="button" data-draft="${esc(prompt)}" data-ctx="${esc(ctxLabel || '')}">AI 帮我填</button>`
  }
  function kv(k, v, n) {
    return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${v}</span>${n ? `<span class="n">${esc(n)}</span>` : ''}</div>`
  }
  function badgeFor(item) {
    const g = gradeOf(item)
    if (g.state === 'needsUln') return '<span class="badge needs">需参考上限</span>'
    if (g.state === 'none') return '<span class="badge">未分级</span>'
    return `<span class="badge grade">对照 CTCAE v5.0 · ${g.grade} 级</span>`
  }

  /* ------------------------------ 看板 ------------------------------ */
  function vDashboardOverview() {
    const p = profile()
    const lastLabs = p.labs[p.labs.length - 1]
    const lastSym = allSymptoms()[0]
    const answers = p.questions.filter((q) => !q.done).length
    return `
      <div class="row-3">
        <div class="card">
          <div class="card-head"><span class="card-title">今天怎么样</span>${aiButton('我今天不太舒服，想记一笔', '看板·今天怎么样')}</div>
          <p class="muted">记一次痒或累，20 秒完成。也可以直接对右侧说。</p>
          <div class="actions-row" style="margin-top:8px">
            <button class="btn" type="button" data-goto="symptoms/itch">记一笔痒</button>
            <button class="btn ghost" type="button" data-goto="symptoms/fatigue">记一笔累</button>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><span class="card-title">接下来</span></div>
          ${kv('参考复查节点', '2026-11-08（约 1 个月后）', '±30 天是工作台显示带宽，不是指南内容')}
          <p class="muted" style="margin-top:6px">起点 ${esc(p.startedAt)} · 按 6 个月间隔推算，未按分期调整</p>
        </div>
        <div class="card">
          <div class="card-head"><span class="card-title">最近变化</span></div>
          ${kv('最近一次 ALP', `${lastLabs.items.find((i) => i.code === 'ALP').value} U/L`, `${lastLabs.date} · ${lastLabs.items[0].lab}`)}
          ${kv('最近一次记录的感受', lastSym ? `痒 ${lastSym.itch}/10 · 累 ${lastSym.fatigue}/3` : '无', lastSym ? lastSym.date : '')}
          <p class="muted" style="margin-top:6px">只并列事实，不判断好坏。</p>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="card-title">我的问题</span><span class="muted">${answers} 条待问</span></div>
        <ul class="list">
          ${p.questions.filter((q) => !q.done).slice(0, 4).map((q) => `<li><span class="timeline-dot"></span><span>${esc(q.text)}</span></li>`).join('') || '<li class="muted">还没有问题，去「复查节奏 → 就诊准备」加一条</li>'}
        </ul>
        <div class="actions-row" style="margin-top:8px">
          <button class="btn ghost" type="button" data-goto="followup/prep">整理复诊问题</button>
          <button class="btn ghost" type="button" data-goto="records/export">导出给医生</button>
        </div>
      </div>`
  }

  function vDashboardNext() {
    const p = profile()
    const nodes = cadenceNodes(p)
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">接下来要发生的事</span></div>
        <ul class="list">
          ${nodes.map((n) => `<li><span class="time">${esc(n.date)}</span><span>${esc(n.label)}<br><span class="muted">${esc(n.note)}</span></span></li>`).join('')}
        </ul>
        <p class="muted" style="margin-top:8px">这些是**参考节点**，不是提醒；工作台不会发通知。</p>
      </div>
      <div class="row">
        <div class="card"><div class="card-head"><span class="card-title">待办</span></div>
          <ul class="list">${p.questions.filter((q) => !q.done).slice(0, 3).map((q) => `<li><span class="timeline-dot"></span><span>${esc(q.text)}</span></li>`).join('') || '<li class="muted">无</li>'}</ul>
        </div>
        <div class="card"><div class="card-head"><span class="card-title">上次复查带走了什么</span></div>
          <p class="muted">导出快照 1 份（2026-10-08）· 含 6 次化验与 7 条感受记录</p>
        </div>
      </div>`
  }

  function vDashboardChanges() {
    const p = profile()
    const series = seriesFor(p, 'ALP')
    const first = series[0], last = series[series.length - 1]
    const ratio = (x) => (x.refHigh ? x.value / x.refHigh : null)
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">这 6 个月</span><span class="muted">只列变化，不给结论</span></div>
        <div class="row-3">
          ${kv('ALP 首次', `${first.value} U/L（${pct(ratio(first))}×ULN）`, first.date)}
          ${kv('ALP 最近', `${last.value} U/L（${pct(ratio(last))}×ULN）`, last.date)}
          ${kv('记录次数', `${series.length} 次化验`, `最近一次 ${last.date}`)}
        </div>
        <div style="margin-top:10px">${oneChart(p, ['ALP', 'GGT', 'TBil'])}</div>
        <p class="chart-note">每条线按自身全期 min/max 归一化，**数值之间不可直接比较**；单点不连线。</p>
      </div>`
  }

  /* ------------------------------ 我的病底 ------------------------------ */
  function vBasicsDiagnosis() {
    const p = profile()
    const tri = (v) => ({ positive: '阳性', negative: '阴性', untested: '未检测' }[v] || '未记录')
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">诊断要素（照抄报告，不判读）</span>${aiButton('我想补一下确诊时的抗体结果', '病底·诊断与抗体')}</div>
        <div class="row">
          ${kv('确诊日期', esc(p.diagnosedAt))}
          ${kv('AMA', tri(p.antibodies.ama), '三态：阳性 / 阴性 / 未检测')}
          ${kv('AMA-M2', tri(p.antibodies.amaM2))}
          ${kv('ANA', tri(p.antibodies.ana))}
        </div>
        <p class="muted" style="margin-top:8px">备注：${esc(p.antibodies.note)}</p>
        <div class="actions-row" style="margin-top:10px"><button class="btn ghost" type="button" data-page="diagnosis">看完整记录</button></div>
      </div>`
  }

  function vBasicsFibrosis() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">纤维化与影像</span></div>
        ${kv('检查方式', esc(p.fibrosis.method), '不同方式的结果不互相换算')}
        ${kv('结果原文', esc(p.fibrosis.value))}
        ${kv('日期', esc(p.fibrosis.date))}
        <p class="muted" style="margin-top:8px">${esc(p.fibrosis.note)}。工作台**不判断纤维化分期**，也不把弹性值换算成分级。</p>
      </div>`
  }

  function vBasicsComorbidity() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">合并症档案</span><span class="muted">各科各记，在这里归集</span></div>
        ${p.comorbidity.length ? `<ul class="list">${p.comorbidity.map((c) => `<li><span class="time">${esc(c.since)}</span><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.note)}</span></span></li>`).join('')}</ul>` : '<p class="muted">还没有记录</p>'}
        <p class="muted" style="margin-top:8px">合并症的诊断与治疗由各专科医生判断，本页只做记录。</p>
      </div>`
  }

  /* ------------------------------ 用药与应答 ------------------------------ */
  function vTreatmentCurrent() {
    const p = profile()
    const totalMissed = p.adherence.reduce((a, b) => a + b.missed, 0)
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">当前用药</span>${aiButton('我在吃的药想记一下', '用药·当前用药')}</div>
        ${p.meds.map((m) => `
          <div class="stack" style="border-bottom:1px dashed var(--line);padding-bottom:8px;margin-bottom:8px">
            ${kv(m.name, esc(m.doseText), `${m.freq} · 起 ${m.startDate}`)}
            <div><span class="badge needs">获批状态未核实</span></div>
          </div>`).join('')}
        <div class="actions-row">
          <button class="btn" type="button" data-miss="1">今天漏服</button>
          <span class="muted">近 6 个月累计漏服 ${totalMissed} 次（只是记录，不评价）</span>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="card-title">漏服月视图</span></div>
        <div class="row-3">
          ${p.adherence.map((a) => kv(a.month, `${a.missed} 次`)).join('')}
        </div>
      </div>`
  }

  function vTreatmentPathway() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">治疗路径（默认概要，点开看细节）</span><span class="ph-hint">打印时全部展开</span></div>
        ${p.pathway.map((ph) => `
          <details class="phase-fold" style="margin-bottom:8px">
            <summary><span class="phase-dot"></span><b>${esc(ph.phase)}</b><span class="muted">· ${esc(ph.d)}</span><span>· ${esc(ph.text)}</span></summary>
            <div class="phase-detail">
              ${pdBlock('方案', ph.detail.regimen)}
              ${pdBlock('指标和趋势', ph.detail.metrics)}
              ${pdBlock('影像发现', ph.detail.imaging)}
              ${pdBlock('副作用总结', ph.detail.ae)}
              ${pdBlock('心理/营养措施和效果', ph.detail.support)}
            </div>
          </details>`).join('')}
        <p class="muted">每张卡固定五块：方案 / 指标和趋势 / 影像发现 / 副作用总结 / 心理营养措施和效果；无内容写「无 + 说明」，不省略块。</p>
      </div>`
  }
  function pdBlock(title, block) {
    return `<section class="pd-block"><h4>${esc(title)}</h4><p class="muted">${esc(block.summary)}</p>
      <table>${block.items.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></section>`
  }

  function vTreatmentSide() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">副作用记录</span>${aiButton('我吃药后有点不舒服，想记一下', '用药·副作用')}</div>
        <ul class="list">
          <li><span class="time">2026-03</span><span>服药后腹胀，程度自评轻；处理原文：未处理</span></li>
          <li><span class="time">2025-12</span><span>偶有恶心，饭后缓解（患者自述）</span></li>
        </ul>
        <p class="muted" style="margin-top:8px">副作用不归因、不评级（本癌种未启用 CTCAE 症状分级），只记时间与原文。</p>
      </div>`
  }

  /* ------------------------------ 生化线 ------------------------------ */
  function vLabsCards() {
    const p = profile()
    const last = p.labs[p.labs.length - 1]
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">最近一次化验 · ${esc(last.date)}</span>${aiButton('帮我看看这次化验有什么变化', '生化线·指标卡')}</div>
        <p class="muted">点卡片翻到背面看这条线；缺参考上限的会标「需参考上限」，不会用通用值补。</p>
      </div>
      <div class="metric-grid">
        ${last.items.map((it) => {
          const series = seriesFor(p, it.code)
          const g = gradeOf(it)
          const prev = series.length > 1 ? series[series.length - 2] : null
          const delta = prev ? (it.value - prev.value) : null
          return `
            <div class="mcard" data-flip>
              <div class="mcard-inner">
                <div class="mface front">
                  <span class="label">${esc(LABELS[it.code] || it.code)}</span>
                  <span class="value">${esc(it.value)} <small>${esc(it.unit || '')}</small></span>
                  <span class="delta">${delta == null ? '无前次可比' : `较前次 ${delta > 0 ? '+' : ''}${delta}`}${it.refHigh == null ? '' : ` · 参考上限 ${it.refHigh}`}</span>
                  <span>${badgeFor(it)}</span>
                  <span class="src">${esc(it.lab)} · ${esc(last.date)}</span>
                </div>
                <div class="mface back">
                  <span class="label">${esc(LABELS[it.code] || it.code)} · 全期</span>
                  ${spark(series.map((s) => s.value))}
                  <span class="delta">${series.length} 个点 · ${esc(series[0].date)} 至 ${esc(series[series.length - 1].date)}</span>
                  <span class="src">${g.state === 'needsUln' ? '这张单子没有上限，无法算倍数' : g.state === 'graded' ? `对照 CTCAE v5.0（${g.ratio ? pct(g.ratio) + '×ULN' : '绝对阈值'}）` : '该项无 CTCAE 分级'}</span>
                </div>
              </div>
            </div>`
        }).join('')}
      </div>`
  }

  function spark(values) {
    const w = 240, h = 46, pad = 4
    const min = Math.min(...values), max = Math.max(...values)
    const span = max - min || 1
    const pts = values.map((v, i) => ({ x: pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1), y: h - pad - ((v - min) / span) * (h - pad * 2) }))
    const d = smoothPath(pts)
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#5C6B3C" stroke-width="1.6"/></svg>`
  }

  function oneChart(p, codes) {
    const w = 760, h = 260, padL = 34, padR = 16, padT = 16, padB = 46
    const dates = p.labs.map((r) => r.date)
    const xs = (i) => padL + (i * (w - padL - padR)) / Math.max(dates.length - 1, 1)
    const colors = { ALP: '#5C6B3C', GGT: '#A8681E', TBil: '#3C5A6B' }
    const lines = codes.map((code) => {
      const s = seriesFor(p, code)
      const vals = s.map((x) => x.value)
      const min = Math.min(...vals), max = Math.max(...vals)
      const span = max - min || 1
      const pts = s.map((x, i) => ({ x: xs(p.labs.findIndex((r) => r.date === x.date)), y: padT + (1 - (x.value - min) / span) * (h - padT - padB) }))
      const d = smoothPath(pts)
      const last = pts[pts.length - 1]
      const lastVal = s[s.length - 1].value
      return {
        code, d, pts, color: colors[code] || '#555',
        label: `<text x="${Math.min(last.x + 6, w - padR - 24).toFixed(1)}" y="${(last.y - 8).toFixed(1)}" font-size="11" fill="${colors[code] || '#555'}">${code} ${lastVal}</text>`,
      }
    })
    const gridY = [0, 1, 2, 3].map((i) => `<line x1="${padL}" x2="${w - padR}" y1="${padT + (i * (h - padT - padB)) / 3}" y2="${padT + (i * (h - padT - padB)) / 3}" stroke="#E2E0D3" stroke-width="1"/>`).join('')
    const xLabels = p.labs.map((r, i) => `<text x="${xs(i).toFixed(1)}" y="${h - 22}" font-size="10" fill="#7C8567" text-anchor="middle">${r.date.slice(5)}</text>`).join('')
    const events = p.pathway.map((ph) => {
      const idx = p.labs.findIndex((r) => r.date >= ph.d)
      if (idx < 0) return ''
      return `<line x1="${xs(idx).toFixed(1)}" x2="${xs(idx).toFixed(1)}" y1="${padT}" y2="${h - padB}" stroke="#CFCCB9" stroke-dasharray="3 3"/>`
    }).join('')
    return `
      <div class="chart-wrap">
        <svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="ALP、GGT、总胆红素的时间序列（各自归一化，不可直接比较）">
          ${gridY}${events}
          ${lines.map((l) => `<path d="${l.d}" fill="none" stroke="${l.color}" stroke-width="1.8"/>`).join('')}
          ${lines.map((l) => l.pts.map((pt) => `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.4" fill="${l.color}"/>`).join('')).join('')}
          ${lines.map((l) => l.label).join('')}
          ${xLabels}
          <line x1="${padL}" x2="${w - padR}" y1="${h - padB}" y2="${h - padB}" stroke="#CFCCB9"/>
        </svg>
        <div class="chart-legend">
          ${codes.map((c) => `<span class="legend-item"><span class="legend-swatch" style="background:${colors[c] || '#555'}"></span>${c}</span>`).join('')}
          <span class="legend-item"><span class="legend-swatch" style="background:#CFCCB9;height:2px"></span>治疗节点（竖虚线）</span>
        </div>
      </div>`
  }

  function vLabsChart() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">一图秀 · ${esc(p.label)}</span><span class="muted">各自归一化，不可直接比较</span></div>
        ${oneChart(p, ['ALP', 'GGT', 'TBil'])}
        <p class="chart-note">单点不连线；治疗节点只作时间参照，不代表疗效。</p>
      </div>
      <div class="card">
        <div class="card-head"><span class="card-title">口径</span></div>
        <p class="muted">三条线各自按全期 min/max 归一化，所以"哪条更高"没有意义；要看倍数请回「指标卡」，那里按每张单子的参考上限算。</p>
      </div>`
  }

  function vLabsGrading() {
    const p = profile()
    const last = p.labs[p.labs.length - 1]
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">分级说明（对照，不是诊断）</span></div>
        <ul class="list">
          <li><span class="badge grade">对照 CTCAE v5.0 · 2 级</span><span>有参考上限时给的对照徽章；卡面同时给区间与实测倍数。</span></li>
          <li><span class="badge needs">需参考上限</span><span>这张单子没印上限 → 不计算倍数、不给级别（下限可以借，上限不能借）。</span></li>
          <li><span class="badge">未分级</span><span>该项在 CTCAE 里没有可用阈值（如 GGT），或单位无法确认。</span></li>
        </ul>
        <div class="row" style="margin-top:10px">
          ${kv('本次可分级项', String(last.items.filter((i) => gradeOf(i).state === 'graded').length))}
          ${kv('缺上限项', String(last.items.filter((i) => gradeOf(i).state === 'needsUln').length), '这些项不给级别')}
        </div>
        <p class="muted" style="margin-top:10px">工作台不计算 GLOBE / UK-PBC / 巴黎 / 巴塞罗那等应答评分——那些是医生用的判定工具。界面也不写"应答/未应答"。</p>
      </div>`
  }

  /* ------------------------------ 痒与累 ------------------------------ */
  function sliderRow(id, label, value, min, max, hint) {
    return `<div class="field"><label for="${id}">${esc(label)}：<b id="${id}-out">${value}</b>${hint ? ` <span class="muted">${esc(hint)}</span>` : ''}</label>
      <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" step="1"></div>`
  }

  function vSymptomItch() {
    const d = state.draft
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">今天的痒</span>${aiButton('今天痒 6 分，晚上更重', '痒与累·今天的痒')}</div>
        ${sliderRow('itch', '痒的程度（0–10，你自己打分）', d.itch, 0, 10, '不是医学量表，只是你的感觉')}
        <div class="row" style="margin-top:8px">
          <label class="field"><span>夜间更重</span><span><input type="checkbox" id="night" ${d.nightWorse ? 'checked' : ''}> 勾选</span></label>
          <label class="field"><span>抓破/留痕</span><span><input type="checkbox" id="scratch" ${d.scratch ? 'checked' : ''}> 勾选</span></label>
        </div>
        <div class="field" style="margin-top:8px"><label for="note">一句描述（可空）</label><input type="text" id="note" value="${esc(d.note)}" placeholder="例如：小腿外侧，夜里最痒"></div>
        <div class="actions-row" style="margin-top:10px">
          <button class="btn" type="button" id="save-itch">保存这一次</button>
          <span class="muted">保存后进入「我的记录」，AI 不会替你打分</span>
        </div>
      </div>`
  }

  function vSymptomFatigue() {
    const d = state.draft
    const opts = [['1', '能完成日常'], ['2', '勉强完成'], ['3', '做不了']]
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">今天的累</span>${aiButton('今天整个人没电，走两层楼要歇', '痒与累·今天的累')}</div>
        <div class="segmented" id="fatigue-seg">
          ${opts.map(([v, t]) => `<button type="button" data-fatigue="${v}" aria-pressed="${String(d.fatigue) === v}">${t}</button>`).join('')}
        </div>
        <p class="muted" style="margin-top:8px">三档只是"今天能不能完成日常"，不是乏力分级量表。</p>
      </div>`
  }

  function vSymptomLog() {
    const list = allSymptoms()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">我的记录</span><span class="muted">共 ${list.length} 条</span></div>
        <ul class="list">
          ${list.map((s) => {
            const lab = profile().labs.find((r) => r.date === s.date)
            const alp = lab ? lab.items.find((i) => i.code === 'ALP') : null
            return `<li><span class="time">${esc(s.date)}</span><span>
              <b>痒 ${s.itch}/10 · 累 ${s.fatigue}/3</b>${s.nightWorse ? ' · 夜间重' : ''}${s.scratch ? ' · 抓破' : ''} · 睡被打断 ${s.sleepBreaks} 次
              ${s.note ? `<br><span class="muted">${esc(s.note)}</span>` : ''}
              <br><span class="muted">同日指标：${alp ? `ALP ${alp.value} U/L（${alp.refHigh ? pct(alp.value / alp.refHigh) + '×ULN' : '无上限'}）` : '当天没有化验'}</span>
            </span></li>`
          }).join('')}
        </ul>
        <p class="muted" style="margin-top:8px">两列只并列：左「你的感受」右「同日的数」。工作台不解释它们之间有没有关系。</p>
      </div>`
  }

  function vSymptomImpact() {
    const list = allSymptoms()
    const nights = list.filter((s) => s.nightWorse).length
    const broken = list.reduce((a, b) => a + (b.sleepBreaks || 0), 0)
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">影响与睡眠</span></div>
        <div class="row-3">
          ${kv('夜间加重的记录', `${nights} / ${list.length} 条`)}
          ${kv('睡眠被打断累计', `${broken} 次`)}
          ${kv('最近 30 天记录', `${list.filter((s) => s.date >= '2026-09-25').length} 条`)}
        </div>
        <p class="muted" style="margin-top:8px">这些数字只用于"复诊时说得清"，不代表病情轻重。</p>
      </div>`
  }

  /* ------------------------------ 并发症筛查 ------------------------------ */
  function vScreeningType(kind, title, desc) {
    const p = profile()
    const rec = p.screening.filter((s) => s.type === kind)
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">${esc(title)}</span>${aiButton(`我想记一次${title}的检查结果`, '筛查·' + title)}</div>
        <p class="muted">${esc(desc)}</p>
        ${rec.length ? `<ul class="list" style="margin-top:8px">
          ${rec.map((r) => `<li><span class="time">${esc(r.date)}</span><span>${esc(r.result)}${r.detail ? `<br><span class="muted">${esc(r.detail)}</span>` : ''}</span></li>`).join('')}
        </ul>` : '<p class="muted" style="margin-top:8px">还没有记录。</p>'}
        ${kind === 'endoscopy' && rec.length ? `<p class="muted" style="margin-top:8px">距上次 ${monthsSince(rec[rec.length - 1].date)} 个月 · 参考间隔 12–24 个月（工作台默认值，不是指南内容）</p>` : ''}
        <div class="actions-row" style="margin-top:10px"><button class="btn ghost" type="button" data-more="1">⋯ 更多</button></div>
      </div>`
  }
  function monthsSince(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const now = new Date('2026-10-25T00:00:00')
    return Math.max(0, Math.round((now - d) / (1000 * 60 * 60 * 24 * 30.4)))
  }

  /* ------------------------------ 复查节奏 ------------------------------ */
  function cadenceNodes(p) {
    const start = new Date(p.startedAt + 'T00:00:00')
    const addMonths = (d, m) => {
      const nd = new Date(d.getTime())
      const day = nd.getDate()
      nd.setMonth(nd.getMonth() + m)
      if (nd.getDate() < day) nd.setDate(0) // 月末夹取：1/31 + 1 月 = 2 月末
      return nd
    }
    /* 本地日期 → 'YYYY-MM-DD' 必须手拼，不能用 toISOString()：
       toISOString 走 UTC，东八区的本地零点会退成前一天（2024-03-20 + 6 个月
       显示成 2024-09-19，用户按它去约复查会早一天）。 */
    const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return [6, 12].map((m) => {
      const d = addMonths(start, m)
      const iso = isoOf(d)
      return { date: iso, label: `${m} 个月复查参考节点`, note: `起点 ${p.startedAt} + ${m} 个月；±30 天为显示带宽` }
    })
  }

  function vFollowupCadence() {
    const p = profile()
    const nodes = cadenceNodes(p)
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">复查节奏</span><span class="muted">只算参考节点，不排计划</span></div>
        <ul class="list">
          ${nodes.map((n) => `<li><span class="time">${esc(n.date)}</span><span>${esc(n.label)}<br><span class="muted">${esc(n.note)}</span></span></li>`).join('')}
        </ul>
        <div class="stack" style="margin-top:10px">
          ${kv('起点', esc(p.startedAt), '开始用药日；改起点会整体平移节点（不是"上次复查 + 间隔"）')}
          ${kv('检查项', '肝功能 / 血常规 / 超声（按医生安排）', '工作台不替你决定查什么')}
        </div>
        <p class="muted" style="margin-top:8px">工作台不发提醒、不弹通知；这里只是"下次大概什么时候"。</p>
      </div>`
  }

  function vFollowupPrep() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">就诊准备</span>${aiButton('帮我理一下这次要问医生什么', '复查节奏·就诊准备')}</div>
        <ul class="list">
          ${p.questions.map((q) => `<li><input type="checkbox" ${q.done ? 'checked' : ''} aria-label="已问"> <span>${esc(q.text)}</span></li>`).join('')}
        </ul>
        <div class="field" style="margin-top:8px"><label for="new-q">再加一条问题</label><input type="text" id="new-q" placeholder="例如：这次的 ALP 和上次比怎么样？"></div>
        <div class="actions-row" style="margin-top:8px">
          <button class="btn ghost" type="button" id="add-q">加进清单</button>
          <button class="btn" type="button" data-goto="records/export">导出给医生</button>
        </div>
        <p class="muted" style="margin-top:8px">引导句式只做结构提示，不替你写医学结论。</p>
      </div>`
  }

  function vFollowupTodos() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">待办与问题</span></div>
        <div class="row">
          <div>${kv('待问医生的', String(p.questions.filter((q) => !q.done).length) + ' 条')}
            <p class="muted">来自「就诊准备」勾选</p></div>
          <div>${kv('我自己的待办', '0 条', '新建待办 due 为空，不设截止日提醒')}</div>
        </div>
        <div class="actions-row" style="margin-top:8px"><button class="btn ghost" type="button" data-goto="followup/prep">去整理问题</button></div>
      </div>`
  }

  /* ------------------------------ 报告与资料 ------------------------------ */
  function vRecordsImport() {
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">导入报告</span></div>
        <p class="muted">选一份化验单照片或 PDF。**原件会上传到云端解析服务**（MinerU），本页会先让你确认再上传。</p>
        <div class="actions-row" style="margin-top:10px">
          <button class="btn" type="button" id="pick-file">选文件（演示）</button>
          <span class="muted">本轮未接真实解析：按钮只走候选演示</span>
        </div>
        <div class="card" style="margin-top:10px;background:#FCFBF5">
          <div class="card-head"><span class="card-title">候选（逐项核对）</span><span class="badge needs">未保存</span></div>
          <ul class="list">
            <li><span>ALP</span><span class="muted">231 U/L · 上限 120 · 2026-10-08</span><span class="badge grade">核对后入档</span></li>
            <li><span>GGT</span><span class="muted">171 U/L · 上限 45 · 2026-10-08</span></li>
            <li><span>总胆红素</span><span class="muted">13 µmol/L · 上限 21 · 2026-10-08</span></li>
          </ul>
          <div class="actions-row" style="margin-top:8px">
            <button class="btn" type="button" id="confirm-cand">确认这 3 项</button>
            <button class="btn ghost" type="button" id="reject-cand">全部拒收</button>
          </div>
          <p class="muted" style="margin-top:6px">拒收不改变任何已存记录（零副作用）。</p>
        </div>
      </div>`
  }

  function vRecordsFiles() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">原件</span><span class="muted">${p.documents.length} 份</span></div>
        <ul class="list">
          ${p.documents.map((d) => `<li><span class="time">${esc(d.date)}</span><span>${esc(d.name)} <span class="badge ${d.parsed ? 'ok' : ''}">${d.parsed ? '已解析' : '未解析'}</span></span></li>`).join('')}
        </ul>
        <p class="muted" style="margin-top:8px">原件留在本机资料目录；导出时默认不带原件，只带结构化记录。</p>
      </div>`
  }

  function vRecordsExport() {
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">导出给医生</span>${aiButton('帮我把最近半年整理成一份给医生', '报告与资料·导出')}</div>
        <div class="row">
          ${kv('时间窗', '最近 6 个月')}
          ${kv('包含', '化验 · 用药 · 感受记录 · 问题清单')}
        </div>
        <p class="muted" style="margin-top:8px">私密标记的内容不会进导出；快照会写"数据截止日"与"此后新增记录未包含"。</p>
        <div class="actions-row" style="margin-top:10px">
          <button class="btn" type="button" id="do-export">生成快照</button>
          <span class="muted">原型演示：生成一份可下载的文本快照</span>
        </div>
      </div>`
  }

  /* ------------------------------ 临床研究 ------------------------------ */
  function vTrialsSearch() {
    const p = profile()
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">检索</span><span class="badge">登记状态，未核实</span></div>
        <div class="row">
          <div class="field"><label for="kw">关键词</label><input type="text" id="kw" value="原发性胆汁性胆管炎" ></div>
          <div class="field"><label for="area">地区</label><input type="text" id="area" value="" placeholder="可空"></div>
        </div>
        <div class="actions-row" style="margin-top:8px"><button class="btn" type="button" id="do-search">检索（演示 2 条）</button></div>
        <ul class="list" style="margin-top:10px">
          ${p.trials.map((t) => `<li><span class="time">${esc(t.source)}</span><span><b>${esc(t.title)}</b><br><span class="muted">${esc(t.phase)} · ${esc(t.area)} · ${esc(t.status)}</span></span></li>`).join('')}
        </ul>
        <p class="muted" style="margin-top:8px">登记 ≠ 有效 ≠ 安全 ≠ 可入组；工作台不判断你符不符合条件。</p>
      </div>`
  }

  function vTrialsSaved() {
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">收藏</span></div>
        <p class="muted">还没有收藏。检索结果卡上的「收藏」会存在本机。</p>
      </div>`
  }

  function vTrialsSources() {
    return `
      <div class="card">
        <div class="card-head"><span class="card-title">来源说明</span></div>
        <ul class="list">
          <li><span class="time">ictrp</span><span>WHO ICTRP（全球广度）</span></li>
          <li><span class="time">ctv</span><span>ClinicalTrials.gov 深度索引</span></li>
          <li><span class="time">chictr</span><span>ChiCTR 实时</span></li>
          <li><span class="time">cde</span><span>药物临床试验登记与信息公示平台（含 PI）</span></li>
        </ul>
        <p class="muted" style="margin-top:8px">离线语料目前**只覆盖胰腺癌**，对 PBC 属「未配置」——查不到不等于不存在。</p>
      </div>`
  }

  /* ------------------------------ 交互绑定 ------------------------------ */
  function bindViewEvents() {
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => {
      state.view = b.dataset.view
      state.sub = NAV.find((n) => n.id === state.view).subs[0][0]
      render()
    }))
    $$('[data-sub]').forEach((b) => b.addEventListener('click', () => { state.sub = b.dataset.sub; render() }))
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => {
      const [v, s] = b.dataset.goto.split('/')
      state.view = v; state.sub = s; render()
    }))
    $$('[data-flip]').forEach((c) => {
      c.addEventListener('click', () => c.classList.toggle('flipped'))
      c.setAttribute('tabindex', '0')
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.classList.toggle('flipped') } })
    })
    $$('[data-draft]').forEach((b) => b.addEventListener('click', () => {
      const prompt = b.dataset.draft
      const ctx = draftContext(b.dataset.ctx)
      const detail = { prompt, context: ctx, channel: EVT_DRAFT }
      document.dispatchEvent(new CustomEvent(EVT_DRAFT, { detail }))
      const ta = $('#agent-text')
      ta.value = `${prompt}\n\n【病情上下文】${ctx}`
      ta.focus()
      toast('已把提示词放进输入框（不会自动发送）')
    }))
    const saveItch = $('#save-itch')
    if (saveItch) saveItch.addEventListener('click', () => {
      const s = {
        date: '2026-10-25',
        itch: Number($('#itch').value),
        nightWorse: $('#night').checked,
        scratch: $('#scratch').checked,
        sleepBreaks: Number(state.draft.sleepBreaks),
        fatigue: state.draft.fatigue,
        note: $('#note').value,
      }
      state.localSymptoms.unshift(s)
      toast('已记下这一次（演示：仅本页内存，不落库）')
      state.view = 'symptoms'; state.sub = 'log'; render()
    })
    const itch = $('#itch')
    if (itch) itch.addEventListener('input', () => { $('#itch-out').textContent = itch.value; state.draft.itch = Number(itch.value) })
    $$('[data-fatigue]').forEach((b) => b.addEventListener('click', () => {
      state.draft.fatigue = Number(b.dataset.fatigue)
      $$('[data-fatigue]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    }))
    const miss = $('[data-miss]')
    if (miss) miss.addEventListener('click', () => toast('已记一次漏服（演示：不落库）'))
    const addQ = $('#add-q')
    if (addQ) addQ.addEventListener('click', () => {
      const v = $('#new-q').value.trim()
      if (!v) return toast('先写一条问题')
      profile().questions.push({ id: 'q' + Date.now(), text: v, done: false })
      toast('已加入清单')
      render()
    })
    const pick = $('#pick-file')
    if (pick) pick.addEventListener('click', () => toast('演示：这里会先弹"原件将上传"确认，再出候选'))
    const confirmCand = $('#confirm-cand')
    if (confirmCand) confirmCand.addEventListener('click', () => toast('已确认 3 项（演示：不落库）'))
    const rejectCand = $('#reject-cand')
    if (rejectCand) rejectCand.addEventListener('click', () => toast('已全部拒收，未改动任何记录'))
    const doSearch = $('#do-search')
    if (doSearch) doSearch.addEventListener('click', () => toast('演示：真实检索在 M4 接 unified-trial-mcp'))
    const doExport = $('#do-export')
    if (doExport) doExport.addEventListener('click', () => {
      const p = profile()
      const last = p.labs[p.labs.length - 1]
      const txt = [
        `小管宝 DuctPal 就诊快照（虚构示例）`,
        `档案：${p.label} · 生成时间：2026-10-25 · 数据截止：${last.date}`,
        `此后新增记录未包含。本文件只整理资料，不构成医疗建议。`,
        '',
        `【最近一次化验】${last.date} ${last.items[0].lab}`,
        ...last.items.map((i) => `- ${i.code} ${i.value} ${i.unit || ''}（参考 ${i.refLow}–${i.refHigh ?? '未印'}）`),
        '',
        `【当前用药】`,
        ...p.meds.map((m) => `- ${m.name} ${m.doseText}（${m.freq}）获批状态未核实`),
        '',
        `【待问医生】`,
        ...p.questions.filter((q) => !q.done).map((q) => `- ${q.text}`),
      ].join('\n')
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `DuctPal-就诊快照-2026-10-25.txt`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      toast('已生成快照文件')
    })
    const more = $('[data-more]')
    if (more) more.addEventListener('click', () => toast('⋯ 更多：手工补一条 / 改这一条 / 看原文'))
    const pageBtn = $('[data-page]')
    if (pageBtn) pageBtn.addEventListener('click', () => openPage(basicsPage()))
  }

  function draftContext(label) {
    const p = profile()
    const last = p.labs[p.labs.length - 1]
    const alp = last.items.find((i) => i.code === 'ALP')
    return `${p.label}｜确诊 ${p.diagnosedAt}｜最近化验 ${last.date}：ALP ${alp.value} U/L（${alp.refHigh ? pct(alp.value / alp.refHigh) + '×ULN' : '无上限'}）｜最近感受：痒 ${allSymptoms()[0]?.itch ?? '—'}/10`
  }

  /* ------------------------------ 整页视图（32 号） ------------------------------ */
  function basicsPage() {
    const p = profile()
    return `<div class="card">
      <h3>诊断与抗体 · 完整记录</h3>
      <p class="muted">这一页把「确诊时的原文」与「后来补做的检查」分开列，避免把不同时间的结论混在一起。</p>
      <div class="row" style="margin-top:10px">
        ${kv('确诊日期', esc(p.diagnosedAt))}
        ${kv('开始用药', esc(p.startedAt))}
        ${kv('AMA', { positive: '阳性', negative: '阴性', untested: '未检测' }[p.antibodies.ama])}
        ${kv('AMA-M2', { positive: '阳性', negative: '阴性', untested: '未检测' }[p.antibodies.amaM2])}
      </div>
      <p class="muted" style="margin-top:8px">来源：${esc(p.antibodies.note)}</p>
    </div>`
  }

  const pageStack = []
  function openPage(html, title, push) {
    $('#page-body').innerHTML = html
    $('#page-title').textContent = title || '详情'
    $('#page').hidden = false
    pageStack.push(title || '详情')
    if (push !== false) history.pushState({ page: pageStack.length }, '', '#page=' + pageStack.length)
  }
  function closePage(viaHistory) {
    if ($('#page').hidden) return
    $('#page').hidden = true
    pageStack.pop()
    if (!viaHistory) history.back()
  }

  /* ------------------------------ AI 面板 ------------------------------ */
  function applyAgentWidth() {
    const frame = $('#frame')
    if (state.agentOpen) frame.style.setProperty('--agent-w', state.agentWidth + '%')
    frame.classList.toggle('agent-hidden', !state.agentOpen)
    $('#btn-ai').textContent = state.agentOpen ? '收起 AI 对话' : '打开 AI 对话'
    $('#btn-ai').dataset.state = state.agentOpen ? 'open' : 'closed'
  }
  function clampAgentWidth(w) { return Math.max(25, Math.min(45, Math.round(w))) }

  function bindShell() {
    $('#btn-ai').addEventListener('click', () => { state.agentOpen = !state.agentOpen; applyAgentWidth() })
    $('#btn-ai-hide').addEventListener('click', () => { state.agentOpen = false; applyAgentWidth() })
    $('#profile-btn').addEventListener('click', () => {
      state.profileKey = state.profileKey === 'A' ? 'B' : 'A'
      state.localSymptoms = []
      toast('已切换到' + profile().label)
      render(); $('#footer-profile').textContent = profile().label
    })
    const sp = $('#agent-splitter')
    sp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        state.agentWidth = clampAgentWidth(state.agentWidth + (e.key === 'ArrowLeft' ? 2 : -2))
        sp.setAttribute('aria-valuenow', state.agentWidth)
        applyAgentWidth(); localStorage.setItem('pbc.agentWidth', String(state.agentWidth))
      }
      if (e.key === 'Home') { state.agentWidth = 45; applyAgentWidth() }
      if (e.key === 'End') { state.agentWidth = 25; applyAgentWidth() }
    })
    let dragging = false
    sp.addEventListener('mousedown', () => { dragging = true; document.body.style.userSelect = 'none' })
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return
      const rect = $('#frame').getBoundingClientRect()
      const w = ((rect.right - e.clientX) / rect.width) * 100
      state.agentWidth = clampAgentWidth(w)
      sp.setAttribute('aria-valuenow', state.agentWidth)
      applyAgentWidth()
    })
    window.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false; document.body.style.userSelect = ''
      localStorage.setItem('pbc.agentWidth', String(state.agentWidth))
    })
    $('#agent-send').addEventListener('click', () => {
      const ta = $('#agent-text')
      const v = ta.value.trim()
      if (!v) return toast('先写一句')
      /* 这里**不造回复**：把内容交给宿主原生会话，由那边真的回答。
         自己拼一条"AI 收到了"会让用户以为已经问过医生了。 */
      document.dispatchEvent(new CustomEvent(EVT_DRAFT, { detail: { prompt: v, context: '', channel: EVT_DRAFT } }))
      ta.value = ''
      toast('已交给右侧原生会话；本页不模拟回复')
    })
    $('#agent-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#agent-send').click() }
    })
    $('#page-back').addEventListener('click', () => closePage())
    $('#page-close').addEventListener('click', () => closePage())
    window.addEventListener('popstate', () => {
      if (!$('#page').hidden) { $('#page').hidden = true; pageStack.pop() }
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#page').hidden) closePage()
    })
    const saved = Number(localStorage.getItem('pbc.agentWidth'))
    if (saved) state.agentWidth = clampAgentWidth(saved)
  }

  function toast(msg) {
    const t = $('#toast')
    t.textContent = msg
    t.hidden = false
    clearTimeout(toast._t)
    toast._t = setTimeout(() => { t.hidden = true }, 2600)
  }

  /* ------------------------------ 数据来源横幅 ------------------------------ */
  function showSourceBanner() {
    const old = document.getElementById('source-banner')
    if (old) old.remove()
    if (DATA_SOURCE === 'api') return
    const bg = DATA_SOURCE === 'empty' ? '#EDF0E2' : '#FBF1DF'
    const fg = DATA_SOURCE === 'empty' ? '#3F4A2B' : '#A8681E'
    document.body.insertAdjacentHTML('afterbegin',
      '<div id="source-banner" style="background:' + bg + ';color:' + fg +
      ';padding:8px 14px;border-bottom:1px solid #E1DFD2;font-size:12.5px">' + esc(DATA_NOTE) + '</div>')
  }

  /* ------------------------------ 原生会话挂载位 ------------------------------ */
  /* 开发版**不自建聊天框**：把 AI 面板主体换成宿主原生会话的挂载位，
     只说明"会话在哪个面板、这里不模拟回答"。原型里那三条示例气泡是演示用的，
     进了开发版就会让人以为这里能问医学问题。 */
  function renderAgentSlot() {
    const body = $('#agent-body')
    if (!body || DATA_SOURCE !== 'api') return
    body.innerHTML =
      '<div class="msg ai"><b>AI 对话在右侧原生面板</b><br>这个页面只负责整理资料。' +
      '点页面里的「AI 帮我填」会把提示词和这一页的病情要点交给宿主的原生会话，' +
      '由你确认后再发送；本页不会替你回答医学问题。</div>'
  }

  /* ------------------------------ 启动 ------------------------------ */
  async function boot() {
    const loaded = await loadBootstrap()
    if (loaded.reachable) {
      if (applyData(loaded.data) && DEMO.profiles.length) {
        DATA_SOURCE = 'api'
      } else {
        /* 接口通但库里没有档案：给空态，绝不拿演示档案顶上 */
        DATA_SOURCE = 'empty'
        DATA_NOTE = '工作台连上了，但你的资料库里还没有档案。导入一张化验单或新建档案后，这里才会有内容。'
        DEMO = { generatedAt: '', profiles: [], sourceStates: [] }
      }
    } else {
      DATA_SOURCE = 'demo'
      DATA_NOTE = '没连上工作台接口，下面显示的是演示数据（虚构）。'
    }
    if (DEMO_FALLBACK && !DEMO.profiles.length && DATA_SOURCE === 'demo') DEMO = DEMO_FALLBACK
    showSourceBanner()
    if (!DEMO || !DEMO.profiles || !DEMO.profiles.length) {
      // 启动期校验失败：渲染横幅，禁止裸 throw 白屏（ZERO-TO-DEV 硬约束 18）
      document.body.insertAdjacentHTML('afterbegin', '<div style="background:#FBF1DF;color:#A8681E;padding:10px 14px;border-bottom:1px solid #E6CDA4">演示数据未加载：请确认 demo-data.js 与 index.html 在同一目录。</div>')
      return
    }
    bindShell()
    applyAgentWidth()
    render()
    renderAgentSlot()
    if (location.hash.startsWith('#page=')) openPage(basicsPage(), '诊断与抗体 · 完整记录', false)
  }
  document.addEventListener('DOMContentLoaded', boot)
})()
