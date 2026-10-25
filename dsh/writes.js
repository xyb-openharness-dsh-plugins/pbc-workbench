/* 写入层：患者自己记的东西（症状/痒累）——**闭环的"记录"半环**。
 *
 * 为什么单独一个模块：第一版只有读、没有写，前端"保存"是内存假动作
 * （`toast('已记下这一次（演示：仅本页内存，不落库）')`），刷新即丢。
 * 界面文案是诚实的，但对患者来说这不是"待优化"，是"这个工作台记不了我的事"。
 *
 * 三条口径（每条都有对应测试）：
 * 1. **只写本人表达面**：痒 0–10、累 1–3、「没记」一律 NULL，绝不落任何分级列。
 *    0 分是有效值（"我今天不痒"），不等于"没记"。
 * 2. **日期由调用方显式给**：不默认"今天"。客户端时钟可能是错的，而这条记录
 *    会和化验单并排给医生看；日期错了比没有更糟。缺日期直接报错。
 * 3. **隐私是数据结构属性**：`visibility` 落库，不是前端开关。默认 `shared`，
 *    用户显式标私密才 private，且私密记录**不进导出**（导出层二次过滤）。
 */
import { StoreError } from './store.js'

/** 校验失败。`code` 供路由翻译成 400，`field` 供前端把错误挂到具体控件上。 */
export class ValidationError extends StoreError {
  constructor(message, field = null) {
    /* StoreError 的签名是 (code, message)——先 code 后 message，别写反。 */
    super('VALIDATION_FAILED', message)
    this.field = field
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** 0–10 的整数，或 null（没记）。字符串数字也接受，但必须是整数值。 */
function intOrNull(value, { min, max, field }) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw new ValidationError(`${field} 必须是一个数字`, field)
  if (!Number.isInteger(n)) throw new ValidationError(`${field} 必须是整数`, field)
  if (n < min || n > max) throw new ValidationError(`${field} 必须在 ${min}–${max} 之间`, field)
  return n
}

/** 布尔三态：true / false / null（没记）。不从字符串猜。 */
function boolOrNull(value, field) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  if (value === 0 || value === 1) return !!value
  throw new ValidationError(`${field} 只能是 true / false / 不填`, field)
}

/** 日期必须是真实存在的 ISO 日期（拦 2026-02-30）。 */
export function assertIsoDate(value, field = 'date') {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new ValidationError(`${field} 必须是 YYYY-MM-DD 格式（例如 2026-10-25）`, field)
  }
  const [y, m, d] = value.split('-').map(Number)
  const probe = new Date(y, m - 1, d)
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
    throw new ValidationError(`${field} 不是真实存在的日期：${value}`, field)
  }
  return value
}

/**
 * 记一条痒/累。
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{profileKey:string, date:string, itch?:number|null, fatigue?:number|null,
 *          nightWorse?:boolean|null, scratch?:boolean|null, sleepBreaks?:number|null,
 *          note?:string, visibility?:'shared'|'private'}} input
 * @returns {{id:number, ord:number}}
 */
export function addSymptomLog(db, input = {}) {
  const profileKey = String(input.profileKey ?? '').trim()
  if (!profileKey) throw new ValidationError('缺少档案标识（profileKey）', 'profileKey')
  const exists = db.prepare('SELECT 1 FROM profiles WHERE profile_key = ?').get(profileKey)
  if (!exists) throw new ValidationError(`没有这个档案：${profileKey}`, 'profileKey')

  const date = assertIsoDate(input.date)
  const itch = intOrNull(input.itch, { min: 0, max: 10, field: 'itch' })
  const fatigue = intOrNull(input.fatigue, { min: 1, max: 3, field: 'fatigue' })
  const nightWorse = boolOrNull(input.nightWorse, 'nightWorse')
  const scratch = boolOrNull(input.scratch, 'scratch')
  const sleepBreaks = intOrNull(input.sleepBreaks, { min: 0, max: 20, field: 'sleepBreaks' })
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  const visibility = input.visibility ?? 'shared'
  if (visibility !== 'shared' && visibility !== 'private') {
    throw new ValidationError('visibility 只能是 shared 或 private', 'visibility')
  }
  /* 一条都没有记：不写空行。空记录会让"今天记过"变成假事实。 */
  if (itch === null && fatigue === null && nightWorse === null && scratch === null && sleepBreaks === null && !note) {
    throw new ValidationError('这一条什么都没填，没有保存', null)
  }

  const maxOrd = db.prepare('SELECT COALESCE(MAX(ord), 0) AS n FROM symptom_logs WHERE profile_key = ?').get(profileKey).n
  const now = new Date().toISOString()
  const info = db.prepare(`INSERT INTO symptom_logs
    (profile_key, logged_on, itch_0_10, fatigue_1_3, night_worse, scratch_skin, sleep_breaks, note, visibility, created_at, ord)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    profileKey, date, itch, fatigue,
    nightWorse === null ? null : nightWorse ? 1 : 0,
    scratch === null ? null : scratch ? 1 : 0,
    sleepBreaks, note, visibility, now, maxOrd + 1,
  )
  return { id: Number(info.lastInsertRowid), ord: maxOrd + 1, date, visibility }
}

/** 删掉刚记错的那一条（按 id）。返回是否真的删了。 */
export function removeSymptomLog(db, id) {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError('id 不是有效数字', 'id')
  const info = db.prepare('DELETE FROM symptom_logs WHERE id = ?').run(n)
  return Number(info.changes) > 0
}
