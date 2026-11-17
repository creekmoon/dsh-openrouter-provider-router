/**
 * Out-of-process verification for the OpenRouter provider plugin Host half.
 * Stubs fetch and the Cordis context, then asserts rewrite/route/persistence behavior.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const pluginDir = fileURLToPath(new URL('..', import.meta.url))
const home = join(tmpdir(), 'dsh-openrouter-provider-test-home')
const model = 'deepseek/deepseek-v4.1-flash-1017'

rmSync(home, { recursive: true, force: true })
mkdirSync(home, { recursive: true })
process.env.DSH_HOME = home
writeFileSync(join(home, 'openrouter-provider.json'), JSON.stringify({
  version: 1,
  rules: { [model]: { only: ['stepfun/fp8'], allowFallbacks: false } },
}))

const failures = []
function check(name, condition, detail) {
  if (condition) console.log('PASS ' + name)
  else { failures.push(name + (detail ? ' :: ' + detail : '')); console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}

const calls = []
const stubFetch = async (input, init) => {
  calls.push({ url: String(input), init })
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
}
globalThis.fetch = stubFetch

let registered
const effects = []
const ctx = {
  logger: { warn: (message) => console.log('WARN ' + message), debug: (message) => console.log('DBG ' + message) },
  effect(factory, label) { const dispose = factory(); effects.push({ label, dispose }); return dispose },
  connection: {
    fetch: {
      register(route) { registered = route; return async () => { registered = undefined } },
    },
  },
  get(key) {
    if (key === 'agentDefaultModel') {
      return { currentSelection: () => ({ provider: 'openrouter', model }) }
    }
    return undefined
  },
}

const { apply } = await import(pathToFileURL(join(pluginDir, 'index.js')).href)
apply(ctx)

check('fetch patched after apply', globalThis.fetch !== stubFetch)
check('effect count is two', effects.length === 2, String(effects.length))
check('rpc route registered at /api/openrouter-provider', registered?.path === '/api/openrouter-provider', registered?.path)
check('rpc route accepts POST only', JSON.stringify(registered?.methods) === '["POST"]')
check('rpc route buffers body', registered?.requestBody === 'buffered')

function bodyOf(call) {
  try { return JSON.parse(call.init.body) } catch { return undefined }
}

// 1. matching model gets provider routing
calls.length = 0
await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], reasoning_effort: 'max' }),
})
const rewritten = bodyOf(calls[0])
check('request still reaches the original fetch', calls.length === 1)
check('provider.only injected', JSON.stringify(rewritten?.provider?.only) === '["stepfun/fp8"]', JSON.stringify(rewritten?.provider))
check('allow_fallbacks injected', rewritten?.provider?.allow_fallbacks === false)
check('unrelated fields preserved', rewritten?.reasoning_effort === 'max' && Array.isArray(rewritten?.messages))

// 2. region endpoint counts too
calls.length = 0
await globalThis.fetch('https://us.openrouter.ai/api/v1/chat/completions', {
  method: 'POST', body: JSON.stringify({ model }),
})
check('regional openrouter host matched', bodyOf(calls[0])?.provider?.only?.[0] === 'stepfun/fp8')

// 3. other models untouched
calls.length = 0
await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST', body: JSON.stringify({ model: 'google/gemini-9', temperature: 0.2 }),
})
check('unmatched model untouched', bodyOf(calls[0])?.provider === undefined, JSON.stringify(bodyOf(calls[0])))

// 4. other hosts untouched
calls.length = 0
await globalThis.fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST', body: JSON.stringify({ model }),
})
check('non-openrouter host untouched', bodyOf(calls[0])?.provider === undefined)

// 5. non-JSON bodies untouched
calls.length = 0
await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', body: 'not json' })
check('unparsable body passed through unchanged', calls[0]?.init.body === 'not json')

// 6. RPC: state
async function rpc(method, payload) {
  const request = new Request('http://localhost/api/openrouter-provider', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'openrouter-provider', payload: { method, payload } }),
  })
  const response = await registered.fetch(request)
  return await response.json()
}

const stateReply = await rpc('state', {})
check('rpc state ok', stateReply?.result?.ok === true, JSON.stringify(stateReply).slice(0, 200))
check('rpc state reports default model', stateReply?.result?.value?.defaultSelection?.model === model)
check('rpc state reports the stored rule', stateReply?.result?.value?.rules?.[model]?.only?.[0] === 'stepfun/fp8')

// 7. RPC: save then rewrite follows the new rule
const saveReply = await rpc('save', { scope: 'model', model: 'deepseek/deepseek-r1', only: ['deepinfra/fp8', 'novita/fp8'], allowFallbacks: true })
check('rpc save ok', saveReply?.result?.ok === true, JSON.stringify(saveReply).slice(0, 300))
const disk = JSON.parse(readFileSync(join(home, 'openrouter-provider.json'), 'utf8'))
check('save persisted to disk', disk?.rules?.['deepseek/deepseek-r1']?.only?.length === 2, JSON.stringify(disk))
calls.length = 0
await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST', body: JSON.stringify({ model: 'deepseek/deepseek-r1' }),
})
check('new rule applies immediately', JSON.stringify(bodyOf(calls[0])?.provider) === '{"only":["deepinfra/fp8","novita/fp8"],"allow_fallbacks":true}', JSON.stringify(bodyOf(calls[0])?.provider))

// 8. RPC: invalid input rejected
const badReply = await rpc('save', { scope: 'model', model: 'not a model', only: ['x'] })
check('rpc rejects a bad model id', badReply?.result?.ok === false, JSON.stringify(badReply).slice(0, 200))
const emptyReply = await rpc('save', { scope: 'model', model, only: [] })
check('rpc rejects an empty selection', emptyReply?.result?.ok === false)

// 9. RPC: providers (network stubbed to an empty endpoint list)
const providersReply = await rpc('providers', { input: 'deepseek/deepseek-v4.1-flash-1017' })
check('rpc providers ok', providersReply?.result?.ok === true, JSON.stringify(providersReply).slice(0, 200))
check('rpc providers returns the catalog shape', Array.isArray(providersReply?.result?.value?.providers))

// 10. RPC: clear removes the rule
const clearReply = await rpc('clear', { scope: 'model', model: 'deepseek/deepseek-r1' })
check('rpc clear ok', clearReply?.result?.ok === true)
const afterClear = JSON.parse(readFileSync(join(home, 'openrouter-provider.json'), 'utf8'))
check('clear persisted', afterClear?.rules?.['deepseek/deepseek-r1'] === undefined, JSON.stringify(afterClear))

// 10b. DSH-style `~` prefix: saving works and the wire model without `~` still matches
const tildeReply = await rpc('save', { scope: 'model', model: '~deepseek/deepseek-flash-latest', only: ['deepseek'], allowFallbacks: false })
check('rpc accepts a `~`-prefixed model id', tildeReply?.result?.ok === true, JSON.stringify(tildeReply).slice(0, 300))
calls.length = 0
await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST', body: JSON.stringify({ model: 'deepseek/deepseek-flash-latest' }),
})
check('`~` key matches the stripped wire model', JSON.stringify(bodyOf(calls[0])?.provider) === '{"only":["deepseek"],"allow_fallbacks":false}', JSON.stringify(bodyOf(calls[0])?.provider))
calls.length = 0
await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST', body: JSON.stringify({ model: '~deepseek/deepseek-flash-latest' }),
})
check('`~` key matches the `~` wire model', bodyOf(calls[0])?.provider?.only?.[0] === 'deepseek')

// 10c. path-traversal model ids are refused
const traversalReply = await rpc('save', { scope: 'model', model: 'deepseek/..', only: ['deepseek'] })
check('rpc refuses a traversal model id', traversalReply?.result?.ok === false)

// 11. dispose restores fetch
await effects[1].dispose?.()
await effects[0].dispose?.()
check('dispose restored the original fetch', globalThis.fetch === stubFetch)

console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED`)
process.exitCode = failures.length === 0 ? 0 : 1
