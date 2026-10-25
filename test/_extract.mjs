/* 从 `public/app.js` 里抠出指定顶层声明的源码，供单元测试直接在 Node 里调用。
 *
 * 为什么不用 import：`public/app.js` 是给浏览器用的经典脚本（IIFE，末尾直接 boot()），
 * 在 Node 里 import 会去碰 document。而这三个函数（分级 / 复查节点 / 描线）
 * 恰恰是最需要单测的部分 —— 它们算错不会报错，只会安静地给出一个错数字。
 *
 * 抠取的边界靠括号配平：从声明起点扫到括号回到 0。
 * 抠完先过一遍 `new Function`，语法不通就当场失败（说明抠取逻辑被源码形态破坏了）。
 */

function scanDecl(src, name) {
  const patterns = [`function ${name}(`, `async function ${name}(`, `const ${name} = `, `let ${name} = `]
  let start = -1
  for (const p of patterns) {
    start = src.indexOf(p)
    if (start >= 0) break
  }
  if (start < 0) throw new Error(`public/app.js 里找不到声明：${name}`)

  /* 单行声明（`const LABELS = { … }` 也是一行）：直接取到行尾，够用且不会被后面的代码带跑。 */
  const lineEnd = src.indexOf('\n', start)
  const line = src.slice(start, lineEnd)

  /* 箭头函数且整行没有 { → 就是表达式体，取到行尾。 */
  if (!line.includes('{') && !line.includes('[')) return line.replace(/;\s*$/, '')

  /* 否则从第一个 { 或 [ 开始配平。引号内的内容跳过（本仓代码里字符串不含花括号）。 */
  const braceStart = (() => {
    const a = line.indexOf('{')
    const b = line.indexOf('[')
    if (a < 0) return b
    if (b < 0) return a
    return Math.min(a, b)
  })()
  let i = start + braceStart
  let depth = 0
  let quote = ''
  for (; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') { i++; continue }
      if (c === quote) quote = ''
      continue
    }
    if (c === "'" || c === '"') { quote = c; continue }
    if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error(`声明 ${name} 的括号没有配平`)
}

/**
 * 取出一组声明，返回可直接调用的对象。
 * @param {string} src public/app.js 全文
 * @param {string[]} names 顶层声明名
 * @param {object} [extra] 额外注入的全局（如 window / document 的替身）
 */
export function loadDeclarations(src, names, extra = {}) {
  const parts = names.map((n) => `/* ${n} */\n${scanDecl(src, n)}`)
  const tail = names.map((n) => `__out[${JSON.stringify(n)}] = typeof ${n} === 'undefined' ? undefined : ${n}`).join('\n')
  const body = `${parts.join('\n')}\nconst __out = {}\n${tail}\nreturn __out`
  /* 语法不通会在这里抛：宁可测试失败，也不要拿一段半截源码去算数字。 */
  const fn = new Function(...Object.keys(extra), body)
  return fn(...Object.values(extra))
}
