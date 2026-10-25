/* 工作台实例：一个资料目录 = 一个库 + 一条导出路径。
 *
 * 为什么要有这一层：`dsh/index.js`（宿主插件）和 `scripts/dev-server.mjs`（本地直开）
 * 必须用**同一份**打开/播种/读档逻辑。分开写就会"本地能开、装进 Desktop 就空档案"。
 *
 * 两条边界：
 * 1. **资料目录由用户选定**：这里只校验（`assertWorkspacePath`），不猜、不建父目录、
 *    不把主目录/桌面/下载根当默认值。
 * 2. **没有资料目录 ≠ 报错**：`open(null)` 打开内存库并播种演示数据，让第一次装上就能看到东西；
 *    真要有资料就必须显式给 root。这条规则让"演示"和"真实"在数据层就分开，不靠界面判断。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertWorkspacePath } from './server.js'
import { close, migrate, openDatabase } from './store.js'
import { bootstrap as readBootstrap, getProfile as readProfile, listProfiles } from './readmodels.js'
import { seedDemo, hasDemoData, DB_FILE } from './demo.js'
import { addScreeningRecord, addSymptomLog, removeSymptomLog } from './writes.js'
import { APP_INFO } from '../lib/version.js'

export class Workbench {
  constructor({ workspace, db, demo }) {
    this.workspace = workspace
    this.db = db
    this.demo = demo
  }

  get version() { return APP_INFO.version }
  get displayVersion() { return APP_INFO.displayVersion }
  get build() { return APP_INFO.build }
  /** 是否是演示模式（没有真实资料目录）。界面据此显示"演示数据"横幅。 */
  get isDemo() { return this.workspace === null }

  /**
   * @param {string|null} workspace 用户选定的资料目录；null = 内存库演示模式
   */
  static async open(workspace) {
    if (workspace === null || workspace === undefined) {
      const db = openDatabase(':memory:')
      migrate(db)
      const demo = seedDemo(db)
      return new Workbench({ workspace: null, db, demo })
    }

    const root = assertWorkspacePath(workspace)
    /* 目录不存在是正常的（用户第一次选它），这里建目录；父目录不存在上面已经拦了。 */
    mkdirSync(root, { recursive: true })
    const db = openDatabase(join(root, DB_FILE))
    migrate(db)
    /* 只有库里一条档案都没有才播种：已有真实记录时绝不覆盖。 */
    const demo = hasDemoData(db) ? { seeded: false, reason: '已有档案' } : seedDemo(db)
    return new Workbench({ workspace: root, db, demo })
  }

  listProfiles() {
    return listProfiles(this.db)
  }

  /** 单份档案。私密内容默认不给（口径：私密是数据结构属性，不是前端开关）。 */
  getProfile(key, opts = {}) {
    return readProfile(this.db, key, opts)
  }

  bootstrap() {
    return readBootstrap(this.db, { version: this.version, build: this.build })
  }

  /**
   * 把复诊准备写进 `<资料目录>/exports/`。
   * 内存库演示模式没有资料目录 → 抛 EXPORT_SAVE_UNAVAILABLE，由路由翻译成 501，
   * 不假装保存成功。
   */
  saveExport(key) {
    if (!this.workspace) {
      const error = new Error('演示模式没有资料目录，导出的文件不能落盘；请先在设置里选定资料目录')
      error.code = 'EXPORT_SAVE_UNAVAILABLE'
      throw error
    }
    const profile = this.getProfile(key, { includePrivate: true })
    if (!profile) {
      const error = new Error(`没有这个档案：${key}`)
      error.code = 'PROFILE_NOT_FOUND'
      throw error
    }
    /* 延迟 import：导出模块只在真的导出时才加载，插件启动不背这个成本。 */
    return import('./export.js').then(({ renderPrepMarkdown, exportFilename }) => {
      /* 私密过滤在渲染器内部完成；这里取全量的唯一原因是让它能算出"有东西被排除"。 */
      const md = renderPrepMarkdown(profile, { version: this.version })
      const dir = join(this.workspace, 'exports')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, exportFilename(profile))
      writeFileSync(file, md, 'utf8')
      return { ok: true, file, bytes: Buffer.byteLength(md, 'utf8') }
    })
  }

  /**
   * 记一条痒/累。**演示模式（内存库）也允许写**——它不落盘，但至少让患者当场看到
   * "记下来了"这条链路是通的；真正的持久化要有资料目录。是否落盘由调用方按
   * `this.isDemo` 决定要不要提示，写入本身不该因为演示模式就 404。
   */
  addSymptom(input) {
    const saved = addSymptomLog(this.db, { ...input, profileKey: input?.profileKey })
    return { ...saved, persisted: !this.isDemo }
  }

  /** 删掉记错的那一条。 */
  removeSymptom(id) {
    return removeSymptomLog(this.db, id)
  }

  /** 记一条筛查结果。返回里带 `persisted`：内存演示库不能假装写盘成功。 */
  addScreening(input) {
    return { ...addScreeningRecord(this.db, input), persisted: !this.isDemo }
  }

  close() {
    close(this.db)
  }
}

export { DB_FILE }
