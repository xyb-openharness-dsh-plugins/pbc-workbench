/* 本文件由 scripts/build-client.mjs 从 src/client.js 生成，**请勿手改**。
 * 改面板行为请改 src/client.js，然后 npm run build:client；
 * 改面板宽度/分栏参数请改 lib/layout.js；改接口前缀请改 dsh/routes.js。 */
/* 小管宝 DuctPal —— DSH Desktop 业务面板（**源码**）。
 *
 * 本文件是手写源，`lib/client.js` 由 `scripts/build-client.mjs` 注入常量后生成。
 * **不要直接改 lib/client.js**（下次构建会被整份覆盖，占位符没了以后也不会再报错）。
 * Desktop 不会替我们打包客户端（workbench-standard §3.5），所以这里用零依赖的字符串替换
 * 把常量注进去：包名/仓库取自 package.json，面板参数取自 lib/layout.js，接口前缀取自 dsh/routes.js。
 * 参数只有一份来源，用生成而不是手抄，就是为了避免两边漂移。
 *
 * ## 面板形态：customFrame
 *
 * 标准分栏（customFrame=false）下宿主只把 businessWidth 写成一个静态 CSS 变量，
 * 服务侧没有拖宽/关闭面板的接口——实机表现是"业务区被拉满、顶栏没有 AI 按钮、右侧会话不可调"
 * （依据见 lib/layout.js 顶部注释）。所以换 customFrame：宿主把**原生会话节点**作为
 * `conversation` prop 交给我们排版，于是
 *
 * - 顶栏有明确的「打开对话 / 收起对话」按钮，不把关闭藏在面板内部；
 * - 中间 splitter 可鼠标拖、可键盘调（←/→ 步进，Home/End 到边界），区间 25%–45%，带
 *   `role="separator"` 与 aria-valuenow；
 * - 收起只是隐藏，**不结束、不删除会话**；再点开回到同一会话；
 * - 宽度存 localStorage，重开后恢复；
 * - 容器窄于 760px 转覆盖式抽屉，业务区不让位。
 *
 * ## 四条硬约束
 * 1. 根节点首个子元素必须是语义 `<header>`，并用 `--dsh-frame-leading-clearance` 避让 macOS 窗口按钮。
 * 2. 原生会话**始终挂载**（只用 display 显隐）——宿主明确要求切换工作台内容时不重挂输入树，
 *    卸载会丢掉输入框状态。
 * 3. 无会话时业务区照常可用，依赖会话的操作在按钮处引导，不阻断业务。
 * 4. 不自建聊天框：草稿只写进宿主原生输入框，且**不自动发送**。
 */
;(function () {
  // 没有模块加载器就静静退出：这个文件也会被静态检查脚本读到，不该在那时抛错。
  if (typeof window === 'undefined' || typeof window.__ModuleLoader__?.load !== 'function') return

  window.__ModuleLoader__.load({
    id: '@ductpal-dsh/pbc-workbench',
    factory: function (require) {
      var React = require('react')
      var h = React.createElement

      /* ---------- 构建期常量 ---------- */
      var PKG_NAME = '@ductpal-dsh/pbc-workbench'
      var UI_ENTRY = '/api/pbc-workbench/ui/'
      var API_PREFIX = '/api/pbc-workbench'
      var VERSION = '0.2.12'
      var BUSINESS_SIDE = 'left'
      var BUSINESS_WIDTH = Number('0.65')
      /* 注入的是裸字面量（true/false），不加引号也不写 `'x' === 'true'`：
         scripts/check-host-contract.mjs 第 4 条按 "customFrame 必须是 boolean 字面量" 检查，
         写成字符串比较会让判据读到表达式而不是值。 */
      var CUSTOM_FRAME = true
      var AGENT_DEFAULT = Number('0.35')
      var AGENT_MIN = Number('0.25')
      var AGENT_MAX = Number('0.45')
      var AGENT_STEP = Number('0.02')
      var NARROW_BELOW = Number('760')
      var DRAWER_MAX = Number('420')

      var TITLE = '小管宝 DuctPal'
      var PANEL_TITLE = '小管宝 PBC 工作台'
      var SUBTITLE = '本机数据 · 记录不是诊断'
      var DESCRIPTION = '把散落的化验单、ALP 的长期走向、用药与换线、痒与累和并发症筛查整理成可核对的档案，复诊前生成一份能递给医生的问题清单。'
      var EVT_DRAFT = 'pbc:agent-draft'
      var WIDTH_KEY = 'ductpal.pbc.agent-pane.v1'
      var DRAFT_QUEUE_KEY = 'ductpal.pbc.initial-drafts.v1'

      function clampWidth(value) {
        var n = Number(value)
        if (!Number.isFinite(n)) return AGENT_DEFAULT
        return Math.min(AGENT_MAX, Math.max(AGENT_MIN, n))
      }
      /* 对齐到步进：鼠标拖和键盘按落在同一组取值上，免得拖出 33.7% 这种数。 */
      function snapWidth(value) {
        if (!AGENT_STEP) return clampWidth(value)
        return clampWidth(Math.round(value / AGENT_STEP) * AGENT_STEP)
      }
      function round4(n) {
        return Math.round(n * 10000) / 10000
      }
      function loadWidth() {
        try {
          var saved = JSON.parse(window.localStorage.getItem(WIDTH_KEY) || 'null')
          return clampWidth(saved && saved.width)
        } catch {
          return AGENT_DEFAULT
        }
      }
      function saveWidth(width) {
        try {
          window.localStorage.setItem(WIDTH_KEY, JSON.stringify({ width: round4(width) }))
        } catch {
          /* 隐私模式下 localStorage 会抛：记不住宽度不算故障，不该弹错。 */
        }
      }

      /* ---------- 样式（苔绿主色 #5C6B3C，配纸色 #F7F6EF） ---------- */
      var rootStyle = {
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0,
        width: '100%', maxWidth: '100%', boxSizing: 'border-box',
        background: '#F7F6EF', color: '#2B3320',
        fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif',
      }
      /* 首个子元素必须是语义 <header>：宿主给 macOS 窗口按钮预留了 --dsh-frame-leading-clearance。
         布局：左＝品牌+版本号，右＝打开/收起对话按钮，中间说明文字占位。 */
      var headerStyle = {
        display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', flexWrap: 'wrap',
        padding: '6px 12px', paddingInlineStart: 'var(--dsh-frame-leading-clearance, 12px)',
        borderBottom: '1px solid #E1DFD2', background: '#FCFBF5', fontSize: 12,
      }
      var brandStyle = {
        display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, color: '#3F4A2B',
        whiteSpace: 'nowrap', fontSize: 12.5,
      }
      var verStyle = {
        fontWeight: 500, fontSize: 11, color: '#7A7F6B', background: '#ECEAE0',
        borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap',
      }
      var hintStyle = { flex: 1, minWidth: 200, color: '#8B8F7C', fontSize: 11.5 }
      var headerActionsStyle = { display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', marginLeft: 'auto' }
      var bodyStyle = { position: 'relative', display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }
      var businessStyle = { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }
      var frameStyle = { flex: '1 1 auto', width: '100%', minHeight: 0, border: 0, display: 'block' }
      var paneStyle = {
        display: 'flex', flexDirection: 'column', flex: '0 0 auto', minWidth: 0, minHeight: 0,
        borderLeft: '1px solid #E1DFD2', background: '#FFFEF8', overflow: 'hidden',
      }
      var drawerStyle = { position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 3, boxShadow: '-8px 0 24px rgba(63,74,43,0.14)' }
      var splitterStyle = {
        position: 'absolute', top: 0, bottom: 0, width: 1, marginRight: -0.5,
        zIndex: 2, background: '#E4DFEA', cursor: 'col-resize', touchAction: 'none',
        transition: 'background .15s ease, box-shadow .15s ease',
      }

      /* 分隔线（全家族统一行为）：悬停显示本工作台同色系增亮色 + 拖动把手；按住左右拖动调 AI 面板宽度 */
      var SPLITTER_BRAND = '#3F4A2B'
      var splitterMix = (hex, ratio) => {
        const n = parseInt(String(hex).replace('#', ''), 16)
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
        const mix = (c) => Math.round(c + (255 - c) * ratio)
        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
      }
      var splitterRgba = function (hex, alpha) {
        var n = parseInt(String(hex).replace('#', ''), 16)
        return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + alpha + ')'
      }
      var splitterHoverStyle = {
        ...splitterStyle,
        background: SPLITTER_BRAND,
        boxShadow: `0 0 6px ${splitterRgba(SPLITTER_BRAND, 0.55)}`,
      }
      var splitterDragStyle = {
        ...splitterHoverStyle,
        boxShadow: `0 0 10px ${splitterRgba(SPLITTER_BRAND, 0.8)}`,
      }
      var splitterHitStyle = {
        position: 'absolute', top: 0, bottom: 0, left: -5, width: 11,
        background: 'transparent', cursor: 'col-resize',
      }
      var splitterGripStyle = {
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 14, height: 22, borderRadius: 4, background: SPLITTER_BRAND,
        color: '#fff', fontSize: 11, lineHeight: '22px', letterSpacing: '-1px', textAlign: 'center',
        opacity: 0.95, pointerEvents: 'none', userSelect: 'none',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
      }
      var splitterFocusStyle = Object.assign({}, splitterStyle,
        { background: SPLITTER_BRAND, boxShadow: '0 0 0 1px ' + splitterRgba(SPLITTER_BRAND, 0.5) })
      var dragShieldStyle = {
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 4,
        cursor: 'col-resize', background: 'transparent', touchAction: 'none',
      }
      var fallbackStyle = { padding: 24, color: '#3F4A2B', fontSize: 14, lineHeight: 1.7 }
      var buttonStyle = {
        border: 0, borderRadius: 999, padding: '5px 14px', whiteSpace: 'nowrap',
        background: '#5C6B3C', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer',
      }
      var ghostStyle = Object.assign({}, buttonStyle, { background: 'transparent', color: '#5C6B3C', border: '1px solid #D8D5C4' })
      var padStyle = {
        display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center',
        padding: 20, color: '#6E735F', fontSize: 12.5, lineHeight: 1.75,
      }

      function Fallback(props) {
        return h('div', { style: fallbackStyle },
          h('p', null, '页面没能加载（v' + VERSION + ' · ' + UI_ENTRY + '）。常见原因是 Harness 刚重启、插件还没加载完。'),
          h('p', null, '你的资料只存在自己选的资料目录里，不会因为这个提示丢失。'),
          h('button', { type: 'button', style: buttonStyle, onClick: props.onRetry }, '重新加载'),
        )
      }

      /* ---------- 会话判定（与家族其它工作台同款） ---------- */
      var bridge = null
      function currentSession() {
        var service = bridge && bridge.desktopWorkbenches
        if (typeof service?.currentSession === 'function') return service.currentSession() || null
        var snapshot = bridge?.sessions?.list?.getSnapshot?.()
        return (snapshot && snapshot.current)
          || Object.keys((snapshot && snapshot.byId) || {}).find(function (id) {
            return ((snapshot.byId[id] && snapshot.byId[id].retainedBy && snapshot.byId[id].retainedBy.mainView) || 0) > 0
          })
          || null
      }
      function workbenchOwnsSession(sessionId) {
        if (!sessionId) return false
        var service = bridge && bridge.desktopWorkbenches
        if (typeof service?.ownsSession === 'function') return Boolean(service.ownsSession(sessionId))
        return false
      }
      function ownedSession() {
        var id = currentSession()
        return workbenchOwnsSession(id) ? id : null
      }

      /* ---------- 原生草稿：只填入，不发送 ---------- */
      function fillDraft(sessionId, prompt) {
        if (!sessionId || ownedSession() !== sessionId) throw new Error('会话已切换，请回到本工作台再操作')
        var actx = bridge.sessions.scope?.(sessionId)
        var conversation = actx?.get?.('conversation')
        if (!conversation) throw new Error('对话输入不可用')
        var input = conversation.input.for(actx)
        var snapshot = input.state.getSnapshot()
        /* 输入框里已经有引用（occurrences）或非普通输入（phase!=='plain'）时灌草稿会砸掉
           用户排好的东西。这不是"没做完"，是宿主输入框的既有状态，必须拦住并说清楚。 */
        if ((snapshot.occurrences && snapshot.occurrences.length) || (snapshot.phase && snapshot.phase !== 'plain')) {
          throw new Error('当前草稿含引用或特殊输入，请先在会话里处理，再交给小管宝')
        }
        var current = snapshot.draft || ''
        input.setDraft(current.trim() ? current + '\n\n' + prompt : prompt)
      }

      var pendingDraft = null
      try {
        var saved = JSON.parse(window.localStorage.getItem(DRAFT_QUEUE_KEY) || 'null')
        if (saved && saved.sessionId && saved.prompt) pendingDraft = saved
      } catch {
        /* 隐私模式忽略。 */
      }
      function rememberDraft(entry) {
        pendingDraft = entry
        try {
          if (entry) window.localStorage.setItem(DRAFT_QUEUE_KEY, JSON.stringify(entry))
          else window.localStorage.removeItem(DRAFT_QUEUE_KEY)
        } catch {
          /* 同上。 */
        }
      }
      /* 面板重挂载（切页签、宿主重绘）会丢内存里的草稿，所以存 localStorage，
         起来后 500ms 一轮试着灌回去，灌成功就删。 */
      function flushDraft() {
        if (!pendingDraft) return false
        try {
          fillDraft(pendingDraft.sessionId, pendingDraft.prompt)
          rememberDraft(null)
          return true
        } catch {
          return false
        }
      }

      function onboardingPrompt(dir) {
        return [
          '你正在协助我使用「小管宝 DuctPal」原发性胆汁性胆管炎（PBC）工作台。它只做本机资料整理，不提供诊疗建议。',
          '资料目录：' + (dir || '（首次打开时在面板里选择）'),
          '里面是我的化验单与 ALP/GGT/TBil 的长期序列、当前用药与换线记录、痒与累的记录、并发症筛查、就诊问题清单。',
          '分工：你帮我汇总、找缺漏、把报告里的指标和日期整理成对照表；判断和决定由我和我的医生做。',
          '三条请你遵守：不要替我推算参考范围（报告没印上限就是没印）；不要替我判定"应答/未应答"；',
          '不要给我算 GLOBE / UK-PBC 之类的评分。我标记的"看法"是我自己的担心，不是医生结论。',
        ].join('\n')
      }

      /* ---------- 面板本体（customFrame） ---------- */
      function Panel(props) {
        var conversation = props && props.conversation

        var gen = React.useState(0)
        var generation = gen[0]
        var setGeneration = gen[1]

        var bs = React.useState(false)
        var broken = bs[0]
        var setBroken = bs[1]

        var ns = React.useState('')
        var note = ns[0]
        var setNote = ns[1]

        var ws = React.useState(loadWidth)
        var width = ws[0]
        var setWidth = ws[1]

        var os = React.useState(true)
        var paneOpen = os[0]
        var setPaneOpen = os[1]

        var cs = React.useState(false)
        var connecting = cs[0]
        var setConnecting = cs[1]

        var rs = React.useState(false)
        var narrow = rs[0]
        var setNarrow = rs[1]

        var ds = React.useState(false)
        var dragging = ds[0]
        var setDragging = ds[1]
        var hs = React.useState(false)
        var hovering = hs[0]
        var setHovering = hs[1]

        var brokenTimer = React.useRef(null)
        var shellRef = React.useRef(null)
        var dragHostRef = React.useRef(null)
        var frameRef = React.useRef(null)

        var hasConversation = Boolean(conversation)
        var canOpenSession = typeof (bridge && bridge.desktopWorkbenches && bridge.desktopWorkbenches.ensureSession) === 'function'

        /* 8 秒没 onLoad 就当没起来：宁可给一个能重试的提示，也不留一块白板。
           onLoad 成功后必须清掉定时器，否则加载完 8 秒后面板会被换成兜底页。 */
        React.useEffect(function () {
          setBroken(false)
          brokenTimer.current = window.setTimeout(function () { setBroken(true) }, 8000)
          return function () { window.clearTimeout(brokenTimer.current) }
        }, [generation])

        React.useEffect(function () {
          var timer = window.setInterval(function () {
            if (flushDraft()) setNote('草稿已填入会话，按回车发送')
          }, 500)
          var unsubscribe = bridge?.desktopWorkbenches?.subscribe?.(function () { setNote('') })
          return function () {
            window.clearInterval(timer)
            if (typeof unsubscribe === 'function') unsubscribe()
          }
        }, [])

        /* 窄屏判定用**容器宽度**，不用 window.innerWidth：工作台可能只占屏幕左边 65%，
           1200px 的屏幕上业务区只有 780px，按窗口判会把窄屏当宽屏用。 */
        React.useEffect(function () {
          var host = shellRef.current
          if (!host || typeof ResizeObserver !== 'function') return undefined
          var observer = new ResizeObserver(function (entries) {
            var w = (entries[0] && entries[0].contentRect && entries[0].contentRect.width) || 0
            setNarrow(w > 0 && w < NARROW_BELOW)
          })
          observer.observe(host)
          return function () { observer.disconnect() }
        }, [])

        var applyWidth = React.useCallback(function (next) {
          var snapped = round4(snapWidth(next))
          setWidth(snapped)
          saveWidth(snapped)
        }, [])

        var stopDrag = React.useCallback(function () {
          dragHostRef.current = null
          setDragging(false)
        }, [])

        React.useEffect(function () {
          if (!dragging) return undefined
          function onMove(event) {
            var host = dragHostRef.current
            if (!host) return
            var rect = host.getBoundingClientRect()
            if (!rect.width) return
            /* 会话在右侧：指针越靠左，会话越宽。 */
            applyWidth(((rect.right - event.clientX) / rect.width) * 100)
          }
          function onUp() { stopDrag() }
          document.addEventListener('pointermove', onMove)
          document.addEventListener('pointerup', onUp)
          document.addEventListener('pointercancel', onUp)
          return function () {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('pointercancel', onUp)
          }
        }, [dragging, applyWidth, stopDrag])

        function onSplitterPointerDown(event) {
          event.preventDefault()
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch (e) { /* 旧宿主降级 */ }
          dragHostRef.current = shellRef.current
          setDragging(true)
        }

        function onSplitterKeyDown(event) {
          var delta = { ArrowLeft: AGENT_STEP, ArrowRight: -AGENT_STEP }[event.key]
          if (delta !== undefined) { event.preventDefault(); applyWidth(width + delta); return }
          if (event.key === 'Home') { event.preventDefault(); applyWidth(AGENT_MAX); return }
          if (event.key === 'End') { event.preventDefault(); applyWidth(AGENT_MIN) }
        }

        /* ---------- 打开 / 收起对话 ---------- */
        function openAgent(prompt) {
          setNote('')
          if (!canOpenSession) {
            setNote('当前 Desktop 版本不支持从面板调起会话；请从左侧会话列表新建会话')
            return Promise.resolve()
          }
          setConnecting(true)
          return Promise.resolve()
            .then(function () {
              return fetch(API_PREFIX + '/health').then(function (r) { return r.json() })
            })
            .catch(function () { return null })
            .then(function (health) {
              /* 资料目录由服务端 `config.root`（宿主注入的 dshHomePath）决定，**客户端不知道、
                 也不该知道**：health 只回 dataDirConfigured 这个布尔，不回路径。
                 所以这里不传 folder，让宿主用默认会话目录，避免我们自己编一个路径出来。 */
              var configured = Boolean(health && health.dataDirConfigured)
              return bridge.desktopWorkbenches.ensureSession({ folder: null }).then(function (id) {
                rememberDraft({ sessionId: id, prompt: prompt || onboardingPrompt(null) })
                flushDraft()
                setPaneOpen(true)
                setNote(configured
                  ? '会话已就绪：草稿已填入右侧输入框，按回车发送'
                  : '会话已就绪，但资料目录还没配好（面板里能看演示数据，记不进你自己的库）')
              })
            })
            .catch(function (error) {
              setNote('没能调起会话：' + ((error && error.message) || error))
            })
            .then(function () { setConnecting(false) })
        }

        /* 收起只是隐藏，不是关闭/删除会话：再点开回到同一个会话。 */
        function onAgentClick() {
          if (!hasConversation) { void openAgent(null); return }
          setPaneOpen(function (open) { return !open })
          setNote('')
        }

        /* ---------- 页面发来的「让 AI 帮我写」：只填输入框，不发送 ---------- */
        function deliverContext(prompt) {
          var id = ownedSession()
          if (id) {
            rememberDraft({ sessionId: id, prompt: prompt })
            setPaneOpen(true)
            setNote(flushDraft()
              ? '已把这一页的内容填入会话草稿，按回车发送'
              : '会话输入框还没就绪；草稿已暂存，就绪后自动填入')
            return Promise.resolve()
          }
          setNote('正在为你调起 AI 会话…')
          return openAgent(prompt)
        }

        /* handler 每轮换成最新闭包，effect 只注册一次：
           直接在 effect 里闭包 deliverContext 会拿到首帧的 state（会话 ID 已经变了也不自知）。 */
        var deliverRef = React.useRef(null)
        React.useEffect(function () { deliverRef.current = deliverContext })
        /* 页面顶栏的「对话」只发 `pbc:agent-open`（页面不自建面板）。这里必须真的接住：
           此前只认草稿事件，装机后点「对话」**一点反应都没有**，用户看到的就是
           "这个工作台没有 AI 入口"。同一个 ref 拿最新闭包，避免 effect 钉死在首帧。 */
        var openRef = React.useRef(null)
        React.useEffect(function () { openRef.current = onAgentClick })
        React.useEffect(function () {
          function onMessage(event) {
            var data = event.data
            if (!data || typeof data !== 'object') return
            var type = data.type
            if (type !== EVT_DRAFT && type !== 'pbc:agent-open') return
            var frame = frameRef.current
            /* 三条守卫缺一不可：类型（别的面板的自定义事件不能进）、
               来源窗口（同源但别的 frame 不行）、同源（跨站页面绝不能往会话里写字）。 */
            if (!frame || event.source !== frame.contentWindow) return
            if (event.origin !== window.location.origin) return
            if (type === 'pbc:agent-open') {
              void (openRef.current && openRef.current())
              return
            }
            var prompt = typeof data.prompt === 'string' ? data.prompt.trim() : ''
            if (!prompt) return
            var ctx = typeof data.context === 'string' ? data.context.trim() : ''
            var full = ctx ? prompt + '\n\n【病情上下文】\n' + ctx.slice(0, 4000) : prompt
            void (deliverRef.current && deliverRef.current(full.slice(0, 8000)))
          }
          window.addEventListener('message', onMessage)
          return function () { window.removeEventListener('message', onMessage) }
        }, [])

        var agentLabel = !canOpenSession
          ? '对话暂不可用'
          : connecting ? '正在连接…'
            : !hasConversation ? '打开对话'
              : paneOpen ? '收起对话' : '打开对话'

        if (broken) return h(Fallback, { onRetry: function () { setGeneration(function (n) { return n + 1 }) } })

        var percent = Math.round(width)
        var paneVisible = paneOpen && (hasConversation || connecting)

        return h('div', { style: rootStyle },
          h('header', { style: headerStyle },
            h('span', { style: brandStyle }, '🌿 ' + TITLE),
            h('span', { style: verStyle }, 'v' + VERSION),
            h('span', { style: hintStyle },
              hasConversation
                ? '右侧是 DSH 原生会话：可拖中间分隔边调宽（25%–45%），收起不会结束会话。'
                : '还没有会话。点右侧「打开对话」调起原生会话，开场白只填进草稿，不自动发送。'),
            h('div', { style: headerActionsStyle },
              h('button', {
                type: 'button',
                style: buttonStyle,
                onClick: onAgentClick,
                disabled: connecting || !canOpenSession,
                'aria-label': '对话：' + agentLabel,
              }, agentLabel),
              /* 收起给一个明确的控件，不把关闭藏在面板内部。 */
              hasConversation && paneOpen && h('button', {
                type: 'button', style: ghostStyle,
                onClick: function () { setPaneOpen(false) },
                'aria-label': '收起对话面板',
              }, '×'),
              note && h('span', { style: { color: '#5C6B3C', fontWeight: 600 } }, note),
            ),
          ),
          h('div', { ref: shellRef, style: bodyStyle },
            h('div', { style: businessStyle },
              h('iframe', {
                key: generation,
                ref: frameRef,
                src: UI_ENTRY + 'index.html',
                title: TITLE + ' · ' + SUBTITLE,
                style: frameStyle,
                sandbox: 'allow-scripts allow-same-origin allow-forms allow-downloads',
                onLoad: function () {
                  setBroken(false)
                  window.clearTimeout(brokenTimer.current)
                },
              }),
            ),
            /* 原生会话**始终挂载**：卸载会丢掉输入框与草稿状态（宿主明确要求不重挂输入树），
               所以隐藏走 display，不卸载组件。 */
            /* splitter 只在宽屏出现：窄屏是覆盖式抽屉，拖宽没有意义。 */
            !narrow && paneVisible && h('div', {
              role: 'separator',
              'aria-orientation': 'vertical',
              'aria-label': '调整对话面板宽度',
              'aria-valuemin': Math.round(AGENT_MIN),
              'aria-valuemax': Math.round(AGENT_MAX),
              'aria-valuenow': percent,
              tabIndex: 0,
              style: {
                ...(dragging ? splitterDragStyle : hovering ? splitterHoverStyle : splitterStyle),
                right: percent + '%',
              },
              onPointerDown: onSplitterPointerDown,
              onPointerEnter: function () { setHovering(true) },
              onPointerLeave: function () { setHovering(false) },
              onKeyDown: onSplitterKeyDown,
            }, h('span', { style: splitterHitStyle, 'aria-hidden': 'true' }),
              (hovering || dragging) ? h('span', { style: splitterGripStyle, 'aria-hidden': 'true' }, '⠿') : null),
            h('aside', {
              style: Object.assign({}, paneStyle,
                narrow ? drawerStyle : null,
                { width: narrow ? 'min(92%, ' + DRAWER_MAX + 'px)' : percent + '%' },
                { display: paneVisible ? 'flex' : 'none' }),
              'aria-label': '对话',
              'aria-hidden': paneVisible ? undefined : 'true',
            }, conversation || h('div', { style: padStyle },
              h('b', null, '对话还没开始'),
              h('span', null, '点顶栏「打开对话」调起 DSH 原生会话后，它会固定出现在这一侧。'),
              h('span', null, '没有会话也不影响记录：左边的化验、生化线、痒与累、复查节奏照常可用。'),
            )),
            /* 拖动时铺一层透明遮罩：指针一旦掠到业务 iframe 上，指针事件就归子文档，
            document 上的监听收不到；遮罩让整个面板都成为我们的命中区。 */
            dragging && !narrow && h('div', { 'aria-hidden': 'true', style: dragShieldStyle }),
          ),
        )
      }

      function apply(ctx) {
        bridge = ctx
        ctx.effect(function () {
          return ctx.desktopWorkbenches.register({
            title: TITLE,
            panelTitle: PANEL_TITLE,
            icon: '🌿',
            repository: 'https://github.com/xyb-openharness-dsh-plugins/pbc-workbench',
            description: DESCRIPTION,
            audience: '原发性胆汁性胆管炎（PBC）患者；照护者可代记',
            requirements: '本机数据整理；不做诊断与处置建议，不替你判定生化应答，判断由你与医生做出。',
            initialization: 'empty',
            embedded: true,
            version: VERSION,
            author: '小 X 宝家族',
            /* 下面三个值由 scripts/build-client.mjs 从 lib/layout.js 注入，不在这里手写第二份。 */
            layout: { businessSide: BUSINESS_SIDE, businessWidth: BUSINESS_WIDTH },
            customFrame: CUSTOM_FRAME,
          }, Panel)
        })
      }

      return { apply: apply, inject: ['desktopWorkbenches', 'sessions'] }
    },
  })
})()
