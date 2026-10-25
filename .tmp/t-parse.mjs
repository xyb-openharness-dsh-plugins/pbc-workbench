import { extractLabCandidates, htmlTablesToPipes, stripLatexInCell, refRangeOf, guessReportDate, guessLabName } from '../dsh/parse.js'

// 1) 管道表格
const md1 = `
# 检验报告
市一院检验科  2026-09-08

| 项目 | 结果 | 单位 | 参考范围 |
| --- | --- | --- | --- |
| 碱性磷酸酶(ALP) | 212 | U/L | 35–120 |
| γ-谷氨酰转肽酶 | 168 | U/L | 7–45 |
| 总胆红素 | 13.2 | μmol/L | 5.1-19.0 |
| 血小板 | 92 | 10^9/L | 125–350 |
| 白蛋白 | 阴性 | g/L | 40–55 |
| C 反应蛋白 | 3.1 | mg/L | <10 |
`
const r1 = extractLabCandidates(md1)
console.log('md1 candidates:', r1.candidates.map(c=>`${c.code}=${c.valueText}${c.unitText} ref[${c.refLowText??'-'},${c.refHighText??'-'}]`))
console.log('md1 skipped:', r1.skipped.map(s=>`${s.name}:${s.cell}:${s.reason}`))

// 2) HTML 表格 + LaTeX 单位
const md2 = `
<table>
<tr><th>项目</th><th>结果</th><th>单位</th><th>参考值</th></tr>
<tr><td>ALP</td><td>286</td><td>$10^{9}/L$</td><td>35-120</td></tr>
<tr><td>ALT</td><td>&lt;5</td><td>U/L</td><td>7-40</td></tr>
</table>
`
const r2 = extractLabCandidates(md2)
console.log('md2 candidates:', r2.candidates.map(c=>`${c.code}=${c.valueText}${c.unitText} num=${c.valueNum} ref[${c.refLowText??'-'},${c.refHighText??'-'}]`))

// 3) 反例：先剥标签会串位
const naive = md2.replace(/<[^>]+>/g,'')
console.log('naive strip contains ALP286?', /ALP\s*286/.test(naive), '| naive snippet:', JSON.stringify(naive.replace(/\s+/g,' ').slice(0,60)))
const r3 = extractLabCandidates(naive)
console.log('md3 (naive) candidates count:', r3.candidates.length)

// 4) 缺上限
console.log('refRangeOf("<10")', refRangeOf('<10'), 'refRangeOf("≥35")', refRangeOf('≥35'))
// 5) 日期/实验室
console.log('date:', guessReportDate('2026年9月8日 报告'), guessReportDate('no date here'))
console.log('lab:', guessLabName('送检单位 市第一人民医院检验科 报告'))
