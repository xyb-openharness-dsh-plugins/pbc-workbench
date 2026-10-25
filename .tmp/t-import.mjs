import { openDatabase, migrate } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { ImportService, numOrNull, isParsable, safeDocName } from '../dsh/import.js'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const db = openDatabase(':memory:')
migrate(db)
seedDemo(db)

const workdir = mkdtempSync(join(tmpdir(), 'pbc-doc-'))
const docsDir = join(workdir, 'documents')

const MD = `
市一院检验科 2026-09-08
| 项目 | 结果 | 单位 | 参考范围 |
| --- | --- | --- | --- |
| 碱性磷酸酶 | 212 | U/L | 35–120 |
| γ-谷氨酰转肽酶 | 168 | U/L | 7–45 |
| 总胆红素 | 13.2 | μmol/L | 5.1-19.0 |
| 白蛋白 | 阴性 | g/L | 40–55 |
`
const fakeClient = { parse: async ({ bytes, filename }) => ({ markdown: MD, pages: 1, contentList: null }) }
const svc = new ImportService(db, { client: fakeClient, documentsDir: docsDir })

const buf = Buffer.from('%PDF-1.4 fake')
const out = await svc.importReport(buf, { profileKey: 'A', filename: '2026-09 化验单.pdf' })
console.log('import:', { documentId: out.documentId, state: out.parseState, candidates: out.candidates.length, skipped: out.skipped.length, pages: out.pages, labName: out.labName, reportDate: out.reportDate })
console.log('files on disk:', readdirSync(docsDir))
console.log('job rows:', db.prepare('SELECT kind,state,source_name,note FROM parse_jobs').all())

const cands = svc.listCandidates(out.documentId)
console.log('cands:', cands.map(c => `${c.code}=${c.value_text} [${c.ref_low_text},${c.ref_high_text}] ${c.state}`))

// accept ALP + GGT + TBil, reject 白蛋白 is not a candidate
for (const c of cands) svc.setCandidateState(c.id, 'accepted')
// commit panel
const panel = svc.commitPanel({ documentId: out.documentId, profileKey: 'A', labName: out.labName })
console.log('panel:', panel)
console.log('items:', db.prepare('SELECT code,value_num,value_text,unit_text,ref_low,ref_high,ord FROM lab_items WHERE panel_id=? ORDER BY ord').all(panel.panelId))

// numOrNull guards
console.log('numOrNull:', [null, undefined, '', '  ', '0', '3.5', '<5', '阴性', 0].map(v => `${JSON.stringify(v)}→${JSON.stringify(numOrNull(v))}`).join(' '))
console.log('isParsable:', ['a.pdf','a.PNG','a.txt','a.xlsx','a']['' ] === undefined ? ['a.pdf','a.PNG','a.txt','a.xlsx','a'].map(f=>`${f}=${isParsable(f)}`) : '')
console.log('safeDocName:', safeDocName('../../etc/2026-09 化验单.pdf'), safeDocName('...'))
console.log('doc row:', db.prepare('SELECT name,rel_path,doc_date,origin,parse_state,parse_note FROM documents ORDER BY id DESC LIMIT 1').get())

// 失败路径：坏 client
const bad = new ImportService(db, { client: { parse: async () => { throw Object.assign(new Error('上游 500'), { code: 'API_ERROR' }) } }, documentsDir: docsDir })
try { await bad.importReport(Buffer.from('x'), { profileKey: 'A', filename: 'bad.pdf' }) } catch (e) { console.log('fail path:', e.message, 'documentId=', e.documentId) }
console.log('failed doc:', db.prepare("SELECT name,parse_state,parse_note FROM documents WHERE parse_state='failed'").all())
console.log('candidates for failed doc:', db.prepare("SELECT COUNT(*) c FROM parse_candidates WHERE document_id=?").get(
  db.prepare("SELECT id FROM documents WHERE parse_state='failed'").get().id))
console.log('jobs now:', db.prepare('SELECT kind,state,note FROM parse_jobs').all())
