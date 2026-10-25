import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { Workbench } from '/Users/sammini/Downloads/pbc-workbench/dsh/workbench.js'
const src = readFileSync('prototypes/v0.2/demo-data.js', 'utf8')
const window = {}
new Function('window', src)(window)
const demo = window.DEMO
const wb = await Workbench.open(null)
const boot = wb.bootstrap()
const want = demo.profiles[0].labs, got = boot.profiles[0].labs
console.log('len', want.length, got.length)
for (let i = 0; i < want.length; i++) {
  if (isDeepStrictEqual(want[i], got[i])) continue
  console.log('panel', i, want[i].date, got[i].date)
  console.log(' items', want[i].items.length, got[i].items.length)
  for (let j = 0; j < Math.max(want[i].items.length, got[i].items.length); j++) {
    const a = want[i].items[j], b = got[i].items[j]
    if (!isDeepStrictEqual(a, b)) {
      console.log('  idx', j, '\n   want', JSON.stringify(a), '\n   got ', JSON.stringify(b))
    }
  }
}
