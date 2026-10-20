/**
 * Host-route test for the daily-log bundle.
 *
 * Loads the real `apply()` against a fake Cordis context, captures the registered
 * web routes, and drives `/state`, `/save` with a temp `DSH_HOME` so the user's
 * journal is never touched. Covers the `imported` task field round-trip, input
 * sanitization, and the same-origin guard.
 *
 * Run: node test/host-routes.mjs
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const home = mkdtempSync(join(tmpdir(), 'daily-log-test-'))
process.env.DSH_HOME = home

const mod = await import(pathToFileURL(join(import.meta.dirname, '..', 'index.js')).href)

const routes = new Map()
const disposers = []

const ctx = {
  webServer: {
    register(route) {
      routes.set(route.path, route.handler)
      return () => routes.delete(route.path)
    },
  },
  get: name => {
    if (name !== 'sessionQuery') return null
    return {
      async readSession(sessionId) {
        return {
          session: { id: sessionId },
          events: [
            { type: 'user/message', seq: 1, time: 1000, data: {} },
            { type: 'assistant/message', seq: 2, time: 2000, data: { usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 850 } } },
            { type: 'assistant/message', seq: 3, time: 4000, data: { usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0 } } },
          ],
        }
      },
    }
  },
  on: () => () => {},
  effect(fn) {
    // Generator effects yield disposers (routes) in this bundle.
    const iterator = fn()
    if (iterator && typeof iterator.next === 'function') {
      let step = iterator.next()
      while (!step.done) {
        const value = step.value
        if (typeof value === 'function') disposers.push(value)
        step = iterator.next()
      }
    }
    return () => {}
  },
}

mod.apply(ctx)

function fakeReq({ body = null, headers = {}, method = 'POST', url = '/daily-log/save' } = {}) {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== null) yield Buffer.from(body, 'utf8')
    },
    on() {},
    once() {},
    off() {},
  }
}

function fakeRes() {
  return {
    status: 0,
    headers: {},
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers || {}
      this.headersSent = true
    },
    end(chunk) {
      if (chunk) this.body += chunk.toString()
      this.writableEnded = true
    },
    on() {},
    once() {},
    off() {},
  }
}

async function call(path, req) {
  const handler = routes.get(path)
  if (!handler) throw new Error(`route missing: ${path}`)
  const res = fakeRes()
  await handler(req, res)
  return { status: res.status, body: res.body ? JSON.parse(res.body) : null }
}

let failures = 0
function check(label, condition, detail) {
  if (condition) console.log(`PASS  ${label}`)
  else {
    failures += 1
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

check('routes registered', routes.size >= 4, [...routes.keys()].join(', '))

const entry = {
  date: '2026-10-20',
  summary: '带导入标记的一天',
  tasks: [
    {
      id: 'a',
      text: '把发布流程跑一遍',
      done: false,
      imported: { at: 1792427000000, target: 'board', label: '发布插件' },
      evil: 'dropped',
    },
    { id: 'b', text: '写文档', done: true },
  ],
  updatedAt: Date.now(),
}

const saved = await call(
  '/daily-log/save',
  fakeReq({
    headers: { 'content-type': 'application/json', host: '127.0.0.1:1' },
    body: JSON.stringify({ entry }),
  }),
)
check('save accepts a JSON body', saved.status === 200, JSON.stringify(saved.status))
const stored = saved.body?.state?.entries?.['2026-10-20']
check('task count survives', stored?.tasks?.length === 2, JSON.stringify(stored?.tasks?.length))
check('imported marker round-trips', stored?.tasks?.[0]?.imported?.label === '发布插件', JSON.stringify(stored?.tasks?.[0]))
check('imported target round-trips', stored?.tasks?.[0]?.imported?.target === 'board')
check('unknown task keys are dropped', stored?.tasks?.[0]?.evil === undefined)

const typed = await call('/daily-log/save', fakeReq({ headers: { 'content-type': 'text/plain' }, body: '{}' }))
check('non-JSON bodies are refused', typed.status === 415, String(typed.status))

const foreign = await call(
  '/daily-log/save',
  fakeReq({
    headers: { 'content-type': 'application/json', origin: 'http://evil.example', host: '127.0.0.1:1' },
    body: JSON.stringify({ entry }),
  }),
)
check('foreign origins are refused', foreign.status === 403, String(foreign.status))

const sameOrigin = await call(
  '/daily-log/save',
  fakeReq({
    headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:1', host: '127.0.0.1:1' },
    body: JSON.stringify({ entry }),
  }),
)
check('same-origin saves pass', sameOrigin.status === 200, String(sameOrigin.status))

const state = await call('/daily-log/state', fakeReq({ method: 'GET', headers: {} }))
check('state lists the saved day', Boolean(state.body?.entries?.['2026-10-20']))

// ------------------------------------------------------------------------- //
// cost: day spend from the priced usage ledger, task share from the log
// ------------------------------------------------------------------------- //
const usageDir = join(home, 'dsh-usage')
mkdirSync(usageDir, { recursive: true })
writeFileSync(
  join(usageDir, 'usage-ledger.json'),
  JSON.stringify({
    version: 1,
    days: {
      '2026-10-20': {
        'deepseek-official': {
          'deepseek-flash': {
            inputTokens: 1000000,
            outputTokens: 500000,
            cacheReadTokens: 500000,
            cacheWriteTokens: 0,
            calls: 10,
            cost: 1.0,
          },
        },
      },
    },
  }),
  'utf8',
)

const cost = await call(
  '/daily-log/cost',
  fakeReq({
    headers: { 'content-type': 'application/json', host: '127.0.0.1:1' },
    body: JSON.stringify({
      date: '2026-10-20',
      tasks: [{ id: 'a', sessionId: 'session-x', since: 3000 }],
    }),
  }),
)
check('day spend is read from the usage ledger', cost.body?.day?.cost === 1, JSON.stringify(cost.body?.day))
check('day tokens include cache reads', cost.body?.day?.tokens === 2000000, String(cost.body?.day?.tokens))
check('day source is the ledger', cost.body?.source === 'usage-ledger', String(cost.body?.source))
check('blended rate is cost over tokens', Math.abs(cost.body?.ratePerToken - 5e-7) < 1e-12, String(cost.body?.ratePerToken))
check('task counts only events after the import', cost.body?.tasks?.a?.tokens === 30, JSON.stringify(cost.body?.tasks?.a))
check('task spend is tokens times the blended rate', Math.abs(cost.body?.tasks?.a?.cost - 1.5e-5) < 1e-12, String(cost.body?.tasks?.a?.cost))

const noLedger = await call(
  '/daily-log/cost',
  fakeReq({
    headers: { 'content-type': 'application/json', host: '127.0.0.1:1' },
    body: JSON.stringify({ date: '1999-01-01', tasks: [] }),
  }),
)
check('a day without ledger data falls back to a rate', noLedger.body?.source === 'fallback-rate', String(noLedger.body?.source))

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
