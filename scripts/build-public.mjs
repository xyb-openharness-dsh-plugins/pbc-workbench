#!/usr/bin/env node
/* public 构建：`prototypes/v0.2/` → `public/`（逐字符复制，只做定点替换）。
 *
 * 规矩（26 号 §「原型是唯一视觉基准」）：
 *   原型与开发版的差异必须**只有**下面这几处定点替换，多一处就是要被 ui-parity 抓到的漂移。
 *   - 版本号：原型写 `v0.1.0 · 原型`，开发版写真实版本号 + `· 开发版`
 *   - 数据来源：原型直接读 `window.DEMO`，开发版要先调 `/api/<slug>/bootstrap`，
 *     只有**接口不通**时才允许回退演示数据（接口通但库空必须显示空态）
 *   除此之外 style.css / index.html / app.js 的其余字节必须与原型完全相同——
 *   ui-parity.test.mjs 会逐字节比对，这里多改一个空格都会红。
 *
 * 用法：
 *   node scripts/build-public.mjs           写 public/
 *   node scripts/build-public.mjs --check   只校验（npm run check 用）
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SRC = join(ROOT, 'prototypes', 'v0.2')
const OUT = join(ROOT, 'public')

/* 纯复制、零改动的文件。 */
const VERBATIM = ['style.css', 'demo-data.js']

/**
 * `index.html` 的定点替换。
 * 除了版本徽标，还改了"原型"这个字样——开发版不能自称原型，否则截图与 README 对不上。
 * 注意这里只替换徽标与页脚两处，其余结构一个字节都不动。
 */
function renderIndex(source, version) {
  return source
    .replace(`（原型）</title>`, `（开发版）</title>`)
    .replace(
      `<span class="version-chip" id="version-chip">v0.1.0 · 原型</span>`,
      `<span class="version-chip" id="version-chip">v${version} · 开发版</span>`,
    )
    .replace(
      `<span id="footer-built">原型 v0.1.0</span>`,
      `<span id="footer-built">开发版 v${version}</span>`,
    )
}

/**
 * `app.js` 的定点替换：只动三处。
 *   1) 顶栏与页脚的版本文案
 *   2) 数据来源从 `const DEMO = window.DEMO` 换成"先取接口、取不到才用演示"
 *   3) boot() 里先 await 数据再 render
 * 其它函数（30 个视图、gradeOf、smoothPath、oneChart、cadenceNodes……）必须逐字符相同。
 */
function renderApp(source, { version, apiPrefix }) {
  const out = source

  /* ① 版本：两处文案 */
  .replace(
    `  const VERSION = 'v0.1.0'`,
    `  const VERSION = 'v${version}'`,
  )
  .replace(
    `    $('#version-chip').textContent = VERSION + ' · 原型'`,
    `    $('#version-chip').textContent = VERSION + ' · 开发版'`,
  )
  .replace(
    `    $('#footer-built').textContent = '原型 ' + VERSION`,
    `    $('#footer-built').textContent = '开发版 ' + VERSION`,
  )

  /* ② 数据来源：保留 `DEMO` 这个名字当**兜底**，但真实数据由接口提供。
     命名沿用 `DEMO` 是为了让 30 个视图函数一个都不用改——改视图就等于脱离原型。 */
  .replace(
    `  const DEMO = window.DEMO`,
    [
      `  /* 开发版：先取工作台接口。`,
      `     只有**接口不通**才回退演示数据；接口通但库空必须显示空态，`,
      `     否则用户看到的演示档案会被当成自己的病历（DATA_SOURCE 用来在界面上说清楚）。 */`,
      `  const API_PREFIX = '${apiPrefix}'`,
      `  const DEMO_FALLBACK = window.DEMO`,
      `  let DEMO = window.DEMO`,
      `  let DATA_SOURCE = 'pending'`,
      `  let DATA_NOTE = ''`,
      ``,
      `  /* 挂载前缀只在"被宿主嵌在子路径下"时才有值：/w/abc/api/pbc-workbench/ui/index.html`,
      `     → base='/w/abc'。直接把 /api/pbc-workbench 当 base 会拼出`,
      `     /api/pbc-workbench/api/pbc-workbench/... 404，页面静默回退演示数据，`,
      `     看着有数据其实根本没连上库——这条踩过，别再犯。 */`,
      `  function apiBase() {`,
      `    const m = location.pathname.match(/^(.*)\\/ui(?:\\/|$)/)`,
      `    const base = m ? m[1] : ''`,
      `    /* 用 endsWith 而不是正则替换：脚本本身是模板字符串，正则字符类里的 $ 和花括号`,
      `       会被当成插值起点，写出来的代码会当场语法错误。 */`,
      `    return base.endsWith(API_PREFIX) ? base.slice(0, -API_PREFIX.length) : base`,
      `  }`,
      `  const apiUrl = (path) => apiBase() + API_PREFIX + path`,
      ``,
      `  /* 接口通不通与"库里有没有东西"是两件事，必须分开表达：`,
      `     reachable=false → 用演示数据（并明说这是演示）`,
      `     reachable=true 且 profiles 为空 → 空态（不拿演示档案填满空工作区） */`,
      `  async function loadBootstrap() {`,
      `    try {`,
      `      const res = await fetch(apiUrl('/bootstrap'))`,
      `      if (!res.ok) return { reachable: false, data: null }`,
      `      return { reachable: true, data: await res.json() }`,
      `    } catch {`,
      `      return { reachable: false, data: null }`,
      `    }`,
      `  }`,
      ``,
      `  let SOURCE_STATES = []`,
      ``,
      `  /* 把接口数据摊进视图用的那份结构。字段逐个显式列出，`,
      `     不静默丢——少一个字段界面上就是一片空白，而空白最像"数据丢了"。 */`,
      `  function applyData(data) {`,
      `    if (!data || !Array.isArray(data.profiles)) return false`,
      `    DEMO = {`,
      `      generatedAt: (data.demo_meta && data.demo_meta.generatedAt) || '',`,
      `      profiles: data.profiles,`,
      `    }`,
      `    SOURCE_STATES = Array.isArray(data.sourceStates) ? data.sourceStates : []`,
      `    return true`,
      `  }`,
    ].join('\n'),
  )

  /* ③ boot：先取数据再 render（视图函数全是同步的，数据没到会渲染成 0 条，看着像数据丢了） */
  .replace(
    `  function boot() {\n` +
    `    if (!DEMO || !DEMO.profiles || !DEMO.profiles.length) {`,
    `  async function boot() {\n` +
    `    const loaded = await loadBootstrap()\n` +
    `    if (loaded.reachable) {\n` +
    `      if (applyData(loaded.data) && DEMO.profiles.length) {\n` +
    `        DATA_SOURCE = 'api'\n` +
    `      } else {\n` +
    `        /* 接口通但库里没有档案：给空态，绝不拿演示档案顶上 */\n` +
    `        DATA_SOURCE = 'empty'\n` +
    `        DATA_NOTE = '工作台连上了，但你的资料库里还没有档案。导入一张化验单或新建档案后，这里才会有内容。'\n` +
    `        DEMO = { generatedAt: '', profiles: [], sourceStates: [] }\n` +
    `      }\n` +
    `    } else {\n` +
    `      DATA_SOURCE = 'demo'\n` +
    `      DATA_NOTE = '没连上工作台接口，下面显示的是演示数据（虚构）。'\n` +
    `    }\n` +
    `    if (DEMO_FALLBACK && !DEMO.profiles.length && DATA_SOURCE === 'demo') DEMO = DEMO_FALLBACK\n` +
    `    showSourceBanner()\n` +
    `    if (!DEMO || !DEMO.profiles || !DEMO.profiles.length) {`,
  )

  /* ④ 空态横幅：数据来源必须写在界面上，不能只写在文档里 */
  .replace(
    `  /* ------------------------------ 启动 ------------------------------ */`,
    [
      `  /* ------------------------------ 数据来源横幅 ------------------------------ */`,
      `  function showSourceBanner() {`,
      `    const old = document.getElementById('source-banner')`,
      `    if (old) old.remove()`,
      `    if (DATA_SOURCE === 'api') return`,
      `    const bg = DATA_SOURCE === 'empty' ? '#EDF0E2' : '#FBF1DF'`,
      `    const fg = DATA_SOURCE === 'empty' ? '#3F4A2B' : '#A8681E'`,
      `    document.body.insertAdjacentHTML('afterbegin',`,
      `      '<div id="source-banner" style="background:' + bg + ';color:' + fg +`,
      `      ';padding:8px 14px;border-bottom:1px solid #E1DFD2;font-size:12.5px">' + esc(DATA_NOTE) + '</div>')`,
      `  }`,
      ``,
      `  /* ------------------------------ 原生会话挂载位 ------------------------------ */`,
      `  /* 开发版**不自建聊天框**：把 AI 面板主体换成宿主原生会话的挂载位，`,
      `     只说明"会话在哪个面板、这里不模拟回答"。原型里那三条示例气泡是演示用的，`,
      `     进了开发版就会让人以为这里能问医学问题。 */`,
      `  function renderAgentSlot() {`,
      `    const body = $('#agent-body')`,
      `    if (!body || DATA_SOURCE !== 'api') return`,
      `    body.innerHTML =`,
      `      '<div class="msg ai"><b>AI 对话在右侧原生面板</b><br>这个页面只负责整理资料。' +`,
      `      '点页面里的「AI 帮我填」会把提示词和这一页的病情要点交给宿主的原生会话，' +`,
      `      '由你确认后再发送；本页不会替你回答医学问题。</div>'`,
      `  }`,
      ``,
      `  /* ------------------------------ 启动 ------------------------------ */`,
    ].join('\n'),
  )

  /* ⑤ 发送按钮：开发版不造"AI 回复"，只把内容交出去 */
  .replace(
    [
      `    $('#agent-send').addEventListener('click', () => {`,
      `      const ta = $('#agent-text')`,
      `      const v = ta.value.trim()`,
      `      if (!v) return toast('先写一句')`,
      `      const body = $('#agent-body')`,
      `      const me = document.createElement('div'); me.className = 'msg me'; me.textContent = v; body.appendChild(me)`,
      `      const ai = document.createElement('div'); ai.className = 'msg ai'`,
      `      ai.textContent = '（原型演示）我收到了。真实会话在开发版由宿主原生 Agent 接管，这里不会假装能回答医学问题。'`,
      `      body.appendChild(ai)`,
      `      body.scrollTop = body.scrollHeight`,
      `      ta.value = ''`,
      `    })`,
    ].join('\n'),
    [
      `    $('#agent-send').addEventListener('click', () => {`,
      `      const ta = $('#agent-text')`,
      `      const v = ta.value.trim()`,
      `      if (!v) return toast('先写一句')`,
      `      /* 这里**不造回复**：把内容交给宿主原生会话，由那边真的回答。`,
      `         自己拼一条"AI 收到了"会让用户以为已经问过医生了。 */`,
      `      document.dispatchEvent(new CustomEvent(EVT_DRAFT, { detail: { prompt: v, context: '', channel: EVT_DRAFT } }))`,
      `      ta.value = ''`,
      `      toast('已交给右侧原生会话；本页不模拟回复')`,
      `    })`,
    ].join('\n'),
  )

  /* ⑥ boot 里在 render() 之后挂上原生会话挂载位（render 会重绘视图但不碰 #agent-body，
     所以这一步只需要在首帧做一次；放在 render 之后是为了 DATA_SOURCE 已确定）。 */
  .replace(
    `    bindShell()\n    applyAgentWidth()\n    render()`,
    `    bindShell()\n    applyAgentWidth()\n    render()\n    renderAgentSlot()`,
  )

  return out
}

async function main() {
  const check = process.argv.includes('--check')
  const version = (await import(pathToFileURL(join(ROOT, 'lib', 'version.js')).href)).version
  const { API_PREFIX } = await import(pathToFileURL(join(ROOT, 'dsh', 'routes.js')).href)

  if (!existsSync(SRC)) throw new Error(`缺少原型目录 ${relative(ROOT, SRC)}`)
  if (!check) mkdirSync(OUT, { recursive: true })

  const targets = []

  for (const name of VERBATIM) {
    const src = readFileSync(join(SRC, name))
    targets.push({ name, content: src })
  }

  const index = renderIndex(readFileSync(join(SRC, 'index.html'), 'utf8'), version)
  targets.push({ name: 'index.html', content: Buffer.from(index) })

  const app = renderApp(readFileSync(join(SRC, 'app.js'), 'utf8'), { version, apiPrefix: API_PREFIX })
  targets.push({ name: 'app.js', content: Buffer.from(app) })

  /* 定点替换必须真的发生过：原型改了措辞而这里没跟上时，替换会静默不生效，
     版号就永远是旧的。逐个断言"替换后与原文不同"，比事后看截图可靠。 */
  const originalApp = readFileSync(join(SRC, 'app.js'), 'utf8')
  if (originalApp === app.toString()) {
    throw new Error('app.js 的定点替换一处都没生效：原型的锚点文字变了，先同步 scripts/build-public.mjs')
  }

  const changed = []
  for (const { name, content } of targets) {
    const dest = join(OUT, name)
    let current = null
    try { current = readFileSync(dest) } catch { /* 首次构建 */ }
    if (current && Buffer.compare(current, content) === 0) continue
    changed.push(name)
    if (!check) writeFileSync(dest, content)
  }

  if (check) {
    if (changed.length) {
      console.error(`public/ 与 prototypes/v0.2/ 不一致：${changed.join(', ')}。跑 npm run build:public`)
      process.exit(1)
    }
    console.log('public/ 与原型一致（仅定点替换）')
    return
  }

  console.log(changed.length ? `已生成 public/：${changed.join(', ')}` : 'public/ 没有变化，不重写')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
