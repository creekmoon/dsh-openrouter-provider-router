/**
 * 离线检查的统一入口。每个子脚本自己打印 PASS/FAIL 并以非零码退出。
 * verify-catalog.mjs 不在其中：它会真实请求 openrouter.ai。
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const here = fileURLToPath(new URL('.', import.meta.url))
const scripts = [
  ['Host 半：fetch 注入、RPC、落盘', 'verify-host.mjs'],
  ['客户端：文案键与设计闸门', 'audit-client.mjs'],
  ['布局几何：564px 内容列与表格列宽', 'check-layout.mjs'],
  ['渲染冒烟：状态与结构', 'render-smoke.mjs'],
  ['文档：中英双份 README 与标签词', 'check-docs.mjs'],
]

let failed = 0
for (const [label, file] of scripts) {
  console.log(`\n=== ${label} :: test/${file} ===`)
  const result = spawnSync(process.execPath, [join(here, file)], { stdio: 'inherit' })
  if (result.status !== 0) {
    failed += 1
    console.log(`FAILED test/${file}`)
  }
}

console.log(failed === 0 ? '\nALL TEST FILES PASSED' : `\n${failed} TEST FILE(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1
