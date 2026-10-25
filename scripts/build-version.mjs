#!/usr/bin/env node
/**
 * 生成 lib/version.js。
 *
 * 唯一来源是仓库根目录的 VERSION。build / commit 来自 git；没有 git 时写 local，
 * 不猜日期、不编造哈希。生成结果确定：同一次提交重复跑不会改动文件（幂等）。
 *
 * 用法：
 *   node scripts/build-version.mjs           写入（内容没变不落盘）
 *   node scripts/build-version.mjs --check   只校验，与 VERSION 不一致时退出码 1
 *
 * 渠道由环境变量 DUCTPAL_CHANNEL 指定，三选一：prototype / beta / stable。
 * 本仓当前是 beta（开发版：可跑、未装机）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'lib', 'version.js')
const checkOnly = process.argv.includes('--check')

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const CHANNELS = ['prototype', 'beta', 'stable']
const CHANNEL_LABELS = {
  prototype: '交互原型 · 未接入 DSH',
  beta: '测试版 · 数据仅在本机',
  stable: '正式版 · 数据仅在本机',
}

const raw = readFileSync(join(root, 'VERSION'), 'utf8').trim()

/** 代码层面的守卫：版本号格式错，生成器自己先拒绝，而不是写一份坏的 version.js。 */
export function versionProblems(text) {
  if (!SEMVER.test(text)) return [`VERSION 不是合法语义化版本：${text}`]
  return []
}

const problems = versionProblems(raw)
if (problems.length) {
  console.error(`✗ ${problems.join('；')}`)
  process.exit(1)
}

const channel = process.env.DUCTPAL_CHANNEL || 'beta'
if (!CHANNELS.includes(channel)) {
  console.error(`✗ DUCTPAL_CHANNEL 只能是 ${CHANNELS.join(' / ')}，收到：${channel}`)
  process.exit(1)
}

function git(args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const commit = git(['rev-parse', '--short', 'HEAD']) || 'local'
const build = git(['log', '-1', '--format=%cs']) || 'local'

const generated = `// 本文件由 scripts/build-version.mjs 生成，请勿手改。
// 唯一来源：仓库根目录的 VERSION。改版本先改 VERSION，再跑 npm run build:version。
export const version = '${raw}'
export const build = '${build}'
export const channel = '${channel}'
export const commit = '${commit}'

export const displayVersion = \`v\${version}\`
export const channelLabel = '${CHANNEL_LABELS[channel]}'

export const APP_INFO = Object.freeze({
  version,
  displayVersion,
  build,
  channel,
  channelLabel,
  commit,
})
`

if (checkOnly) {
  if (!existsSync(target)) {
    console.error('✗ 缺少 lib/version.js，请先运行 npm run build:version')
    process.exit(1)
  }
  /* build / commit 是随提交变化的易变量：提交后必然与 HEAD 不同，
     比较全文会让 check 在每次提交后必失败。只比较稳定字段。 */
  const stable = (text) => text.replace(/^export const (build|commit) = '.*'$/gm, '')
  if (stable(readFileSync(target, 'utf8')) !== stable(generated)) {
    console.error('✗ lib/version.js 与 VERSION 不同步，请运行 npm run build:version')
    process.exit(1)
  }
  console.log(`✓ lib/version.js 与 VERSION 同步：v${raw}（build ${build} · ${channel}）`)
  process.exit(0)
}

if (existsSync(target) && readFileSync(target, 'utf8') === generated) {
  console.log(`= lib/version.js 未变化：v${raw}（build ${build} · ${channel}）`)
  process.exit(0)
}

writeFileSync(target, generated)
console.log(`✓ 已生成 lib/version.js：v${raw}（build ${build} · ${channel}）`)
