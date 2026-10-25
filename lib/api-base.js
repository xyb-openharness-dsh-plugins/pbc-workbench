/**
 * apiBase 定稿契约（DEV-REQUIREMENTS §3.3 第 14 条）。
 *
 * 一句话：**页面拿到的 API_BASE 是"挂载前缀"，接口路径一律在它后面再接 `/api/...`。**
 *
 *   API_BASE = ''            → 独立启动（dev-server）
 *   API_BASE = '/api/pbc'    → 宿主把插件挂在某个前缀下
 *   页面统一拼 `${API_BASE}/api/pbc-workbench/bootstrap`
 *
 * 为什么必须有守卫：GBM 那轮踩了 4 次，每次都是同一件事——
 * 有人用 `includes('/api')` 判"前缀已经带 /api 了，别重复"，结果宿主前缀
 * `/api/pbc` 本身就含 `/api`，于是页面拼出 `/api/pbc-workbench/...`（丢了挂载前缀）
 * 或 `/api/pbc/api/pbc-workbench/...`（重复了一段）。两种都在本地看不出来，
 * 装进 Desktop 才 404。
 *
 * 所以守卫**只禁交界重复**：前缀末尾恰好是 `api` 那一段（`/(^|\/)api$/`）。
 * 别的一律放行——`/api/pbc`、`/mount/api/v2`、`''` 都是合法的。
 *
 * 三种失败都要能看见（启动期渲染错误横幅，**禁止裸 throw 白屏**）：
 *   - 前缀不是以 `/` 开的字符串 → INVALID_BASE_SHAPE
 *   - 前缀以 `/` 结尾 → INVALID_BASE_TRAILING_SLASH（拼出来会有 `//`）
 *   - 前缀末尾是 `api` 整段 → INVALID_BASE_API_BOUNDARY（拼出来会 `/api/api/`）
 */

/** 交界的唯一定义：结尾那一整段恰好是 `api`。`/api`、`/mount/api` 命中；`/api/pbc` 不命中。 */
export const API_BOUNDARY_RE = /(^|\/)api$/

/**
 * 校验挂载前缀。合法返回 `{ok:true, base}`，不合法返回 `{ok:false, code, message}`。
 * **不抛异常**：调用方（客户端启动期）需要拿到结果去渲染横幅，而不是让整个面板白屏。
 */
export function apiBaseGuard(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'INVALID_BASE_SHAPE', message: `挂载前缀必须是字符串，收到 ${typeof raw}` }
  }
  const base = raw.trim()
  if (base === '') return { ok: true, base }
  if (!base.startsWith('/')) {
    return { ok: false, code: 'INVALID_BASE_SHAPE', message: `挂载前缀必须以 / 开头：${base}` }
  }
  if (base.endsWith('/')) {
    return { ok: false, code: 'INVALID_BASE_TRAILING_SLASH', message: `挂载前缀不能以 / 结尾（拼接口路径会出现 //）：${base}` }
  }
  if (API_BOUNDARY_RE.test(base)) {
    return {
      ok: false,
      code: 'INVALID_BASE_API_BOUNDARY',
      message: `挂载前缀不能以 api 结尾（会成为 /api/api/... 的交界重复）：${base}`,
    }
  }
  return { ok: true, base }
}

/** 拼接口路径。`apiBaseGuard` 不通过时**仍拼出可用路径**（去掉重复段），并让调用方去显示横幅。 */
export function apiUrl(base, path) {
  const clean = path.startsWith('/') ? path : `/${path}`
  const trimmed = typeof base === 'string' ? base.replace(/\/+$/, '') : ''
  /* 交界重复：把前缀末尾的 api 段去掉，剩下的仍能拼出正确路径 */
  const safe = API_BOUNDARY_RE.test(trimmed) ? trimmed.replace(/\/api$/, '') : trimmed
  return `${safe}${clean}`
}

/** 双形态回归用：同一份 UI 在两种前缀下必须拼出同一个最终路径（去掉前缀后的部分逐字符相等）。 */
export function stripBase(url, base) {
  const trimmed = typeof base === 'string' ? base.replace(/\/+$/, '') : ''
  if (!trimmed) return url
  return url.startsWith(trimmed) ? url.slice(trimmed.length) : url
}
