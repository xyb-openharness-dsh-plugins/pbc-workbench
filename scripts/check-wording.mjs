#!/usr/bin/env node
/* 医疗表述越界检查（文案红线）。
 *
 * 产品只做「整理与对照」，不做诊断、不给处置建议、不替你判定生化应答
 * （SPEC §2 / DEV-REQUIREMENTS §三·医学口径）。这条红线在 UI 文案里最容易破防，
 * 所以放进 `npm run check`：命中即失败，不靠人记。
 *
 * 扫描范围：会被用户读到的实现代码 —— `dsh/`、`lib/`、`public/`、`src/`、`demo/`、
 * `prototypes/` 下的 .js/.mjs/.cjs/.html/.css。**不扫 docs/**：那是讨论稿，另有评审。
 * `prototypes/` 虽然冻结，但它是最直接给患者看的文案，越界表述不能只靠人眼。
 *
 * 两种放行：
 * 1. 否定语境 —— 命中词前 12 个字符内出现「不 / 勿 / 禁 / 别」，判为免责表述；
 * 2. 显式标注 —— 该行含 `wording-allow` 注释（注释里要写清为什么）。
 *
 * 用法：node scripts/check-wording.mjs    （退出码 0 无命中 / 1 有命中）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = ['dsh', 'lib', 'public', 'src', 'demo', 'prototypes']
const EXTS = new Set(['.js', '.mjs', '.cjs', '.html', '.css'])

/* 越界表述：不是"提到疾病或药"，而是"替医生下结论 / 给处置 / 替患者判应答"。
   PBC 专属三条（应答判定、评分自算、病因解释）单独列出 —— 这三件事
   在 PBC 病友群里最常被互相"指导"，也最容易写进界面。 */
const RULES = [
  { id: 'treatment-advice', re: /建议\s*(进行|做|用|接受|采用|考虑)?\s*(治疗|手术|化疗|放疗|用药|服药|停药|加药|减药|靶向)/g },
  { id: 'recommend-drug', re: /推荐\s*(进行|使用|服用|用)?\s*(用药|服药|治疗|手术|剂量|药物)/g },
  { id: 'stop-medication', re: /(可以|可|建议|不妨)\s*停\s*(药|用|服)/g },
  { id: 'skip-care', re: /(不用|无需|不必|没必要)\s*(就医|复查|去医院|看医生)/g },
  { id: 'prognosis-claim', re: /预后\s*(良好|较好|不错|较差|很差)/g },
  { id: 'cure-rate', re: /治愈率|生存期\s*(还有|不足|大概)/g },
  { id: 'diagnose-claim', re: /(确诊|诊断)\s*为\s*(癌|肿瘤|恶性|原发性胆汁性)/g },
  /* PBC 专属：替患者判"应答 / 未应答"。医生才做这个判断，本仓只画线不判。
     判据不能带谓语前缀——第一版要求「你已经|判定为…」才命中，于是数据层里裸的
     「档案 A · 部分应答」一路逃检（它经读模型直出界面，还成了导出文件标题首行）。
     结论词本身出现在**任何字段值**里都算越界，不管前面有没有主语；
     真正的否定语境（"不判应答"）由 NEGATION 放行，所以不误伤。 */
  { id: 'response-verdict', re: /(完全应答|部分应答|应答不佳|未应答|生化应答良好|应答充分)/g },
  /* PBC 专属：自算预后评分（GLOBE / UK-PBC）。分数要输入未采集的变量，算出来是编的。 */
  { id: 'score-self-calc', re: /(计算|算出|估算)\s*(GLOBE|UK-?PBC)\s*(分值|评分)/gi },
  /* PBC 专属：把痒/累归因给某个机制。病因解释是医生的活，本仓只记录强度与时间。 */
  { id: 'cause-claim', re: /(你的瘙痒|你的乏力)\s*(是|来自|因为)\s*(胆汁淤积|胆酸|肝)/g },
]

/* 近邻否定：命中词前面的紧邻字词（12 字符窗口）。 */
const NEGATION = /[不勿禁别]$|不构成|不代表|不做|不提供|不作为|不替你/
/* 句内否定：**整行前半段**出现这些词，说明这句在讲"不许做什么"。
   为什么需要它：「不要替我判定"应答/未应答"」这类话里，否定词离命中词有十几个字，
   12 字符窗口抓不到，于是把免责声明本身报成越界。放宽的是**语境判定**，
   不是词表——真写了「档案 A · 部分应答」照样红（那一行前半段没有否定词）。 */
const NEGATION_WIDE = /不构成|不代表|不做|不提供|不作为|不替你|不判|不写|不算|不推算|不要/

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (st.isFile() && EXTS.has(extname(entry))) out.push(full)
  }
  return out
}

const files = DIRS.flatMap((d) => walk(join(root, d)))
const hits = []

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('wording-allow')) return
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      let m
      while ((m = rule.re.exec(line)) !== null) {
        const before = line.slice(Math.max(0, m.index - 12), m.index)
        if (NEGATION.test(before)) continue
        if (NEGATION_WIDE.test(line.slice(0, m.index))) continue
        hits.push({ file: relative(root, file), line: i + 1, rule: rule.id, text: m[0].trim() })
      }
    }
  })
}

if (!files.length) {
  console.log('= 没有可扫描的实现文件（dsh/ lib/ public/ src/ 为空或不存在），本次跳过')
  process.exit(0)
}

if (hits.length) {
  console.error(`✗ 医疗表述越界 ${hits.length} 处（本仓只整理资料，不做诊断与处置建议）：\n`)
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.rule}]  「${h.text}」`)
  console.error('\n改法：改成"记录 / 整理 / 带去看医生"的表述；确属免责语句请写在否定语境里。')
  console.error('依据：docs/SPEC.md §2 产品立场、docs/DEV-REQUIREMENTS-2026-10-25.md §三 医学口径。')
  process.exit(1)
}

console.log(`✓ 医疗表述检查通过（${files.length} 个实现文件，0 处越界）`)
