/**
 * MinerU 云端解析客户端（M5 接入层，六部件第 1 件）。
 *
 * 协议来源：https://mineru.net/doc/docs （API v4）。本文件只封装**四个动作**：
 *   ① `POST /file-urls/batch` 申请上传链接 → ② `PUT` 上传原件 → ③ 轮询 `GET /extract-results/batch/{id}`
 *   → ④ 下载 `full_zip_url` 并取出 `full.md` 与 `*_content_list.json`。
 *
 * 三条边界（本仓口径）：
 * 1. **Token 只从本地私密文件或环境变量来**，不写进仓库、不进日志、不进错误消息
 *    （错误里只给来源与掩码）。PBC 化验单里含有生日、住院号，原件本身也是隐私。
 * 2. **不猜解析结果**：拿不到 `full.md` 就是失败，不返回半份数据当成功。
 * 3. **解析失败不产生候选**——调用方（ImportService）拿到异常后把 document 置为 failed，
 *    原件留着可重试。
 *
 * **上传前必须让用户知情**：原件会离开本机到 mineru.net。界面在点「解析」前明确提示，
 * 用户不点就不上传（这条在 docs/SPEC.md 与 README 的隐私段落里都写了，别改成自动上传）。
 */
import { readZip } from '../lib/zip.js'
import { MINERU_TOKEN_URL, maskToken, readMineruToken, secretFile as currentSecretFile } from './settings.js'

export const MINERU_BASE_URL = 'https://mineru.net/api/v4'
/**
 * 解析模型：显式写死 `pipeline`，不吃服务端默认值——否则换个账号或上游改默认，
 * 表格还原的口径就会漂。压平表格要更稳时可以显式传 `modelVersion: 'vlm'`。
 */
export const MINERU_MODEL_DEFAULT = 'pipeline'

export { maskToken }

export class MineruError extends Error {
  constructor(code, message, detail = null) {
    super(message)
    this.name = 'MineruError'
    this.code = code
    this.detail = detail
  }
}

/**
 * Token 解析优先级：显式传入 > 密钥文件 > 环境变量。
 * 文件优先、env 次之：设置页里保存的 Token 永远生效，env 只在文件缺失时兜底。
 * 反过来（env 优先）会让一条遗留的过期 env 长期盖住新存的 Token，表现为
 * "换了 Token 还是 401"，极难自查。
 * 三处都没有就报 `NO_TOKEN`，**不静默用匿名请求**（那只会得到一个看不懂的 401）。
 */
export function resolveToken({ token = null, env = process.env, secretFile = currentSecretFile({ env }) } = {}) {
  if (token?.trim()) return { token: token.trim(), source: 'explicit' }
  let fileToken = ''
  try {
    fileToken = readMineruToken({ file: secretFile })
  } catch (error) {
    // 文件坏了要单独说清（读不出 ≠ 没配），否则用户会在设置页反复保存却始终失败
    throw new MineruError('BAD_SECRET_FILE', error.message)
  }
  if (fileToken) return { token: fileToken, source: 'secret-file' }
  if (env?.MINERU_TOKEN?.trim()) return { token: env.MINERU_TOKEN.trim(), source: 'env:MINERU_TOKEN' }
  throw new MineruError(
    'NO_TOKEN',
    `没有 MinerU Token：在工作台「设置 → 文档解析」里填入，或设置环境变量 MINERU_TOKEN。申请地址：${MINERU_TOKEN_URL}`,
  )
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class MineruClient {
  /**
   * @param {object} opts
   * @param {string} [opts.token] 不给就按 resolveToken 的顺序找
   * @param {string} [opts.baseUrl]
   * @param {Function} [opts.fetchImpl] 注入用（单测不联网）
   * @param {number} [opts.requestTimeoutMs] 单次请求超时
   */
  constructor({
    token = null, baseUrl = MINERU_BASE_URL, fetchImpl = null,
    requestTimeoutMs = 60000, env = process.env, secretFile = currentSecretFile({ env }),
  } = {}) {
    const resolved = resolveToken({ token, env, secretFile })
    this.token = resolved.token
    this.tokenSource = resolved.source
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl ?? globalThis.fetch
    this.requestTimeoutMs = requestTimeoutMs
  }

  get maskedToken() {
    return maskToken(this.token)
  }

  async #request(method, path, { body = null, raw = false } = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
    const headers = { Authorization: `Bearer ${this.token}`, Accept: '*/*' }
    if (body !== null && !raw) headers['Content-Type'] = 'application/json'

    const signal = AbortSignal.timeout(this.requestTimeoutMs)
    let response
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: raw ? body : body === null ? undefined : JSON.stringify(body),
        signal,
      })
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new MineruError('TIMEOUT', `MinerU 请求超时（${method} ${url}）`, { url })
      }
      throw new MineruError('NETWORK', `请求 MinerU 失败：${error.message}`, { url })
    }

    if (response.status === 401 || response.status === 403) {
      /* 401 不重试：Token 不对就是不对，重试只会把同一把错 key 再发十遍。 */
      throw new MineruError(
        'UNAUTHORIZED',
        `MinerU 拒绝了这个 Token（HTTP ${response.status}，来源 ${this.tokenSource}，key=${this.maskedToken}）`,
        { status: response.status },
      )
    }

    if (raw) {
      if (!response.ok) throw new MineruError('UPLOAD_FAILED', `上传文件失败：HTTP ${response.status}`)
      return null
    }

    let json = null
    try {
      json = await response.json()
    } catch {
      throw new MineruError('BAD_RESPONSE', `MinerU 返回的不是 JSON（HTTP ${response.status}）`, { url })
    }
    if (json?.code !== 0) {
      const message = String(json?.msg ?? '未知错误')
      const code = /token|auth|权限|登录/i.test(message) ? 'UNAUTHORIZED' : 'API_ERROR'
      throw new MineruError(code, `MinerU 接口报错（code=${json?.code}）：${message}`, {
        apiCode: json?.code, traceId: json?.trace_id,
      })
    }
    return json
  }

  /** ① 申请上传链接。返回 batchId 与一一对应的 PUT 地址。 */
  async createUploadBatch({ files, enableFormula = true, enableTable = true, language = 'ch', modelVersion = null, pageRanges = null }) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new MineruError('BAD_INPUT', 'createUploadBatch 需要至少一个文件')
    }
    const body = {
      enable_formula: enableFormula,
      enable_table: enableTable,
      language,
      files: files.map((f) => ({ name: f.name, ...(f.dataId ? { data_id: f.dataId } : {}) })),
    }
    if (modelVersion) body.model_version = modelVersion
    if (pageRanges) body.page_ranges = pageRanges

    const json = await this.#request('POST', '/file-urls/batch', { body })
    const batchId = json?.data?.batch_id
    const urls = json?.data?.file_urls
    if (!batchId || !Array.isArray(urls) || urls.length !== files.length) {
      throw new MineruError('BAD_RESPONSE', '申请上传链接的返回不完整（缺 batch_id 或 file_urls 数量对不上）', {
        got: json?.data,
      })
    }
    return { batchId, uploadUrls: urls }
  }

  /**
   * ② 上传原件。MinerU 要求**不设 Content-Type**（设了会被当成表单解析而失败），
   * 所以这里走 raw 分支，headers 里只有 Authorization 与 Accept。
   */
  async uploadFile(uploadUrl, bytes) {
    await this.#request('PUT', uploadUrl, { body: bytes, raw: true })
    return { ok: true }
  }

  /** ③ 查一次批次结果。 */
  async getBatchResult(batchId) {
    const json = await this.#request('GET', `/extract-results/batch/${batchId}`)
    const results = json?.data?.extract_result
    if (!Array.isArray(results)) {
      throw new MineruError('BAD_RESPONSE', '批次结果里没有 extract_result 数组', { got: json?.data })
    }
    return results.map((r) => ({
      fileName: r.file_name ?? null,
      state: r.state ?? null,
      zipUrl: r.full_zip_url ?? null,
      errMsg: r.err_msg ?? null,
      dataId: r.data_id ?? null,
      progress: r.extract_progress ?? null,
    }))
  }

  /** ③ 轮询到全部结束（done / failed）或超时。 */
  async waitForBatch(batchId, { intervalMs = 3000, timeoutMs = 300000, onProgress = null } = {}) {
    const startedAt = Date.now()
    for (;;) {
      const results = await this.getBatchResult(batchId)
      if (onProgress) onProgress(results)
      const pending = results.filter((r) => r.state !== 'done' && r.state !== 'failed')
      if (pending.length === 0) return results
      if (Date.now() - startedAt > timeoutMs) {
        throw new MineruError(
          'TIMEOUT',
          `等了 ${Math.round(timeoutMs / 1000)} 秒还没解析完（batch=${batchId}，仍在 ${[...new Set(pending.map((p) => p.state))].join('/')}）`,
          { batchId, results },
        )
      }
      await sleep(intervalMs)
    }
  }

  /** ④ 下载结果压缩包（不落盘，直接读内存）。 */
  async downloadZip(zipUrl) {
    let response
    try {
      response = await this.fetchImpl(zipUrl, { signal: AbortSignal.timeout(this.requestTimeoutMs) })
    } catch (error) {
      throw new MineruError('NETWORK', `下载解析结果失败：${error.message}`, { zipUrl })
    }
    if (!response.ok) throw new MineruError('DOWNLOAD_FAILED', `下载解析结果失败：HTTP ${response.status}`, { zipUrl })
    return Buffer.from(await response.arrayBuffer())
  }

  /**
   * 完整跑一遍：申请 → 上传 → 轮询 → 下载 → 取出 markdown 与 content_list。
   * 任一环节失败都抛异常，**不返回半份结果**。
   */
  async parse({
    bytes, filename, dataId = null, intervalMs = 3000, timeoutMs = 300000,
    enableFormula = true, enableTable = true, language = 'ch', modelVersion = MINERU_MODEL_DEFAULT, pageRanges = null,
  }) {
    if (!bytes || bytes.length === 0) throw new MineruError('BAD_INPUT', '文件内容为空，不提交解析')
    if (!filename?.trim()) throw new MineruError('BAD_INPUT', '缺少文件名（MinerU 按扩展名判类型）')

    const { batchId, uploadUrls } = await this.createUploadBatch({
      files: [{ name: filename.trim(), dataId }],
      enableFormula, enableTable, language, modelVersion, pageRanges,
    })
    await this.uploadFile(uploadUrls[0], bytes)
    const results = await this.waitForBatch(batchId, { intervalMs, timeoutMs })
    const first = results[0]

    if (first.state !== 'done') {
      throw new MineruError('TASK_FAILED', `MinerU 解析失败：${first.errMsg || first.state}`, { batchId, result: first })
    }
    if (!first.zipUrl) throw new MineruError('BAD_RESPONSE', '解析完成但没有返回 full_zip_url', { batchId, result: first })

    const zipBuffer = await this.downloadZip(first.zipUrl)
    let zip
    try {
      zip = readZip(zipBuffer)
    } catch (error) {
      throw new MineruError('BAD_ZIP', `解析结果不是可读的 ZIP：${error.message}`, { batchId })
    }
    if (!zip.has('full.md')) {
      throw new MineruError('NO_MARKDOWN', `解析结果里没有 full.md（实际条目：${zip.names.slice(0, 8).join(', ')}）`, {
        names: zip.names,
      })
    }

    const markdown = zip.text('full.md')
    const contentListName = zip.names.find((n) => n.endsWith('_content_list.json')) ?? null
    let contentList = null
    if (contentListName) {
      try {
        contentList = JSON.parse(zip.text(contentListName))
      } catch (error) {
        throw new MineruError('BAD_CONTENT_LIST', `content_list 不是合法 JSON：${error.message}`, { contentListName })
      }
    }

    /* 批次接口在 done 后不再返回 extract_progress，页数改从 content_list 的 page_idx 上限推；
       两处都没有就留 null（不拿文件大小之类的猜一个）。 */
    const pagesFromList = Array.isArray(contentList) && contentList.length
      ? Math.max(...contentList.map((item) => (Number.isInteger(item?.page_idx) ? item.page_idx + 1 : 0)))
      : null
    return {
      batchId,
      zipUrl: first.zipUrl,
      markdown,
      contentList,
      pages: first.progress?.total_pages ?? pagesFromList ?? null,
      names: zip.names,
    }
  }
}

export function createMineruClient(options = {}) {
  return new MineruClient(options)
}
