/**
 * 文档检查：中英双份 README 必须互相可达，截图路径必须存在，标签词必须与 package.json 一致。
 * 只守能自动验证的硬事实，不评价文案；新增截图或改包名时这里会先报错。
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)
const read = name => readFileSync(fileURLToPath(new URL(name, root)), 'utf8')
const manifest = JSON.parse(read('package.json'))
const zh = read('README.md')
const en = read('README.en.md')
const topicsLine = /GitHub topics[：:]\s*([^。\n]+)/.exec(zh)?.[1] ?? ''
const topics = [...topicsLine.matchAll(/`([^`]+)`/g)].map(match => match[1])
const screenshotsOf = text => [...text.matchAll(/\]\((docs\/screenshots\/[^)]+)\)/g)].map(match => match[1])

const zhShots = screenshotsOf(zh)
const enShots = screenshotsOf(en)
const checks = [
  ['中文 README 链到英文版', zh.includes('[English](README.en.md)')],
  ['英文 README 链到中文版', en.includes('[中文](README.md)')],
  ['两份都写了克隆地址', [zh, en].every(text => text.includes('git clone https://github.com/creekmoon/dsh-openrouter-provider-router.git'))],
  ['两份都写了包名', [zh, en].every(text => text.includes(manifest.name))],
  ['两份都写了离线检查命令', [zh, en].every(text => text.includes('node test/run.mjs'))],
  ['两份引用同一组截图', zhShots.length === 3 && enShots.length === 3 && zhShots.every((shot, index) => shot === enShots[index])],
  ['引用的截图都真实存在', [...zhShots, ...enShots].every(shot => existsSync(fileURLToPath(new URL(shot, root))))],
  ['标签词与 package.json 关键词一致', topics.length >= 5 && topics.length === manifest.keywords.length && topics.every(topic => manifest.keywords.includes(topic))],
]

for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name)
if (checks.some(([, ok]) => !ok)) {
  process.exitCode = 1
} else {
  console.log('ALL DOC CHECKS PASSED')
}
