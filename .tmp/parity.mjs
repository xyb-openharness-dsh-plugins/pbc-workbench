import { readFileSync } from 'node:fs'
import { Workbench } from '/Users/sammini/Downloads/pbc-workbench/dsh/workbench.js'
const src = readFileSync('prototypes/v0.2/demo-data.js', 'utf8')
const window = {}
new Function('window', src)(window)
const demo = window.DEMO
const wb = await Workbench.open(null)
const boot = wb.bootstrap()
console.log('demo profiles', demo.profiles.length, 'boot profiles', boot.profiles.length)
// compare keys
const a = demo.profiles.map(p => p.key).join(','), b = boot.profiles.map(p => p.key).join(',')
console.log('keys same?', a === b, a, b)
const A = demo.profiles[0], B = boot.profiles[0]
const ka = Object.keys(A), kb = Object.keys(B)
console.log('proto keys == boot keys?', JSON.stringify(ka) === JSON.stringify(kb))
console.log('proto', ka.join(','))
console.log('boot ', kb.join(','))
