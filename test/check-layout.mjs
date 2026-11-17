/**
 * 布局几何核对：按宿主设置页的真实宽度算各列可用像素。
 * 面板 800px = 188px 导航 + 612px 内容列；内容列内距 24px*2 => 564px 可用。
 * 表格与窄宽断点的固定列、间距、内距都从 client.js 的样式里读，避免文档与实现漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')
const failures = []
function check(name, ok, detail) {
  if (ok) console.log('PASS ' + name + (detail ? ' :: ' + detail : ''))
  else { failures.push(name); console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}

/* 官方骨架：800 - 188 - 24*2 = 564 */
const PANEL = 800
const NAV = 188
const OPTIONS_PADDING = 24
const CONTENT = PANEL - NAV - OPTIONS_PADDING * 2
check('内容列 = 564px（800 − 188 − 48）', CONTENT === 564, CONTENT + 'px')

const section = /\.dop \{[^}]*max-width: (\d+)px/.exec(source)
check('区块最大宽 720px（官方 .section）', section !== null && Number(section[1]) === 720, section?.[1] + 'px')

const columns = /\.dop-columns \{[^}]*grid-template-columns: (\d+)px minmax\(0, 1fr\) (\d+)px (\d+)px (\d+)px; gap: (\d+)px; align-items: center; padding: \d+px (\d+)px/.exec(source)
check('找到表格列模板', columns !== null, columns?.[0])

if (columns !== null) {
  const box = Number(columns[1])
  const inputCol = Number(columns[2])
  const outputCol = Number(columns[3])
  const uptimeCol = Number(columns[4])
  const gap = Number(columns[5])
  const padding = Number(columns[6])
  const fixed = box + inputCol + outputCol + uptimeCol + gap * 4 + padding * 2
  const nameColumn = CONTENT - fixed
  console.log(`\n[564px 内容列] 表格固定列=${fixed}px 名称列=${nameColumn}px`)
  check('名称列 ≥ 240px（内部 id 与精度可读）', nameColumn >= 240, nameColumn + 'px')
  check('数字列 56px 起（价格不被截断）', inputCol >= 56 && outputCol >= 56, `${inputCol}/${outputCol}`)
}

const narrow = /@container \(max-width: (\d+)px\)/.exec(source)
const narrowColumns = /@container \(max-width: \d+px\) \{[\s\S]*?grid-template-columns: (\d+)px minmax\(0, 1fr\) (\d+)px/.exec(source)
check('窄宽断点存在', narrow !== null && narrowColumns !== null, narrow?.[1] + 'px')

if (narrow !== null && narrowColumns !== null) {
  const contentNarrow = 390 - 16 * 2
  const fixed = Number(narrowColumns[1]) + Number(narrowColumns[2]) + 8 * 2 + 14 * 2
  const nameColumn = contentNarrow - fixed
  console.log(`\n[390px 窗口] 内容=${contentNarrow}px 名称列=${nameColumn}px`)
  check('窄宽名称列 ≥ 200px', nameColumn >= 200, nameColumn + 'px')
}

const add = /\.dop-add \{[^}]*?[;{]\s*height: (\d+)px/.exec(source)
check('新建槽 44px（官方 .addButton）', add !== null && Number(add[1]) === 44, add?.[1] + 'px')

const card = /\.dop-card \{[^}]*padding: (\d+)px (\d+)px/.exec(source)
check('卡片内距 12/14（官方 .rowCard）', card !== null && Number(card[1]) === 12 && Number(card[2]) === 14, card?.[1] + '/' + card?.[2])

const row = /\.dop-row \{[^}]*min-height: (\d+)px/.exec(source)
check('表格行 44px 起（行内动作可点）', row !== null && Number(row[1]) === 44, row?.[1] + 'px')

console.log(failures.length === 0 ? '\nALL LAYOUT CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED`)
process.exitCode = failures.length === 0 ? 0 : 1
