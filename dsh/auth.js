/* 宿主鉴权闸：把 `connection.requestRejection` 的结果翻译成"放行 / 401 / 503"。
 *
 * 单独一个文件的原因：这段逻辑**只在宿主语境**下走到（dev-server 直接调 createApiHandler，
 * 根本不经过这里），而 `dsh/index.js` 顶部 import 了 Schemastery —— 单测里没有那份 peer 依赖，
 * 想测这段就得先把它拆出来。拆出来顺带把口径写死在一处：
 *
 *   ① **宿主没给鉴权能力 → 503**，不放行。少给一个能力就把本机资料裸奔，是更坏的选择。
 *   ② 宿主"不拒绝"时 `undefined` 与 `null` 都可能出现，判定必须用**真值**。
 *      本机 2026-10-25 装机副本实测：用 `!== undefined` 判时，`null` 被当状态码写进
 *      `writeHead(null)`，进程抛 `ERR_HTTP_INVALID_STATUS_CODE` 整条服务链熄火。
 *   ③ 拒绝时照宿主给的状态码回，并明确告诉用户"要登录 DSH"——不自己造登录态。
 */
/* 这些错误码供调用方分支；宿主日志里出现时能直接认出是哪一档。 */
export const AUTH_UNAVAILABLE = 'AUTH_UNAVAILABLE'
export const AUTH_REQUIRED = 'AUTH_REQUIRED'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

/**
 * 造一个 request handler：先过宿主鉴权，再交给业务 handler。
 *
 * @param {object} options
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => any} options.api 业务 handler（routes.js 的）
 * @param {object|undefined} options.connection 宿主的 connection 服务（可能不存在）
 * @returns {(req: any, res: any) => any}
 */
export function createAuthorized({ api, connection }) {
  if (typeof api !== 'function') throw new TypeError('createAuthorized: api 必须是函数')

  return function authorized(req, res) {
    if (typeof connection?.requestRejection !== 'function') {
      res.writeHead(503, JSON_HEADERS)
      res.end(JSON.stringify({
        error: AUTH_UNAVAILABLE,
        message: '宿主未提供鉴权能力，本机资料暂不可访问（这不是你的操作问题，重启 Harness 后仍如此请反馈）',
      }))
      return
    }
    const rejection = connection.requestRejection(req)
    /* 真值判：0 / '' / null / undefined 一律当"不拒绝"（宿主只在拒绝时给状态码）。 */
    if (rejection) {
      res.writeHead(rejection, JSON_HEADERS)
      res.end(JSON.stringify({ error: AUTH_REQUIRED, message: '需要登录 DSH 才能访问本机资料' }))
      return
    }
    return api(req, res)
  }
}
