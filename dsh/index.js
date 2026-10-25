/* 小管宝 DuctPal —— DSH Desktop 宿主插件入口。
 *
 * 四件事，按顺序：
 *   1. 打开数据源（`config.root` 有值→用户资料库；没值→内存库 + 演示数据，只读演示）
 *   2. 过宿主鉴权（`ctx.connection.requestRejection`，**不自己造一套登录**）
 *   3. 把请求交给 `dsh/routes.js` 的 createApiHandler
 *      —— 独立启动（scripts/dev-server.mjs）与宿主用**同一份**路由表：
 *         本地能开的路径，装进 Desktop 也一定在。曾经两边各写一套，
 *         结果是本地打开正常、装机后 404，而且报错看起来像"插件没加载"。
 *   4. `ctx.effect` 的 dispose 里按顺序关库
 */
import Schema from '@deepseek-ai/schemastery'
import { Workbench } from './workbench.js'
import { API_PREFIX, createApiHandler } from './routes.js'
import { servePublic } from './server.js'
import { createAuthorized } from './auth.js'
import { build as buildDate, version as pkgVersion } from '../lib/version.js'

export const name = 'pbc-workbench-main'
export const inject = ['webServer', 'connection']
// root 由 cordis.patch.yml 的 config.root: !!js dshHomePath('pbc') 注入（用户资料目录）。
// 声明了它，scripts/check-workbench-package.mjs 的 ⑤ 才会反过来要求 patch 必须有注入；
// 两边必须同时存在，否则装机后每次重启都退回内存库。
export const Config = Schema.object({
  root: Schema.string().description('用户资料目录（由宿主 dshHomePath 注入）'),
})

/* 版本号只认 lib/version.js（由 build-version.mjs 从 VERSION 生成）：
   以前这里读 package.json，结果 health 的 build 永远是 null（package.json 没有 build 字段），
   而"版本对了、构建日期空白"这种半对状态最难查。 */


/** 打开数据源。root 缺失不是错误——它是"还没选资料目录"的正常状态，退回只读演示。 */
async function openDataSource(root) {
  return root ? Workbench.open(root) : Workbench.open(null)
}

export function apply(ctx) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')

  /* 异步打开：宿主不等我们，所以先把 handler 挂上，打不开就在 /health 里说原因，
     其余接口统一 503 —— 不假装返回空数据，否则用户看到空档案会以为"数据丢了"。 */
  let source = null
  let failure = null
  const ready = openDataSource(ctx.config?.root)
    .then((wb) => { source = wb })
    .catch((error) => {
      failure = `资料库打不开：${error?.message ?? error}`
      ctx.logger?.warn?.(failure)
    })

  const api = createApiHandler({
    /* 传一个**稳定的代理对象**，不传 getter：路由表在 health 里直接读 source.isDemo()，
       若这里抛错就会把 /health 也带崩——而 /health 恰恰是用来报告"为什么打不开"的。 */
    source: {
      get db() { return requireSource().db },
      bootstrap: () => requireSource().bootstrap(),
      profile: (key, opts) => requireSource().getProfile(key, opts),
      saveExport: (key) => requireSource().saveExport(key),
      isDemo: () => (source ? source.isDemo : null),
    },
    version: pkgVersion,
    /* build 取 lib/version.js（由 scripts/build-version.mjs 从 VERSION + git 生成），
       不从 package.json 取 ——那里没有 build 字段，取出来永远是 null，
       界面上"构建日期"就一栏空白，而空白看起来像"没构建成功"。 */
    build: buildDate ?? null,
    serveUi: (req, res, urlPath) => void servePublic(req, res, urlPath),
    get failure() { return failure },
    /* 只回布尔，不回路径：路径会出现在 HTTP 响应里，谁抓到响应就知道你把资料放哪了。 */
    dataDirConfigured: Boolean(ctx.config?.root),
  })

  /* 资料库是异步就绪的。每个请求现取，避免"启动时的 null 被闭包钉死"；
     还没就绪就抛带 code 的错，由 routes.js 的 errorBody 映射成状态码。 */
  function requireSource() {
    if (!source) {
      throw Object.assign(
        new Error(failure ?? '资料库还在打开中，请稍后重试'),
        { code: 'BOOTSTRAP_UNAVAILABLE' },
      )
    }
    return source
  }

  /* 鉴权逻辑抽到 dsh/auth.js：它只在宿主语境下走到，dev-server 根本不经过，
     放在这里就没法单测（本文件顶部 import 了 Schemastery，单测环境没有那份 peer）。
     两个真实缺陷的角色分工见那个文件的头注释。 */
  const authorized = createAuthorized({ api, connection: ctx.connection })

  /* 前缀注册：/api/pbc-workbench 下所有路径（含 /ui 静态）都走同一入口。
     用 register 返回的 dispose 交给 ctx.effect，不要自己数着关。 */
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: authorized,
  }), 'pbc-workbench api')

  ctx.effect(() => {
    void ready
    return () => {
      /* 关库失败不该阻断卸载流程：宿主此刻可能已经在关了，抛出去会盖掉真正的原因。 */
      try { source?.close?.() } catch { /* 见上 */ }
      source = null
    }
  })
}
