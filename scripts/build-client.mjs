#!/usr/bin/env node
/* 客户端构建：`src/client.js` → `lib/client.js`（常量注入，无打包器）。
 *
 * Desktop 不替我们打包客户端，要求 `lib/client.js` 是**已构建好的单文件**。
 * 真正的参数来源只有三处，本脚本把它们读出来填进占位符，避免两边手抄漂移：
 *   - 包名 / 仓库   ← package.json
 *   - 面板参数      ← lib/layout.js（PANEL / AGENT_PANE）
 *   - 接口前缀      ← dsh/routes.js（API_PREFIX / UI_PREFIX）
 *   - 版本号        ← lib/version.js（由 scripts/build-version.mjs 从 VERSION 生成）
 *
 * 用法：
 *   node scripts/build-client.mjs           写 lib/client.js
 *   node scripts/build-client.mjs --check   只校验（CI / npm run check 用），不一致退出 1
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SRC = join(ROOT, 'src', 'client.js')
const OUT = join(ROOT, 'lib', 'client.js')

const HEADER = `/* 本文件由 scripts/build-client.mjs 从 src/client.js 生成，**请勿手改**。
 * 改面板行为请改 src/client.js，然后 npm run build:client；
 * 改面板宽度/分栏参数请改 lib/layout.js；改接口前缀请改 dsh/routes.js。 */
`

/** 仓库地址归一化：只认 https://github.com/<org>/<repo>，git@ 与 .git 尾巴都抹掉。 */
function canonicalRepository(raw) {
  /* npm 允许两种写法：字符串，或 `{type:'git', url:'...'}`。两种都要认——
     只认字符串时对象会被 String() 成 "[object Object]"，报错信息还看不出是哪种写法出的问题。 */
  const value = typeof raw === 'string' ? raw.trim() : String(raw?.url ?? '').trim()
  if (!value) throw new Error('package.json 里没有 repository 地址：客户端需要它才能在宿主里显示来源')
  let url = value
  if (url.startsWith('git@')) url = 'https://' + url.slice('git@'.length).replace(':', '/')
  else if (url.startsWith('git://')) url = 'https://' + url.slice('git://'.length)
  url = url.replace(/\.git$/, '').replace(/\/+$/, '')
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(url)) {
    throw new Error(`repository 不是可用的 GitHub 地址："${value}"（归一化后 "${url}"）`)
  }
  return url
}

/**
 * 面板参数前置自检。放在构建期而不是运行期：
 * 参数写错时界面是"看起来能用"，只有真机拖动才会发现，装完再改就晚了。
 */
function assertPanelConfig(panel, agent) {
  const problems = []
  if (!panel || typeof panel !== 'object') problems.push('lib/layout.js 没有导出 PANEL')
  if (!agent || typeof agent !== 'object') problems.push('lib/layout.js 没有导出 AGENT_PANE')
  if (problems.length) throw new Error(problems.join('；'))

  if (panel.customFrame !== true) {
    problems.push('PANEL.customFrame 必须是 true：标准分栏下宿主把 businessWidth 当静态 CSS 变量，业务区会被拉满且顶栏没有会话按钮')
  }
  if (panel.businessSide !== 'left' && panel.businessSide !== 'right') {
    problems.push(`PANEL.businessSide 只能是 'left' 或 'right'，现在是 ${JSON.stringify(panel.businessSide)}`)
  }
  const width = Number(panel.businessWidth)
  if (!Number.isFinite(width) || width < 0.25 || width > 0.7) {
    problems.push(`PANEL.businessWidth 必须落在 0.25–0.7，现在是 ${JSON.stringify(panel.businessWidth)}`)
  }
  // 业务区与会话区是同一块宽度的两部分：加起来超过 1 就会把会话挤成 0 宽。
  if (Number.isFinite(width) && width + Number(agent.default) > 1.0001) {
    problems.push(`businessWidth(${width}) + AGENT_PANE.default(${agent.default}) 超过 1，会话区会被挤没`)
  }
  if (!(agent.min < agent.default && agent.default < agent.max)) {
    problems.push(`AGENT_PANE 要求 min < default < max，现在是 ${agent.min}/${agent.default}/${agent.max}`)
  }
  if (agent.min < 0.2 || agent.max > 0.6) problems.push(`AGENT_PANE 区间 ${agent.min}–${agent.max} 超出宿主可接受范围`)
  if (!Number.isFinite(Number(agent.ratioStep)) || Number(agent.ratioStep) <= 0) {
    problems.push(`AGENT_PANE.ratioStep 必须是正数（键盘/拖动的步进），现在是 ${JSON.stringify(agent.ratioStep)}`)
  }
  if (problems.length) throw new Error('面板参数自检没通过：\n  - ' + problems.join('\n  - '))
}

async function loadInputs() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const layout = await import(pathToFileURL(join(ROOT, 'lib', 'layout.js')).href)
  const routes = await import(pathToFileURL(join(ROOT, 'dsh', 'routes.js')).href)
  const version = await import(pathToFileURL(join(ROOT, 'lib', 'version.js')).href)

  if (!layout.PANEL || !layout.AGENT_PANE) throw new Error('lib/layout.js 必须同时导出 PANEL 与 AGENT_PANE')
  assertPanelConfig(layout.PANEL, layout.AGENT_PANE)

  const replacements = {
    __PKG_NAME__: pkg.name,
    __REPOSITORY__: canonicalRepository(pkg.repository),
    __API_PREFIX__: routes.API_PREFIX,
    __UI_ENTRY__: routes.UI_PREFIX,
    __VERSION__: version.version,
    __BUSINESS_SIDE__: layout.PANEL.businessSide,
    __BUSINESS_WIDTH__: String(layout.PANEL.businessWidth),
    __CUSTOM_FRAME__: String(layout.PANEL.customFrame),
    __AGENT_DEFAULT__: String(layout.AGENT_PANE.default),
    __AGENT_MIN__: String(layout.AGENT_PANE.min),
    __AGENT_MAX__: String(layout.AGENT_PANE.max),
    /* 注意注入的是**比例步进**（0.02 = 2%），不是像素步进 step: 24。
       键盘调整走的是百分比，注入像素会让一次按键跳 24%。 */
    __AGENT_STEP__: String(layout.AGENT_PANE.ratioStep),
    __NARROW_BELOW__: String(layout.AGENT_PANE.narrowBelowPx),
    __DRAWER_MAX__: String(layout.AGENT_PANE.drawerMaxPx),
  }
  return { pkg, replacements }
}

function render(source, replacements) {
  let out = source
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value)
  }
  /* 替换完必须再扫一遍：漏一个占位符，界面就会显示 "__AGENT_MIN__%" 这种东西，
     而且运行时不会报错——只有扫一遍才知道漏了。 */
  const leftover = out.match(/__[A-Z][A-Z0-9_]*__/g)
  if (leftover) {
    throw new Error(`构建后仍有未替换的占位符：${[...new Set(leftover)].join(', ')}`)
  }
  return HEADER + out
}

async function main() {
  const check = process.argv.includes('--check')
  const source = readFileSync(SRC, 'utf8')
  const { replacements } = await loadInputs()
  const next = render(source, replacements)

  let current = null
  try { current = readFileSync(OUT, 'utf8') } catch { /* 首次构建 */ }

  if (check) {
    if (current === null) {
      console.error('lib/client.js 还不存在，先跑 npm run build:client')
      process.exit(1)
    }
    if (current !== next) {
      console.error('lib/client.js 与 src/client.js 不一致：改了源码或改了参数，但没重新构建。跑 npm run build:client')
      process.exit(1)
    }
    console.log('lib/client.js 与 src/client.js 一致')
    return
  }

  if (current === next) {
    console.log('lib/client.js 没有变化，不重写')
    return
  }
  writeFileSync(OUT, next)
  console.log(`已生成 ${relative(ROOT, OUT)}（${next.length} 字节）`)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
