/**
 * 布局几何核对：设置面板真实内容宽 => 两栏（主线 + 侧栏）各得多少像素。
 * 面板 800px = 188px 导航 + 24px*2 内边距 => 内容列 564px。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')
const failures = []
function check(name, ok, detail) {
  if (ok) console.log('PASS ' + name + (detail ? ' :: ' + detail : ''))
  else { failures.push(name); console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}

const work = /\.dop-work \{ display: grid; grid-template-columns: minmax\(0, 1fr\) (\d+)px; gap: (\d+)px;/.exec(source)
const rail = /\.dop-rail \{ display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: (\d+)px;/.exec(source)
const railRow = /\.dop-railRow \{ display: grid; grid-template-columns: (\d+)px minmax\(0, 1fr\); gap: (\d+)px;/.exec(source)
const pin = /\.dop-pin \{ display: grid; grid-template-columns: (\d+)px minmax\(0, 1fr\); gap: (\d+)px; align-items: start; padding: (\d+)px (\d+)px (\d+)px (\d+)px;/.exec(source)
const stackQuery = /@container \(max-width: (\d+)px\) \{\s*\n\s*\.dop-work \{ grid-template-columns: minmax\(0, 1fr\);/.exec(source)

check('找到两栏模板', work !== null, work?.[0])
check('找到侧栏内距', rail !== null, rail?.[1])
check('找到侧栏行模板', railRow !== null, railRow?.[0])
check('找到已指定行模板', pin !== null, pin?.[0])
check('找到窄容器单列断点', stackQuery !== null, stackQuery?.[1])

const CONTENT = 564
const railWidth = Number(work?.[1])
const gap = Number(work?.[2])
const mainWidth = CONTENT - railWidth - gap
console.log(`\n[564px 内容列] 侧栏=${railWidth}px 间距=${gap}px 主线=${mainWidth}px`)
check('侧栏 240 档', railWidth === 240, railWidth + 'px')
check('主线仍有 300px 量级（≥280）', mainWidth >= 280, mainWidth + 'px')

/* 侧栏内部：复选框 + 行内容；行内容再分名称与价格 */
const railPadding = Number(rail?.[1])
const railInner = railWidth - 2 - railPadding * 2
const railBox = Number(railRow?.[1])
const railGap = Number(railRow?.[2])
const railMain = railInner - railBox - railGap
const priceText = '0.105 / 0.42'
const priceWidth = Math.ceil(priceText.length * 6.1)
const railName = railMain - 8 - priceWidth
const metaText = 'stepfun/fp8 · 精度 fp8 · 上下文 1.05M'
console.log(`\n[侧栏内部] 内宽=${railInner}px 行内容=${railMain}px 价格≈${priceWidth}px 名称=${railName}px`)
check('名称列 ≥ 96px（截断即可读）', railName >= 96, railName + 'px')
check('名称列不塌陷', railName > 0, railName + 'px')
check('副行按省略号截断而不是溢出', source.includes('.dop-railMeta {') && /\.dop-railMeta \{[^}]*text-overflow: ellipsis/.test(source), metaText)

/* 主线内部：已指定行；价格靠右，名称留给左侧 */
const pinBox = Number(pin?.[1])
const pinGap = Number(pin?.[2])
const pinPadLeft = Number(pin?.[5])
const pinPadRight = Number(pin?.[4])
const pinInner = mainWidth - pinPadLeft - pinPadRight
const pinMain = pinInner - pinBox - pinGap
const pinPrice = Math.ceil('$0.105 / $0.42'.length * 6.6)
const pinName = pinMain - 8 - pinPrice
console.log(`\n[主线内部] 行内容=${pinMain}px 价格≈${pinPrice}px 名称=${pinName}px`)
check('已指定名称列 ≥ 120px', pinName >= 120, pinName + 'px')
check('已指定副行允许折行', /\.dop-pinMeta \{[^}]*word-break: break-word/.test(source))

/* 手填输入：主线减去添加按钮 */
const addButton = 64
const inputWidth = mainWidth - addButton - 8
console.log(`\n[手填输入] 输入框≈${inputWidth}px 添加按钮≈${addButton}px`)
check('输入框 ≥ 180px', inputWidth >= 180, inputWidth + 'px')

/* 结构：手填 -> 已指定 -> 侧栏 */
const fieldAt = source.indexOf("className: 'dop-field'")
const pinsAt = source.indexOf("className: 'dop-pins'")
const emptyAt = source.indexOf("className: 'dop-empty'")
const railCallAt = source.indexOf('renderRail()')
check('手填在已指定之前', fieldAt > 0 && fieldAt < pinsAt, `${fieldAt} < ${pinsAt}`)
check('已指定在侧栏之前', pinsAt > 0 && pinsAt < railCallAt, `${pinsAt} < ${railCallAt}`)
check('空状态与列表二选一', emptyAt > 0)

console.log(failures.length === 0 ? '\nALL LAYOUT CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED`)
process.exitCode = failures.length === 0 ? 0 : 1
