/* apiBase 契约回归（DEV-REQUIREMENTS §三·工程约束第 14 条）。
 *
 * 这一条是本家族踩得最多的一次：页面拼接口路径时"猜前缀里有没有 /api"，
 * 结果本地一切正常，装进宿主就 404 —— 因为本地 base 是 ''，怎么拼都对。
 *
 * 所以这里不测"实现看起来对不对"，而是把 `public/app.js` 里的 `apiBase()`
 * **原样抠出来重新执行**，用三个真实会出现的 URL 复算：
 *   ① 独立启动       /api/pbc-workbench/ui/index.html          → ''
 *   ② 宿主挂在子路径 /w/abc/api/pbc-workbench/ui/index.html     → '/w/abc'
 *   ③ 宿主挂在子路径 /w/abc/api/pbc-workbench/ui/               → '/w/abc'
 * 再与 `lib/api-base.js`（定稿契约实现）交叉验证：两种前缀下最终路径必须一致。
 *
 * 用法：node --test test/ui-base.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { API_BOUNDARY_RE, apiBaseGuard, apiUrl, stripBase } from '../lib/api-base.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const APP = readFileSync(join(ROOT, 'public/app.js'), 'utf8')

/* 从 public/app.js 里抠出 apiBase() 的函数体，交给 new Function 重放。
   抠不出来就直接失败 —— 说明实现被改名了，这个测试也该跟着改。 */
function extractApiBase() {
  const start = APP.indexOf('function apiBase()')
  assert.ok(start >= 0, 'public/app.js 里找不到 function apiBase()')
  const end = APP.indexOf('\n  const apiUrl', start)
  assert.ok(end > start, 'apiBase() 后面找不到 apiUrl 定义，抠取边界失效')
  const src = APP.slice(start, end).trim()
  assert.ok(src.endsWith('}'), `抠出来的 apiBase 不是完整函数：…${src.slice(-40)}`)
  return src
}

const API_PREFIX = (APP.match(/const API_PREFIX = '([^']+)'/) || [])[1]
assert.ok(API_PREFIX, 'public/app.js 里找不到 const API_PREFIX')

function compute(pathname) {
  const fn = new Function('location', 'API_PREFIX', `${extractApiBase()}\nreturn apiBase()`)
  return fn({ pathname }, API_PREFIX)
}

test('① 独立启动：UI 在 /api/pbc-workbench/ui/ 下，base 必须是空串', () => {
  assert.equal(compute(`${API_PREFIX}/ui/index.html`), '')
  assert.equal(compute(`${API_PREFIX}/ui/`), '')
  assert.equal(compute('/index.html'), '')
})

test('② 宿主挂在子路径：/w/abc/api/pbc-workbench/ui/index.html → /w/abc', () => {
  assert.equal(compute(`/w/abc${API_PREFIX}/ui/index.html`), '/w/abc')
  assert.equal(compute(`/w/abc${API_PREFIX}/ui/`), '/w/abc')
  assert.equal(compute(`/deep/mount${API_PREFIX}/ui/app.js`), '/deep/mount')
})

test('③ 拼出来的接口路径里 /api/pbc-workbench 只出现一次（别把前缀当前缀再拼一次）', () => {
  const cases = [
    ['', `${API_PREFIX}/ui/index.html`],
    ['/w/abc', `/w/abc${API_PREFIX}/ui/index.html`],
  ]
  for (const [want, pathname] of cases) {
    const base = compute(pathname)
    assert.equal(base, want)
    const url = `${base}${API_PREFIX}/bootstrap`
    const hits = url.split(API_PREFIX).length - 1
    assert.equal(hits, 1, `${url} 里 /api/pbc-workbench 出现了 ${hits} 次`)
    assert.ok(!url.includes(`${API_PREFIX}${API_PREFIX}`), `出现交界重复：${url}`)
  }
})

test('④ 双形态回归：两种挂载前缀下，去掉前缀后的路径逐字符相等', () => {
  for (const path of ['/bootstrap', `/profile/A`, `/export/A.md`]) {
    const dev = apiUrl('', `${API_PREFIX}${path}`)
    const hosted = apiUrl('/w/abc', `${API_PREFIX}${path}`)
    assert.equal(stripBase(dev, ''), `${API_PREFIX}${path}`)
    assert.equal(stripBase(hosted, '/w/abc'), `${API_PREFIX}${path}`)
    assert.equal(stripBase(dev, ''), stripBase(hosted, '/w/abc'), `两种前缀下 ${path} 拼出来的路径不一致`)
  }
})

test('⑤ 守卫只禁「交界重复」，不搞 includes("/api") 一刀切', () => {
  /* 合法：这三种都必须放行 */
  for (const ok of ['', '/api', '/mount/api/v2']) {
    if (ok === '/api') {
      assert.equal(apiBaseGuard(ok).ok, false, '/api 正好是交界，必须拒')
      continue
    }
    assert.equal(apiBaseGuard(ok).ok, true, `${ok} 应放行`)
  }
  for (const ok of ['', '/api/pbc', '/mount/api/v2', '/w/abc']) {
    assert.equal(apiBaseGuard(ok).ok, true, `${ok} 应放行（只禁交界重复，不判子串）`)
  }
  /* 不合法：三种各有独立 code，调用方要能分支显示不同横幅 */
  assert.equal(apiBaseGuard(null).code, 'INVALID_BASE_SHAPE')
  assert.equal(apiBaseGuard('w/abc').code, 'INVALID_BASE_SHAPE')
  assert.equal(apiBaseGuard('/w/abc/').code, 'INVALID_BASE_TRAILING_SLASH')
  assert.equal(apiBaseGuard('/api').code, 'INVALID_BASE_API_BOUNDARY')
  assert.equal(apiBaseGuard('/mount/api').code, 'INVALID_BASE_API_BOUNDARY')
  /* 守卫不抛异常：调用方要拿结果去渲染横幅，抛了就是白屏 */
  assert.doesNotThrow(() => apiBaseGuard(undefined))
})

test('⑥ 交界正则本身：只命中结尾那一整段 api', () => {
  assert.ok(API_BOUNDARY_RE.test('/api'))
  assert.ok(API_BOUNDARY_RE.test('/mount/api'))
  assert.ok(!API_BOUNDARY_RE.test('/api/pbc'))
  assert.ok(!API_BOUNDARY_RE.test('/apiary'))
  assert.ok(!API_BOUNDARY_RE.test(''))
})

test('⑦ 守卫不通过时 apiUrl 仍拼得出可用路径（不让整页白屏）', () => {
  /* 传了非法前缀（结尾是 api），apiUrl 去掉重复段后仍能拼对 */
  assert.equal(apiUrl('/api', `${API_PREFIX}/bootstrap`), `${API_PREFIX}/bootstrap`)
  assert.equal(apiUrl('/mount/api', `${API_PREFIX}/bootstrap`), `/mount${API_PREFIX}/bootstrap`)
})
