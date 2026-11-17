/**
 * Live catalog verification: API path, page-parsing fallback, and URL input.
 * Wraps the real fetch so the API can be forced to fail while the page still loads.
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const pluginDir = fileURLToPath(new URL('..', import.meta.url))
const home = join(tmpdir(), 'dsh-openrouter-provider-catalog-home')
rmSync(home, { recursive: true, force: true })
mkdirSync(home, { recursive: true })
process.env.DSH_HOME = home

const failures = []
function check(name, condition, detail) {
  if (condition) console.log('PASS ' + name)
  else { failures.push(name); console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}

const model = 'deepseek/deepseek-v4.1-flash-1017'
const pageUrl = `https://openrouter.ai/${model}`
const realFetch = globalThis.fetch
let forceApiFailure = false
const seen = []

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input)
  seen.push(url)
  if (forceApiFailure && url.includes('/api/v1/models/') && url.endsWith('/endpoints')) {
    return new Response(JSON.stringify({ error: 'forced' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  return await realFetch(input, init)
}

let registered
const ctx = {
  logger: { warn: (message) => console.log('WARN ' + message), debug: () => {} },
  effect(factory) { return factory() },
  connection: { fetch: { register(route) { registered = route; return async () => {} } } },
  get() { return undefined },
}

const { apply } = await import(pathToFileURL(join(pluginDir, 'index.js')).href)
apply(ctx)

async function rpc(method, payload) {
  const request = new Request('http://localhost/api/openrouter-provider', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'live', method: 'openrouter-provider', payload: { method, payload } }),
  })
  const response = await registered.fetch(request)
  return await response.json()
}

// 1. API path
seen.length = 0
const apiReply = await rpc('providers', { input: model })
const apiValue = apiReply?.result?.value
check('api path ok', apiReply?.result?.ok === true, JSON.stringify(apiReply).slice(0, 300))
check('api source', apiValue?.source === 'api', apiValue?.source)
check('api model resolved', apiValue?.model === model, apiValue?.model)
check('api provider count', Array.isArray(apiValue?.providers) && apiValue.providers.length > 40, String(apiValue?.providers?.length))
check('api stepfun present', apiValue?.providers?.some((row) => row.tag === 'stepfun/fp8'))
check('api rows carry prices', apiValue?.providers?.every((row) => typeof row.promptPerMillion === 'number' || row.promptPerMillion === null))
check('api rows carry specs', apiValue?.providers?.every((row) => row.contextLength === null || typeof row.contextLength === 'number'))
check('api model specs', typeof apiValue?.specs?.contextWindow === 'number' && apiValue.specs.contextWindow > 0, JSON.stringify(apiValue?.specs))
check('api modalities', Array.isArray(apiValue?.specs?.inputModalities) && apiValue.specs.inputModalities.includes('text'))
const stepfun = apiValue?.providers?.find((row) => row.tag === 'stepfun/fp8')
console.log('stepfun row: ' + JSON.stringify(stepfun))

// 2. URL input resolves the same model
const urlReply = await rpc('providers', { input: `https://openrouter.ai/models/${model}?endpoint=abc#providers` })
check('url input resolves model', urlReply?.result?.value?.model === model, JSON.stringify(urlReply?.result?.value?.model))

// 3. Page fallback when the API is unavailable (fresh apply => fresh 60s cache)
forceApiFailure = true
const pageRoutes = []
const pageCtx = {
  logger: ctx.logger,
  effect(factory) { return factory() },
  connection: { fetch: { register(route) { pageRoutes.push(route); return async () => {} } } },
  get() { return undefined },
}
apply(pageCtx)
const pageRoute = pageRoutes[pageRoutes.length - 1]
async function pageRpc(method, payload) {
  const request = new Request('http://localhost/api/openrouter-provider', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'live-page', method: 'openrouter-provider', payload: { method, payload } }),
  })
  return await (await pageRoute.fetch(request)).json()
}
seen.length = 0
const pageReply = await pageRpc('providers', { input: pageUrl })
const pageValue = pageReply?.result?.value
console.log('page attempt urls: ' + seen.join(' | '))
check('page path ok', pageReply?.result?.ok === true, JSON.stringify(pageReply).slice(0, 400))
check('page source', pageValue?.source === 'page', pageValue?.source)
check('page provider count', Array.isArray(pageValue?.providers) && pageValue.providers.length === apiValue?.providers?.length, `${pageValue?.providers?.length} vs ${apiValue?.providers?.length}`)
const apiTags = new Set((apiValue?.providers ?? []).map((row) => row.tag))
const pageTags = (pageValue?.providers ?? []).map((row) => row.tag)
check('page tags equal api tags', pageTags.every((tag) => apiTags.has(tag)) && pageTags.length === apiTags.size)
check('page stepfun present', pageTags.includes('stepfun/fp8'))
check('page model specs', typeof pageValue?.specs?.contextWindow === 'number' && pageValue.specs.contextWindow > 0, JSON.stringify(pageValue?.specs))
const pageStepfun = pageValue?.providers?.find((row) => row.tag === 'stepfun/fp8')
console.log('page stepfun row: ' + JSON.stringify(pageStepfun))
check('page price matches api price', pageStepfun?.promptPerMillion === stepfun?.promptPerMillion && pageStepfun?.completionPerMillion === stepfun?.completionPerMillion,
  `${JSON.stringify(pageStepfun)} vs ${JSON.stringify(stepfun)}`)

// 4. Unknown model: both paths report a readable failure
forceApiFailure = false
const missingReply = await rpc('providers', { input: 'deepseek/definitely-not-a-model-xyz' })
check('missing model fails cleanly', missingReply?.result?.ok === false, JSON.stringify(missingReply).slice(0, 300))
console.log('missing model message: ' + missingReply?.result?.error?.message)

// 5. Model catalog for the picker
const catalogReply = await rpc('models', {})
const catalog = catalogReply?.result?.value
check('model catalog ok', catalogReply?.result?.ok === true, JSON.stringify(catalogReply).slice(0, 200))
check('model catalog is large', Array.isArray(catalog) && catalog.length > 300, String(catalog?.length))
const aliasRow = catalog?.find((row) => row.id === '~deepseek/deepseek-flash-latest')
const concreteRow = catalog?.find((row) => row.id === 'deepseek/deepseek-v4.1-flash-1017')
const routerRow = catalog?.find((row) => row.id === 'openrouter/auto')
console.log('alias row: ' + JSON.stringify(aliasRow))
console.log('concrete row: ' + JSON.stringify(concreteRow))
console.log('router row: ' + JSON.stringify(routerRow))
check('alias row flagged', aliasRow?.alias === true && aliasRow?.router === false, JSON.stringify(aliasRow))
check('concrete row not flagged', concreteRow?.alias === false && concreteRow?.router === false, JSON.stringify(concreteRow))
check('router row flagged', routerRow?.router === true, JSON.stringify(routerRow))
check('catalog sorted by name', catalog?.slice(0, 3).every((row) => typeof row.name === 'string') === true)

// 6. Alias model yields an empty list with a readable reason instead of an error
const aliasProviders = await rpc('providers', { input: '~deepseek/deepseek-flash-latest' })
const aliasValue = aliasProviders?.result?.value
check('alias providers ok', aliasProviders?.result?.ok === true, JSON.stringify(aliasProviders).slice(0, 300))
check('alias providers empty', Array.isArray(aliasValue?.providers) && aliasValue.providers.length === 0, String(aliasValue?.providers?.length))
check('alias emptyReason', aliasValue?.emptyReason === 'alias', aliasValue?.emptyReason)

// 7. Router model empty reason
const routerProviders = await rpc('providers', { input: 'openrouter/auto' })
const routerValue = routerProviders?.result?.value
console.log('router providers: ' + JSON.stringify({ ok: routerProviders?.result?.ok, count: routerValue?.providers?.length, reason: routerValue?.emptyReason, error: routerProviders?.result?.error?.message }))
check('router providers empty or explained', routerProviders?.result?.ok === false
  || (routerValue?.providers?.length === 0 && routerValue?.emptyReason === 'router'), JSON.stringify(routerValue).slice(0, 300))

// 8. Garbage input is refused
const badReply = await rpc('providers', { input: 'https://example.com/whatever' })
check('foreign url refused', badReply?.result?.ok === false, JSON.stringify(badReply).slice(0, 200))
console.log('bad input message: ' + badReply?.result?.error?.message)

console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED`)
process.exitCode = failures.length === 0 ? 0 : 1
