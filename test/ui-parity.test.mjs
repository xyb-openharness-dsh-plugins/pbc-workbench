/* ui-parity：开发版 UI 与原型逐字符对齐（四条总原则第 1 条）。
 *
 * 原型是唯一视觉基准。开发版允许加的东西只有三类，且必须白名单登记：
 *   ① 取数据（apiBase / apiUrl / loadBootstrap / applyData）
 *   ② 说明数据来源的横幅（showSourceBanner）
 *   ③ 会话挂载位说明（renderAgentSlot）
 * 除这三类，任何开发版新增的函数 / 改掉的常量块 / 改掉的样式，都算"原型漂移"。
 *
 * 对齐的判据不看人眼，看字节：
 *   - style.css     → 与 prototypes/v0.2/style.css **逐字节相同**
 *   - demo-data.js  → 与 prototypes/v0.2/demo-data.js **逐字节相同**
 *   - index.html    → 归一化 title 与版本号后逐字节相同
 *   - app.js        → NAV / GRADE_CODES / LABELS / VIEWS 四个常量块逐字节相同
 *   - 函数集合      → 原型有的开发版必须有（`boot` 允许改成 async）
 *
 * 用法：node --test test/ui-parity.test.mjs   （前置 npm run build:public）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const PROTO_APP = read('prototypes/v0.2/app.js')
const PUB_APP = read('public/app.js')
const PROTO_CSS = read('prototypes/v0.2/style.css')
const PUB_CSS = read('public/style.css')
const PROTO_DEMO = read('prototypes/v0.2/demo-data.js')
const PUB_DEMO = read('public/demo-data.js')
const PROTO_HTML = read('prototypes/v0.2/index.html')
const PUB_HTML = read('public/index.html')

/* 开发版允许新增的函数：全部与"数据从哪来"有关，不碰任何视图逻辑。 */
const EXTRA_ALLOWED = new Set(['apiBase', 'apiUrl', 'loadBootstrap', 'applyData', 'showSourceBanner', 'renderAgentSlot'])

function functions(src) {
  return [...src.matchAll(/^ {2}(?:async )?function ([A-Za-z0-9_$]+)/gm)].map((m) => m[1])
}

/* 取 `const NAME = ` 到行首 `};` 或 `}` 为止的整块（常量块两边必须逐字节相同）。 */
function block(src, name) {
  const start = src.indexOf(`const ${name} = `)
  assert.ok(start >= 0, `找不到常量块 const ${name}`)
  const objEnd = src.indexOf('\n  }', start)
  const arrEnd = src.indexOf('\n  ]', start)
  let end
  if (objEnd < 0) end = arrEnd
  else if (arrEnd < 0) end = objEnd
  else end = Math.min(objEnd, arrEnd)
  assert.ok(end > start, `常量块 const ${name} 的结束位置找不到`)
  return src.slice(start, end)
}

test('① 原型里的每个函数，开发版都必须有（改名等于漂移）', () => {
  const pub = new Set(functions(PUB_APP))
  const missing = functions(PROTO_APP).filter((f) => !pub.has(f))
  assert.deepEqual(missing, [], `开发版缺这些函数：${missing.join(', ')}`)
})

test('② 开发版新增的函数必须落在白名单里', () => {
  const proto = new Set(functions(PROTO_APP))
  const extra = functions(PUB_APP).filter((f) => !proto.has(f))
  const unexpected = extra.filter((f) => !EXTRA_ALLOWED.has(f))
  assert.deepEqual(unexpected, [], `开发版多出未登记的函数：${unexpected.join(', ')}（先想清楚它属不属于"取数据/说明来源"三类）`)
})

test('③ 四个视图常量块两边逐字节相同（NAV / GRADE_CODES / LABELS / VIEWS）', () => {
  for (const name of ['NAV', 'GRADE_CODES', 'LABELS', 'VIEWS']) {
    assert.equal(block(PUB_APP, name), block(PROTO_APP, name), `常量块 ${name} 与原型不一致`)
  }
})

test('④ style.css 与原型逐字节相同（视觉基准不许改）', () => {
  assert.equal(PUB_CSS, PROTO_CSS, 'public/style.css 与 prototypes/v0.2/style.css 不一致：改样式请先改原型')
})

test('⑤ demo-data.js 与原型逐字节相同（演示数据只有一个来源）', () => {
  assert.equal(PUB_DEMO, PROTO_DEMO, 'public/demo-data.js 与 prototypes/v0.2/demo-data.js 不一致')
})

test('⑥ index.html 归一化 title 与版本号后逐字节相同', () => {
  /* 归一化三件事：标题、版本号、以及「原型 / 开发版」这枚渠道词。
     渠道词是允许不同的——它正是"这是哪一份"的唯一线索，界面上必须看得见。 */
  const norm = (s) =>
    s
      .replace(/<title>[^<]*<\/title>/, '<title>TITLE</title>')
      .replace(/v\d+\.\d+\.\d+/g, 'vX.Y.Z')
      .replace(/开发版/g, 'CHANNEL')
      .replace(/原型/g, 'CHANNEL')
  assert.equal(norm(PUB_HTML), norm(PROTO_HTML), 'public/index.html 除标题与版本号外的部分与原型不一致')
})

test('⑦ 开发版必须真的接了接口：有 API_PREFIX、有 function apiBase()、字面量 /bootstrap', () => {
  assert.match(PUB_APP, /const API_PREFIX = '\/api\/pbc-workbench'/, '缺 API_PREFIX 常量')
  assert.match(PUB_APP, /function apiBase\(\)/, '缺 function apiBase()')
  assert.match(PUB_APP, /\/bootstrap/, '缺 /bootstrap 字面量 —— 页面根本没连接口')
  assert.match(PUB_APP, /DEMO_FALLBACK/, '缺 DEMO_FALLBACK：接口不通才回退演示数据，不能把演示当默认')
})

test('⑧ 开发版不许自建聊天框：只能派发 pbc:agent-draft 事件', () => {
  assert.match(PUB_APP, /new CustomEvent\(EVT_DRAFT/, '缺 EVT_DRAFT 事件派发')
  /* 判据是"有没有一本正经地造一条回复"，不是"有没有出现过这几个字"：
     `toast('已交给右侧原生会话；本页不模拟回复')` 是免责说明，必须允许。
     造回复的形态=给会话里塞一段 assistant 内容，或本地拼一段假回答再渲染。 */
  assert.ok(!/function\s+(mockReply|agentReply|fakeReply)/.test(PUB_APP), '开发版不该有 mockReply / agentReply 这类造回复的函数（会话由宿主的原生面板负责）')
  assert.ok(!/agent-body[\s\S]{0,200}appendChild/.test(PUB_APP), '开发版不该往 agent-body 里塞内容：那是宿主的原生会话面板，不是自建聊天框')
})

test('⑨ 原型必须冻结：prototypes/v0.2 的版本号不许跟着 package.json 涨', () => {
  const pkg = JSON.parse(read('package.json'))
  const protoVer = (PROTO_APP.match(/const VERSION = 'v(\d+\.\d+\.\d+)'/) || [])[1]
  assert.ok(protoVer, '原型里找不到 const VERSION')
  assert.equal(protoVer, '0.1.0', '原型版本号冻结在 0.1.0（它是视觉基准，不许随发版改动）')
  assert.ok(typeof pkg.version === 'string')
})
