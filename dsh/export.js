/* 导出：把档案整理成一份「复诊准备」markdown（给本人带去门诊，不是病历）。
 *
 * 四条硬约束（每条都有一次返工记录）：
 * 1. **私密分节不进导出**：`visibility='private'` 的痒累记录、合并症、换线记录一律不写。
 *    即便调用方传 includePrivate=true 也只影响页面——带出去被人看见的风险不在页面里。
 *    被排除时不静默：末尾写一句"有这块内容，本文件不含"，否则用户会以为丢数据。
 * 2. **看法不是结论**：本人记录段落必须带「本人记录，不是医生结论」的抬头。
 * 3. **只抄不解释**：数值、报告原文、分级照抄；不写"建议/可能/需要注意/提示/考虑"
 *    这类判读词（`scripts/check-wording.mjs` 会拦）。参考区间外只标"超出参考区间"，
 *    不写"偏高/异常"。
 * 4. **缺值不伪造**：没有的段落整段不出现，不写"暂无数据"占位；
 *    数值缺失写 `—` 而不是 0（`Number(null)===0` 陷阱）。
 *
 * 时间窗：默认最近 6 个月。窗口外的数据不删，但导出里不出现——
 * 因为带去门诊的一页纸必须短，全量核对靠应用，不靠这份文件。
 */

const LINE = '\n'

/** 导出默认时间窗（月）。改这里等于改产品口径，`test/export.test.mjs` 会跟着验。 */
export const EXPORT_WINDOW_MONTHS = 6

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 减去 N 个月；目标月份没有那一天时夹到月末（1/31 - 1 月 → 2/28）。 */
export function monthsAgo(from, months) {
  const d = new Date(from.getTime())
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

/** 字符串日期是否落在窗口内。非 ISO 日期一律算窗口内（宁可多带，不可少带）。 */
export function inWindow(dateStr, cutoff) {
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return true
  return dateStr.slice(0, 10) >= cutoff
}

function table(headers, rows) {
  if (!rows.length) return ''
  const out = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`]
  for (const r of rows) {
    out.push(`| ${r.map((c) => (c === null || c === undefined || c === '' ? '—' : String(c))).join(' | ')} |`)
  }
  return out.join(LINE)
}

function section(title, body) {
  return body ? `${LINE}## ${title}${LINE}${LINE}${body}${LINE}` : ''
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * 参考区间文字。两个端点都有 → `a–b`；缺一侧就**明说缺哪一侧**；都没有 → null（不写"未知"）。
 *
 * 为什么不用 `≥35` 这种写法：报告单上印的是"参考范围 35–120"，
 * 缺上限时写 `≥35` 会被读成"正常值应该 ≥35"，方向正好拧了。
 * 患者视角必须写成"只印了下限 35，上限未印"。
 */
export function bandText(low, high, unit) {
  const u = unit ? ` ${unit}` : ''
  if (low !== null && high !== null) return `${low}–${high}${u}`
  if (low !== null) return `只印了下限 ${low}${u}，上限未印`
  if (high !== null) return `只印了上限 ${high}${u}，下限未印`
  return null
}

/**
 * 这一条是否落在参考区间外。
 * 三态：`inside` / `outside` / `unknown`（缺端点或缺数值）。
 * **缺上限绝不判 outside**——本仓口径：借下限不等于借上限。
 */
export function bandState(value, low, high) {
  const v = num(value)
  if (v === null) return 'unknown'
  if (low === null && high === null) return 'unknown'
  if (low !== null && v < low) return 'outside'
  if (high !== null && v > high) return 'outside'
  /* 只有下限（上限缺）时：不低于下限只能说"没越出已知的那一侧"，
     不能判 inside（上限未知），也不能判 outside（可能只是没超上限）。 */
  if (high === null) return v >= low ? 'inside-known-low' : 'outside'
  return 'inside'
}

const STATE_TEXT = {
  inside: '',
  'inside-known-low': '上限未印，无法判断',
  outside: '超出参考区间',
  unknown: '',
}

/**
 * 生成复诊准备 markdown。
 * @param {object} profile 读模型给的单份档案（camelCase，与 demo-data.js 同形）
 * @param {{now?:Date, version?:string, windowMonths?:number}} [opts]
 *   注意：**没有** excludedPrivate 选项。私密过滤与"是否写排除声明"都在本函数内部算，
 *   调用方传什么都不影响——上一版正是靠调用方记得传参，结果两个出口都漏了。
 */
export function renderPrepMarkdown(profile, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date()
  const windowMonths = opts.windowMonths ?? EXPORT_WINDOW_MONTHS
  const cutoff = ymd(monthsAgo(now, windowMonths))
  const p = profile ?? {}
  const out = []

  /* 私密过滤的唯一实现：**在这里**，不在调用方。
     第一版靠调用方记得传 includePrivate:false，而 routes.js:157 与 workbench.js:79
     为了页面完整都传了 true —— 于是导出把私密原文带了出去，文件末尾还印着
     "本文件不包含"，是"既声明又违反"。现在无论调用方传什么，导出侧一律剔除；
     是否写排除声明也由这里自己算，不信调用方。 */
  const shared = (list) => (list ?? []).filter((r) => r && r.visibility !== 'private')
  const excludedPrivate = hasPrivateContent(p)

  out.push(`# 复诊准备 · ${p.label ?? '档案'}${p.name ? `（${p.name}）` : ''}`)
  out.push('')
  out.push(`- 生成时间：${ymd(now)}`)
  out.push(`- 数据截止：${cutoff}（此后新增记录未包含）`)
  if (opts.version) out.push(`- 工作台版本：${opts.version}`)
  out.push('')
  out.push('本文件只包含本人记录的信息，不构成诊断或治疗意见；具体判断请以主诊医生意见为准。')

  /* 一、基本信息 */
  const info = [
    p.age !== null && p.age !== undefined ? `- 年龄：${p.age}` : null,
    p.sex ? `- 性别：${p.sex}` : null,
    p.diagnosedAt ? `- 确诊日期：${p.diagnosedAt}` : null,
    p.startedAt ? `- 开始治疗：${p.startedAt}` : null,
    p.weightKg !== null && p.weightKg !== undefined ? `- 体重：${p.weightKg} kg` : null,
  ].filter(Boolean)
  const ab = p.antibodies
  const abRows = ab
    ? [
      ['AMA', ab.ama], ['AMA-M2', ab.amaM2], ['ANA', ab.ana],
    ].map(([k, v]) => [k, v === 'positive' ? '阳性' : v === 'negative' ? '阴性' : '未查'])
    : []
  if (ab?.note) abRows.push(['来源', ab.note])
  out.push(section('基本信息与抗体', [info.join(LINE), abRows.length ? `${LINE}${table(['项目', '结果'], abRows)}` : '']
    .filter(Boolean).join(LINE)))

  /* 二、纤维化与影像（只抄报告原文，不给分级） */
  if (p.fibrosis) {
    const f = p.fibrosis
    out.push(section('纤维化与影像（报告原文）', table(
      ['日期', '方式', '报告原文', '备注'],
      [[f.date, f.method, f.value, f.note]],
    )))
  }

  /* 三、最近化验：窗口内的每一次，逐指标带参考区间与越界标记 */
  const labs = (p.labs ?? []).filter((l) => inWindow(l.date, cutoff))
  if (labs.length) {
    const rows = []
    for (const l of labs) {
      for (const it of l.items ?? []) {
        const low = num(it.refLow)
        const high = num(it.refHigh)
        const st = bandState(it.value, low, high)
        rows.push([
          l.date,
          it.code,
          it.value === null || it.value === undefined ? '—' : it.value,
          it.unit ?? '—',
          bandText(low, high, it.unit) ?? '—',
          STATE_TEXT[st] || '—',
          it.lab ?? '—',
        ])
      }
    }
    out.push(section(`最近化验（${cutoff} 起）`, [
      table(['日期', '指标', '结果', '单位', '参考区间', '是否越界', '实验室'], rows),
      '',
      '参考区间取自当次化验单本身；同一指标换医院可能不同，未用通用值替代。',
    ].join(LINE)))
  }

  /* 四、用药（剂量照抄原文，不换算） */
  const meds = (p.meds ?? []).filter((m) => m.inUse !== false)
  if (meds.length) {
    out.push(section('当前用药', table(
      ['药名', '剂量（抄录原文）', '频次', '开始日期', '获批状态'],
      meds.map((m) => [m.name, m.doseText, m.freq, m.startDate, m.approval === 'verified' ? '已核实' : '未核实']),
    )))
  }

  /* 五、服药漏记（按月，只给数字） */
  const adh = shared(p.adherence).filter((a) => inWindow(`${a.month}-01`, cutoff))
  if (adh.length) {
    out.push(section('服药漏记（本人记录）', table(['月份', '漏记次数'], adh.map((a) => [a.month, a.missed]))))
  }

  /* 六、痒与累（本人感受，不是分级） */
  const syms = shared(p.symptoms).filter((s) => inWindow(s.date, cutoff))
  if (syms.length) {
    out.push(section('痒与累（本人记录，不是医生结论）', [
      table(['日期', '瘙痒 0–10', '乏力 1–3', '夜间加重', '抓破皮肤', '夜醒次数', '备注'], syms.map((s) => [
        s.date,
        s.itch === null || s.itch === undefined ? '—' : s.itch,
        s.fatigue === null || s.fatigue === undefined ? '—' : s.fatigue,
        s.nightWorse === null ? '—' : s.nightWorse ? '是' : '否',
        s.scratch === null ? '—' : s.scratch ? '是' : '否',
        s.sleepBreaks === null || s.sleepBreaks === undefined ? '—' : s.sleepBreaks,
        s.note || '—',
      ])),
      '',
      '瘙痒与乏力是本人自评分数，不是检验值，也不对应任何分级标准。',
    ].join(LINE)))
  }

  /* 七、并发症筛查（按系统分节，标题来自库里的 sectionTitle） */
  const scr = shared(p.screening).filter((s) => inWindow(s.date, cutoff))
  if (scr.length) {
    const bySection = new Map()
    for (const s of scr) {
      const key = s.sectionTitle || s.type
      if (!bySection.has(key)) bySection.set(key, [])
      bySection.get(key).push([s.date, s.result, s.detail || '—'])
    }
    const body = [...bySection.entries()]
      .map(([title, rows]) => `**${title}**${LINE}${LINE}${table(['日期', '报告原文', '备注'], rows)}`)
      .join(`${LINE}${LINE}`)
    out.push(section('并发症筛查（报告原文）', body))
  }

  /* 八、换线记录（只抄医生原话） */
  const reg = shared(p.regimenChanges).filter((c) => inWindow(c.date, cutoff))
  if (reg.length) {
    out.push(section('换线与用药调整（医生原话）', table(['日期', '医生原话', '我的理解状态'], reg.map((c) => [c.date, c.text, c.status]))))
  }

  /* 九、想问医生的问题（本人写的，工作台不生成问题） */
  const qs = shared(p.questions).filter((q) => !q.done)
  out.push(section('想问医生的问题', qs.length
    ? qs.map((q) => `- ${q.text}`).join(LINE)
    : '（这一栏留空，由本人手写。）'))

  /* 十、本人关注 / 情绪（如果有） */
  out.push(LINE)
  out.push('---')
  out.push('')
  out.push('本文件不含任何「是否应答」「需要加药」之类的判断；这类判断请由主诊医生给出。')
  if (excludedPrivate) {
    /* 不写原文，只写"有这块内容、被有意排除" */
    out.push('')
    out.push('本人标记为私密的记录（痒累自述、合并症、换线记录中被标私密的部分）本文件不包含。')
  }
  return `${out.filter((x) => x !== null && x !== undefined).join(LINE).replace(/\n{3,}/g, '\n\n')}${LINE}`
}

/** 导出文件名：档案名 + 日期，去掉路径分隔符（macOS / Windows 都按最严格的删）。 */
export function exportFilename(profile, date = new Date()) {
  const stamp = ymd(date)
  const who = String(profile?.label ?? profile?.name ?? '档案').replace(/[\\/:*?"<>|]/g, '')
  return `复诊准备-${who}-${stamp}.md`
}

/** 档案里是否含私密内容（供调用方判断要不要写排除声明）。 */
export function hasPrivateContent(profile) {
  const p = profile ?? {}
  const isPrivate = (r) => r && r.visibility === 'private'
  return (p.symptoms ?? []).some(isPrivate) || (p.comorbidity ?? []).some(isPrivate) || (p.regimenChanges ?? []).some(isPrivate)
}
