/**
 * 静态审计：文案键必须两侧都存在、结构保持三视图，视觉沿用宿主设置页的官方尺寸。
 * 尺寸依据见 README「设计规格」一节；这里只做字符串层面的硬约束。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))
const moduleId = /__ModuleLoader__\.load\(\{\s*(?:\/\/[^\n]*\n\s*)?id: '([^']+)'/.exec(source)

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

/* 双语闸门：界面文案只能来自字典，字典外不得再出现中文（注释不算文案） */
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/
const code = source.slice(enEnd).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const enBlock = source.slice(enStart, enEnd)
const localeOf = id => JSON.parse(readFileSync(fileURLToPath(new URL(`../locale/${id}.json`, import.meta.url)), 'utf8'))
const zhMeta = localeOf('zh').meta
const enMeta = localeOf('en').meta

const i18nChecks = [
  ['字典外没有中文文案', !CJK.test(code)],
  ['英文字典不含中文', !CJK.test(enBlock)],
  ['中英元数据都写了标题与描述', [zhMeta, enMeta].every(meta => String(meta?.title ?? '') !== '' && String(meta?.description ?? '') !== '')],
  ['中文元数据确实是中文', CJK.test(zhMeta.title + zhMeta.description)],
  ['英文元数据不含中文', !CJK.test(enMeta.title + enMeta.description)],
]
for (const [name, ok] of i18nChecks) console.log((ok ? 'PASS ' : 'FAIL ') + name)
if (i18nChecks.some(([, ok]) => !ok)) process.exitCode = 1

/* CSS 块：从 const CSS = ` 到终止反引号 */
const cssStart = source.indexOf('const CSS = `')
const cssEnd = source.indexOf('\n`\n', cssStart)
if (cssStart < 0 || cssEnd < 0) throw new Error('css block not found')
const css = source.slice(cssStart, cssEnd)

/* 设计闸门：宿主设计语言 + 官方设置页尺寸 */
const dashedBlocks = [...css.matchAll(/\.dop-[A-Za-z]+\s*\{([^}]*)\}/g)].filter(match => match[1].includes('dashed'))
const designChecks = [
  ['无 transition: all', !css.includes('transition: all')],
  ['虚线只出现在空态与新建槽（宿主同款）', dashedBlocks.length === 2 && dashedBlocks.every(match => /\.dop-(add|empty)\s*\{/.test(match[0]))],
  ['单一深度策略（无阴影）', !css.includes('box-shadow')],
  ['无字面色值', !/#[0-9a-fA-F]{3,8}\b/.test(css)],
  ['无 scale(0) 进场', !/scale\(0\)/.test(css)],
  ['可按压元素有 :active', css.includes(':active')],
  ['价格与 token 数用 tabular-nums', css.includes('tabular-nums')],
  ['骨架与开关尊重 reduced-motion', css.includes('prefers-reduced-motion')],
  ['动效只碰 transform/背景色', !/transition:[^;]*(width|height|top|left|margin|padding)/.test(css)],
  ['标题 16/24 500（官方区块标题）', /\.dop-title \{[^}]*font-size: 16px; line-height: 24px; font-weight: 500/.test(css)],
  ['输入 32 高 r12（官方 .input）', /\.dop-input \{[^}]*height: 32px/.test(css) && /\.dop-input \{[^}]*border-radius: var\(--dsw-radius-md\)/.test(css)],
  ['紧凑按钮 28 高（官方行内动作）', /\.dop-compact \{[^}]*height: 28px/.test(css) && /\.dop-compact \{[^}]*border-radius: var\(--dsw-radius-sm\)/.test(css)],
  ['主按钮 36 高（官方 .primaryButton）', /\.dop-primary \{[^}]*height: 36px/.test(css)],
  ['卡片 0.5px 发丝线 + r20（官方 .rowCard）', /\.dop-card \{[^}]*border: 0\.5px solid var\(--dsw-alias-border-l4\)[^}]*border-radius: var\(--dsw-radius-xl\)/.test(css)],
  ['内嵌块 r16（官方 .editor）', /\.dop-inset \{[^}]*border-radius: var\(--dsw-radius-lg\)[^}]*background: var\(--dsw-alias-bg-module-platform\)/.test(css)],
  ['无吸底操作条', !css.includes('position: sticky')],
]
for (const [name, ok] of designChecks) console.log((ok ? 'PASS ' : 'FAIL ') + name)
if (designChecks.some(([, ok]) => !ok)) process.exitCode = 1

const checks = [
  ['模块 id 等于包名（宿主按包名请求浏览器模块）', moduleId?.[1] === manifest.name, `${moduleId?.[1]} vs ${manifest.name}`],
  ['useEffect 只调用一次', (source.match(/useEffect\(/g) ?? []).length === 1],
  ['输入聚焦用官方边框色，不覆盖焦点环', source.includes('.dop-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }')],
  ['卡片用 settings-card 令牌', source.includes('--dsw-alias-settings-card-fill')],
  ['hover 用交互令牌', source.includes('--dsw-alias-interactive-bg-hover')],
  ['三视图状态机', source.includes("view === 'picker'") && source.includes("view === 'editor'") && source.includes("view: 'list'")],
  ['清单页有新建槽', source.includes("className: 'dop-add'")],
  ['新建槽在列表末位', source.indexOf("className: 'dop-add'") > source.indexOf('savedRows.map(renderRuleCard)')],
  ['供应商是表格而不是侧栏', source.includes("className: 'dop-columns'") && !source.includes('dop-rail')],
  ['表格按输入价排序', source.includes('sortProvidersByPrice')],
  ['作用范围并进模型选择', source.includes('chooseModel(ALL_MODELS)')],
  ['保存与取消在编辑页底部', source.includes("className: 'dop-footer'") && source.includes("t('save')")],
  ['删除需二次确认', source.includes('confirmDelete') && source.includes("t('confirmDelete')")],
  ['清单外 slug 就地提示', source.includes("t('notInCatalog')") && source.includes("t('notInCatalogHint')")],
  ['已选供应商逐项可移除', source.includes('dop-tagButton') && source.includes("t('remove')")],
  ['手填输入有可访问名', source.includes("'aria-label': t('manualPlaceholder')")],
  ['别名/路由就地引导', source.includes("t('aliasTitle')") && source.includes("t('routerTitle')") && source.includes("t('pickConcrete')")],
  ['保存前要求至少一家', source.includes('providerTags.length > 0') && source.includes("t('atLeastOne')")],
  ['窄容器收成三列', source.includes('@container (max-width: 520px)') && css.includes('.dop-colOut, .dop-colUptime { display: none; }')],
  ['非 OpenRouter 默认模型不自动套用', source.includes("selection?.provider !== 'openrouter'")],
]
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name)
if (checks.some(([, ok]) => !ok)) process.exitCode = 1

/* 每个写死的 className 都要有对应样式，避免改名后静默丢样式 */
const usedClasses = new Set(
  [...source.matchAll(/className: '([^']+)'/g)]
    .flatMap(match => match[1].split(/\s+/))
    .filter(name => name.startsWith('dop-')),
)
const missingClasses = [...usedClasses].filter(name => !css.includes('.' + name))
console.log((missingClasses.length === 0 ? 'PASS ' : 'FAIL ') + '样式覆盖所有 className')
if (missingClasses.length > 0) {
  console.log('  缺少样式：' + missingClasses.join(', '))
  process.exitCode = 1
}

