/* 文档导入：原件 → MinerU → 候选 → （用户逐条接受）→ 化验单。
 *
 * 链路：POST /api/pbc-workbench/import（原始字节 + `?name=` + `?profile=`）
 *      → MinerU v4 解析 → full.md → `dsh/parse.js` 抽候选
 *      → 原件落 `<资料目录>/documents/` + `documents` 一行 + `parse_candidates` 若干（state='pending'）
 *      → 前端逐条核对，接受后才落 `lab_panels` / `lab_items`。
 *
 * ---- 五条不可让步（家族契约，别为了"智能"放宽） ----
 * 1. **只抄写不推测**：报告里没有的指标不生成候选；数值只做"字符串 → 数字"的搬运，
 *    单位换算、参考范围判定、缺失补齐全部不做。
 * 2. **候选不是记录**：解析只写 `parse_candidates`，不碰 `lab_items`。
 *    用户点"接受"才进事实层，且 `lab_panels.source_kind='parsed'`（可追溯）。
 * 3. **参考范围不是结果**：`35–120` 这种两数一格整行放弃，不当成结果值。
 * 4. **`<0.5` / `阴性` 留原文**：`value_text` 存字符串，`value_num` 保持 NULL。
 *    **绝不用 `Number(x)` 兜底**——`Number(null) === 0`，会把"没测"写成"测出来是 0"。
 * 5. **解析失败不产生候选**：document 置 `failed` + `parse_note` 记原因，原件留在磁盘可重试；
 *    **不删原件**，也不把半份结果当成功。
 *
 * ---- 上传是显式动作 ----
 * 原件会离开本机到 mineru.net。界面必须先说明再让用户点「解析」，**
 * 这里不做"导入即自动上传"**；用户拒绝上传时走 `recordOnly()`，只登记原件与日期。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { MineruError, createMineruClient } from './mineru.js'
import { extractLabCandidates, guessLabName, guessReportDate } from './parse.js'

export { MineruError }

const DOCUMENT_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.docx', '.pptx', '.xlsx'])
/** 只有这些能被 MinerU 解析；别的格式在本地就拦住，**不发请求**（省流量也省得报莫名其妙的错）。 */
export const PARSABLE_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.docx', '.pptx', '.xlsx'])

export function extOf(filename) {
  const m = String(filename ?? '').toLowerCase().match(/(\.[a-z0-9]+)$/)
  return m ? m[1] : ''
}

export function isParsable(filename) {
  return PARSABLE_EXT.has(extOf(filename))
}

/** 文件名清洗：去掉路径分隔与控制字符，**保留中文**（"2026-09 化验单.pdf" 比哈希好认）。 */
export function safeDocName(filename) {
  const base = basename(String(filename ?? 'document')).replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_').trim()
  const cleaned = base.replace(/^\.+/, '')
  return (cleaned || 'document').slice(0, 120)
}

/**
 * 字符串 → 数字或 null。**只有真的是一串数字时才转**。
 * 这是 `Number(null)===0` 那个坑的唯一防线，所有落数值列的地方都必须过它。
 */
export function numOrNull(text) {
  if (text === null || text === undefined) return null
  const t = String(text).trim()
  if (t === '') return null
  if (!/^-?\d+(?:\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * 导入服务。`documentsDir` 是原件落盘目录（`<资料目录>/documents`）；
 * 纯演示（内存库）时可以不传，那原件就不落盘，`rel_path` 记 `memory:<sha>`。
 */
export class ImportService {
  constructor(db, { client = null, documentsDir = null, extract = extractLabCandidates, clock = nowIso } = {}) {
    this.db = db
    this.client = client
    this.documentsDir = documentsDir
    this.extract = extract
    this.clock = clock
  }

  /** 纯解析，不落库。失败直接抛（调用方决定是否记 failed）。 */
  async parse(buffer, { filename = 'document.pdf' } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new MineruError('BAD_INPUT', '文件是空的，没有可解析的内容')
    }
    if (!isParsable(filename)) {
      throw new MineruError('UNSUPPORTED_TYPE', `MinerU 不支持 ${extOf(filename) || '该'} 格式；请上传 PDF 或图片扫描件`)
    }
    if (!this.client) {
      throw new MineruError('NO_TOKEN', '还没有配置 MinerU Token，无法解析。可以先只登记原件（不解析）。')
    }
    const parsed = await this.client.parse({ bytes: buffer, filename })
    const markdown = parsed.markdown ?? ''
    const { candidates, skipped } = this.extract(markdown)
    return {
      markdown,
      candidates,
      skipped,
      pages: parsed.pages ?? null,
      reportDate: guessReportDate(filename) ?? guessReportDate(markdown) ?? null,
      labName: guessLabName(markdown),
    }
  }

  /** 原件落盘，返回 `{relPath, sha256, bytes}`。同名不同内容不会互相覆盖（哈希进文件名）。 */
  storeOriginal(buffer, filename) {
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const clean = safeDocName(filename)
    if (!this.documentsDir) return { relPath: `memory:${sha256.slice(0, 16)}`, sha256, bytes: buffer.length }
    mkdirSync(this.documentsDir, { recursive: true, mode: 0o700 })
    const name = `${sha256.slice(0, 12)}-${clean}`
    const abs = join(this.documentsDir, name)
    /* 同一个文件重复导入不重复写盘；内容不同则哈希不同、自然分成两个文件。 */
    if (!existsSync(abs)) writeFileSync(abs, buffer, { mode: 0o600 })
    return { relPath: join('documents', name), sha256, bytes: buffer.length }
  }

  /**
   * 只登记原件，不上传、不解析（用户拒绝上传，或格式本地就能存）。
   * 这是"我先把单子存起来"这条路径的落点。
   */
  recordOnly(buffer, { profileKey, filename = 'document.pdf', docDate = null } = {}) {
    const stored = this.storeOriginal(buffer, filename)
    const id = this.#insertDocument(null, {
      profileKey,
      name: safeDocName(filename),
      stored,
      docDate,
      origin: 'upload',
      parseState: 'unparsed',
      parseNote: '已保存原件，未上传解析',
    })
    return { documentId: id, stored: { ...stored, bytes: stored.bytes }, parseState: 'unparsed' }
  }

  /**
   * 完整导入：落盘 → 解析 → 写候选。
   * 解析失败时**仍然保留原件与 document 行**（parse_state='failed'），可重试。
   */
  async importReport(buffer, { profileKey, filename = 'document.pdf', docDate = null } = {}) {
    const stored = this.storeOriginal(buffer, filename)
    const jobId = this.#startJob('mineru', filename)

    let parsed
    try {
      parsed = await this.parse(buffer, { filename })
    } catch (error) {
      const id = this.#insertDocument(null, {
        profileKey,
        name: safeDocName(filename),
        stored,
        docDate,
        origin: 'upload',
        parseState: 'failed',
        parseNote: `解析失败：${error.message}`,
      })
      this.#finishJob(jobId, 'failed', error.message)
      throw Object.assign(error, { documentId: id })
    }

    const partial = parsed.candidates.length === 0
    const documentId = this.#insertDocument(null, {
      profileKey,
      name: safeDocName(filename),
      stored,
      docDate: docDate ?? parsed.reportDate,
      origin: 'upload',
      parseState: partial ? 'partial' : 'parsed',
      parseNote: partial
        ? '解析完成但没有抽到可抄写的指标（可能是排版不是表格）；原件已保留，可人工录入或重试'
        : `MinerU 解析，${parsed.pages ?? '?'} 页，抽出 ${parsed.candidates.length} 条候选`,
    })

    /* 候选与 document 同事务写：要么都进，要么都不进。 */
    this.db.exec('BEGIN')
    try {
      const ins = this.db.prepare(`INSERT INTO parse_candidates
        (document_id, profile_key, code, value_text, unit_text, ref_low_text, ref_high_text, drawn_on, state, note, created_at, ord)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      parsed.candidates.forEach((c, i) => {
        ins.run(
          documentId, profileKey, c.code, c.valueText, c.unitText,
          c.refLowText, c.refHighText, docDate ?? parsed.reportDate,
          'pending', null, this.clock(), i,
        )
      })
      this.db.exec('COMMIT')
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch { /* 原始错误优先 */ }
      this.#finishJob(jobId, 'failed', error.message)
      throw error
    }

    this.#finishJob(jobId, partial ? 'partial' : 'success',
      `候选 ${parsed.candidates.length} 条，跳过 ${parsed.skipped.length} 条`)
    return {
      documentId,
      parseState: partial ? 'partial' : 'parsed',
      candidates: parsed.candidates,
      skipped: parsed.skipped,
      pages: parsed.pages,
      labName: parsed.labName,
      reportDate: docDate ?? parsed.reportDate,
    }
  }

  /** 接受 / 拒收一条候选。**只改状态，不写事实层**。 */
  setCandidateState(candidateId, state) {
    if (!['pending', 'accepted', 'rejected', 'needs_review'].includes(state)) {
      throw new MineruError('BAD_STATE', `未知的候选状态：${state}`)
    }
    const r = this.db.prepare('UPDATE parse_candidates SET state = ? WHERE id = ?').run(state, candidateId)
    if (r.changes === 0) throw new MineruError('CANDIDATE_NOT_FOUND', `没有这条候选（id=${candidateId}）`)
    return { id: Number(candidateId), state, changed: r.changes }
  }

  /**
   * 把某份文档下**已接受**的候选落成一张化验单（`lab_panels` + `lab_items`）。
   *
   * 只在用户显式点「保存为化验单」时调用。`ref_low/ref_high` 走 `numOrNull`，
   * 认不出就留 NULL——**留 NULL 的后果是界面显示"上限未印"，这是对的**，
   * 强行填 0 会让界面算出错误的倍数。
   */
  commitPanel({ documentId, profileKey, drawnOn = null, labName = null }) {
    const doc = this.db.prepare('SELECT * FROM documents WHERE id = ? AND profile_key = ?').get(documentId, profileKey)
    if (!doc) throw new MineruError('DOCUMENT_NOT_FOUND', `没有这份文档（id=${documentId}）`)

    const accepted = this.db.prepare(
      "SELECT * FROM parse_candidates WHERE document_id = ? AND state = 'accepted' ORDER BY ord",
    ).all(documentId)
    if (accepted.length === 0) {
      throw new MineruError('NO_ACCEPTED_CANDIDATE', '这份文档还没有已接受的指标，先逐条核对再保存')
    }

    const date = drawnOn ?? accepted.find((c) => c.drawn_on)?.drawn_on ?? doc.doc_date ?? null
    if (!date) throw new MineruError('MISSING_DATE', '这张化验单缺日期，请先补上（日期决定它在趋势线里的位置）')

    this.db.exec('BEGIN')
    try {
      const panelInsert = this.db.prepare(
        'INSERT INTO lab_panels (profile_key, drawn_on, lab_name, src_doc, source_kind, created_at) VALUES (?,?,?,?,?,?)',
      )
      const panelId = Number(panelInsert.run(profileKey, date, labName, documentId, 'parsed', this.clock()).lastInsertRowid)

      const itemInsert = this.db.prepare(`INSERT INTO lab_items
        (panel_id, code, value_num, value_text, unit_text, ref_low, ref_high, ord) VALUES (?,?,?,?,?,?,?,?)`)
      accepted.forEach((c, i) => {
        const num = numOrNull(c.value_text)
        itemInsert.run(
          panelId, c.code,
          num,
          /* 数值型不留 value_text（两列同时有值会让"到底是几"变得含糊）；非数值型才留原文。 */
          num === null ? c.value_text : null,
          c.unit_text,
          numOrNull(c.ref_low_text),
          numOrNull(c.ref_high_text),
          i,
        )
      })

      this.db.prepare("UPDATE documents SET parse_state = 'parsed', parse_note = ? WHERE id = ?")
        .run(`${doc.parse_note ? `${doc.parse_note}；` : ''}已存为化验单 ${date}`, documentId)

      this.db.exec('COMMIT')
      return { panelId, drawnOn: date, items: accepted.length }
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch { /* 原始错误优先 */ }
      throw error
    }
  }

  /** 读一份文档的候选（前端核对界面用）。 */
  listCandidates(documentId) {
    return this.db.prepare(
      'SELECT id, code, value_text, unit_text, ref_low_text, ref_high_text, drawn_on, state, ord FROM parse_candidates WHERE document_id = ? ORDER BY ord',
    ).all(documentId).map((r) => ({ ...r }))
  }

  #insertDocument(_unused, { profileKey, name, stored, docDate, origin = 'upload', parseState = 'unparsed', parseNote = null }) {
    const r = this.db.prepare(`INSERT INTO documents
      (profile_key, name, rel_path, mime, sha256, doc_date, origin, parse_state, parse_note, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      profileKey, name, stored.relPath, mimeOf(name), stored.sha256, docDate,
      origin, parseState, parseNote, this.clock(),
    )
    return Number(r.lastInsertRowid)
  }

  #startJob(kind, name) {
    try {
      const r = this.db.prepare(
        'INSERT INTO parse_jobs (document_id, profile_key, kind, state, source_name, note, created_at) VALUES (NULL, NULL, ?, ?, ?, NULL, ?)',
      ).run(kind, 'running', name, this.clock())
      return Number(r.lastInsertRowid)
    } catch {
      /* 任务表是辅助台账：写不进去不该让整个导入失败（老库没有这张表时降级为不记历史）。 */
      return null
    }
  }

  #finishJob(jobId, state, note) {
    if (!jobId) return
    try {
      this.db.prepare('UPDATE parse_jobs SET state = ?, note = ?, finished_at = ? WHERE id = ?')
        .run(state, note ?? null, this.clock(), jobId)
    } catch { /* 同上，台账失败不影响主流程 */ }
  }
}

function mimeOf(name) {
  const ext = extOf(name)
  return {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }[ext] ?? null
}

/** 默认服务：从设置页/环境变量取 Token；`documentsDir` 由调用方按资料目录给出。 */
export function createImportService(db, options = {}) {
  const client = options.client ?? (options.noClient ? null : createMineruClient(options))
  return new ImportService(db, { ...options, client })
}

/** 读回原件字节（重试解析时用）。记忆模式的 `memory:` 路径读不出来，明确报错。 */
export function readOriginal(documentsDir, relPath) {
  if (!documentsDir || String(relPath).startsWith('memory:')) {
    throw new MineruError('ORIGINAL_UNAVAILABLE', '原件只存在于内存演示模式，没有落盘，无法重试解析')
  }
  const abs = join(documentsDir, '..', relPath)
  if (!existsSync(abs)) throw new MineruError('ORIGINAL_MISSING', `原件不在资料目录里：${relPath}`)
  return readFileSync(abs)
}

export { DOCUMENT_EXT }
