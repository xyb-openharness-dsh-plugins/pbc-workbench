import { readFileSync } from 'node:fs'
import { loadDeclarations } from '../test/_extract.mjs'
const src = readFileSync('public/app.js', 'utf8')
const got = loadDeclarations(src, ['num', 'GRADE_CODES', 'gradeOf'])
console.log('gradeOf type', typeof got.gradeOf)
console.log(got.gradeOf({ code: 'ALP', value: 286, refHigh: 120 }))
console.log(got.gradeOf({ code: 'ALP', value: 120, refHigh: 40 }))
console.log(got.gradeOf({ code: 'ALP', value: 120.1, refHigh: 40 }))
console.log(got.gradeOf({ code: 'ALP', value: 212, refHigh: null }))
