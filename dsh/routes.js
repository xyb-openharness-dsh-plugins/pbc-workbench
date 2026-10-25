/* 路由表：独立启动（dev-server）与 DSH 宿主两条链路共用这一份。
 *
 * 为什么要抽出来：不抽的话 `/api/pbc-workbench/bootstrap` 会有两个实现，
 * 本地能开、装进 Desktop 就 404（家族里踩过两轮）。
 * 这里只依赖 node 内置模块，**不许 import Schemastery** —— 独立启动时那个 peer 依赖并不存在。
 *
 * 鉴权不在这里：宿主链路由 dsh/index.js 先过 `connection.requestRejection`；
 * 独立启动本来就只有本机回环访问，不需要登录态。
 *
 * ---- apiBase 定稿契约（DEV-REQUIREMENTS §3.3 第 14 条，原文抄录）----
 * `API_BASE = 挂载前缀（独立启动空串，宿主 /api/<slug>）`，页面统一拼 `${API_BASE}/api/xxx`；
 * 守卫**只禁交界重复**（`/(^|/)api$/`），**不许 `includes('/api')` 一刀切** ——
 * 宿主前缀本来就含 `/api`，一刀切会把正确配置判成错的。
 * 契约实现在 `lib/api-base.js`，本文件只导出前缀常量，不改它。
 */

import { apiBaseGuard } from '../lib/api-base.js'

export const API_PREFIX = '/api/pbc-workbench'
export const UI_PREFIX = `${API_PREFIX}/ui`

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  })
  res.end(buf)
}

function sendMarkdown(res, status, text, headers = {}) {
  const buf = Buffer.from(text, 'utf8')
  res.writeHead(status, {
    'content-type': 'text/markdown; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(buf)
}

/**
 * 错误 → {status, body}。带 `^[A-Z_]+$` code 的错误透传成可区分的状态码，
 * 不让界面只能看到一句 500。**不把堆栈或 token 带出去。**
 */
export function errorBody(error) {
  const code = error?.code
  if (code && typeof code === 'string' && /^[A-Z_]+$/.test(code)) {
    const status = {
      NO_TOKEN: 503,
      UNAUTHORIZED: 503,
      EXPORT_SAVE_UNAVAILABLE: 501,
      PROFILE_NOT_FOUND: 404,
      WORKSPACE_PATH_INVALID: 400,
      /* 患者填错了字段（0–10 写 11、日期写了 2 月 30 日）→ 400，不是服务端错误 */
      VALIDATION_FAILED: 400,
      EMPTY_DB_PATH: 500,
    }[code] ?? 502
    return { status, body: { error: code, message: error.message } }
  }
  if (error?.status === 413) return { status: 413, body: { error: 'too_large', message: error.message } }
  return { status: 500, body: { error: 'internal_error', message: error.message } }
}

function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        const error = new Error('文件超过 30 MB')
        error.status = 413
        reject(error)
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * @param {object} opts
 * @param {{db:object, bootstrap():object, profile(key:string, opts?:object):object|null,
 *          saveExport?:(key:string)=>object, isDemo?:()=>boolean}} opts.source
 * @param {string} opts.version
 * @param {string} opts.build
 * @param {(req:object,res:object,path:string)=>boolean} opts.serveUi 静态文件出口（两条链路的 public/ 定位不同）
 * @param {string|null} [opts.failure] 数据源打不开的原因；非空时除 /health 外一律 503
 * @param {string} [opts.apiBase] 前端挂载前缀（宿主传入），仅用于 health 回报，供双形态回归核对
 * @param {boolean|null} [opts.dataDirConfigured] 资料目录是否已由宿主注入（`config.root`）。
 *        只回布尔、不回路径：路径会出现在 HTTP 响应里，谁抓到响应就知道你把资料放哪了。
 */
export function createApiHandler({ source, version, build, serveUi, failure = null, apiBase = '', dataDirConfigured = null }) {
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1')
    const path = url.pathname

    if (path === `${API_PREFIX}/health`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      return sendJson(res, 200, {
        ok: !failure,
        version,
        build,
        apiVersion: 'v1',
        ui: UI_PREFIX,
        /* 双形态回归靠这两个字段：独立启动 apiBase=''，宿主 apiBase='/api/<slug>'。
           两者都能拼出同一条 API_PREFIX —— 检查器直接比。 */
        apiBase,
        apiPrefix: API_PREFIX,
        demo: typeof source.isDemo === 'function' ? source.isDemo() : null,
        /* 前端据此区分"演示库"和"记进你自己的库"。只给结论，不给路径。 */
        dataDirConfigured: dataDirConfigured === null ? null : Boolean(dataDirConfigured),
        capabilities: ['bootstrap', 'profile', 'export', 'symptoms', 'screening', 'trials', 'mineru-settings'],
        error: failure || undefined,
      })
    }

    /* 数据源打不开：/health 已经报了原因，其它接口统一 503，不假装返回空数据。 */
    const unavailable = () => sendJson(res, 503, { error: 'bootstrap_unavailable', message: failure })
    if (failure && path !== `${API_PREFIX}/health` && !(path === UI_PREFIX || path.startsWith(`${UI_PREFIX}/`))) {
      return unavailable()
    }

    if (path === `${API_PREFIX}/bootstrap`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      try {
        return sendJson(res, 200, source.bootstrap())
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 私密分节默认不给：只有显式 ?private=1 才返回原文。 */
    const profileMatch = path.match(new RegExp(`^${API_PREFIX}/profile/([^/]+)$`))
    if (profileMatch) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      const key = decodeURIComponent(profileMatch[1])
      try {
        const profile = source.profile(key, { includePrivate: url.searchParams.get('private') === '1' })
        if (!profile) return sendJson(res, 404, { error: 'profile_not_found', key })
        return sendJson(res, 200, { profile })
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 复诊准备 markdown：**导出侧强制剔除私密**，即便调用方传了 private=1 也不带出去。 */
    const exportMatch = path.match(new RegExp(`^${API_PREFIX}/export/([^/]+)\\.md$`))
    if (exportMatch) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      const key = decodeURIComponent(exportMatch[1])
      try {
        const full = source.profile(key, { includePrivate: true })
        if (!full) return sendJson(res, 404, { error: 'profile_not_found', key })
        const { renderPrepMarkdown, exportFilename } = await import('./export.js')
        /* 私密过滤在 renderPrepMarkdown 内部完成（不靠这里传参，也不靠 includePrivate）。
           这里取全量是为了让渲染器**自己**发现"有私密内容被排除"并写下排除声明——
           传 false 会让排除声明也一起消失，用户会以为数据丢了。 */
        const md = renderPrepMarkdown(full, { version })
        return sendMarkdown(res, 200, md, {
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exportFilename(full))}`,
        })
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 把导出写进资料目录（exports/）。演示模式（内存库）不支持，回 501 而不是假装成功。 */
    const saveMatch = path.match(new RegExp(`^${API_PREFIX}/export/([^/]+)\\.md/save$`))
    if (saveMatch) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      if (typeof source.saveExport !== 'function') return sendJson(res, 501, { error: 'export_save_unavailable' })
      try {
        return sendJson(res, 200, await source.saveExport(decodeURIComponent(saveMatch[1])))
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 记一条痒/累 —— 闭环的"记录"半环。
       第一版没有这条路由：前端"保存"只写内存 + 一个 toast 说"不落库"，
       患者记完刷新即丢。日期必须由调用方显式给（不默认"今天"：客户端时钟可能是错的，
       而这条记录要和化验单并排给医生看）。 */
    if (path === `${API_PREFIX}/symptoms`) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      if (typeof source.addSymptom !== 'function') return sendJson(res, 501, { error: 'symptom_write_unavailable' })
      let body = {}
      try {
        const raw = await readBody(req, 64 * 1024)
        body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      } catch {
        return sendJson(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' })
      }
      try {
        const saved = source.addSymptom(body)
        return sendJson(res, 201, { ok: true, saved })
      } catch (error) {
        const { status, body: err } = errorBody(error)
        /* 校验失败要把字段名带回去，前端才能把错误挂到那个控件上，而不是弹个笼统的 toast */
        return sendJson(res, status, error.field ? { ...err, field: error.field } : err)
      }
    }

    /* 删掉刚记错的那一条（更正语义：不是"删除数据"，是"这条记错了"）。 */
    const symptomDelete = path.match(new RegExp(`^${API_PREFIX}/symptoms/(\\d+)$`))
    if (symptomDelete) {
      if (req.method !== 'DELETE') return sendJson(res, 405, { error: 'method_not_allowed' })
      if (typeof source.removeSymptom !== 'function') return sendJson(res, 501, { error: 'symptom_write_unavailable' })
      try {
        const removed = source.removeSymptom(Number(symptomDelete[1]))
        if (!removed) return sendJson(res, 404, { error: 'symptom_not_found' })
        return sendJson(res, 200, { ok: true })
      } catch (error) {
        const { status, body: err } = errorBody(error)
        return sendJson(res, status, err)
      }
    }

    /* 临床试验分层匹配（35 号）：建档 + 本地快照 → 分层线索。
       注意这里**不出数值分**，也不写"适合/不适合"——见 dsh/match.js 头注释。 */
    const matchPath = path.match(new RegExp(`^${API_PREFIX}/trials/match/([^/]+)$`))
    if (matchPath) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      if (typeof source.matchTrials !== 'function') return sendJson(res, 501, { error: 'trial_match_unavailable' })
      try {
        return sendJson(res, 200, source.matchTrials(decodeURIComponent(matchPath[1])))
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 记一条筛查结果（骨密度/甲状腺/胃镜/维生素/肝影像）。
       result 存**报告原文**，不解析、不推断该不该查——这是本仓的医学边界。 */
    if (path === `${API_PREFIX}/screening`) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      if (typeof source.addScreening !== 'function') return sendJson(res, 501, { error: 'screening_write_unavailable' })
      let body = {}
      try {
        const raw = await readBody(req, 64 * 1024)
        body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      } catch {
        return sendJson(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' })
      }
      try {
        return sendJson(res, 201, { ok: true, saved: source.addScreening(body) })
      } catch (error) {
        const { status, body: err } = errorBody(error)
        return sendJson(res, status, error.field ? { ...err, field: error.field } : err)
      }
    }

    /* MinerU 设置：只回掩码与来源，**原文永不出现在响应里**。 */
    if (path === `${API_PREFIX}/settings/mineru`) {
      const settings = await import('./settings.js')
      if (req.method === 'GET') {
        try {
          return sendJson(res, 200, settings.mineruSettingsStatus())
        } catch (error) {
          return sendJson(res, 500, { error: 'settings_unavailable', message: error.message })
        }
      }
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      let body = {}
      try {
        const raw = await readBody(req, 64 * 1024)
        body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      } catch {
        return sendJson(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' })
      }
      try {
        const status = body?.action === 'clear'
          ? settings.clearMineruToken()
          : settings.saveMineruToken(body?.token)
        return sendJson(res, 200, status)
      } catch (error) {
        /* 校验失败是用户输入问题（400）；文件坏、写不进去是环境问题（500） */
        const status = /请先填写|太短|过长|不能有空格|意外字符|不合法 JSON/.test(error.message) ? 400 : 500
        return sendJson(res, status, {
          error: status === 400 ? 'invalid_token' : 'settings_write_failed',
          message: error.message,
        })
      }
    }

    if (path === UI_PREFIX || path.startsWith(`${UI_PREFIX}/`)) {
      return void serveUi(req, res, path.slice(UI_PREFIX.length) || '/')
    }
    return sendJson(res, 404, { error: 'not_found', path })
  }
}

/** 仅供检查器与测试复用：判定一个挂载前缀是否可用。 */
export { apiBaseGuard }
