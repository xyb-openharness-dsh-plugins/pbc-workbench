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

/* 纯复制、零改动的文件。bridge.js 是页面与宿主外框的唯一通路（pbc:agent-draft /
   pbc:agent-open），必须随构建生成：只手工放进 public/ 的话，换机重建或打包一旦漏了它，
   装机版的「AI 帮我填」就永远送不到会话，而页面看起来完全正常。 */
const VERBATIM = ['style.css', 'demo-data.js', 'bridge.js', 'primer.css', 'primer.js', 'primer-data.js']

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
/* 定点替换的**命中台账**：`String.replace(anchor, next)` 不命中时是静默空转——原型改一句
   措辞，这里就悄悄换不回来，产物看着"构建成功"，运行时才报 `todayIso is not defined`。
   实测踩过一次（锚点写成 `function esc(s) {`，实际是 `const esc = (s) =>`）。
   靠逐处记账脆（替换写法有数组/模板串多种），改在**产物层**验：每处替换都必须在
   产物里留下可 grep 的指纹，少一条就构建失败。 */
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
      `      /* 三档对照是派生结果，服务器算好带上来（与原型共用 lib/trial-match.js） */`,
      `      trialMatch: data.trialMatch || {},`,
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

  /* ⑥ 症状保存：原型只写内存（`toast('…仅本页内存，不落库')`），开发版必须真的落库。
     替换掉整段 `if (saveItch) saveItch.addEventListener(...)` —— 它写死了日期、
     写 state.localSymptoms、还自承不落库。开发版改成 POST /symptoms 后重取档案。 */
  .replace(
    [
      `    const saveItch = $('#save-itch')`,
      `    if (saveItch) saveItch.addEventListener('click', () => {`,
      `      const s = {`,
      `        date: '2026-10-25',`,
      `        itch: Number($('#itch').value),`,
      `        nightWorse: $('#night').checked,`,
      `        scratch: $('#scratch').checked,`,
      `        sleepBreaks: Number(state.draft.sleepBreaks),`,
      `        fatigue: state.draft.fatigue,`,
      `        note: $('#note').value,`,
      `      }`,
      `      state.localSymptoms.unshift(s)`,
      `      toast('已记下这一次（演示：仅本页内存，不落库）')`,
      `      state.view = 'symptoms'; state.sub = 'log'; render()`,
      `    })`,
    ].join('\n'),
    [
      `    const saveItch = $('#save-itch')`,
      `    if (saveItch) saveItch.addEventListener('click', async () => {`,
      `      /* 开发版：真的写库。日期取**本机今天**（不写死），因为这条记录要和化验单`,
      `         并排给医生看，日期错了比没有更糟。 */`,
      `      const s = {`,
      `        profileKey: state.profileKey,`,
      `        date: todayIso(),`,
      `        itch: Number($('#itch').value),`,
      `        nightWorse: $('#night').checked,`,
      `        scratch: $('#scratch').checked,`,
      `        fatigue: state.draft.fatigue,`,
      `        note: $('#note').value,`,
      `      }`,
      `      saveItch.disabled = true`,
      `      try {`,
      `        const res = await fetch(apiUrl('/symptoms'), {`,
      `          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s),`,
      `        })`,
      `        const data = await res.json()`,
      `        if (!res.ok) throw new Error(data.message || '保存失败')`,
      `        toast(data.saved && data.saved.persisted === false`,
      `          ? '已记下（演示模式：这次不会落到你自己的资料库）'`,
      `          : '已记下这一次')`,
      `        state.draft.note = ''`,
      `        await reloadProfile()`,
      `        state.view = 'symptoms'; state.sub = 'log'; render()`,
      `      } catch (error) {`,
      `        toast('没能保存：' + (error.message || '请稍后重试'))`,
      `      } finally {`,
      `        saveItch.disabled = false`,
      `      }`,
      `    })`,
    ].join('\n'),
  )

  /* ⑤.5 临床试验匹配：原型用 demoMatch 跑演示规则，开发版改成真接口。
     结果形状必须一致（分层 + 证据），否则同一页两套渲染逻辑。 */
  .replace(
    [
      `    const doMatch = $('#do-match')`,
      `    if (doMatch) doMatch.addEventListener('click', () => {`,
      `      /* 原型里没有接口：用演示规则跑一遍，让"分层 + 证据"这件事可看见。`,
      `         开发版由 build-public 换成真接口调用。 */`,
      `      state.trialMatch = demoMatch(profile())`,
      `      render()`,
      `    })`,
    ].join('\n'),
    [
      `    const doMatch = $('#do-match')`,
      `    if (doMatch) doMatch.addEventListener('click', async () => {`,
      `      /* 开发版走真接口：本地快照 + 分层规则都在服务端跑，前端只渲染。`,
      `         两边的结果形状必须一致（分层 + 逐条证据），否则同一页会长出两套渲染逻辑。 */`,
      `      doMatch.disabled = true`,
      `      try {`,
      `        const res = await fetch(apiUrl('/trials/match/' + encodeURIComponent(state.profileKey)))`,
      `        const data = await res.json()`,
      `        if (!res.ok) throw new Error(data.message || '匹配失败')`,
      `        state.trialMatch = data`,
      `        render()`,
      `      } catch (error) {`,
      `        toast('没能跑匹配：' + (error.message || '请稍后重试'))`,
      `      } finally {`,
      `        doMatch.disabled = false`,
      `      }`,
      `    })`,
    ].join('\n'),
  )

  /* ⑥.5 筛查结果写入：原型里的「⋯ 更多」当初只弹一个 toast（承诺了"补一条"却没通路），
     独立评审 P1-3 点出来了。这里把那条 toast 换成真表单 + 真 POST。 */
  .replace(
    `    const pageBtn = $('[data-page]')`,
    [
      `    const saveScreen = $('#save-screening')`,
      `    if (saveScreen) saveScreen.addEventListener('click', async () => {`,
      `      const saved = {`,
      `        profileKey: state.profileKey,`,
      `        sectionKey: saveScreen.dataset.screening,`,
      `        date: $('#scr-date').value,`,
      `        result: $('#scr-result').value,`,
      `        detail: $('#scr-detail').value,`,
      `      }`,
      `      saveScreen.disabled = true`,
      `      try {`,
      `        const res = await fetch(apiUrl('/screening'), {`,
      `          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(saved),`,
      `        })`,
      `        const data = await res.json()`,
      `        if (!res.ok) throw new Error(data.message || '保存失败')`,
      `        toast(data.saved && data.saved.persisted === false`,
      `          ? '已记下（演示模式：这次不会落到你自己的资料库）'`,
      `          : '已记下这一次')`,
      `        await reloadProfile()`,
      `        render()`,
      `      } catch (error) {`,
      `        toast('没能保存：' + (error.message || '请稍后重试'))`,
      `      } finally {`,
      `        saveScreen.disabled = false`,
      `      }`,
      `    })`,
      `    const pageBtn = $('[data-page]')`,
    ].join('\n'),
  )

  /* ⑦ 本机今天（YYYY-MM-DD）。**不用 toISOString()**：那是 UTC，东八区本地零点会退一天，
     用户记的"今天"就变成了昨天。手拼本地年月日。 */
  /* 锚点必须是「启动」标记而不是 esc：`test/ui-parity.test.mjs` 用
     "从 `const X = ` 到下一个 `\n  }`" 取常量块并逐字节比对，在这里插一个带
     `  }` 结尾的函数会把 LABELS 的边界推后，常量块校验当场红（实测踩过）。
     插在「启动」之前不影响任何常量块的边界，而且函数声明会提升，位置随便。 */
  .replace(
    `  /* ------------------------------ 启动 ------------------------------ */`,
    [
      `  /* 本机今天的 YYYY-MM-DD。不用 toISOString().slice(0,10)：那是 UTC 日期，`,
      `     东八区凌晨会退成前一天，患者记的"今天"就落到昨天去了。 */`,
      `  function todayIso() {`,
      `    const d = new Date()`,
      `    const p = (n) => String(n).padStart(2, '0')`,
      `    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())`,
      `  }`,
      ``,
      `  /* 保存后重取档案：界面上的数字必须来自库里，不能只改内存。 */`,
      `  async function reloadProfile() {`,
      `    try {`,
      `      const res = await fetch(apiUrl('/profile/' + encodeURIComponent(state.profileKey) + '?private=1'))`,
      `      if (!res.ok) return`,
      `      const data = await res.json()`,
      `      if (!data.profile) return`,
      `      const at = DEMO.profiles.findIndex((x) => x.key === data.profile.key)`,
      `      if (at >= 0) DEMO.profiles[at] = data.profile`,
      `    } catch { /* 重取失败不影响"已保存"这个事实，页面保持旧数据 */ }`,
      `  }`,
      ``,
      `  /* ------------------------------ 启动 ------------------------------ */`,
    ].join('\n'),
  )

  /* ⑧ boot 里在 render() 之后挂上原生会话挂载位（render 会重绘视图但不碰 #agent-body，
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

  /* 定点替换必须真的发生过。只验"产物≠原文"不够——那只能证明**至少一处**命中，
     而实测踩的正是"大部分命中、一处静默空转"（`todayIso is not defined`）。
     这里逐条验产物指纹：少一条就构建失败，并且指出是哪一处没跟上。 */
  const originalApp = readFileSync(join(SRC, 'app.js'), 'utf8')
  if (originalApp === app.toString()) {
    throw new Error('app.js 的定点替换一处都没生效：原型的锚点文字变了，先同步 scripts/build-public.mjs')
  }
  const appText = app.toString()
  const FINGERPRINTS = [
    ['版本常量', `const VERSION = 'v${version}'`],
    ['数据来源三态', 'DATA_SOURCE'],
    ['apiBase 前缀', 'function apiBase'],
    ['接口取数', "apiUrl('/bootstrap')"],
    ['来源横幅', 'function showSourceBanner'],
    ['原生会话挂载位', 'function renderAgentSlot'],
    ['发送改派发事件', 'new CustomEvent(EVT_DRAFT'],
    ['症状写入', "apiUrl('/symptoms')"],
    ['筛查写入', "apiUrl('/screening')"],
    ['试验匹配走接口', "apiUrl('/trials/match/'"],
    ['本机今天', 'function todayIso'],
    ['保存后重取档案', 'async function reloadProfile'],
    ['boot 挂载位', 'renderAgentSlot()'],
    /* 这条是踩出来的：替换 todayIso 时把 esc 的定义整段吃掉了，
       运行时 `esc is not defined`，整页白屏——而指纹清单当时没覆盖到它。 */
    ['esc 转义还在', "const esc = (s) => String(s == null ? '' : s)"],
  ]
  const missing = FINGERPRINTS.filter(([, needle]) => !appText.includes(needle)).map(([id]) => id)
  if (missing.length) {
    throw new Error(`public/app.js 缺少这些替换痕迹：${missing.join('、')}——原型锚点变了，先同步 scripts/build-public.mjs`)
  }
  /* 反向：原型里那些**不许**带进开发版的东西 */
  const FORBIDDEN = [
    ['自建聊天框模拟回复', '（原型演示）我收到了'],
    ['内存假保存', '仅本页内存，不落库'],
    ['写死的今天', "date: '2026-10-25'"],
  ]
  const leaked = FORBIDDEN.filter(([, needle]) => appText.includes(needle)).map(([id]) => id)
  if (leaked.length) {
    throw new Error(`public/app.js 里还有不该带进开发版的内容：${leaked.join('、')}`)
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
