import { openDatabase, migrate } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { bootstrap } from '../dsh/readmodels.js'
const db = openDatabase(':memory:')
migrate(db)
console.log(seedDemo(db))
const b = bootstrap(db, { version: '0.1.0', build: '2026-10-25' })
const A = b.profiles.A
console.log('keys', Object.keys(A).length, Object.keys(A).join(','))
console.log('fib', JSON.stringify(A.fibrosis))
console.log('labs0', JSON.stringify(A.labs[0].items[0]))
console.log('sep labs', JSON.stringify(A.labs.find(l=>l.date==='2026-09-08').items.find(i=>i.code==='ALP')))
console.log('screening0', JSON.stringify(A.screening[0]))
console.log('meds', JSON.stringify(A.meds))
console.log('trials', JSON.stringify(A.trials))
console.log('pathway0 detail keys', Object.keys(A.pathway[0].detail))
console.log('sourceStates', b.sourceStates.length)
console.log('demo_meta', JSON.stringify(b.demo_meta))
console.log('docs', JSON.stringify(A.documents))
console.log('questions', JSON.stringify(A.questions))
