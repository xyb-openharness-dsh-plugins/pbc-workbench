#!/usr/bin/env node
/* 版本号一致性校验。
 *
 * 单一来源：仓库根目录的 `VERSION`（一行，语义化版本）。所有"会显示给人看"的地方都核。
 *
 * 两类核对：
 * 1. **跟着 VERSION 走** —— `package.json`、生成的 `lib/version.js`、构建出的
 *    `public/index.html`（标题 / 徽标 / 页脚三处字面量）、`public/app.js` 的 `VERSION` 常量。
 * 2. **冻结在快照版本** —— `prototypes/v0.2/` 是 G2 签认过的视觉基准，**不跟着版本前移**。
 *    它一旦动，`ui-parity` 的"逐字符"就失去依据。所以这里核对它仍然停在 `FROZEN_PROTOTYPE`。
 *
 * 用法：node scripts/check-version.mjs   （退出码 0 一致 / 1 不一致）
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/** 原型快照冻结的版本：G2 签认时的那个号，不再移动。 */
const FROZEN_PROTOTYPE = '0.1.0'

const problems = []
const checks = []

function check(name, actual, expected) {
  const ok = actual === expected
  checks.push({ name, actual, expected, ok })
  if (!ok) problems.push(`${name}：期望 ${expected}，实际 ${actual ?? '（未找到）'}`)
}

if (!existsSync(join(root, 'VERSION'))) {
  console.error('✗ 缺少 VERSION 文件（仓库根目录）')
  process.exit(1)
}

const version = read('VERSION').trim()
if (!SEMVER.test(version)) {
  console.error(`✗ VERSION 不是合法语义化版本：${version}`)
  process.exit(1)
}

/* 0) 冻结快照：原型只核对"它没被改号"，不要求跟上 VERSION */
if (existsSync(join(root, 'prototypes/v0.2/app.js'))) {
  const appJs = read('prototypes/v0.2/app.js')
  check('prototypes/v0.2/app.js（快照冻结）', appJs.match(/const VERSION = 'v(\d+\.\d+\.\d+)'/)?.[1], FROZEN_PROTOTYPE)
  const html = read('prototypes/v0.2/index.html')
  const literals = [...new Set([...html.matchAll(/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/g)].map((x) => x[1]))]
  check('prototypes/v0.2/index.html 版本字面量（去重）', literals.join(', '), FROZEN_PROTOTYPE)
}

/* 1) 开发版页面：标题 + 徽标 + 页脚三处字面量必须都是当前版本 */
const indexHtml = read('public/index.html')
/* 标题里带不带版本号由页面自己决定（本仓标题只写"开发版"，版本在徽标上），
   带了就必须对得上；没带不算错——但**标题里不许再出现"原型"**，
   因为开发版自称原型会让截图、README 与真机三方对不上。 */
const titleTag = indexHtml.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
const titleVersion = titleTag.match(/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)?.[1]
if (titleVersion !== undefined) check('public/index.html <title> 版本', titleVersion, version)
check('public/index.html <title> 不含"原型"', /原型/.test(titleTag) ? '含' : '不含', '不含')
const publicLiterals = [...new Set([...indexHtml.matchAll(/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/g)].map((x) => x[1]))]
check('public/index.html 版本字面量（去重）', publicLiterals.join(', '), version)

/* 2) 构建出来的 app.js 里的 VERSION 常量（脚本运行时读它渲染徽标） */
const appJs = read('public/app.js')
check('public/app.js VERSION 常量', appJs.match(/const VERSION = 'v(\d+\.\d+\.\d+)'/)?.[1], version)

/* 3) 生成的 lib/version.js（构建期注入，宿主与面板都读它） */
if (existsSync(join(root, 'lib/version.js'))) {
  check('lib/version.js version', read('lib/version.js').match(/export const version = '([^']+)'/)?.[1], version)
} else {
  problems.push('缺少 lib/version.js（包与面板的唯一版本来源），请运行 npm run build:version')
}

/* 4) package.json（打包与 npm 上看到的号） */
check('package.json version', JSON.parse(read('package.json')).version, version)

const pad = (s, n) => String(s ?? '（未找到）').padEnd(n)
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${pad(c.name, 46)} ${c.actual ?? '—'}`)

if (problems.length) {
  console.error('\n版本号不一致：')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\n改版本时先改 VERSION，再跑 npm run build:version && npm run build:public。')
  console.error(`原型快照 prototypes/v0.2 冻结在 v${FROZEN_PROTOTYPE}，不随 VERSION 移动。`)
  process.exit(1)
}

console.log(`\n✓ 版本号一致：v${version}（核对 ${checks.length} 处；原型快照冻结在 v${FROZEN_PROTOTYPE}）`)
