/**
 * OpenRouter 供应商指定（Host 半）
 * 拦截发往 openrouter.ai 的 chat/completions 请求，按模型补上 provider.only 与
 * allow_fallbacks；策略存于 $DSH_HOME/openrouter-provider.json，浏览器经
 * /api/openrouter-provider 读写，供应商候选来自 OpenRouter 的 endpoints 接口。
 */
import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = 'openrouter-provider'
export const inject = ['connection']

/** 浏览器 RPC 通道：必须与 Connection 的 /api 通道一致 */
const RPC_ENDPOINT = 'openrouter-provider'
const RPC_PATH = `/api/${RPC_ENDPOINT}`
/** 通配模型键：作用于所有 OpenRouter 请求 */
const ALL_MODELS = '*'
const ENDPOINTS_API = 'https://openrouter.ai/api/v1/models'
const MODELS_API = 'https://openrouter.ai/api/v1/models'
const ENDPOINTS_TIMEOUT_MS = 15_000
/* 模型目录整包 800KB 量级，给更长的超时并缓存 10 分钟 */
const MODELS_TIMEOUT_MS = 20_000
const MODELS_CACHE_MS = 600_000
/* 模型页是整页 RSC 负载，体积在 2MB 量级，给更长的超时 */
const PAGE_TIMEOUT_MS = 30_000
const ENDPOINTS_CACHE_MS = 60_000

/** 供应商 slug，例如 `stepfun/fp8`、`deepseek`、`wafer/us` */
const PROVIDER_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?:\/[A-Za-z0-9._-]{1,64}){0,2}$/
/** OpenRouter 模型 id，例如 `deepseek/deepseek-v4.1-flash-1017`、`deepseek/deepseek-r1:free`；允许 DSH 侧的 `~` 前缀 */
const MODEL_ID = /^~?[A-Za-z0-9_~:-][A-Za-z0-9._~:-]{0,127}\/[A-Za-z0-9_~-][A-Za-z0-9._~:-]{0,127}$/

/**
 * 校验模型 id 是否可安全拼进 endpoints 的 URL 路径
 * 除格式外还要挡掉 `.` / `..` 这类会把请求带到别的路径的段
 * @param {unknown} model 待校验的模型 id
 * @returns {string | undefined} 合法时返回去空格后的 id
 */
function modelIdOf(model) {
  const value = typeof model === 'string' ? model.trim() : ''
  if (!MODEL_ID.test(value)) return undefined
  if (value.split('/').some((segment) => segment === '.' || segment === '..')) return undefined
  return value
}

/**
 * 规则匹配用的规范模型名：去掉 DSH 侧的 `~` 前缀，让保存键与实际发送的 model 能对上
 * @param {unknown} model 模型 id
 * @returns {string} 可用于比较的模型名
 */
function canonicalModel(model) {
  return typeof model === 'string' ? model.trim().replace(/^~/, '') : ''
}

/**
 * 策略文件路径，与其它 DSH 数据并列放在 DSH_HOME 下
 * @returns {string} 形如 C:\Users\me\.dsh\openrouter-provider.json
 */
function policyFilePath() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'openrouter-provider.json')
}

/**
 * 判断值是否是普通对象
 * @param {unknown} value 待判断值
 * @returns {boolean} true 表示非 null 且非数组的对象
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 把磁盘或浏览器传来的规则归一成 { only, allowFallbacks }
 * 丢弃非法 slug、去重并保持顺序；结构不合法时返回 undefined
 * @param {unknown} value 单条规则
 * @returns {{ only: string[], allowFallbacks: boolean } | undefined} 归一后的规则
 */
function normalizeRule(value) {
  if (!isPlainObject(value)) return undefined
  const only = Array.isArray(value.only)
    ? [...new Set(value.only.filter((slug) => typeof slug === 'string' && PROVIDER_SLUG.test(slug)))]
    : []
  return { only, allowFallbacks: value.allowFallbacks === true }
}

/**
 * 归一整张规则表，非法条目直接丢弃而不是让整份策略失效
 * @param {unknown} raw 规则表
 * @returns {Record<string, { only: string[], allowFallbacks: boolean }>} 合法规则表
 */
function normalizeRules(raw) {
  const rules = {}
  if (!isPlainObject(raw)) return rules
  for (const [model, value] of Object.entries(raw)) {
    if (model !== ALL_MODELS && modelIdOf(model) === undefined) continue
    const rule = normalizeRule(value)
    if (rule !== undefined) rules[model] = rule
  }
  return rules
}

/**
 * 从磁盘读规则表，文件不存在视为没有规则
 * @param {string} path 策略文件路径
 * @returns {Record<string, { only: string[], allowFallbacks: boolean }>} 规则表
 */
function readRulesFromDisk(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    throw error
  }
  return normalizeRules(JSON.parse(text)?.rules)
}

/**
 * 原子写策略文件：先写同目录临时文件再改名，避免半截 JSON
 * @param {string} path 策略文件路径
 * @param {Record<string, unknown>} rules 待写入的规则表
 * @returns {Promise<void>} 写入完成
 */
async function writeRulesToDisk(path, rules) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify({ version: 1, rules }, undefined, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

/**
 * 从请求 URL 解析出真正的主机与路径，非 OpenRouter 直接不算命中
 * @param {unknown} input fetch 的第一个参数
 * @returns {{ hostname: string, pathname: string } | undefined} 命中候选的地址信息
 */
function openRouterAddress(input) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : isPlainObject(input) ? input.url : ''
  if (typeof raw !== 'string' || raw === '') return undefined
  let url
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (!/(^|\.)openrouter\.ai$/i.test(url.hostname)) return undefined
  if (!/\/chat\/completions\/?$/.test(url.pathname)) return undefined
  return { hostname: url.hostname, pathname: url.pathname }
}

/**
 * 找到某模型真正生效的规则，先精确匹配再退回通配键
 * 精确匹配按去掉 `~` 的规范名比较，避免保存键与线上 model 差一个前缀就不生效
 * @param {Record<string, { only: string[], allowFallbacks: boolean }>} rules 规则表
 * @param {string} model 请求体里的模型 id
 * @returns {{ only: string[], allowFallbacks: boolean } | undefined} 生效规则，没有可用规则时为 undefined
 */
function matchRule(rules, model) {
  const wanted = canonicalModel(model)
  const exact = wanted === ''
    ? undefined
    : Object.entries(rules).find(([key]) => key !== ALL_MODELS && canonicalModel(key) === wanted)?.[1]
  const candidates = [exact, rules[ALL_MODELS]].filter((rule) => rule !== undefined)
  return candidates.find((rule) => rule.only.length > 0)
}

/**
 * 计算要发给 OpenRouter 的请求体：保留调用方已有 provider 字段，只覆盖本插件负责的两项
 * @param {Record<string, unknown>} body 原始请求体
 * @param {{ only: string[], allowFallbacks: boolean }} rule 生效规则
 * @returns {Record<string, unknown>} 新的请求体
 */
function withProviderRouting(body, rule) {
  const provider = isPlainObject(body.provider) ? { ...body.provider } : {}
  provider.only = [...rule.only]
  provider.allow_fallbacks = rule.allowFallbacks
  return { ...body, provider }
}

/**
 * 检查并改写一次 fetch 调用，任何异常都退回原请求
 * @param {unknown} input fetch 的第一个参数
 * @param {unknown} init fetch 的第二个参数
 * @param {() => Record<string, { only: string[], allowFallbacks: boolean }>} getRules 读取当前规则表
 * @param {{ debug?: (message: string, ...rest: unknown[]) => void }} logger 诊断日志
 * @returns {{ input: unknown, init: Record<string, unknown> } | undefined} 改写后的请求，未命中为 undefined
 */
function rewriteFetchRequest(input, init, getRules, logger) {
  try {
    if (openRouterAddress(input) === undefined) return undefined
    if (!isPlainObject(init) || typeof init.body !== 'string') return undefined
    const body = JSON.parse(init.body)
    if (!isPlainObject(body)) return undefined
    const rule = matchRule(getRules(), body.model)
    if (rule === undefined) return undefined
    return { input, init: { ...init, body: JSON.stringify(withProviderRouting(body, rule)) } }
  } catch (error) {
    logger.debug?.(`openrouter-provider: 请求体改写跳过（可能是正常情况无须理会）：${error?.message ?? error}`)
    return undefined
  }
}

/**
 * 安装全局 fetch 拦截器，卸载时只在仍是本插件版本的情况下还原
 * @param {() => Record<string, { only: string[], allowFallbacks: boolean }>} getRules 读取当前规则表
 * @param {{ debug?: (message: string, ...rest: unknown[]) => void }} logger 诊断日志
 * @returns {() => void} 还原函数
 */
function installFetchPatch(getRules, logger) {
  const originalFetch = globalThis.fetch
  if (typeof originalFetch !== 'function') return () => {}

  function patchedFetch(input, init) {
    const rewritten = rewriteFetchRequest(input, init, getRules, logger)
    return rewritten === undefined
      ? originalFetch.call(this, input, init)
      : originalFetch.call(this, rewritten.input, rewritten.init)
  }

  globalThis.fetch = patchedFetch
  return () => {
    if (globalThis.fetch === patchedFetch) globalThis.fetch = originalFetch
  }
}

/**
 * 读取默认模型选择，用于设置页初始模型名
 * @param {{ get: (key: string) => unknown }} ctx Host 插件上下文
 * @returns {{ provider: string, model: string } | undefined} 默认模型，读不到时为 undefined
 */
function readDefaultSelection(ctx) {
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    if (selection === undefined || selection === null) return undefined
    if (typeof selection.provider !== 'string' || typeof selection.model !== 'string') return undefined
    return { provider: selection.provider, model: selection.model }
  } catch {
    return undefined
  }
}

/**
 * 把 $/token 的字符串或数字换算成 $/1M token
 * @param {unknown} value endpoints 里的原始价格
 * @returns {number | null} 每百万 token 的美元价，无法解析时为 null
 */
function perMillionOf(value) {
  const perToken = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(perToken) ? Number((perToken * 1_000_000).toFixed(4)) : null
}

/**
 * 取一组数字里的最大值，忽略 null 与非数字
 * @param {Array<unknown>} values 候选值
 * @returns {number | null} 最大值，全空时为 null
 */
function maxFinite(values) {
  const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  return numbers.length === 0 ? null : Math.max(...numbers)
}

/**
 * 归一模型输入/输出模态数组
 * @param {unknown} value 模态数组
 * @returns {string[]} 去重后的模态名
 */
function modalitiesOf(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

/**
 * 把 endpoints 接口的一条记录裁成设置页需要的字段
 * @param {unknown} endpoint OpenRouter endpoints 接口的单项
 * @returns {{ tag: string, providerName: string, quantization: string, contextLength: number | null, maxCompletionTokens: number | null, promptPerMillion: number | null, completionPerMillion: number | null, uptimeLast30m: number | null, degraded: boolean }} 候选供应商
 */
function toProviderRow(endpoint) {
  const pricing = isPlainObject(endpoint?.pricing) ? endpoint.pricing : {}
  return {
    tag: typeof endpoint?.tag === 'string' ? endpoint.tag : '',
    providerName: typeof endpoint?.provider_name === 'string' ? endpoint.provider_name : '',
    quantization: typeof endpoint?.quantization === 'string' ? endpoint.quantization : '',
    contextLength: Number.isFinite(endpoint?.context_length) ? endpoint.context_length : null,
    maxCompletionTokens: Number.isFinite(endpoint?.max_completion_tokens) ? endpoint.max_completion_tokens : null,
    promptPerMillion: perMillionOf(pricing.prompt),
    completionPerMillion: perMillionOf(pricing.completion),
    uptimeLast30m: Number.isFinite(endpoint?.uptime_last_30m) ? endpoint.uptime_last_30m : null,
    degraded: Number.isFinite(endpoint?.status) && endpoint.status !== 0,
  }
}

/**
 * 按 tag 去重并合并同名供应商，保持接口给出的价格顺序
 * @param {Array<{ tag: string, providerName: string }>} rows 供应商行
 * @returns {Array<{ tag: string, providerName: string }>} 去重后的行
 */
function dedupeProviderRows(rows) {
  const byTag = new Map()
  for (const row of rows) {
    const known = byTag.get(row.tag)
    if (known === undefined) byTag.set(row.tag, row)
    else if (row.providerName !== '' && !known.providerName.split(' / ').includes(row.providerName)) {
      known.providerName = known.providerName === '' ? row.providerName : `${known.providerName} / ${row.providerName}`
    }
  }
  return [...byTag.values()]
}

/**
 * 从 endpoints 接口响应里读出模型规格与供应商候选
 * @param {unknown} payload endpoints 接口的 JSON
 * @returns {{ specs: object, providers: Array<object> }} 目录数据
 */
function readApiCatalog(payload) {
  const data = isPlainObject(payload?.data) ? payload.data : {}
  const endpoints = Array.isArray(data.endpoints) ? data.endpoints : []
  const rows = dedupeProviderRows(endpoints.map(toProviderRow).filter((row) => row.tag !== ''))
  const architecture = isPlainObject(data.architecture) ? data.architecture : {}
  const modelId = typeof data.id === 'string' ? data.id : ''
  const tokenizer = typeof architecture.tokenizer === 'string' ? architecture.tokenizer : ''
  const description = typeof data.description === 'string' ? data.description : ''
  return {
    specs: {
      name: typeof data.name === 'string' ? data.name : '',
      contextWindow: maxFinite(rows.map((row) => row.contextLength)),
      maxCompletionTokens: maxFinite(rows.map((row) => row.maxCompletionTokens)),
      inputModalities: modalitiesOf(architecture.input_modalities),
      outputModalities: modalitiesOf(architecture.output_modalities),
      reasoning: endpoints.some((endpoint) => Array.isArray(endpoint?.supported_parameters) && endpoint.supported_parameters.includes('reasoning')),
    },
    /* 别名与路由模型没有固定供应商清单：接口会返回空数组而不是报错 */
    emptyReason: rows.length > 0
      ? undefined
      : modelId.startsWith('~') ? 'alias' : tokenizer === 'Router' || /redirect/i.test(description) ? 'router' : 'none',
    providers: rows,
  }
}

/**
 * 把模型页 HTML 里的 React Server Components 负载拼回普通文本
 * 页面把 JSON 以字符串形式再编码了一层，所以拼接后还要再反转义一次
 * @param {string} html 模型页 HTML
 * @returns {string} RSC 负载文本
 */
function flightTextOf(html) {
  const chunks = []
  const pattern = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g
  for (const match of html.matchAll(pattern)) {
    try {
      chunks.push(JSON.parse(match[1]))
    } catch {
      /* 单个 chunk 解不开不影响其余 chunk */
    }
  }
  return chunks.join('').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

/**
 * 从给定位置起截取配对的 JSON 数组文本
 * @param {string} text 待扫描文本
 * @param {number} start `[` 的下标
 * @returns {string | undefined} 完整数组文本，找不到配对时为 undefined
 */
function balancedArrayAt(text, start) {
  let depth = 0
  let inString = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      if (char === '\\') index++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '[') depth++
    else if (char === ']') {
      depth--
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return undefined
}

/**
 * 在模型页负载里找最长的一组 endpoint 记录
 * 页面同时带多个查询结果，供应商表来自其中最长的那一份
 * @param {string} payload RSC 负载文本
 * @returns {Array<Record<string, unknown>>} endpoint 记录
 */
function endpointRowsOfPage(payload) {
  let best = []
  for (const marker of ['"state":{"data":[', '"data":[']) {
    let from = 0
    let attempts = 0
    while (attempts < 200) {
      const at = payload.indexOf(marker, from)
      if (at < 0) break
      from = at + marker.length
      attempts++
      const arrayText = balancedArrayAt(payload, at + marker.indexOf('['))
      if (arrayText === undefined) continue
      let rows
      try {
        rows = JSON.parse(arrayText)
      } catch {
        continue
      }
      if (!Array.isArray(rows)) continue
      const endpoints = rows.filter((row) => isPlainObject(row)
        && typeof row.provider_name === 'string' && isPlainObject(row.pricing) && typeof row.provider_slug === 'string')
      if (endpoints.length > best.length) best = endpoints
    }
  }
  return best
}

/**
 * 把模型页的一条 endpoint 记录裁成与接口一致的供应商行
 * @param {Record<string, any>} row 模型页记录
 * @returns {{ tag: string, providerName: string, quantization: string, contextLength: number | null, maxCompletionTokens: number | null, promptPerMillion: number | null, completionPerMillion: number | null, uptimeLast30m: null, degraded: boolean }} 候选供应商
 */
function toPageProviderRow(row) {
  const pricing = isPlainObject(row.pricing) ? row.pricing : {}
  return {
    tag: row.provider_slug,
    providerName: typeof row.provider_display_name === 'string' ? row.provider_display_name : row.provider_name,
    quantization: typeof row.quantization === 'string' ? row.quantization : '',
    contextLength: Number.isFinite(row.context_length) ? row.context_length : null,
    maxCompletionTokens: Number.isFinite(row.max_completion_tokens) ? row.max_completion_tokens : null,
    promptPerMillion: perMillionOf(pricing.prompt),
    completionPerMillion: perMillionOf(pricing.completion),
    uptimeLast30m: null,
    degraded: Number.isFinite(row.status) && row.status !== 0,
  }
}

/**
 * 从模型页 HTML 里读出模型规格与供应商候选
 * @param {string} html 模型页 HTML
 * @returns {{ specs: object, providers: Array<object> }} 目录数据
 */
function readPageCatalog(html) {
  const endpoints = endpointRowsOfPage(flightTextOf(html))
  if (endpoints.length === 0) throw new Error('模型页里没有找到供应商清单')
  const rows = dedupeProviderRows(endpoints.map(toPageProviderRow).filter((row) => row.tag !== ''))
  const modelInfo = isPlainObject(endpoints[0]?.model) ? endpoints[0].model : {}
  return {
    specs: {
      name: typeof modelInfo.name === 'string' ? modelInfo.name : '',
      contextWindow: maxFinite([...rows.map((row) => row.contextLength), modelInfo.context_length]),
      maxCompletionTokens: maxFinite(rows.map((row) => row.maxCompletionTokens)),
      inputModalities: modalitiesOf(modelInfo.input_modalities),
      outputModalities: modalitiesOf(modelInfo.output_modalities),
      reasoning: modelInfo.supports_reasoning === true,
    },
    emptyReason: rows.length > 0 ? undefined : 'none',
    providers: rows,
  }
}

/**
 * 把 /models 目录里的一条记录裁成模型选择器需要的字段
 * 价格为负表示路由模型（由 OpenRouter 自己决定实际模型）；`~` 开头是 Latest 别名
 * @param {unknown} model 目录条目
 * @returns {{ id: string, name: string, contextWindow: number | null, promptPerMillion: number | null, completionPerMillion: number | null, inputModalities: string[], outputModalities: string[], alias: boolean, router: boolean, batch: boolean }} 选择器行
 */
function toModelRow(model) {
  const pricing = isPlainObject(model?.pricing) ? model.pricing : {}
  const architecture = isPlainObject(model?.architecture) ? model.architecture : {}
  const id = typeof model?.id === 'string' ? model.id : ''
  const promptPerMillion = perMillionOf(pricing.prompt)
  const completionPerMillion = perMillionOf(pricing.completion)
  return {
    id,
    name: typeof model?.name === 'string' ? model.name : '',
    contextWindow: Number.isFinite(model?.context_length) ? model.context_length : null,
    promptPerMillion,
    completionPerMillion,
    inputModalities: modalitiesOf(architecture.input_modalities),
    outputModalities: modalitiesOf(architecture.output_modalities),
    alias: id.startsWith('~'),
    router: (promptPerMillion !== null && promptPerMillion < 0) || (completionPerMillion !== null && completionPerMillion < 0),
    batch: id.includes(':batch'),
  }
}

/**
 * 拉取 OpenRouter 的模型目录，按名称排序
 * @param {AbortSignal} signal 取消信号
 * @returns {Promise<Array<ReturnType<typeof toModelRow>>>} 模型列表
 */
async function fetchModelCatalog(signal) {
  const response = await fetch(MODELS_API, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(MODELS_TIMEOUT_MS)]),
  })
  if (!response.ok) throw new Error(`模型目录接口返回 HTTP ${response.status}`)
  const payload = await response.json()
  const models = Array.isArray(payload?.data) ? payload.data : []
  return models
    .map(toModelRow)
    .filter((row) => row.id !== '')
    .sort((left, right) => (left.name === '' ? left.id : left.name).localeCompare(right.name === '' ? right.id : right.name))
}

/**
 * 解析用户输入：既能接受模型 id，也能接受 openrouter.ai 的模型页 URL
 * @param {unknown} input 输入框内容
 * @returns {{ model: string, pageUrl: string } | undefined} 解析结果，无法识别时为 undefined
 */
function resolveModelInput(input) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (raw === '') return undefined
  if (!/^https?:\/\//i.test(raw)) {
    const model = modelIdOf(raw)
    return model === undefined ? undefined : { model, pageUrl: `https://openrouter.ai/${model}` }
  }
  let url
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (!/(^|\.)openrouter\.ai$/i.test(url.hostname)) return undefined
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
  const at = segments[0] === 'models' ? 1 : 0
  const model = modelIdOf(segments.slice(at, at + 2).join('/'))
  return model === undefined ? undefined : { model, pageUrl: `https://openrouter.ai/${model}` }
}

/**
 * 走 endpoints 接口读某模型的目录；接口没有该模型时抛错，交给模型页兜底
 * @param {string} model OpenRouter 模型 id
 * @param {AbortSignal} signal 取消信号
 * @returns {Promise<{ specs: object, providers: Array<object> }>} 目录数据
 */
async function fetchApiCatalog(model, signal) {
  const request = async (candidate) => await fetch(`${ENDPOINTS_API}/${candidate}/endpoints`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(ENDPOINTS_TIMEOUT_MS)]),
  })
  let response = await request(model)
  /* DSH 的模型名可能带 `~` 前缀，OpenRouter 的目录里没有这个写法时去掉再试一次 */
  if (response.status === 404 && model.startsWith('~')) response = await request(model.slice(1))
  if (response.status === 404) throw new Error('OpenRouter 目录里没有这个模型 id')
  if (!response.ok) throw new Error(`endpoints 接口返回 HTTP ${response.status}`)
  return readApiCatalog(await response.json())
}

/**
 * 直接读模型页 HTML 拿目录，用于接口不可用或模型 id 只在页面上有数据的情况
 * @param {string} pageUrl 模型页地址
 * @param {AbortSignal} signal 取消信号
 * @returns {Promise<{ specs: object, providers: Array<object> }>} 目录数据
 */
async function fetchPageCatalog(pageUrl, signal) {
  const response = await fetch(pageUrl, {
    headers: { accept: 'text/html' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
  })
  if (!response.ok) throw new Error(`模型页返回 HTTP ${response.status}`)
  return readPageCatalog(await response.text())
}

/**
 * 构造浏览器 RPC 响应信封
 * @param {string} rpcId 客户端请求 id
 * @param {{ ok: true, value: unknown } | { ok: false, error: { code: string, message: string, details?: object } }} result 处理结果
 * @returns {Response} 带 server-response 信封的 HTTP 响应
 */
function rpcReply(rpcId, result) {
  const value = result.ok === false
    ? { ...result, error: { ...result.error, details: result.error.details ?? {} } }
    : result
  return Response.json({ type: 'server-response', rpcId, result: value })
}

/**
 * 组装 Host 侧当前状态
 * @param {Record<string, { only: string[], allowFallbacks: boolean }>} rules 规则表
 * @param {{ provider: string, model: string } | undefined} selection 默认模型
 * @returns {{ rules: unknown, defaultSelection: unknown, policyFile: string, allModelsKey: string }} 设置页需要的状态
 */
function describeState(rules, selection) {
  return {
    rules: structuredClone(rules),
    defaultSelection: selection ?? null,
    policyFile: policyFilePath(),
    allModelsKey: ALL_MODELS,
  }
}

/**
 * 从 payload 里取规则键，`scope=all` 用通配键，否则校验模型 id
 * @param {{ scope?: unknown, model?: unknown }} payload 浏览器 payload
 * @returns {string} 规则键
 */
function ruleKeyOf(payload) {
  if (payload?.scope === 'all') return ALL_MODELS
  const model = modelIdOf(payload?.model)
  if (model === undefined) throw new Error('模型 id 不合法，应形如 deepseek/deepseek-v4.1-flash-1017')
  return model
}

/**
 * 校验并去重浏览器提交的供应商 slug 列表
 * @param {unknown} only 浏览器提交的 slug 数组
 * @returns {string[]} 合法 slug
 */
function providerSlugsOf(only) {
  if (!Array.isArray(only) || only.length === 0) throw new Error('至少选择一个供应商，或直接清除该模型的指定')
  const slugs = [...new Set(only.filter((slug) => typeof slug === 'string' && PROVIDER_SLUG.test(slug)))]
  if (slugs.length === 0) throw new Error('供应商 slug 不合法，应形如 stepfun/fp8 或 deepseek')
  return slugs
}

/**
 * 注册 /api/openrouter-provider，负责 state / providers / save / clear 四个操作
 * @param {unknown} ctx Host 插件上下文
 * @param {{ getRules: () => Record<string, unknown>, setRules: (rules: Record<string, unknown>) => Promise<void>, readSelection: () => unknown, logger: { debug?: Function, warn?: Function } }} host 宿主能力
 * @returns {() => Promise<void>} 注销函数
 */
function registerRpcRoute(ctx, host) {
  const cache = new Map()
  /* 模型目录整包较大，单独缓存 10 分钟 */
  let modelCatalog

  async function modelsOf(signal) {
    if (modelCatalog !== undefined && Date.now() - modelCatalog.at < MODELS_CACHE_MS) {
      return { ok: true, value: modelCatalog.rows }
    }
    const rows = await fetchModelCatalog(signal)
    modelCatalog = { at: Date.now(), rows }
    return { ok: true, value: rows }
  }

  async function providersOf(payload, signal) {
    const resolved = resolveModelInput(payload?.input ?? payload?.model)
    if (resolved === undefined) {
      return {
        ok: false,
        error: {
          code: 'openrouter-provider/bad-input',
          message: '请填 OpenRouter 模型 id（如 deepseek/deepseek-v4.1-flash-1017）或模型页 URL（如 https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017）',
        },
      }
    }
    const cached = cache.get(resolved.model)
    if (cached !== undefined && Date.now() - cached.at < ENDPOINTS_CACHE_MS) return { ok: true, value: { ...cached.value, cached: true } }

    /* 先走接口：体积小、字段全；接口没有该模型时再解析模型页兜底 */
    let apiFailure
    try {
      const catalog = await fetchApiCatalog(resolved.model, signal)
      const value = { model: resolved.model, pageUrl: resolved.pageUrl, source: 'api', ...catalog }
      cache.set(resolved.model, { at: Date.now(), value })
      return { ok: true, value }
    } catch (error) {
      apiFailure = error?.message ?? String(error)
    }
    try {
      const catalog = await fetchPageCatalog(resolved.pageUrl, signal)
      const value = { model: resolved.model, pageUrl: resolved.pageUrl, source: 'page', ...catalog }
      cache.set(resolved.model, { at: Date.now(), value })
      return { ok: true, value }
    } catch (error) {
      const pageFailure = error?.message ?? String(error)
      return {
        ok: false,
        error: {
          code: 'openrouter-provider/providers-failed',
          message: `接口：${apiFailure}；模型页：${pageFailure}`,
        },
      }
    }
  }

  async function saveRule(payload) {
    const key = ruleKeyOf(payload)
    const next = { ...host.getRules(), [key]: { only: providerSlugsOf(payload?.only), allowFallbacks: payload?.allowFallbacks === true } }
    await host.setRules(next)
    return { ok: true, value: describeState(next, host.readSelection()) }
  }

  async function clearRule(payload) {
    const key = ruleKeyOf(payload)
    const next = { ...host.getRules() }
    delete next[key]
    await host.setRules(next)
    return { ok: true, value: describeState(next, host.readSelection()) }
  }

  async function dispatch(method, payload, signal) {
    if (method === 'state') return { ok: true, value: describeState(host.getRules(), host.readSelection()) }
    if (method === 'models') return await modelsOf(signal)
    if (method === 'providers') return await providersOf(payload, signal)
    if (method === 'save') return await saveRule(payload)
    if (method === 'clear') return await clearRule(payload)
    return { ok: false, error: { code: 'openrouter-provider/unknown-method', message: `未知操作：${String(method)}` } }
  }

  return ctx.connection.fetch.register({
    path: RPC_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }
      let message
      try {
        message = await request.json()
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }
      const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request'
      const call = message?.payload
      if (!isPlainObject(message) || message.type !== 'client-request' || typeof message.rpcId !== 'string'
        || message.method !== RPC_ENDPOINT || !isPlainObject(call) || typeof call.method !== 'string'
        || !Object.hasOwn(call, 'payload')) {
        return rpcReply(rpcId, { ok: false, error: { code: 'openrouter-provider/bad-request', message: '请求信封不合法' } })
      }
      try {
        return rpcReply(rpcId, await dispatch(call.method, call.payload, request.signal))
      } catch (error) {
        host.logger.warn?.(`openrouter-provider: ${String(error?.message ?? error)}`)
        return rpcReply(rpcId, { ok: false, error: { code: 'openrouter-provider/failed', message: String(error?.message ?? error) } })
      }
    },
  })
}

/**
 * 插件入口：装 fetch 拦截 + 注册设置页 RPC
 * @param {unknown} ctx Host 插件上下文
 */
export function apply(ctx) {
  /* 读启动时的策略文件，读坏只降级为“无规则”，不影响推理链路 */
  let rules = {}
  try {
    rules = readRulesFromDisk(policyFilePath())
  } catch (error) {
    ctx.logger?.warn?.(`openrouter-provider: 策略文件无法解析，已按无规则启动：${error?.message ?? error}`)
  }

  const host = {
    getRules: () => rules,
    setRules: async (next) => {
      await writeRulesToDisk(policyFilePath(), next)
      rules = next
    },
    readSelection: () => readDefaultSelection(ctx),
    logger: ctx.logger ?? {},
  }

  ctx.effect(() => installFetchPatch(() => rules, host.logger), 'openrouter-provider: OpenRouter request patch')
  ctx.effect(() => registerRpcRoute(ctx, host), 'openrouter-provider: settings RPC')
}
