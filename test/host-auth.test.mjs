/* 宿主鉴权闸：把 `connection.requestRejection` 的结果翻译成"放行 / 401 / 503"。
 *
 * 这一段**只在宿主语境**下走到 —— `scripts/dev-server.mjs` 自己造 handler、直接调
 * `createApiHandler`，根本不经过 `dsh/index.js` 的这段。所以 `npm run check` 全绿、
 * dev 探针全绿，装机副本仍然会炸。本机 2026-10-25 实测两个真实缺陷：
 *
 *   ① 宿主没给 `connection.requestRejection` 时，原实现**跳过鉴权继续放行** ——
 *      宿主少给一个能力，本机资料就裸奔出去了。正确行为是 503 明说不可用。
 *   ② 宿主"不拒绝"时可能返回 `null`，原实现用 `!== undefined` 判，把 `null` 当状态码
 *      写进 `writeHead(null)`，进程抛 `ERR_HTTP_INVALID_STATUS_CODE: Invalid status code: null`，
 *      整条服务链熄火（不是 500，是服务直接崩）。判定必须用**真值**。
 *
 * 用法：node --test test/host-auth.test.mjs
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createAuthorized, AUTH_REQUIRED, AUTH_UNAVAILABLE } from '../dsh/auth.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const tmp = mkdtempSync(join(homedir(), '.ductpal-host-'))
process.on('exit', () => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 忽略 */ } })

/** 起一个真 HTTP 服务，handler 包一层业务桩，返回 { server, base, calls }。 */
async function serve(connection) {
  const calls = []
  const api = (req, res) => {
    calls.push(req.url)
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true }))
  }
  const handler = createAuthorized({ api, connection })
  const server = createServer(handler)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { server, calls, base: `http://127.0.0.1:${server.address().port}` }
}

test('① 宿主没有鉴权能力 → 503 明说不可用，且业务 handler 根本不被调用', async () => {
  const { server, base, calls } = await serve(undefined)
  const res = await fetch(`${base}/bootstrap`)
  assert.equal(res.status, 503, '没有鉴权能力却放行了——本机资料会裸奔')
  const body = await res.json()
  assert.equal(body.error, AUTH_UNAVAILABLE)
  assert.match(body.message, /鉴权/)
  assert.equal(calls.length, 0, '鉴权没过就不该走到业务 handler')
  server.close()
})

test('② 宿主返回 null（=不拒绝）：必须放行，不能把 null 当状态码', async () => {
  const { server, base, calls } = await serve({ requestRejection: () => null })
  const res = await fetch(`${base}/health`)
  assert.equal(res.status, 200, '把 null 写进 writeHead 会让服务直接崩（ERR_HTTP_INVALID_STATUS_CODE）')
  assert.deepEqual(await res.json(), { ok: true })
  assert.equal(calls.length, 1)
  server.close()
})

test('③ 宿主返回 undefined（=不拒绝）：同样放行', async () => {
  const { server, base } = await serve({ requestRejection: () => undefined })
  const res = await fetch(`${base}/bootstrap`)
  assert.equal(res.status, 200)
  server.close()
})

test('④ 宿主拒绝 → 照它给的状态码回，带 AUTH_REQUIRED，且不触发业务 handler', async () => {
  const { server, base, calls } = await serve({ requestRejection: () => 401 })
  const res = await fetch(`${base}/bootstrap`)
  assert.equal(res.status, 401)
  assert.equal((await res.json()).error, AUTH_REQUIRED)
  assert.equal(calls.length, 0)
  server.close()
})

test('⑤ 拒绝响应本身不含任何业务数据（不许"先放行再拒绝"）', async () => {
  const { server, base } = await serve({ requestRejection: () => 403 })
  const text = await (await fetch(`${base}/profile/A`)).text()
  assert.ok(!text.includes('ALP'))
  assert.ok(!text.includes('虚构'))
  server.close()
})

test('⑥ api 不是函数时立刻报错（装配错了不该等到第一个请求才发现）', () => {
  assert.throws(() => createAuthorized({ api: null, connection: {} }), /api 必须是函数/)
})

test('⑦ 接上真路由：null 不拒绝时 bootstrap 正常，profiles 是数组且落在 <root>/ 下', async () => {
  const { Workbench } = await import('../dsh/workbench.js')
  const { createApiHandler } = await import('../dsh/routes.js')
  const { servePublic } = await import('../dsh/server.js')
  const wb = await Workbench.open(join(tmp, 'ws'))
  const api = createApiHandler({
    source: {
      get db() { return wb.db },
      bootstrap: () => wb.bootstrap(),
      profile: (k, o) => wb.getProfile(k, o),
      saveExport: (k) => wb.saveExport(k),
      isDemo: wb.isDemo,
    },
    version: '0.2.0',
    build: '2026-10-25',
    serveUi: servePublic,
    dataDirConfigured: true,
  })
  const server = createServer(createAuthorized({ api, connection: { requestRejection: () => null } }))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}/api/pbc-workbench`
  const boot = await (await fetch(`${base}/bootstrap`)).json()
  assert.ok(Array.isArray(boot.profiles), 'profiles 必须是数组（原型 demo-data 的形状）')
  assert.equal(boot.profiles.length, 2)
  const health = await (await fetch(`${base}/health`)).json()
  assert.equal(health.dataDirConfigured, true)
  assert.ok(!/\/(Users|home)\//.test(JSON.stringify(health)), 'health 里出现了绝对路径')
  server.close()
  wb.close()
})
