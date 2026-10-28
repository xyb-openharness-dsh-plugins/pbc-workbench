/* 装机回归：config 是 apply 的第二个参数，不是 ctx.config。
 *
 * Cordis 的服务访问守卫会把 `ctx.config` 当成未声明 inject 的服务访问并直接抛
 *   cannot get property "config" without inject
 * ——服务端插件在 apply 阶段就失败，`/api/pbc-workbench/ui/` 与 `/health` 都不存在，
 * 面板业务区空白。本地桩件补了 ctx.config，所以静态检查全绿、装进 Desktop 才炸。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = readFileSync(join(ROOT, 'dsh/index.js'), 'utf8')
const PATCH = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')

/** 去掉注释，只看真正会执行的代码（注释里可以提 ctx.config，那是解释） */
const CODE = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

test('apply 用第二参数收 config', () => {
  assert.ok(/export function apply\(ctx,\s*config\s*=\s*\{\}\)/.test(SOURCE),
    'apply 必须是 apply(ctx, config = {})，config 不走 ctx.config')
})

test('执行代码里不再读 ctx.config（宿主会直接抛 without inject）', () => {
  assert.ok(!/ctx\s*\.\s*config/.test(CODE), '发现 ctx.config：装机后 apply 会抛 cannot get property "config" without inject')
  assert.ok(/openDataSource\(config\?\.root\)/.test(CODE), '开库必须读 config.root')
  assert.ok(/dataDirConfigured:\s*Boolean\(config\?\.root\)/.test(CODE), 'health 的 dataDirConfigured 必须读 config.root')
})

test('patch 仍注入 config.root，Config 仍声明 root（值与声明同源）', () => {
  assert.ok(/config:\s*\n\s*root:\s*!!js dshHomePath\('pbc'\)/.test(PATCH), 'cordis.patch.yml 必须注入 config.root')
  assert.ok(/Config = Schema\.object\(\{\s*root:/.test(SOURCE), 'Config 必须声明 root')
})