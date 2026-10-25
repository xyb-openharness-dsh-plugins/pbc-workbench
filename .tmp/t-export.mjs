import { openDatabase, migrate } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { getProfile, bootstrap } from '../dsh/readmodels.js'
import { renderPrepMarkdown, hasPrivateContent } from '../dsh/export.js'
const db = openDatabase(':memory:'); migrate(db); seedDemo(db)
const b = bootstrap(db, { version:'0.1.0', build:'2026-10-25' })
for (const k of ['A','B']) {
  const p = b.profiles[k]
  const md = renderPrepMarkdown(p, { now: new Date('2026-10-25T00:00:00Z'), version:'0.1.0', excludedPrivate: hasPrivateContent(p) })
  console.log('=====', k, md.length, 'chars')
  console.log(md)
}
