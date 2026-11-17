/**
 * Static audit of the client half: every t('key') must exist in both dictionaries,
 * and the structure must keep the agreed shape (手填主线 + 右侧栏).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')

const zhStart = source.indexOf('const zh = {')
const enStart = source.indexOf('const en = {')
const enEnd = source.indexOf('const CSS = `')
if (zhStart < 0 || enStart < 0 || enEnd < 0) throw new Error('dictionary blocks not found')

function keysOf(block) {
  const keys = new Set()
  for (const match of block.matchAll(/^\s{6}([A-Za-z][A-Za-z0-9]*): /gm)) keys.add(match[1])
  return keys
}

const zhKeys = keysOf(source.slice(zhStart, enStart))
const enKeys = keysOf(source.slice(enStart, enEnd))
const used = new Set([...source.matchAll(/t\('([A-Za-z][A-Za-z0-9]*)'\)/g)].map(match => match[1]))

const failures = []
for (const key of used) {
  if (!zhKeys.has(key)) failures.push('missing in zh: ' + key)
  if (!enKeys.has(key)) failures.push('missing in en: ' + key)
}
for (const key of zhKeys) if (!enKeys.has(key)) failures.push('zh-only key: ' + key)
for (const key of enKeys) if (!zhKeys.has(key)) failures.push('en-only key: ' + key)
for (const key of [...zhKeys].sort()) if (!used.has(key)) console.log('UNUSED ' + key)

console.log('zh keys=' + zhKeys.size + ' en keys=' + enKeys.size + ' used=' + used.size)
if (failures.length > 0) {
  for (const failure of failures) console.log('FAIL ' + failure)
  process.exitCode = 1
} else {
  console.log('ALL LOCALE KEYS RESOLVE')
}

/* 设计闸门：aglaea-design 的核心铁律静态核对 */
const cssBlock = source.slice(source.indexOf('const CSS = `'), source.indexOf('`\n\n    /**\n     * 调用 Host 的 RPC'))
const spacingValues = [...cssBlock.matchAll(/(?:padding|gap|margin)(?:-[a-z]+)?\s*:\s*([^;]+)/g)]
  .flatMap(match => [...match[1].matchAll(/(-?\d+)px/g)].map(value => Number(value[1])))
  .filter(value => value !== 0)
const offGrid = [...new Set(spacingValues.filter(value => value % 4 !== 0))].sort((a, b) => a - b)
const designChecks = [
  ['无 transition: all', !cssBlock.includes('transition: all')],
  ['无虚线边框', !cssBlock.includes('dashed')],
  ['单一深度策略（无阴影）', !cssBlock.includes('box-shadow')],
  ['无字面色值', !/#[0-9a-fA-F]{3,8}\b/.test(cssBlock)],
  ['无 scale(0) 进场', !/scale\(0\)/.test(cssBlock)],
  ['可按压元素有 :active', cssBlock.includes(':active')],
  ['价格与 token 数用 tabular-nums', cssBlock.includes('tabular-nums')],
  ['骨架屏尊重 reduced-motion', cssBlock.includes('prefers-reduced-motion')],
  ['动效只碰 transform/opacity/背景色', !/transition:[^;]*(width|height|top|left|margin|padding)/.test(cssBlock)],
]
for (const [name, ok] of designChecks) console.log((ok ? 'PASS ' : 'FAIL ') + name)
console.log('非 4px 网格的间距值：' + (offGrid.length === 0 ? '无' : offGrid.join(', ') + 'px'))
if (designChecks.some(([, ok]) => !ok)) process.exitCode = 1

const countOf = (needle) => [...source.matchAll(new RegExp(needle.replace(/[()'*+?.$^[\]{}|\\]/g, '\\$&'), 'g'))].length
const fieldAt = source.indexOf("className: 'dop-field'")
const pinsAt = source.indexOf("className: 'dop-pins'")
const railAt = source.indexOf('renderRail()')
const checks = [
  ['useEffect 只调用一次', (source.match(/useEffect\(/g) ?? []).length === 1],
  ['没有自定义 :focus outline', !source.includes(':focus { outline')],
  ['卡片用 settings-card 令牌', source.includes('--dsw-alias-settings-card-fill')],
  ['hover 用交互令牌', source.includes('--dsw-alias-interactive-bg-hover')],
  ['对象条常驻渲染', source.includes("className: 'dop-object'")],
  ['主线是手填（输入在已指定之前）', fieldAt > 0 && pinsAt > fieldAt],
  ['已指定在侧栏之前', pinsAt > 0 && railAt > pinsAt],
  ['在线挑选是右侧栏', source.includes("className: 'dop-rail'") && source.includes("className: 'dop-work'")],
  ['栏宽写在样式里', cssBlock.includes('grid-template-columns: minmax(0, 1fr) 240px')],
  ['窄容器收成单列', cssBlock.includes('@container (max-width: 540px)') && cssBlock.includes('.dop-work { grid-template-columns: minmax(0, 1fr);')],
  ['精度两侧都可见', countOf("t('colQuant')") >= 2],
  ['上下文两侧都可见', countOf("t('colContext')") >= 3],
  ['uptime 有类型守卫', source.includes('typeof row?.uptimeLast30m === \'number\'') && source.includes("t('colUptime')")],
  ['清单外 slug 就地提示', source.includes("t('notInCatalog')") && source.includes("t('notInCatalogHint')")],
  ['已指定可逐行移除', source.includes('dop-pinRemove') && source.includes("t('remove')")],
  ['手填输入有关联 label', source.includes("htmlFor: 'dop-manual'") && source.includes("id: 'dop-manual'")],
  ['旧多列表格已移除', !source.includes('dop-cellCol') && !source.includes('dop-rowLabel') && !source.includes('dop-table')],
  ['吸底操作条', source.includes('dop-actionbar') && source.includes('position: sticky')],
  ['别名/路由就地引导', source.includes("t('aliasTitle')") && source.includes("t('pickConcrete')")],
  ['清除指定有二次确认', source.includes('confirmRemove') && source.includes("t('confirmYes')")],
  ['换模型时同步规则', source.includes('syncFromState(state, ruleKeyOf(scope, id))')],
  ['非 OpenRouter 默认模型不自动加载', source.includes("selection.provider === 'openrouter'")],
]
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name)
if (checks.some(([, ok]) => !ok)) process.exitCode = 1
