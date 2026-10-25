import Schema from '@deepseek-ai/schemastery'
import { readFileSync } from 'node:fs'

export const name = 'pbc-workbench-main'
export const inject = ['webServer', 'connection']
// root 由 cordis.patch.yml 的 config.root: !!js dshHomePath('pbc') 注入（用户资料目录）。
// 声明了它，scripts/check-workbench-package.mjs 的 ⑤ 才会反过来要求 patch 必须有注入；
// 两边必须同时存在，否则装机后每次重启都退回内存库（ATTR 0.2.1 回收）。
export const Config = Schema.object({
  root: Schema.string().description('用户资料目录（由宿主 dshHomePath 注入）'),
})
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export function apply(ctx) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/api/pbc-workbench/health',
    handler(req, res) {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      if (typeof ctx.connection?.requestRejection !== 'function') return send(503, { error: 'connection authentication capability unavailable' })
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) return send(rejection, { error: 'Authentication required' })
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed' })
      send(200, {
        ok: true,
        version: manifest.version,
        apiVersion: 'v1',
        capabilities: ['health'],
        // 只回布尔，不回路径：健康检查不进日志、不进截图
        dataDirConfigured: Boolean(ctx.config?.root),
      })
    },
  }), 'pbc-workbench health')
}
