/**
 * markdown → 候选指标（六部件第 3 件）。
 *
 * 输入是 MinerU 的 `full.md`，输出是**候选**：`{code, valueText, unitText, refLowText, refHighText}[]`。
 * 只做抄写，不做换算、不做判读、不做缺项补齐。
 *
 * ---- 处理顺序是有原因的，别随手调 ----
 * 1. **先把 HTML 表格转成 `| a | b |`**，并且转换时**按 `<td>` 边界逐个取内容再剥标签**。
 *    反例（家族踩过）：先对整个 markdown 做 `replace(/<[^>]+>/g,'')` 再找表格 ——
 *    标签被删掉后单元格边界消失，`<td>ALP</td><td>286</td>` 变成 `ALP286`，
 *    于是"指标名配第 i 个数"的位置对齐全部串位，抽出来的值对不上指标。
 * 2. **单位里的 LaTeX 先剥**：MinerU 会把 `10^9/L` 写成 `$10^{9}/L$`，
 *    不剥就匹配不到单位白名单，整行被当"单位不认识"丢掉。
 *    剥的是**单元格内**的 LaTeX，不是整个文档——整文替换同样会吃掉 `|`。
 * 3. 参考范围是**两个数**的时候（`35–120`）拆成上下限；
 *    `<120` 这种只有一个数的不猜下限，只把认得的那一侧填上。
 *
 * ---- 四条不可让步 ----
 * 1. **只抄写不推测**：报告里没有的指标不生成候选。
 * 2. **候选不是记录**：只写 `parse_candidates`，不碰 `lab_items`。用户"接受"才落事实层。
 * 3. **参考范围不是结果**：`35–120` 这种两数一格的行不能当结果值。
 * 4. **`<0.5`、`阴性` 留原文**：`value_text` 存字符串，`value_num` 留给接受时再定。
 */

/** PBC 常用 11 项。别名按"报告上真会出现的写法"列，不用缩写硬凑。 */
export const PBC_LAB_DICT = [
  { code: 'ALP', name: '碱性磷酸酶', aliases: ['ALP', 'AKP', '碱性磷酸酶'], unit: 'U/L', ulnTyped: true },
  { code: 'GGT', name: 'γ-谷氨酰转肽酶', aliases: ['GGT', 'γ-GT', 'r-GT', 'GGTase', '谷氨酰转肽酶', 'γ-谷氨酰转肽酶'], unit: 'U/L', ulnTyped: true },
  { code: 'ALT', name: '丙氨酸氨基转移酶', aliases: ['ALT', 'GPT', '谷丙转氨酶', '丙氨酸氨基转移酶'], unit: 'U/L', ulnTyped: true },
  { code: 'AST', name: '天门冬氨酸氨基转移酶', aliases: ['AST', 'GOT', '谷草转氨酶', '天门冬氨酸氨基转移酶'], unit: 'U/L', ulnTyped: true },
  { code: 'TBil', name: '总胆红素', aliases: ['TBil', 'TBIL', 'T-BIL', '总胆红素'], unit: 'μmol/L', ulnTyped: true },
  { code: 'ALB', name: '白蛋白', aliases: ['ALB', '白蛋白'], unit: 'g/L', ulnTyped: false },
  { code: 'PLT', name: '血小板', aliases: ['PLT', '血小板', '血小板计数'], unit: '10⁹/L', ulnTyped: false },
  { code: 'Hb', name: '血红蛋白', aliases: ['Hb', 'HGB', 'HB', '血红蛋白'], unit: 'g/L', ulnTyped: false },
  { code: 'WBC', name: '白细胞', aliases: ['WBC', '白细胞', '白细胞计数'], unit: '10⁹/L', ulnTyped: false },
  { code: 'ANC', name: '中性粒细胞绝对值', aliases: ['ANC', 'NEUT#', '中性粒细胞', '中性粒细胞绝对值'], unit: '10⁹/L', ulnTyped: false },
  { code: 'Cr', name: '肌酐', aliases: ['Cr', 'CREA', 'SCR', '肌酐'], unit: 'μmol/L', ulnTyped: false },
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 词边界匹配。`\b` 对中文无效，所以用"前后不能紧跟字母数字"的断言。
 * 必须有边界：否则 `ALP` 会命中 `ALPHA`，`Cr` 会命中 `Crp`（C 反应蛋白）。
 */
function aliasHit(text, alias) {
  const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(alias)}(?![A-Za-z0-9])`, 'i')
  return re.test(text)
}

/** 实体解码：MinerU 表格里 `<0.5` 会写成 `&lt;0.5`，不解码就被当成"文字"丢掉。 */
function decodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/**
 * 单元格内的 LaTeX 剥离：`$10^{9}/L$` → `10⁹/L`，`$\mu$mol/L` → `μmol/L`。
 * 只处理上下标与希腊字母这两种 MinerU 真会给的形态，别写成通用 LaTeX 解析器。
 */
export function stripLatexInCell(text) {
  let out = String(text ?? '')
  /* 上标数字：10^{9} / 10^9 → 10⁹ */
  const sup = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
  out = out.replace(/10\s*\^?\s*\{?\s*(\d)\s*\}?/g, (_, d) => `10${sup[d]}`)
  /* 希腊字母与常见单位符号 */
  out = out
    .replace(/\\(?:mu|text\{?μ\}?)/g, 'μ')
    .replace(/\\times/g, '×')
    .replace(/\\leq?|\\le\b/g, '≤')
    .replace(/\\geq?|\\ge\b/g, '≥')
  /* 残余的 $ 与花括号（`$` 留着会让单位白名单匹配失败） */
  out = out.replace(/[$]/g, '').replace(/[{}]/g, '')
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * HTML 表格 → `| a | b |` 管道表格。
 * 关键：**先按 `<td>` 逐个取内容，再剥标签**，不要先全局剥标签。
 */
export function htmlTablesToPipes(markdown) {
  const md = String(markdown ?? '')
  if (!/<table/i.test(md)) return md
  return md.replace(/<table[\s\S]*?<\/table>/gi, (block) => {
    const lines = []
    for (const row of block.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        /* ★ 顺序：先取 <td> 内部内容（此时边界还在），再剥内部标签。 */
        .map((m) => stripLatexInCell(decodeEntities(m[1].replace(/<[^>]+>/g, ' '))))
        .filter((c, i, arr) => c !== '' || arr.length > 1)
      if (cells.length) lines.push(`| ${cells.join(' | ')} |`)
    }
    return lines.join('\n')
  })
}

/** 一行 markdown 表格 → 单元格数组。 */
function cellsOf(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => stripLatexInCell(c))
}
const isTableLine = (line) => line.trim().startsWith('|') && line.trim().endsWith('|')
const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim())

/** 数值或"带比较符的数值"。参考范围（两数一格）与文字一律不要。 */
function valueOf(cell) {
  const t = String(cell ?? '').replace(/\s/g, '')
  if (!t) return null
  if (/^[<>≤≥]/.test(t)) {
    const m = t.match(/^([<>≤≥])(-?\d+(?:\.\d+)?)$/)
    return m ? { raw: `${m[1]}${m[2]}`, num: null } : null
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? { raw: t, num: n } : null
}

/** 参考范围一格 → `{lowText, highText}`。认不出就两边都留 null，**绝不补默认值**。 */
export function refRangeOf(cell) {
  const t = String(cell ?? '').replace(/\s/g, '')
  if (!t) return { lowText: null, highText: null }
  const two = t.match(/^(-?\d+(?:\.\d+)?)[–—~\-]{1,2}(-?\d+(?:\.\d+)?)$/)
  if (two) return { lowText: two[1], highText: two[2] }
  const lower = t.match(/^[>≥](-?\d+(?:\.\d+)?)$/)
  if (lower) return { lowText: lower[1], highText: null }
  const upper = t.match(/^[<≤](-?\d+(?:\.\d+)?)$/)
  if (upper) return { lowText: null, highText: upper[1] }
  return { lowText: null, highText: null }
}

/** 单位白名单：只认这些，认不出就把整行标 skipped（不硬塞进候选）。 */
const UNIT_SET = new Set([
  'U/L', 'IU/L', 'μmol/L', 'umol/L', 'mmol/L', 'g/L', 'mg/L', 'mg/dL', 'g/dL',
  '10⁹/L', '10^9/L', '×10⁹/L', '×10^9/L', '10¹²/L', '/μL', '/uL', '%', 'ng/mL', 'pg/mL', 'fL', 'kg',
])
function unitKnown(unit) {
  const u = String(unit ?? '').replace(/\s/g, '')
  if (!u) return true
  return UNIT_SET.has(u) || UNIT_SET.has(u.replace(/×/g, ''))
}

/**
 * 从 markdown 抽候选。
 * @returns {{candidates: Array<object>, skipped: Array<object>}}
 */
export function extractLabCandidates(markdown) {
  const md = htmlTablesToPipes(markdown)
  const candidates = []
  const skipped = []
  const seen = new Set()
  const lines = md.split(/\r?\n/)

  let i = 0
  while (i < lines.length) {
    if (!isTableLine(lines[i])) { i += 1; continue }

    /* 一整块连续表格：首行是表头，分隔行丢掉，其余是数据行。
       不要"看到分隔行就跳过处理"——那会把表头一起跳过，整张表被静默丢弃。 */
    const start = i
    while (i < lines.length && isTableLine(lines[i])) i += 1
    const blockLines = lines.slice(start, i).filter((l) => !isSeparator(l))
    if (blockLines.length < 2) continue

    const header = cellsOf(blockLines[0])
    const idxName = header.findIndex((h) => /项目|指标|名称|检验|item|test/i.test(h))
    const idxVal = header.findIndex((h) => /结果|数值|value|result/i.test(h))
    /* 参考范围列可能叫「参考值」「参考范围」「正常值」，也可能两列分开放。
       只取第一列出现的那个；不试图把「下限/上限」两列拼起来（不同实验室表头差别太大）。 */
    const idxRef = header.findIndex((h) => /参考|正常|范围|reference|ref/i.test(h))
    const idxUnit = header.findIndex((h) => /单位|unit/i.test(h))
    if (idxName === -1 || idxVal === -1) continue

    for (const line of blockLines.slice(1)) {
      const row = cellsOf(line)
      const rawName = row[idxName] ?? ''
      const hit = PBC_LAB_DICT.find((d) => d.aliases.some((a) => aliasHit(rawName, a)))
      if (!hit) continue

      const val = valueOf(row[idxVal] ?? '')
      if (!val) {
        /* 「参考范围」与「结果」的列可能错认（有的报告只有两列），这里再试一次：
           如果结果格是两数一格（35–120）而参考格是单个数字，说明列认反了。 */
        const swapped = valueOf(row[idxRef] ?? '')
        const refLooksLikeValue = !refRangeOf(row[idxVal] ?? '').lowText && !refRangeOf(row[idxVal] ?? '').highText
        if (swapped && refLooksLikeValue && idxRef !== -1) {
          skipped.push({ name: rawName, cell: row[idxVal] ?? '', reason: '列顺序可疑（结果列像是参考范围），未采信' })
        } else {
          skipped.push({ name: rawName, cell: row[idxVal] ?? '', reason: '不是单一数值（参考范围/文字）' })
        }
        continue
      }

      const unitCell = idxUnit >= 0 ? stripLatexInCell(row[idxUnit] ?? '').replace(/\s/g, '') : ''
      if (!unitKnown(unitCell)) {
        skipped.push({ name: rawName, cell: unitCell, reason: '单位不认识' })
        continue
      }

      const ref = idxRef >= 0 ? refRangeOf(row[idxRef]) : { lowText: null, highText: null }
      const dedupe = `${hit.code}:${val.raw}:${ref.lowText ?? ''}:${ref.highText ?? ''}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)

      candidates.push({
        code: hit.code,
        name: hit.name,
        valueText: val.raw,
        valueNum: val.num,
        unitText: unitCell || hit.unit,
        refLowText: ref.lowText,
        refHighText: ref.highText,
        line: start + 1,
      })
    }
  }
  return { candidates, skipped }
}

/** 报告日期：正文或文件名里的 YYYY-MM-DD / YYYY年M月D日。取不到返回 null，**不猜今天**。 */
export function guessReportDate(text, fallback = null) {
  const m = String(text ?? '').match(/(20\d{2})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/)
  if (!m) return fallback
  const [, y, mo, d] = m
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * 这份报告属于哪家实验室：正文里出现「××医院检验科」「市一院检验科」就抄下来，抄不到留 null。
 *
 * **不许猜**：抄不到就是 null，界面显示「未记录实验室」，绝不填一个像样的默认名——
 * 参考上限跟着实验室变（同一份 ALP 在这家 120、那家 135），填错名字等于让人拿错上限比。
 */
export function guessLabName(text) {
  const src = String(text ?? '')
  const m = src.match(/([\u4e00-\u9fa5]{2,14}(?:医院|医学中心|检验中心|门诊部|保健院|卫生院)[\u4e00-\u9fa5]{0,8}(?:检验科|检验中心|生化室)?)/)
    /* 有的报告只印「市一院检验科」，没有「医院」二字——这时按"××检验科"整体抄。 */
    ?? src.match(/([\u4e00-\u9fa5]{2,10}(?:一院|二院|三院|中医院|人民医院)[\u4e00-\u9fa5]{0,8})/)
    ?? src.match(/([\u4e00-\u9fa5]{2,10}检验科)/)
  return m ? m[1].trim() : null
}
