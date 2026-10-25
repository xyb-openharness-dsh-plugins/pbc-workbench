/**
 * 文档解析设置：MinerU Token 的读取、保存与状态（设置页「文档解析」用它）。
 *
 * 为什么单独一层：Token 有三个使用者——导入服务要读、路由要给状态、设置页要写。
 * 三处各写一遍 JSON 解析就会出现"界面说已保存、解析却读不到"这种很难查的分叉。
 * 这里只有一份实现，`dsh/mineru.js` 也 import 它。
 *
 * 文件位置（判定顺序固定，改它就是改产品行为）：
 * 1. `DUCTPAL_MINERU_SECRET` 环境变量（测试与排障用，直接指定文件）；
 * 2. 仓库内 `.secrets/mineru.json`（**已存在就沿用**——开发时的既有约定）；
 * 3. 用户目录 `~/.ductpal/secrets/mineru.json`（装机后的落点）。
 *
 * 为什么不是永远写包内 `.secrets/mineru.json`：装进 Desktop 后包位于
 * `.../node_modules/@ductpal-dsh/pbc-workbench/`，**升级插件会整目录替换**，
 * 用户刚填的 Token 会静默消失；而且用户在设置页填的东西本来就不该落在依赖目录里。
 * 所以"已有包内文件"只是尊重既有约定，没有就写用户目录。
 *
 * 三条硬边界：
 * 1. **原文永不回给界面**：状态里只有掩码与路径，接口不返回 token；
 * 2. **权限 600、目录 700**：Token 是凭据；
 * 3. **文件坏了不覆盖**：解析不了就报错并给出路径，让用户自己处理，不静默清空。
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 申请 / 重置 Token 页。同一地址也用于前端识别"这是一类 Token 问题"。 */
export const MINERU_TOKEN_URL = 'https://mineru.net/apiManage/token'
/** 显式指定密钥文件的环境变量（测试与排障）。 */
export const MINERU_SECRET_ENV = 'DUCTPAL_MINERU_SECRET'
/** 仓库内既有位置。 */
export const PACKAGE_SECRET_FILE = fileURLToPath(new URL('../.secrets/mineru.json', import.meta.url))
/** 用户目录名（与安装目录 `.ductpal` 同源，见 lib/identity.js）。 */
export const HOME_DIR_NAME = '.ductpal'

/** 装机后实际使用的文件：用户目录，不随插件升级被删除。 */
export function userSecretFile(home = homedir()) {
  return join(home, HOME_DIR_NAME, 'secrets', 'mineru.json')
}

/** 当前生效的密钥文件：env > 已存在的包内文件 > 用户目录。 */
export function secretFile({ env = process.env, home = homedir(), exists = existsSync } = {}) {
  const explicit = String(env[MINERU_SECRET_ENV] || '').trim()
  if (explicit) return explicit
  if (exists(PACKAGE_SECRET_FILE)) return PACKAGE_SECRET_FILE
  return userSecretFile(home)
}

/** 显示用路径：主目录缩成 ~，避免把用户名长路径铺在界面上。 */
export function displayPath(file, home = homedir()) {
  const prefix = home.endsWith('/') ? home : `${home}/`
  return file.startsWith(prefix) ? `~${file.slice(home.length)}` : file
}

/** 只露前 4 位与后 2 位，用于"到底用的哪把 key"的排查，不可反推。 */
export function maskToken(token) {
  if (!token) return ''
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}****${token.slice(-2)}`
}

/**
 * 读文件里的 Token；没有就返回空串。
 * 文件存在但不是合法 JSON 时**抛错而不是当没配**——否则界面显示"未配置"，
 * 用户以为保存失败，实际是文件被别的工具写坏了。
 */
export function readMineruToken({ file = secretFile() } = {}) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw new Error(`无法读取 ${displayPath(file)}：${error?.code || error.message}`)
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${displayPath(file)} 不是合法 JSON（应为 {"token": "sk-..."}）；请修正或删除该文件后重试。`)
  }
  const token = typeof parsed?.token === 'string' ? parsed.token.trim() : ''
  return token
}

/**
 * Token 格式：MinerU 的是 `sk-` 开头的长串。
 * 只拦明显的空白与超长，**不猜上游规则**（上游改格式时这里不该成为障碍）。
 */
export function validateMineruToken(raw) {
  const token = String(raw ?? '').trim()
  if (!token) throw new Error('请先填写 MinerU Token；留空请用「清除」。')
  if (token.length < 8) throw new Error('Token 太短了，请确认已完整复制（MinerU 的 Token 以 sk- 开头）。')
  if (token.length > 1024) throw new Error('Token 过长（超过 1024 字符），请确认粘贴的内容只有 Token 本身。')
  if (/\s/.test(token)) throw new Error('Token 里不能有空格或换行，请重新复制一次。')
  if (!/^[A-Za-z0-9._-]+$/.test(token)) throw new Error('Token 含有意外字符，请确认粘贴的是 MinerU 的 API Token。')
  return token
}

function writeSecretFile(file, payload) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const text = `${JSON.stringify(payload, null, 2)}\n`
  /* 原子写：先写临时文件再 rename，避免写一半断电留下坏 JSON。 */
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, text, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, file)
  try { chmodSync(file, 0o600) } catch { /* 某些文件系统不支持改权限；已写入就够了 */ }
}

/** 读已有内容（保留用户自己加的其它键），坏文件不覆盖。 */
function readExisting(file) {
  if (!existsSync(file)) return {}
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    throw new Error(`无法读取 ${displayPath(file)}：${error?.code || error.message}`)
  }
  if (!text.trim()) return {}
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${displayPath(file)} 不是合法 JSON，未覆盖。请先修正或删除该文件。`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${displayPath(file)} 的内容不是对象，未覆盖。`)
  }
  return parsed
}

/** 保存 Token：写文件（600）并返回最新状态。原文不会回给调用方。 */
export function saveMineruToken(raw, options = {}) {
  const file = options.file || secretFile(options)
  const token = validateMineruToken(raw)
  const next = { ...readExisting(file), token }
  writeSecretFile(file, next)
  return mineruSettingsStatus({ ...options, file })
}

/** 清除 Token：只删 token 键，保留文件里其它键；文件因此变空就删掉。 */
export function clearMineruToken(options = {}) {
  const file = options.file || secretFile(options)
  if (!existsSync(file)) return mineruSettingsStatus({ ...options, file })
  const next = { ...readExisting(file) }
  delete next.token
  if (Object.keys(next).length === 0) {
    rmSync(file, { force: true })
  } else {
    writeSecretFile(file, next)
  }
  return mineruSettingsStatus({ ...options, file })
}

/**
 * 设置页要显示的状态。**不含 token 原文**。
 * 三态必须可区分：未配置 / 文件生效 / 环境变量生效（界面据此给不同的说法）。
 */
export function mineruSettingsStatus({ file = secretFile(), env = process.env } = {}) {
  let fileToken = ''
  let error = ''
  try {
    fileToken = readMineruToken({ file })
  } catch (problem) {
    error = problem.message
  }
  const envToken = String(env.MINERU_TOKEN || '').trim()
  const source = fileToken ? 'file' : envToken ? 'env' : 'none'
  const effective = fileToken || envToken
  return {
    configured: Boolean(effective),
    source,
    sourceLabel: source === 'file'
      ? '已保存到本机密钥文件'
      : source === 'env'
        ? '临时使用环境变量 MINERU_TOKEN（未写入文件）'
        : '尚未配置',
    masked: effective ? maskToken(effective) : '',
    file: displayPath(file),
    fileExists: existsSync(file),
    tokenUrl: MINERU_TOKEN_URL,
    error: error || undefined,
    permissions: fileMode(file),
  }
}

function fileMode(file) {
  try { return (statSync(file).mode & 0o777).toString(8) } catch { return undefined }
}
