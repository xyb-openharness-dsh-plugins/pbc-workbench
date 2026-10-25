#!/usr/bin/env node
/**
 * 语法门：仓库里所有"会被执行"的 JavaScript 都过一次 `node --check`。
 *
 * 为什么扫目录而不是列文件名：`npm run check` 早期是一串手写文件名，
 * 每新增 `dsh/readmodels.js`、`dsh/import.js`、`scripts/*.mjs` 就漏一个，
 * 而语法错误只有在真启动时才暴露（那时已经提交了）。改成扫目录，新增文件自动纳入。
 *
 * 范围：`dsh/`、`lib/`、`public/`、`src/`、`scripts/`、`test/`、`demo/`、`research/`。
 * **不扫 `prototypes/`**：那是 G2 签认的视觉基准，原型语法问题会在
 * `scripts/build-public.mjs`（它要读原型做定点替换）那一刻暴露，不在这里顺带兜。
 *
 * 用法：node scripts/check-syntax.mjs    （退出码 0 全通 / 1 有语法错误）
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = ['dsh', 'lib', 'public', 'src', 'scripts', 'test', 'demo', 'research']
const EXT = new Set(['.js', '.mjs'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const info = statSync(full)
    if (info.isDirectory()) walk(full, out)
    else if (EXT.has(full.slice(full.lastIndexOf('.')))) out.push(full)
  }
  return out
}

const files = []
for (const target of TARGETS) {
  try {
    if (statSync(join(root, target)).isDirectory()) walk(join(root, target), files)
  } catch {
    // 目录不存在就跳过（精简包只带 dsh/ 与 lib/）
  }
}

let failed = 0
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] })
  } catch (error) {
    failed += 1
    const firstLine = String(error.stderr ?? '').split('\n').find((line) => line.trim()) ?? '语法错误'
    console.error(`✗ ${relative(root, file)}`)
    console.error(`  ${firstLine.trim()}`)
  }
}

if (failed) {
  console.error(`\n✗ 语法检查失败：${failed} / ${files.length} 个文件`)
  process.exit(1)
}
console.log(`✓ 语法检查通过（${files.length} 个文件）`)
