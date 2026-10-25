import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { Workbench } from '/Users/sammini/Downloads/pbc-workbench/dsh/workbench.js'
const src = readFileSync('prototypes/v0.2/demo-data.js', 'utf8')
const window = {}
new Function('window', src)(window)
const demo = window.DEMO
const wb = await Workbench.open(null)
const boot = wb.bootstrap()
for (let i = 0; i < demo.profiles.length; i++) {
  const want = demo.profiles[i], got = boot.profiles[i]
  if (isDeepStrictEqual(want, got)) { console.log(want.key, 'deep equal OK'); continue }
  console.log(want.key, 'DIFF')
  for (const k of Object.keys(want)) {
    if (!isDeepStrictEqual(want[k], got[k])) {
      console.log('  field', k)
      console.log('   want', JSON.stringify(want[k]).slice(0, 400))
      console.log('   got ', JSON.stringify(got[k]).slice(0, 400))
    }
  }
  for (const k of Object.keys(got)) if (!(k in want)) console.log('  extra field', k)
}
