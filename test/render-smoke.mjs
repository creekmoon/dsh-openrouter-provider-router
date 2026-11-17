/**
 * 渲染冒烟：无浏览器环境下用最小 React 钩子桩，把页面组件在若干真实状态下跑一遍，
 * 确认不抛错、结构对（左主线 / 右侧栏 / 已指定逐行可移除）。
 * 只验证“会不会崩、结构对不对”，不验证像素。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginDir = fileURLToPath(new URL('..', import.meta.url))
const raw = readFileSync(join(pluginDir, 'client.js'), 'utf8')

let factory
globalThis.window = {
  __ModuleLoader__: {
    load(definition) { factory = definition.factory },
  },
}

/* 最小 React 桩：useState 由外部脚本按顺序喂值，其余钩子直接执行或返回 */
const hookScript = { states: [], index: 0, effects: [] }
const React = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children: children.flat(Infinity) }
  },
  useState(initial) {
    const index = hookScript.index++
    const value = index < hookScript.states.length ? hookScript.states[index] : initial
    return [value, () => {}]
  },
  useEffect(callback) { hookScript.effects.push(callback); return undefined },
  useRef(initial) { hookScript.index++; return { current: initial } },
  useMemo(factoryFn) { return factoryFn() },
  useCallback(fn) { return fn },
}

function requireStub(name) {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
}

globalThis.eval(raw)
if (factory === undefined) throw new Error('client module did not register')

const dictionaries = []
const registered = []
const ctx = {
  effect(factoryFn) { return factoryFn() },
  locale: {
    register(ns, dicts) { dictionaries.push({ ns, dicts }); return () => {} },
    bind() { return (key) => (dictionaries[0]?.dicts?.zh?.[key] ?? key) },
  },
  slots: {
    inject(key, callback) { return callback() },
    register(options, component) { registered.push({ options, component }); return () => {} },
  },
}

const plugin = factory(requireStub)
plugin.apply(ctx)
console.log('· 注册：' + registered.map(entry => entry.options.id + ' order=' + entry.options.order).join(', '))
console.log('· 文案键数：' + Object.keys(dictionaries[0].dicts.zh).length)

const component = registered[0].component

const PROVIDERS = [
  { tag: 'wafer/us', providerName: 'Wafer', quantization: 'mxfp4', contextLength: 1048576, maxCompletionTokens: 943718, promptPerMillion: 0.036, completionPerMillion: 0.5, uptimeLast30m: 100, degraded: false },
  { tag: 'stepfun/fp8', providerName: 'StepFun', quantization: 'fp8', contextLength: 1000000, maxCompletionTokens: 384000, promptPerMillion: 0.105, completionPerMillion: 0.42, uptimeLast30m: 99.8, degraded: false },
  { tag: 'fireworks/spot', providerName: 'Fireworks', quantization: '', contextLength: 1048576, maxCompletionTokens: 943718, promptPerMillion: 0.21, completionPerMillion: 0.84, uptimeLast30m: null, degraded: true },
]
const RULES = {
  'deepseek/deepseek-v4.1-flash-1017': { only: ['stepfun/fp8'], allowFallbacks: false },
  '~deepseek/deepseek-flash-latest': { only: ['wafer/us', 'deepseek'], allowFallbacks: true },
}
const STATE = {
  rules: RULES,
  defaultSelection: { provider: 'openrouter', model: '~deepseek/deepseek-flash-latest' },
  policyFile: 'C:/Users/JY/.dsh/openrouter-provider.json',
  allModelsKey: '*',
}
const CATALOG = {
  model: 'deepseek/deepseek-v4.1-flash-1017',
  source: 'api',
  specs: { name: 'DeepSeek: DeepSeek V4.1 Flash 1017', contextWindow: 1048576, maxCompletionTokens: 384000, inputModalities: ['text', 'image'], outputModalities: ['text'], reasoning: true },
  emptyReason: undefined,
  providers: PROVIDERS,
}
const MODELS = [
  { id: 'deepseek/deepseek-v4.1-flash-1017', name: 'DeepSeek: DeepSeek V4.1 Flash 1017', contextWindow: 1048576, promptPerMillion: 0.036, completionPerMillion: 0.5, alias: false, router: false },
  { id: '~deepseek/deepseek-flash-latest', name: 'DeepSeek: DeepSeek Flash Latest', contextWindow: 1048576, promptPerMillion: 0.036, completionPerMillion: 0.5, alias: true, router: false },
  { id: 'openrouter/auto', name: 'Auto Router', contextWindow: 2000000, promptPerMillion: -1000000, completionPerMillion: -1000000, alias: false, router: true },
]

/* 钩子顺序（与组件源码一致）：useRef, 22 个 state, useCallback, useEffect, useMemo */
function stateVector(overrides) {
  const base = [
    undefined,                            // 0  useRef
    'ready',                              // 1  phase
    STATE,                                // 2  state
    null,                                 // 3  notice
    false,                                // 4  dirty
    'deepseek/deepseek-v4.1-flash-1017',  // 5  model
    'model',                              // 6  scope
    ['stepfun/fp8'],                      // 7  selected
    false,                                // 8  allowFallbacks
    CATALOG,                              // 9  catalog
    'ready',                              // 10 catalogPhase
    null,                                 // 11 catalogError
    '',                                   // 12 providerFilter
    '',                                   // 13 manualInput
    null,                                 // 14 manualError
    '',                                   // 15 manualModel
    false,                                // 16 busy
    false,                                // 17 pickerOpen
    null,                                 // 18 modelCatalog
    'idle',                               // 19 modelCatalogPhase
    null,                                 // 20 modelCatalogError
    '',                                   // 21 modelFilter
    false,                                // 22 confirmRemove
  ]
  for (const [index, value] of Object.entries(overrides)) base[Number(index)] = value
  return base
}

function render(states) {
  hookScript.states = states
  hookScript.index = 0
  return component({})
}

function flatten(node, out = []) {
  if (node === null || node === undefined || node === false) return out
  if (Array.isArray(node)) { for (const child of node) flatten(child, out); return out }
  if (typeof node === 'object' && 'type' in node) {
    out.push(node)
    for (const child of node.children ?? []) flatten(child, out)
  }
  return out
}

function textOf(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return (node.children ?? []).map(textOf).join('')
}

function gridChildren(node) {
  return (node?.children ?? []).filter(child => child !== null && child !== undefined && child !== false && typeof child === 'object')
}

const failures = []
function check(name, condition, detail) {
  if (condition) console.log('PASS ' + name)
  else { failures.push(name); console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}

const scenarios = [
  ['默认（就绪、已指定 1 家）', stateVector({})],
  ['加载中', stateVector({ 10: 'loading' })],
  ['加载失败', stateVector({ 10: 'error', 11: '接口：目录里没有该模型；模型页：HTTP 404' })],
  ['别名模型（空清单）', stateVector({ 5: '~deepseek/deepseek-flash-latest', 7: [], 9: { ...CATALOG, providers: [], emptyReason: 'alias' } })],
  ['路由模型（空清单）', stateVector({ 5: 'openrouter/auto', 7: [], 9: { ...CATALOG, providers: [], emptyReason: 'router' } })],
  ['清单为空', stateVector({ 7: [], 9: { ...CATALOG, providers: [], emptyReason: 'none' } })],
  ['筛选无结果', stateVector({ 12: 'zzz' })],
  ['模型面板展开', stateVector({ 17: true, 18: MODELS, 19: 'ready' })],
  ['模型目录加载中', stateVector({ 17: true, 19: 'loading' })],
  ['清除确认态', stateVector({ 22: true })],
  ['保存警告', stateVector({ 3: { tone: 'warn', text: '已保存，但默认模型不同' } })],
  ['所有模型范围', stateVector({ 6: 'all', 7: ['stepfun/fp8', 'my/custom'] })],
  ['清单外的 slug', stateVector({ 7: ['stepfun/fp8', 'my/custom'] })],
  ['未指定任何供应商', stateVector({ 7: [] })],
  ['手动输入非法', stateVector({ 13: 'bad slug!!', 14: '格式不正确：bad slug!!' })],
]

for (const [label, states] of scenarios) {
  try {
    const tree = render(states)
    const nodes = flatten(tree)
    check(`渲染「${label}」不抛错（节点 ${nodes.length}）`, nodes.length > 20)
  } catch (error) {
    check(`渲染「${label}」不抛错`, false, error.message)
  }
}

/* 结构核对：左主线 / 右侧栏，已指定逐行可移除 */
try {
  const tree = render(stateVector({}))
  const nodes = flatten(tree)
  const work = nodes.find(node => node.props?.className === 'dop-work')
  const columns = gridChildren(work)
  check('工作面是两栏', columns.length === 2, String(columns.length))
  const [main, rail] = columns
  check('左列是主线', main?.props?.className === 'dop-main', main?.props?.className)
  check('右列是侧栏', rail?.type === 'aside' && rail?.props?.className === 'dop-rail', String(rail?.type))

  const railRows = flatten(rail).filter(node => node.props?.className === 'dop-railRow')
  check('侧栏列出全部候选', railRows.length === PROVIDERS.length, String(railRows.length))
  const railRowTexts = railRows.map(node => textOf(node))
  console.log('· 侧栏首行：' + railRowTexts[0])
  check('侧栏行含输入/输出价格', /\d+\s*\/\s*\d+/.test(railRowTexts[1]), railRowTexts[1])
  check('侧栏行含精度与上下文', railRowTexts[1].includes('精度 fp8') && railRowTexts[1].includes('上下文 1M'), railRowTexts[1])
  check('侧栏行含状态异常标记', railRowTexts[2].includes('状态异常'), railRowTexts[2])
  check('已勾选行带 data-checked', railRows[1]?.props?.['data-checked'] === 'true', String(railRows[1]?.props?.['data-checked']))
  const railFilter = flatten(rail).find(node => node.type === 'input' && node.props?.className === 'dop-input')
  check('侧栏有筛选输入框', railFilter !== undefined && railFilter.props.value === '')

  const pins = flatten(main).filter(node => node.props?.className === 'dop-pin')
  check('已指定按 selected 渲染', pins.length === 1, String(pins.length))
  const pinText = textOf(pins[0])
  console.log('· 已指定一行：' + pinText)
  check('已指定含 slug 与精度', pinText.includes('stepfun/fp8') && pinText.includes('精度 fp8'), pinText)
  check('已指定含上下文与上限', pinText.includes('上下文 1,000,000') && pinText.includes('上限 384,000'), pinText)
  check('已指定含可用性', pinText.includes('可用性 99.8%'), pinText)
  check('已指定含输入/输出价格', pinText.includes('$0.105 / $0.42'), pinText)
  const removeButton = flatten(pins[0]).find(node => node.props?.className === 'dop-pinRemove')
  check('已指定行有移除按钮', removeButton !== undefined && String(removeButton.props['aria-label']).includes('移除'), String(removeButton?.props?.['aria-label']))

  const manualInput = nodes.find(node => node.type === 'input' && node.props?.id === 'dop-manual')
  check('主线有手填输入框', manualInput !== undefined && manualInput.props.placeholder === 'stepfun/fp8', String(manualInput?.props?.placeholder))
  check('手填输入框有关联 label', nodes.some(node => node.type === 'label' && node.props?.htmlFor === 'dop-manual'))

  const headText = textOf(main)
  check('计数显示“已选 1 / 共 3 家”', headText.includes('已选 1 / 共 3 家'), headText.slice(0, 40))
} catch (error) {
  check('结构核对', false, error.message)
}

/* 空状态：未指定任何供应商 */
try {
  const nodes = flatten(render(stateVector({ 7: [] })))
  const empty = nodes.find(node => node.props?.className === 'dop-empty')
  check('空状态出现', empty !== undefined && textOf(empty).includes('还没有指定供应商'), textOf(empty))
  check('空状态时没有已指定列表', nodes.every(node => node.props?.className !== 'dop-pins'))
} catch (error) {
  check('空状态核对', false, error.message)
}

/* 清单外的 slug：就地提示拼写风险 */
try {
  const nodes = flatten(render(stateVector({ 7: ['stepfun/fp8', 'my/custom'] })))
  const pins = nodes.filter(node => node.props?.className === 'dop-pin')
  const unknownPin = pins.find(node => node.props?.['data-unknown'] === 'true')
  check('清单外 slug 单独标出', unknownPin !== undefined && textOf(unknownPin).includes('清单里没有这个 slug'), textOf(unknownPin))
  check('清单外 slug 给出解释', textOf(unknownPin).includes('拼写可能有误'), textOf(unknownPin))
} catch (error) {
  check('清单外 slug 核对', false, error.message)
}

/* 侧栏各状态：加载 / 失败 / 别名 / 筛选无结果 / 所有模型 */
try {
  const loading = flatten(render(stateVector({ 10: 'loading' })))
  check('加载中：侧栏有骨架与说明', loading.some(node => node.props?.className === 'dop-railSkeleton') && textOf(loading.find(node => node.props?.className === 'dop-railSkeleton')).length >= 0 && loading.some(node => textOf(node).includes('正在读取供应商清单')))

  const failed = flatten(render(stateVector({ 10: 'error', 11: '接口：目录里没有该模型' })))
  check('失败：侧栏给出重试', failed.some(node => node.type === 'button' && textOf(node) === '重试') && failed.some(node => textOf(node).includes('接口：目录里没有该模型')))

  const alias = flatten(render(stateVector({ 5: '~deepseek/deepseek-flash-latest', 7: [], 9: { ...CATALOG, providers: [], emptyReason: 'alias' } })))
  check('别名：侧栏就地引导选具体模型', alias.some(node => textOf(node).includes('别名/路由模型没有固定供应商')) && alias.some(node => node.type === 'button' && textOf(node) === '选具体模型'))

  const filtered = flatten(render(stateVector({ 12: 'zzz' })))
  check('筛选无结果有兜底文案', filtered.some(node => textOf(node) === '没有匹配的供应商'))

  const allScope = flatten(render(stateVector({ 6: 'all', 7: ['my/custom'] })))
  const allRail = flatten(allScope.find(node => node.props?.className === 'dop-rail'))
  const scopeInput = allRail.find(node => node.type === 'input' && node.props?.className === 'dop-input')
  check('所有模型范围：侧栏筛选禁用并说明', scopeInput?.props?.disabled === true && allRail.some(node => textOf(node).includes('直接手填 slug')))
} catch (error) {
  check('侧栏状态核对', false, error.message)
}

console.log(failures.length === 0 ? '\nALL RENDER SMOKE CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED`)
process.exitCode = failures.length === 0 ? 0 : 1
