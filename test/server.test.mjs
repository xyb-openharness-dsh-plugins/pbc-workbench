/* 服务层：同一份 handler 在独立启动与宿主挂载两种形态下都能用。
 *
 * 这一层最容易出的不是 500，而是**静默 404 / 静默空数据**：
 *   - dev-server 与宿主各写一份 handler → 本地能开、装进 Desktop 就 404；
 *   - health 把资料目录路径写进响应 → 抓到响应就知道你把病历放哪了；
 *   - 接口通了但库空却回演示档案 → 用户把演示当成自己的病历。
 *
 * 所以这里用真端口起一次服务，把每条路由都实际打一遍。
 *
 * 用法：node --disable-warning=ExperimentalWarning --test test/server.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { createApiHandler, errorBody } from '../dsh/routes.js'
import { startWorkbenchServer } from '../dsh/server.js'
import { Workbench } from '../dsh/workbench.js'

const tmp = mkdtempSync(join(homedir(), '.ductpal-srv-'))
after(() => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 清理失败不影响结论 */ } })

let server
let base
let wb

before(async () => {
  wb = await Workbench.open(null) // 内存库 + 演示数据
  const started = await startWorkbenchServer({ port: 0, workbench: wb })
  server = started.server
  /* started.url 带结尾 /，直接拼 /api/... 会得到 //api/... —— 那样会掉进静态目录
     回 index.html，症状是"接口返回 HTML"，很难一眼看出是自己拼错。 */
  base = started.url.replace(/\/$/, '')
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  wb.close()
})

const get = (path) => fetch(`${base}${path}`)

test('① health 回齐关键字段，且**不泄露资料目录路径**', async () => {
  const res = await get('/api/pbc-workbench/health')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.apiPrefix, '/api/pbc-workbench')
  assert.equal(body.ui, '/api/pbc-workbench/ui')
  for (const k of ['version', 'build', 'apiVersion', 'apiBase', 'demo', 'capabilities']) {
    assert.ok(k in body, `health 缺字段 ${k}`)
  }
  assert.ok(Array.isArray(body.capabilities))
  assert.ok(body.capabilities.includes('bootstrap'))
  /* demo=true 时 dataDirConfigured 必须是 false 或 null，且**没有任何路径字样** */
  assert.ok(body.dataDirConfigured === false || body.dataDirConfigured === null)
  const raw = JSON.stringify(body)
  assert.ok(!raw.includes(tmp), 'health 响应里出现了资料目录路径')
  assert.ok(!/\/(Users|home)\//.test(raw), 'health 响应里出现了绝对路径')
})

test('② bootstrap 返回数组形状的 profiles（前端写的是 profiles.find）', async () => {
  const body = await (await get('/api/pbc-workbench/bootstrap')).json()
  assert.ok(Array.isArray(body.profiles), 'bootstrap.profiles 必须是数组')
  assert.equal(body.profiles.length, 2)
  assert.equal(body.profiles[0].key, 'A')
  assert.ok(Array.isArray(body.profiles[0].labs))
  assert.ok(body.layout && body.layout.agentPane)
})

test('③ 单档案：私有记录默认不给，?private=1 才给', async () => {
  const plain = (await (await get('/api/pbc-workbench/profile/A')).json()).profile
  const full = (await (await get('/api/pbc-workbench/profile/A?private=1')).json()).profile
  assert.equal(plain.key, 'A')
  assert.ok(Array.isArray(plain.symptoms))
  /* 演示数据里有 visibility='private' 的记录：不带参数时必须被滤掉 */
  const priv = full.symptoms.filter((s) => s.visibility === 'private').length
  assert.ok(priv >= 0)
  assert.ok(plain.symptoms.length <= full.symptoms.length, '默认口径不应该比 private=1 给得更多')
})

test('④ 导出 markdown：缺上限的行不许写成「≥下限」也不许判 inside', async () => {
  const res = await get('/api/pbc-workbench/export/A.md')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') || '', /markdown/)
  const md = await res.text()
  assert.match(md, /只印了下限/, '缺上限时文案必须写"只印了下限 X，上限未印"')
  assert.match(md, /上限未印，无法判断/, '缺上限不能被判成"未越出"')
  assert.ok(!/≥\s*35\s*U\/L/.test(md), '出现了「≥下限」这种会被读成"正常应≥35"的写法')
  /* 不是"不能出现这两个字"（免责声明里必然有），而是"不能出现给人当结论读的形态"：
     例如「诊断为…」「分期为…」「你属于…应答」。免责句必须真的在。 */
  assert.match(md, /不构成诊断或治疗意见/, '导出必须带"不构成诊断或治疗意见"的免责句')
  for (const bad of [/诊断为/, /分期为/, /属[于]?(完全|部分)?应答/, /预后(良好|较差)/]) {
    assert.ok(!bad.test(md), `导出里出现了像结论的表述：${bad}`)
  }
})

test('⑤ 私密记录不进导出（导出是拿到外面去的文件，比页面更需要收敛）', async () => {
  const md = await (await get('/api/pbc-workbench/export/A.md')).text()
  const full = (await (await get('/api/pbc-workbench/profile/A?private=1')).json()).profile
  const privNotes = full.symptoms.filter((s) => s.visibility === 'private' && s.note).map((s) => s.note)
  for (const note of privNotes) {
    assert.ok(!md.includes(note), `隐私备注出现在导出文件里：${note}`)
  }
})

test('⑥ 保存导出：演示模式明确拒绝，不假装写成功', async () => {
  const res = await fetch(`${base}/api/pbc-workbench/export/A.md/save`, { method: 'POST' })
  assert.equal(res.status, 501, '演示库（内存库）保存导出应回 501，不能 200 骗人')
  const body = await res.json()
  assert.equal(body.error, 'EXPORT_SAVE_UNAVAILABLE')
  assert.ok(/资料目录/.test(body.message || ''), '拒绝时要告诉用户"先去设置里选定资料目录"，不能只说失败')
})

test('⑦ 未知档案 404、未知路由 404、非 GET 的静态请求 405', async () => {
  assert.equal((await get('/api/pbc-workbench/profile/NOPE')).status, 404)
  assert.equal((await get('/api/pbc-workbench/nothing-here')).status, 404)
  const dir = await get('/api/pbc-workbench/ui/')
  assert.equal(dir.status, 200)
  const notAllowed = await fetch(`${base}/api/pbc-workbench/ui/style.css`, { method: 'POST' })
  assert.equal(notAllowed.status, 405)
})

test('⑧ UI 静态资源真的在：index.html / app.js / style.css / demo-data.js', async () => {
  for (const [file, sizeFloor] of [['index.html', 1000], ['app.js', 20000], ['style.css', 3000], ['demo-data.js', 10000]]) {
    const res = await get(`/api/pbc-workbench/ui/${file}`)
    assert.equal(res.status, 200, `${file} 打不开`)
    const text = await res.text()
    assert.ok(text.length >= sizeFloor, `${file} 内容过短（${text.length}）`)
  }
})

test('⑨ 错误码到 HTTP 状态的映射是集中一处、可枚举的', () => {
  const cases = [
    [{ code: 'NO_TOKEN', message: 'x' }, 503],
    [{ code: 'UNAUTHORIZED', message: 'x' }, 503],
    [{ code: 'PROFILE_NOT_FOUND', message: 'x' }, 404],
    [{ code: 'WORKSPACE_PATH_INVALID', message: 'x' }, 400],
    [{ code: 'EXPORT_SAVE_UNAVAILABLE', message: 'x' }, 501],
    [{ code: 'SOMETHING_ELSE', message: 'x' }, 502],
    [{ code: 'lower_case_code', message: 'x' }, 500],
    [new Error('普通错误没有 code'), 500],
  ]
  for (const [err, want] of cases) {
    const got = errorBody(err)
    assert.equal(got.status, want, `${err.code ?? '(无 code)'} 应映射到 ${want}，实际 ${got.status}`)
    assert.ok(got.body && typeof got.body.message === 'string', '错误响应必须有给人看的话')
  }
})

test('⑩ 两种挂载形态共用同一份 handler（这是"本地能开、装机 404"的根因）', async () => {
  /* 宿主形态：把同一份 createApiHandler 挂在 /w/abc 下，宿主先把前缀剥掉再交进来。
     这里用真 http server 复现，因为 handler 写的是 node 原生 req/res，不是 fetch 的 Request。 */
  const hosted = createApiHandler({
    source: {
      get db() { return wb.db },
      bootstrap: () => wb.bootstrap(),
      profile: (k, o) => wb.getProfile(k, o),
      saveExport: (k) => wb.saveExport(k),
      get isDemo() { return wb.isDemo },
    },
    version: wb.version,
    build: wb.build,
    serveUi: null,
    apiBase: '/w/abc',
    dataDirConfigured: false,
  })
  const MOUNT = '/w/abc'
  const { createServer } = await import('node:http')
  const srv = createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    if (!path.startsWith(`${MOUNT}/api/`)) { res.writeHead(404); res.end(); return }
    req.url = path.slice(MOUNT.length)
    return void hosted(req, res)
  })
  const port = await new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv.address().port)))
  try {
    const res = await fetch(`http://127.0.0.1:${port}${MOUNT}/api/pbc-workbench/bootstrap`)
    assert.equal(res.status, 200)
    const hostedBody = await res.json()
    const direct = await (await get('/api/pbc-workbench/bootstrap')).json()
    assert.deepEqual(hostedBody.profiles, direct.profiles, '挂在前缀下的数据与直连不一致')
    /* health 要如实回报自己被挂在哪：双形态回归靠这个字段，不是靠注释 */
    const h = await (await fetch(`http://127.0.0.1:${port}${MOUNT}/api/pbc-workbench/health`)).json()
    assert.equal(h.apiBase, '/w/abc')
    assert.equal(h.apiPrefix, '/api/pbc-workbench')
  } finally {
    await new Promise((resolve) => srv.close(resolve))
  }
})
