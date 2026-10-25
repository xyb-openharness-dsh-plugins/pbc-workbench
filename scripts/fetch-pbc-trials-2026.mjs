#!/usr/bin/env node
/**
 * fetch-pbc-trials-2026.mjs — PBC 2026 临床试验采集（ZERO-TO-DEV §1.3）
 *
 * 唯一入口：unified-trial-mcp（MCP stdio，绝不自己拼 URL、不抓页面）。
 * 不传 sourceIds → 所有注册来源各给一个终态；离线语料只有胰腺癌覆盖，
 * 对 PBC 属「未配置 / 无覆盖」，以 unconfigured 如实进入 manifest，
 * **不得**写成"已查过、没有试验"。
 *
 * 记录字段形状（unified-trial-mcp v0.3.1，见 SPEC.md §5）：
 *   records[]: { recordId, source:{id,label,sourceRecordId}, registryNumbers[], title,
 *                studyType, sponsorOrInstitution[], dates{}, sourceUrl, provenance{} }
 *   statuses[]: { sourceId, state, reasonCode, explanation, coverage{}, completeness{} }
 *
 * 用法：
 *   node scripts/fetch-pbc-trials-2026.mjs --dry-run   # 只打印计划与来源状态，不写盘
 *   node scripts/fetch-pbc-trials-2026.mjs             # 真实采集
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const UTS_CLI = process.env.UNIFIED_TRIAL_CLI ?? join(process.env.HOME ?? '', 'Downloads/unified_search_trials/dist/src/cli/main.js')
const OUT_DIR = join(ROOT, 'research', 'pbc-cancer')
const DRY = process.argv.includes('--dry-run')
const SNAPSHOT_DATE = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// 采集口径（与 docs/CLINICAL-DATA-2026.md §1 同步；改口径两处同改）：
// PBC 双名并存（旧名"原发性胆汁性肝硬化"仍在用）+ 中国患者常以"胆汁淤积""熊去氧胆酸"检索。
const QUERIES = [
  { keyword: '原发性胆汁性胆管炎', note: '中文现用标准名（PBC）' },
  { keyword: '原发性胆汁性肝硬化', note: '中文旧名（仍在文献与登记中使用）' },
  { keyword: '胆汁性胆管炎', note: '中文宽口径' },
  { keyword: '原发性胆汁性胆管炎 熊去氧胆酸', note: '一线药语境' },
  { keyword: 'primary biliary cholangitis', note: '英文标准名' },
  { keyword: 'primary biliary cirrhosis', note: '英文旧名' },
  { keyword: 'PBC ursodeoxycholic acid', note: '英文一线药语境' },
  { keyword: 'PBC pruritus', note: '症状语境（瘙痒是 PBC 主要诉求）' },
]
const PER_SOURCE_LIMIT = 200

// unified-trial-mcp 的 SourceState → 本仓 source_states.state（六值受 CHECK 约束）
const STATE_MAP = {
  SUCCESS: 'ready',
  NO_RESULTS: 'ready',      // 真的查过、真的没有 → ready（并带 coverage.zeroResultMeaning）
  NOT_ENABLED: 'unconfigured',
  NEEDS_SETUP: 'unconfigured',
  NOT_QUERIED: 'unconfigured',
  TIMEOUT: 'timeout',
  CHALLENGE_REQUIRED: 'failed',
  RATE_LIMITED: 'partial',
  DENIED: 'failed',
  FAILED: 'failed',
  TRUNCATED: 'truncated',
}
// "查过" 的判据：只有这两个终态表示该来源真的被查询并给出了答案
const QUERIED_STATES = new Set(['SUCCESS', 'NO_RESULTS'])

// SUCCESS 但结果被截断（completeness.isLowerBound 或 truncated）→ 落 truncated，不写 ready。
// 依据：unified-trial-mcp SPEC §5.1「只有 SUCCESS / NO_RESULTS 表示来源实际完成了查询」，
// 但"完成了查询"不等于"拿全了结果"；截断必须让下游看得见。
function effectiveState(s) {
  if (!QUERIED_STATES.has(s.state)) return s.state
  const truncated = s.truncated === true
    || s.completeness?.isLowerBound === true
    || (typeof s.completeness?.rowsReturned === 'number'
        && typeof s.requestedLimit === 'number'
        && s.completeness.rowsReturned >= s.requestedLimit)
  return truncated ? 'TRUNCATED' : s.state
}

class McpClient {
  constructor() {
    this.nextId = 1
    this.pending = new Map()
    this.buf = ''
    this.child = spawn(process.execPath, [UTS_CLI, 'serve'], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (c) => this.#onChunk(c))
    this.child.stderr.setEncoding('utf8')
    this.child.stderr.on('data', (c) => process.stderr.write(c.length > 500 ? c.slice(0, 500) + '…\n' : c))
    this.child.on('error', (e) => process.stderr.write(`[mcp] spawn 失败：${e.message}\n`))
  }
  #onChunk(chunk) {
    this.buf += chunk
    let idx
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line)
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)
          this.pending.delete(msg.id)
          if (msg.error) reject(new Error(`${msg.error.code} ${msg.error.message}`))
          else resolve(msg.result)
        }
      } catch { /* banner/日志行忽略，不猜 */ }
    }
  }
  send(obj) { this.child.stdin.write(JSON.stringify(obj) + '\n') }
  request(method, params, timeoutMs = 180000) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP timeout: ${method}`)) }, timeoutMs)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      this.send({ jsonrpc: '2.0', id, method, params })
    })
  }
  notify(method, params) { this.send({ jsonrpc: '2.0', method, params }) }
  async init() {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'pbc-workbench-fetch', version: '0.1.0' },
    }, 30000)
    this.notify('notifications/initialized', {})
  }
  callTool(name, args) {
    return this.request('tools/call', { name, arguments: args })
      .then((r) => JSON.parse((r.content ?? []).map((c) => c.text ?? '').join('\n') || '{}'))
  }
  close() { try { this.child.stdin.end() } catch { /* 已关闭 */ } this.child.kill('SIGTERM') }
}

// 同一登记号才算同一条；标题/机构/日期相似一律不合并
function registryKeys(rec) {
  const keys = []
  for (const rn of rec.registryNumbers ?? []) {
    const v = rn?.value?.trim?.()
    if (v) keys.push(`${rn.registry}:${v}`.toUpperCase())
  }
  return keys.filter((v, i, a) => a.indexOf(v) === i)
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

async function main() {
  if (!existsSync(UTS_CLI)) {
    console.error(`✗ 找不到 unified-trial-mcp 入口：${UTS_CLI}\n  用 UNIFIED_TRIAL_CLI=<dist/src/cli/main.js 绝对路径> 指定。`)
    process.exit(2)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const cli = new McpClient()
  await cli.init()

  // 先取来源状态：这是"哪些通道压根没配"的唯一可信来源
  let statusSnapshot = {}
  try {
    statusSnapshot = await cli.callTool('get_source_status', {})
  } catch (e) {
    console.error(`[warn] get_source_status 失败：${e.message}（继续，终态以 search_trials 为准）`)
  }
  const sourceList = statusSnapshot.sources ?? statusSnapshot

  if (DRY) {
    console.log('[dry-run] 计划：', JSON.stringify({ UTS_CLI, OUT_DIR, QUERIES, PER_SOURCE_LIMIT, SNAPSHOT_DATE }, null, 2))
    console.log('[dry-run] 来源状态：', JSON.stringify(sourceList, null, 2).slice(0, 4000))
    cli.close()
    return
  }

  const allRecords = new Map()
  const perQuery = []
  // 来源终态按来源聚合：只要任一查询真的查到，就算查过
  const sourceAgg = new Map()

  for (const q of QUERIES) {
    process.stdout.write(`检索 "${q.keyword}" … `)
    let res
    try {
      res = await cli.callTool('search_trials', { keyword: q.keyword, limit: PER_SOURCE_LIMIT })
    } catch (e) {
      perQuery.push({ query: q.keyword, note: q.note, error: String(e.message).slice(0, 300), statuses: [] })
      console.log('失败：' + e.message)
      continue
    }
    const statuses = (res.statuses ?? []).map((s) => ({
      sourceId: s.sourceId ?? null,
      state: s.state ?? null,
      reasonCode: s.reasonCode ?? null,
      explanation: s.explanation ?? null,
      fixHint: s.fixHint ?? null,
      coverage: s.coverage ?? null,
      completeness: s.completeness ?? null,
      resultCount: s.resultCount ?? null,
      requestedLimit: s.requestedLimit ?? PER_SOURCE_LIMIT,
      truncated: s.truncated ?? null,
      effective: effectiveState(s),
    }))
    perQuery.push({
      query: q.keyword,
      note: q.note,
      statuses,
      coverage: res.coverage ?? null,
      completeness: res.completeness ?? null,
      totalRecords: res.totalRecords ?? null,
      overlaps: (res.overlaps ?? []).length,
    })
    for (const s of statuses) {
      const prev = sourceAgg.get(s.sourceId)
      // 优先保留"真的查过"的终态。同为查过时的优先级：
      //   truncated 且有命中(3) > SUCCESS 且有命中(2) > 零命中/未查(1)
      // 关键：SUCCESS 降级为 TRUNCATED 必须**确有命中**，否则会把"零命中的 SUCCESS"误标截断。
      const rank = (x) => {
        if (!QUERIED_STATES.has(x.state)) return 1
        const hit = (x.resultCount ?? 0) > 0
        if (x.effective === 'TRUNCATED' && hit) return 3
        if (x.state === 'SUCCESS' && hit) return 2
        return hit ? 2 : 1
      }
      if (!prev || rank(s) > rank(prev)) sourceAgg.set(s.sourceId, s)
    }
    for (const r of res.records ?? []) {
      if (r.recordId && !allRecords.has(r.recordId)) allRecords.set(r.recordId, r)
    }
    console.log(`${(res.records ?? []).length} 条；终态 ${statuses.map((s) => `${s.sourceId}:${s.state}`).join(' ') || '(空)'}`)
  }
  cli.close()

  // 身份合并：同登记号合并来源；其余按 recordId 独立保留
  const byKey = new Map()
  const entries = []
  for (const [rid, rec] of allRecords) {
    const keys = registryKeys(rec)
    const hit = keys.map((k) => byKey.get(k)).find(Boolean)
    if (hit) {
      hit.mergedSources.push(rid)
      for (const k of keys) byKey.set(k, hit)
    } else {
      const entry = { recordId: rid, mergedSources: [rid], rec }
      entries.push(entry)
      for (const k of keys) byKey.set(k, entry)
    }
  }
  const merged = [...new Map(entries.map((e) => [e.recordId, e])).values()]
  merged.sort((a, b) => String(a.recordId).localeCompare(String(b.recordId)))

  const lines = merged.map(({ recordId, mergedSources, rec }) => JSON.stringify({
    recordId,
    mergedSources,
    sourceId: rec.source?.id ?? recordId.split(':')[0] ?? null,
    title: rec.title ?? null,
    studyType: rec.studyType ?? null,
    sponsor: rec.sponsorOrInstitution ?? null,
    registryNumbers: rec.registryNumbers ?? null,
    dates: rec.dates ?? null,
    countries: rec.countries ?? null,
    recruitmentStatus: rec.recruitmentStatus ?? null,
    sourceUrl: rec.sourceUrl ?? null,
    retrievedAt: rec.provenance?.retrievedAt ?? null,
    statusNote: '登记状态，未核实',
    snapshotDate: SNAPSHOT_DATE,
  }))
  const jsonlPath = join(OUT_DIR, 'trials-2026.jsonl')
  writeFileSync(jsonlPath, lines.length ? lines.join('\n') + '\n' : '')

  // ---- sqlite：与 jsonl / manifest 三处条数必须一致 ----
  const dbPath = join(OUT_DIR, 'pbc_cancer_trials_2026.sqlite')
  if (existsSync(dbPath)) rmSync(dbPath)
  const db = new DatabaseSync(dbPath)
  db.exec(`CREATE TABLE trials (
    record_id TEXT PRIMARY KEY,
    merged_sources TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT,
    study_type TEXT,
    sponsors TEXT,
    registry_numbers TEXT,
    dates TEXT,
    countries TEXT,
    recruitment_status TEXT,
    source_url TEXT,
    retrieved_at TEXT,
    status_note TEXT NOT NULL DEFAULT '登记状态，未核实',
    snapshot_date TEXT NOT NULL
  );
  CREATE INDEX idx_trials_source ON trials(source_id);
  CREATE TABLE source_states (
    scope TEXT NOT NULL,
    source_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('ready','timeout','unconfigured','partial','truncated','failed')),
    upstream_state TEXT NOT NULL,
    reason_code TEXT,
    coverage TEXT,
    completeness TEXT,
    queried INTEGER NOT NULL,
    checked_on TEXT NOT NULL,
    note TEXT,
    PRIMARY KEY (scope, source_id)
  );
  CREATE TABLE query_log (
    query TEXT NOT NULL,
    note TEXT,
    source_id TEXT,
    upstream_state TEXT,
    record_count INTEGER,
    error TEXT
  );`)
  const insTrial = db.prepare(`INSERT INTO trials (record_id, merged_sources, source_id, title, study_type, sponsors,
    registry_numbers, dates, countries, recruitment_status, source_url, retrieved_at, status_note, snapshot_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insState = db.prepare(`INSERT INTO source_states (scope, source_id, state, upstream_state, reason_code,
    coverage, completeness, queried, checked_on, note) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  const insQuery = db.prepare('INSERT INTO query_log (query, note, source_id, upstream_state, record_count, error) VALUES (?,?,?,?,?,?)')

  db.exec('BEGIN')
  try {
    for (const l of lines) {
      const r = JSON.parse(l)
      insTrial.run(r.recordId, JSON.stringify(r.mergedSources), r.sourceId, r.title, r.studyType,
        r.sponsor ? JSON.stringify(r.sponsor) : null,
        r.registryNumbers ? JSON.stringify(r.registryNumbers) : null,
        r.dates ? JSON.stringify(r.dates) : null,
        r.countries ? JSON.stringify(r.countries) : null,
        r.recruitmentStatus, r.sourceUrl, r.retrievedAt, r.statusNote, r.snapshotDate)
    }
    for (const qs of perQuery) {
      for (const s of qs.statuses) {
        insQuery.run(qs.query, qs.note, s.sourceId, s.state, s.resultCount ?? null, qs.error ?? null)
      }
      if (qs.error) insQuery.run(qs.query, qs.note, null, 'ERROR', null, qs.error)
    }
    for (const [sourceId, s] of sourceAgg) {
      const upstream = s.effective ?? s.state
      const mapped = STATE_MAP[upstream] ?? 'failed'
      const noteParts = [s.explanation ?? '']
      if (upstream === 'TRUNCATED') {
        noteParts.push('结果被截断：本来源命中数超过单次上限，manifest 只含前 N 条，不得当作全部命中。')
      }
      insState.run('trials', sourceId, mapped, s.state, s.reasonCode,
        s.coverage ? JSON.stringify(s.coverage) : null,
        s.completeness ? JSON.stringify(s.completeness) : null,
        QUERIED_STATES.has(s.state) ? 1 : 0, SNAPSHOT_DATE, noteParts.filter(Boolean).join(' '))
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    db.close()
    console.error('✗ 落库失败，已回滚：' + e.message)
    process.exit(1)
  }
  const dbCount = db.prepare('SELECT COUNT(*) AS n FROM trials').get().n
  const stateRows = db.prepare('SELECT source_id, state, queried FROM source_states ORDER BY source_id').all()
  db.close()

  const queried = stateRows.filter((r) => r.queried === 1).map((r) => r.source_id)
  const unqueried = stateRows.filter((r) => r.queried !== 1).map((r) => r.source_id)

  const manifest = {
    topic: 'pbc',
    disease: '原发性胆汁性胆管炎（Primary Biliary Cholangitis, PBC）',
    year: '2026',
    snapshotDate: SNAPSHOT_DATE,
    tool: `unified-trial-mcp @ ${UTS_CLI}`,
    queries: QUERIES,
    perSourceLimit: PER_SOURCE_LIMIT,
    recordCount: lines.length,
    dbCount,
    sourceStates: stateRows,
    queriedSources: queried,
    unqueriedSources: unqueried,
    truncatedSources: stateRows.filter((r) => r.state === 'truncated').map((r) => r.source_id),
    honesty: {
      queriedMeaning: '只有 SUCCESS 与 NO_RESULTS 表示该来源真的被查询并给出答案；其余终态一律不代表"没有试验"',
      offlineCorpora: 'ChiCTR 离线语料与 XYB 归档仅覆盖胰腺癌；PBC 不适用，落 unconfigured 而不是 0 条',
      statusWording: '登记 ≠ 有效 ≠ 安全 ≠ 可入组；状态一律「登记状态，未核实」',
      mergeRule: '仅同一登记号合并，其余来源并排保留；标题/机构/日期相似不作为合并依据',
      coverageNote: '0 条结果必须带该来源自己的覆盖声明（见 source_states.coverage）',
    },
    files: {},
  }
  manifest.files['trials-2026.jsonl'] = { sha256: sha256(jsonlPath) }
  manifest.files['pbc_cancer_trials_2026.sqlite'] = { sha256: sha256(dbPath) }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))

  if (manifest.recordCount !== lines.length || dbCount !== lines.length) {
    console.error(`✗ 一致性断言失败：manifest=${manifest.recordCount} jsonl=${lines.length} sqlite=${dbCount}`)
    process.exit(1)
  }
  const bySource = {}
  for (const m of merged) {
    const id = m.rec.source?.id ?? 'unknown'
    bySource[id] = (bySource[id] ?? 0) + 1
  }
  console.log(`完成：${lines.length} 条（合并前 ${allRecords.size}）；bySource=${JSON.stringify(bySource)}`)
  console.log(`已查来源：${queried.join(', ') || '（无）'}；未查/未配置：${unqueried.join(', ') || '（无）'}`)
  if (!queried.length) {
    console.error('⚠ 本轮没有任何来源真正被查询到 —— manifest 已如实记录，界面不得显示"无相关试验"。')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
