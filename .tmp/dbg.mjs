import { Workbench } from '../dsh/workbench.js'
import { startWorkbenchServer } from '../dsh/server.js'
const wb = await Workbench.open(null)
const s = await startWorkbenchServer({ port: 0, workbench: wb })
const b = s.url.replace(/\/$/, '')
const r = await fetch(b + '/api/pbc-workbench/profile/A')
console.log('status', r.status)
const j = await r.json()
console.log('keys', Object.keys(j))
console.log(JSON.stringify(j).slice(0, 500))
const md = await (await fetch(b + '/api/pbc-workbench/export/A.md')).text()
console.log('=== MD grep')
for (const w of ['诊断', '分期', '应答']) {
  const i = md.indexOf(w)
  if (i >= 0) console.log(w, '→', JSON.stringify(md.slice(Math.max(0, i - 60), i + 40)))
}
const sv = await fetch(b + '/api/pbc-workbench/export/A.md/save', { method: 'POST' })
console.log('save status', sv.status, await sv.text())
await new Promise((res) => s.server.close(res))
wb.close()
