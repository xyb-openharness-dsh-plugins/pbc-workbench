#!/usr/bin/env node
/* 独立启动：浏览器里直接看开发版（不需要 Desktop）。
 *
 * 关键约定：**与宿主用同一份 dsh/routes.js**。曾经两边各写一套路由，
 * 结果是本地打开一切正常、装进 Desktop 后 404，而报错看起来像"插件没加载"。
 * 所以这里只做三件事：起 http server、把 public/ 当静态目录、把 /api/ 交给 createApiHandler。
 *
 * 用法：
 *   node --disable-warning=ExperimentalWarning scripts/dev-server.mjs
 *   PORT=4180 DATA=/path/to/资料目录 node scripts/dev-server.mjs
 *
 * DATA 不给就开内存库 + 演示数据（只读演示，不会写盘）。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const { Workbench } = await import(pathToFileURL(join(ROOT, 'dsh', 'workbench.js')).href)
const { startWorkbenchServer } = await import(pathToFileURL(join(ROOT, 'dsh', 'server.js')).href)
const { apiBaseGuard } = await import(pathToFileURL(join(ROOT, 'dsh', 'routes.js')).href)

const port = Number(process.env.PORT ?? 4173)
const workspace = process.env.DATA ?? null

/* 独立启动没有"挂载前缀"这回事，apiBase 恒为 ''。
   双形态回归（独立 vs 宿主）就是靠这两种 apiBase 都能拼出同一条 API_PREFIX。 */
const guard = apiBaseGuard('')
if (!guard.ok) {
  console.error(`apiBase 契约不通过：${guard.message}`)
  process.exit(1)
}

const workbench = await Workbench.open(workspace)
const { url } = await startWorkbenchServer({ port, workbench, workspace })

console.log(`小管宝 DuctPal 开发版已启动：${url}`)
console.log(`  资料库：${workspace ? workspace + '/xyb-pbc.sqlite' : '内存库 + 演示数据（不写盘）'}`)
console.log(`  数据来源：${workbench.isDemo ? '演示' : '你的资料库'}`)
console.log('  Ctrl+C 结束。')

async function shutdown() {
  try { workbench.close() } catch { /* 关库失败不该掩盖退出 */ }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
