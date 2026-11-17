/**
 * 渲染冒烟：无浏览器环境下用最小 React 钩子桩，把三视图在真实状态下各跑一遍。
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

/* 最小 React 桩：页面状态由外部按场景注入，钩子顺序为 useRef / useState / useEffect / useMemo*3 */
const hookScript = { page: null, effects: [] }
const React = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children: children.flat(Infinity) }
  },
  useRef(initial) { return { current: initial } },
  useState(initial) { return [hookScript.page ?? initial, () => {}] },
  useEffect(callback) { hookScript.effects.push(callback); return undefined },
  useMemo(factoryFn) { return factoryFn() },
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
  { tag: 'wafer/us', providerName: 'Wafer', quantization: 'mxfp4', contextLength: 1048576, promptPerMillion: 0.036, completionPerMillion: 0.5, uptimeLast30m: 100, degraded: false },
  { tag: 'stepfun/fp8', providerName: 'StepFun', quantization: 'fp8', contextLength: 1000000, promptPerMillion: 0.105, completionPerMillion: 0.42, uptimeLast30m: 99.8, degraded: false },
  { tag: 'fireworks/spot', providerName: 'Fireworks', quantization: '', contextLength: 1048576, promptPerMillion: 0.21, completionPerMillion: 0.84, uptimeLast30m: null, degraded: true },
]
const RULES = {
  '*': { only: ['deepseek'], allowFallbacks: true },
  'deepseek/deepseek-v4.1-flash-1017': { only: ['stepfun/fp8', 'wafer/us'], allowFallbacks: false },
}
const SNAPSHOT = {
  rules: RULES,
  defaultSelection: { provider: 'openrouter', model: 'deepseek/deepseek-v4.1-flash-1017' },
  policyFile: 'C:/Users/JY/.dsh/openrouter-provider.json',
  allModelsKey: '*',
}
const CATALOG = {
  model: 'deepseek/deepseek-v4.1-flash-1017',
  source: 'api',
  specs: { name: 'DeepSeek V4.1 Flash 1017', contextWindow: 1048576, maxCompletionTokens: 384000, inputModalities: ['text', 'image'] },
  emptyReason: undefined,
  providers: PROVIDERS,
}
const MODELS = [
  { id: 'deepseek/deepseek-v4.1-flash-1017', name: 'DeepSeek V4.1 Flash 1017', contextWindow: 1048576, promptPerMillion: 0.036, completionPerMillion: 0.5, alias: false, router: false },
  { id: '~deepseek/deepseek-flash-latest', name: 'DeepSeek Flash Latest', contextWindow: 1048576, promptPerMillion: 0.036, completionPerMillion: 0.5, alias: true, router: false },
  { id: 'openrouter/auto', name: 'Auto Router', contextWindow: 2000000, promptPerMillion: 0, completionPerMillion: 0, alias: false, router: true },
]

const BASE = {
  phase: 'ready',
  snapshot: SNAPSHOT,
  view: 'list',
  notice: null,
  busy: false,
  draft: { model: 'deepseek/deepseek-v4.1-flash-1017', providers: ['stepfun/fp8', 'wafer/us'], allowFallbacks: false },
  storedKey: '',
  confirmDelete: false,
  catalog: CATALOG,
  catalogPhase: 'ready',
  catalogError: null,
  manualInput: '',
  manualError: null,
  models: MODELS,
  modelsPhase: 'ready',
  modelsError: null,
  modelFilter: '',
  manualModel: '',
}

function pageWith(overrides) {
  return { ...BASE, ...overrides, draft: { ...BASE.draft, ...(overrides.draft ?? {}) } }
}

function render(page) {
  hookScript.page = page
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

const failures = []
function check(name, condition, detail) {
  if (condition) console.log('PASS ' + name)
  else { failures.push(name); console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}

const scenarios = [
  ['初始加载', null],
  ['清单（两条指定）', pageWith({})],
  ['清单（空）', pageWith({ snapshot: { ...SNAPSHOT, rules: {} } })],
  ['清单（错误提示）', pageWith({ notice: { tone: 'error', text: '读取设置失败：boom' } })],
  ['清单（保存警告）', pageWith({ notice: { tone: 'warn', text: '已保存，但当前默认模型是 x' } })],
  ['编辑（清单就绪）', pageWith({ view: 'editor' })],
  ['编辑（清单加载中）', pageWith({ view: 'editor', catalog: null, catalogPhase: 'loading' })],
  ['编辑（清单失败）', pageWith({ view: 'editor', catalog: null, catalogPhase: 'error', catalogError: '接口：404' })],
  ['编辑（别名模型）', pageWith({ view: 'editor', draft: { model: '~deepseek/deepseek-flash-latest', providers: [], allowFallbacks: false }, catalog: { ...CATALOG, providers: [], emptyReason: 'alias' } })],
  ['编辑（所有模型）', pageWith({ view: 'editor', draft: { model: '*', providers: ['deepseek'], allowFallbacks: true }, catalog: null, catalogPhase: 'idle' })],
  ['编辑（删除确认）', pageWith({ view: 'editor', confirmDelete: true })],
  ['编辑（未选供应商）', pageWith({ view: 'editor', draft: { providers: [] } })],
  ['编辑（手动输入非法）', pageWith({ view: 'editor', manualInput: 'bad slug!!', manualError: '格式不正确：bad slug!!' })],
  ['选择模型（就绪）', pageWith({ view: 'picker' })],
  ['选择模型（加载中）', pageWith({ view: 'picker', models: null, modelsPhase: 'loading' })],
  ['选择模型（失败）', pageWith({ view: 'picker', models: null, modelsPhase: 'error', modelsError: 'boom' })],
  ['选择模型（无匹配）', pageWith({ view: 'picker', modelFilter: 'zzz' })],
]

for (const [label, page] of scenarios) {
  try {
    const nodes = flatten(render(page))
    check(`渲染「${label}」不抛错（节点 ${nodes.length}）`, nodes.length > 8)
  } catch (error) {
    check(`渲染「${label}」不抛错`, false, error.message)
  }
}

/* 清单页：指定行、新建槽、规则文件路径 */
try {
  const nodes = flatten(render(pageWith({})))
  const cards = nodes.filter(node => node.props?.className === 'dop-card')
  check('清单渲染两条指定', cards.length === 2, String(cards.length))
  const allCard = textOf(cards[0])
  check('通配行显示所有模型与通配标记', allCard.includes('所有 OpenRouter 模型') && allCard.includes('通配'), allCard)
  const defaultCard = textOf(cards[1])
  check('默认模型行带当前默认标记', defaultCard.includes('当前默认'), defaultCard)
  check('行内列出供应商 slug', defaultCard.includes('stepfun/fp8') && defaultCard.includes('wafer/us'), defaultCard)
  check('行内有编辑与删除', nodes.some(node => node.type === 'button' && textOf(node) === '编辑') && nodes.some(node => node.type === 'button' && textOf(node) === '删除'))
  const add = nodes.find(node => node.props?.className === 'dop-add')
  check('新建槽存在且文案正确', add !== undefined && textOf(add).includes('新建指定'), textOf(add))
  check('规则文件路径可见', textOf(nodes.find(node => node.props?.className === 'dop-config') ?? null).includes('openrouter-provider.json'))
  check('清单页无旧侧栏/两栏结构', nodes.every(node => !['dop-work', 'dop-rail', 'dop-pin'].includes(node.props?.className)))
} catch (error) {
  check('清单结构核对', false, error.message)
}

/* 空清单：引导与空态 */
try {
  const nodes = flatten(render(pageWith({ snapshot: { ...SNAPSHOT, rules: {} } })))
  check('空态出现说明', textOf(nodes.find(node => node.props?.className === 'dop-empty') ?? null).includes('还没有任何指定'))
  check('空态出现三步引导', nodes.filter(node => node.props?.className === 'dop-step').length === 3)
} catch (error) {
  check('空态结构核对', false, error.message)
}

/* 编辑页：表格、勾选、保存门槛、删除区 */
try {
  const nodes = flatten(render(pageWith({ view: 'editor' })))
  const rows = nodes.filter(node => node.props?.className === 'dop-row')
  check('表格列出全部候选', rows.length === PROVIDERS.length, String(rows.length))
  const rowTexts = rows.map(node => textOf(node))
  check('表格行含输入价', rowTexts.some(text => text.includes('0.105')), rowTexts.join(' | '))
  check('表格行含精度与上下文', rowTexts[1].includes('精度 fp8') && rowTexts[1].includes('上下文 1M'), rowTexts[1])
  check('表格行含状态异常标记', rowTexts.some(text => text.includes('状态异常')))
  check('已勾选行带 data-selected', rows.some(node => node.props?.['data-selected'] === 'true'))
  check('未勾选行带 data-selected=false', rows.some(node => node.props?.['data-selected'] === 'false'))

  const tags = nodes.filter(node => node.props?.className === 'dop-removable')
  check('已选供应商是标签行', tags.length === 2, String(tags.length))
  const removeButton = flatten(tags[0]).find(node => node.props?.className === 'dop-tagButton')
  check('标签可单独移除', removeButton !== undefined && String(removeButton.props['aria-label']).includes('stepfun/fp8'))

  const save = nodes.find(node => node.type === 'button' && node.props?.className === 'dop-primary')
  check('保存按钮在编辑页底部且可点', save !== undefined && save.props.disabled === false)
  const danger = nodes.find(node => node.props?.className === 'dop-danger')
  check('删除区给出代价说明', danger !== undefined && textOf(danger).includes('交回 OpenRouter 自动选择'))

  const manual = nodes.find(node => node.type === 'input' && String(node.props?.['aria-label']).includes('供应商 slug'))
  check('手填入口存在', manual !== undefined)
  check('页面上没有吸底条', nodes.every(node => node.props?.className !== 'dop-actionbar'))
} catch (error) {
  check('编辑页结构核对', false, error.message)
}

/* 编辑页：保存门槛与清单不可用状态 */
try {
  const empty = flatten(render(pageWith({ view: 'editor', draft: { providers: [] } })))
  const save = empty.find(node => node.type === 'button' && node.props?.className === 'dop-primary')
  check('未选供应商时保存禁用', save?.props?.disabled === true)
  check('未选供应商时给出原因', empty.some(node => textOf(node) === '至少选 1 家供应商才能保存'))

  const loading = flatten(render(pageWith({ view: 'editor', catalog: null, catalogPhase: 'loading' })))
  check('加载中：给出读取提示', loading.some(node => textOf(node).includes('正在读取供应商清单')))

  const failed = flatten(render(pageWith({ view: 'editor', catalog: null, catalogPhase: 'error', catalogError: '接口：404' })))
  check('失败：给出原因与重试', failed.some(node => textOf(node).includes('接口：404')) && failed.some(node => node.type === 'button' && textOf(node) === '重试'))

  const alias = flatten(render(pageWith({ view: 'editor', draft: { model: '~deepseek/deepseek-flash-latest', providers: [] }, catalog: { ...CATALOG, providers: [], emptyReason: 'alias' } })))
  check('别名：就地引导选具体模型', alias.some(node => textOf(node).includes('别名没有固定的供应商清单')) && alias.some(node => node.type === 'button' && textOf(node) === '改选具体模型'))

  const all = flatten(render(pageWith({ view: 'editor', draft: { model: '*', providers: ['deepseek'] }, catalog: null, catalogPhase: 'idle' })))
  check('所有模型：给出直填说明', all.some(node => textOf(node).includes('所有模型没有按模型的候选清单')))

  const unknown = flatten(render(pageWith({ view: 'editor', draft: { providers: ['stepfun/fp8', 'my/custom'] } })))
  check('清单外 slug 就地提示', unknown.some(node => textOf(node).includes('清单里没有这些 slug')))
} catch (error) {
  check('编辑页状态核对', false, error.message)
}

/* 删除确认 */
try {
  const nodes = flatten(render(pageWith({ view: 'editor', confirmDelete: true })))
  check('删除确认态出现确认按钮', nodes.some(node => node.type === 'button' && textOf(node) === '确认删除'))
  check('删除确认态可取消', nodes.some(node => node.type === 'button' && textOf(node) === '取消'))
} catch (error) {
  check('删除确认核对', false, error.message)
}

/* 选择模型 */
try {
  const nodes = flatten(render(pageWith({ view: 'picker' })))
  const rows = nodes.filter(node => node.props?.className === 'dop-pickRow')
  check('选择模型列出通配项与模型', rows.length === MODELS.length + 1, String(rows.length))
  check('通配项文案正确', textOf(rows[0]).includes('所有 OpenRouter 模型'))
  check('当前模型带 data-current', rows[1]?.props?.['data-current'] === 'true', String(rows[1]?.props?.['data-current']))
  check('别名模型带标记', textOf(rows[2]).includes('Latest 别名'))
  const search = nodes.find(node => node.type === 'input' && String(node.props?.['aria-label']).includes('搜索模型'))
  check('有搜索输入框', search !== undefined)

  const filtered = flatten(render(pageWith({ view: 'picker', modelFilter: 'zzz' })))
  check('无匹配有兜底文案', filtered.some(node => textOf(node) === '没有匹配的模型'))

  const loading = flatten(render(pageWith({ view: 'picker', models: null, modelsPhase: 'loading' })))
  check('目录加载中给出提示', loading.some(node => textOf(node).includes('正在读取模型目录')))

  const failed = flatten(render(pageWith({ view: 'picker', models: null, modelsPhase: 'error', modelsError: 'boom' })))
  check('目录失败给出重试', failed.some(node => node.type === 'button' && textOf(node) === '重试'))
} catch (error) {
  check('选择模型结构核对', false, error.message)
}

console.log(failures.length === 0 ? '\nALL RENDER SMOKE CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED`)
process.exitCode = failures.length === 0 ? 0 : 1
