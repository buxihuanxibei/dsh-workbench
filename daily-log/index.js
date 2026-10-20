/**
 * Host half of the "daily log" bundle.
 *
 * The panel itself lives in `client.js`; this half owns the one thing a Client
 * half cannot own: durable, cross-browser storage of the journal.
 *
 * Storage: one JSON document under `$DSH_HOME/plugin-data/dsh-daily-log/`. The
 * document is small (one record per day), so it is read whole, kept in memory,
 * and written atomically (temp file + rename) after every accepted save. Writes
 * are serialized through one promise chain so two quick saves cannot interleave.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = '/daily-log'
const STORE_VERSION = 1
const MAX_TEXT = 20000
const MAX_TASKS = 200

function dataHome() {
  const home = process.env.DSH_HOME
  if (home && home.trim()) return home.trim()
  try {
    return join(homedir(), '.dsh')
  } catch {
    return process.cwd()
  }
}

const DATA_DIR = join(dataHome(), 'plugin-data', 'dsh-daily-log')
const DATA_FILE = join(DATA_DIR, 'journal.json')

function emptyDocument() {
  return {
    version: STORE_VERSION,
    /** @type {Record<string, {date:string, summary:string, tasks:Array<{id:string,text:string,done:boolean}>, updatedAt:number}>} */
    entries: {},
    lastOpenedAt: null,
    lastOpenedDate: null,
  }
}

function sanitizeText(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return ''
  return value.length > max ? value.slice(0, max) : value
}

function sanitizeTask(task) {
  const imported = task?.imported
  let importedValue
  if (imported && typeof imported === 'object') {
    const label = sanitizeText(imported.label, 200).trim()
    if (label) {
      importedValue = {
        at: Number.isFinite(imported.at) ? Number(imported.at) : Date.now(),
        label,
        target: imported.target === 'board' ? 'board' : 'session',
      }
      // The conversation a task was sent into, kept so its spend can be
      // attributed back to the task.
      const sessionId = sanitizeText(imported.sessionId, 200).trim()
      if (sessionId) importedValue.sessionId = sessionId
    }
  }
  return {
    id: sanitizeText(task?.id, 64) || `t-${Math.random().toString(36).slice(2, 10)}`,
    text: sanitizeText(task?.text, 2000).trim(),
    done: task?.done === true,
    ...(importedValue ? { imported: importedValue } : {}),
  }
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const date = sanitizeText(raw.date, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.slice(0, MAX_TASKS).map(sanitizeTask).filter(task => task.text.length > 0)
    : []
  return {
    date,
    summary: sanitizeText(raw.summary),
    tasks,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : Date.now(),
  }
}

function sendJson(res, status, value) {
  if (res.writableEnded || res.destroyed) return
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

/**
 * The journal is personal data, so every mutating route insists on a JSON body
 * and a same-origin request. A cross-site page cannot send that content type
 * without a CORS preflight (which this route never approves), and a forged
 * Origin is rejected; requests without Origin stay allowed for local tooling.
 * Returns 0 when admitted, otherwise the HTTP status to answer with.
 */
function rejectMutation(req) {
  const type = String(req.headers['content-type'] || '').toLowerCase()
  if (!type.startsWith('application/json')) return 415
  const origin = req.headers.origin
  if (!origin) return 0
  try {
    return new URL(origin).host === String(req.headers.host || '') ? 0 : 403
  } catch {
    return 403
  }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('body-too-large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('invalid-json')
  }
}

// --------------------------------------------------------------------------- //
// rough money attribution
// --------------------------------------------------------------------------- //
/**
 * Blended fallback price in CNY per million tokens, used only when the day has
 * no priced ledger entry at all. The real number always comes from the usage
 * ledger the "@linxin666/dsh-usage" plugin maintains (per day / provider /
 * model, already priced in CNY), so this constant never overrides real data.
 */
const FALLBACK_CNY_PER_MILLION = 2

const LEDGER_FILE = join(dataHome(), 'dsh-usage', 'usage-ledger.json')

/**
 * Display labels for the presets this deployment ships. The registry exposes
 * ids only (their YAML carries no localized name), so the chooser would show
 * "standard / ptc / minimal" verbatim; these labels give the same presets a
 * readable Chinese and English name. A custom preset that declares its own name
 * or description always wins over this table.
 */
const PRESET_LABELS = {
  standard: {
    en: 'Standard mode',
    zh: '标准模式',
    descEn: 'Work with code, files, and information; the everyday mode',
    descZh: '处理代码、文件和资料，适合大多数任务。Agent 会按需使用检索、编辑和终端等工具。',
  },
  ptc: {
    en: 'PTC mode',
    zh: 'PTC 模式',
    descEn: 'Every Standard capability, better for batch tool calls',
    descZh: '包含标准模式的所有能力，更适合批量调用工具，并对结果做筛选、整理、去重或统计。',
  },
  minimal: {
    en: 'Minimal mode',
    zh: '极简模式',
    descEn: 'Terminal and image reading with context compaction',
    descZh: 'Agent 使用终端和图片读取工具，并支持上下文压缩，适合测试与对比基础表现。',
  },
  cordis: {
    en: 'Creator mode',
    zh: '创造模式',
    descEn: 'Customize DSH through conversation; the agent writes plugins',
    descZh: '用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词创建自己的模式。',
  },
  liangshen: {
    en: 'Liangshen mode',
    zh: '梁神模式',
    descEn: 'The theatrical high-intensity mode',
    descZh: '自带长篇描述的整活模式',
  },
}

function localDateKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readDayUsage(date) {
  const empty = { cost: 0, tokens: 0, calls: 0, byModel: [] }
  let ledger
  try {
    ledger = JSON.parse(readFileSync(LEDGER_FILE, 'utf8'))
  } catch {
    return empty
  }
  const day = ledger && ledger.days && ledger.days[date]
  if (!day || typeof day !== 'object') return empty
  let cost = 0
  let tokens = 0
  let calls = 0
  const byModel = []
  for (const [provider, models] of Object.entries(day)) {
    if (!models || typeof models !== 'object') continue
    for (const [model, entry] of Object.entries(models)) {
      if (!entry || typeof entry !== 'object') continue
      const input = Number(entry.inputTokens) || 0
      const output = Number(entry.outputTokens) || 0
      const cacheRead = Number(entry.cacheReadTokens) || 0
      const cacheWrite = Number(entry.cacheWriteTokens) || 0
      const modelTokens = input + output + cacheRead + cacheWrite
      const modelCost = Number(entry.cost) || 0
      const modelCalls = Number(entry.calls) || 0
      cost += modelCost
      tokens += modelTokens
      calls += modelCalls
      byModel.push({ provider, model, cost: modelCost, tokens: modelTokens, calls: modelCalls })
    }
  }
  byModel.sort((left, right) => right.cost - left.cost)
  return { cost, tokens, calls, byModel }
}

/**
 * Archive/pin sets of the durable workspace registry. Read from its storage
 * document because the service exposes mutations only; a missing or reshaped
 * file degrades to "no filters" rather than failing the chooser.
 */
function readWorkspaceFlags() {
  try {
    const raw = JSON.parse(readFileSync(join(dataHome(), 'storages', 'workspace.json'), 'utf8'))
    const global = raw && raw.global ? raw.global : {}
    return {
      archived: new Set(Array.isArray(global.archivedSessionIds) ? global.archivedSessionIds : []),
      pinned: new Set(Array.isArray(global.pinnedSessionIds) ? global.pinnedSessionIds : []),
    }
  } catch {
    return { archived: new Set(), pinned: new Set() }
  }
}

/** Token usage of one conversation after `since`, read from its durable log. */
async function readSessionUsage(query, sessionId, since) {
  if (!query || typeof query.readSession !== 'function') return { tokens: 0, calls: 0 }
  try {
    const snapshot = await query.readSession(sessionId)
    let tokens = 0
    let calls = 0
    for (const event of Array.isArray(snapshot && snapshot.events) ? snapshot.events : []) {
      if (!event || event.type !== 'assistant/message') continue
      if (Number(event.time) < since) continue
      const usage = event.data && event.data.usage
      if (!usage || typeof usage !== 'object') continue
      tokens +=
        (Number(usage.inputTokens) || 0) +
        (Number(usage.outputTokens) || 0) +
        (Number(usage.cacheReadTokens) || 0) +
        (Number(usage.cacheWriteTokens) || 0)
      calls += 1
    }
    return { tokens, calls }
  } catch {
    return { tokens: 0, calls: 0, error: true }
  }
}

export const inject = ['webServer']

export function apply(ctx) {
  if (!ctx.webServer || typeof ctx.webServer.register !== 'function') {
    // The panel is web-only; a headless composition simply has nothing to serve.
    return
  }

  let document = emptyDocument()
  let writeChain = Promise.resolve()

  try {
    const raw = readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      document = emptyDocument()
      if (parsed.entries && typeof parsed.entries === 'object') {
        for (const value of Object.values(parsed.entries)) {
          const entry = sanitizeEntry(value)
          if (entry) document.entries[entry.date] = entry
        }
      }
      if (Number.isFinite(parsed.lastOpenedAt)) document.lastOpenedAt = parsed.lastOpenedAt
      if (typeof parsed.lastOpenedDate === 'string') document.lastOpenedDate = parsed.lastOpenedDate
    }
  } catch {
    // Missing file on first run (or unreadable state): start empty rather than
    // failing the plugin; the next accepted save recreates it.
  }

  const persist = () => {
    const snapshot = JSON.stringify(document, null, 2)
    writeChain = writeChain
      .catch(() => {})
      .then(() => {
        mkdirSync(DATA_DIR, { recursive: true })
        const temp = `${DATA_FILE}.tmp`
        writeFileSync(temp, snapshot, 'utf8')
        renameSync(temp, DATA_FILE)
      })
      .catch(() => {
        /* keep the in-memory state; a later save retries the write */
      })
    return writeChain
  }

  const publicState = () => ({
    version: document.version,
    entries: document.entries,
    lastOpenedAt: document.lastOpenedAt,
    lastOpenedDate: document.lastOpenedDate,
    serverTime: Date.now(),
  })

  ctx.effect(function* () {
    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/state`,
      handler: (_req, res) => {
        sendJson(res, 200, publicState())
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/save`,
      handler: async (req, res) => {
        const rejected = rejectMutation(req)
        if (rejected) {
          sendJson(res, rejected, { error: 'rejected' })
          return
        }
        let body
        try {
          body = await readBody(req)
        } catch (error) {
          sendJson(res, 400, { error: String(error.message || error) })
          return
        }
        const entry = sanitizeEntry(body?.entry)
        if (!entry) {
          sendJson(res, 400, { error: 'invalid-entry' })
          return
        }
        const existing = document.entries[entry.date]
        if (!existing || entry.updatedAt >= existing.updatedAt) {
          document.entries[entry.date] = entry
        }
        await persist()
        sendJson(res, 200, { ok: true, state: publicState() })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/touch`,
      handler: async (req, res) => {
        const rejected = rejectMutation(req)
        if (rejected) {
          sendJson(res, rejected, { error: 'rejected' })
          return
        }
        let body
        try {
          body = await readBody(req)
        } catch {
          body = {}
        }
        const previous = {
          lastOpenedAt: document.lastOpenedAt,
          lastOpenedDate: document.lastOpenedDate,
        }
        const date = sanitizeText(body?.date, 10)
        document.lastOpenedAt = Date.now()
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) document.lastOpenedDate = date
        await persist()
        sendJson(res, 200, { ok: true, previous, state: publicState() })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/presets`,
      handler: async (_req, res) => {
        // The Client half cannot enumerate agent presets, so the Host asks the
        // registry and serves a display-only list for the import chooser.
        let presets = []
        let lastUsedPreset = ''
        try {
          const registry = typeof ctx.get === 'function' ? ctx.get('agentPresets') : null
          if (registry && typeof registry.list === 'function') {
            const list = await registry.list()
            // The selection roster is what the shipped preset picker renders;
            // when it carries a display name, that name is the one users see.
            let rosterRows = []
            try {
              if (typeof registry.remoteExportList === 'function') {
                const roster = await registry.remoteExportList()
                rosterRows = Array.isArray(roster?.presets) ? roster.presets : []
              }
            } catch {
              rosterRows = []
            }
            const rosterById = new Map(rosterRows.filter(row => row && typeof row.id === 'string').map(row => [row.id, row]))
            presets = (Array.isArray(list) ? list : [])
              .filter(item => item && typeof item.id === 'string' && !item.broken)
              .map(item => {
                const rosterRow = rosterById.get(item.id) || null
                const rosterName = rosterRow && typeof rosterRow.name === 'string' ? rosterRow.name.trim() : ''
                const rosterDescription = rosterRow && typeof rosterRow.description === 'string' ? rosterRow.description.trim() : ''
                const translation = PRESET_LABELS[item.id] || PRESET_LABELS[String(item.id).replace(/^preset[-_]/, '')] || null
                const listName = typeof item.name === 'string' ? item.name.trim() : ''
                const declaredName = rosterName || listName
                const declaredDescription = rosterDescription || (typeof item.description === 'string' ? item.description.trim() : '')
                const nameIsId = !declaredName || declaredName === item.id
                const fallback = translation || { en: prettifyPresetId(item.id), zh: prettifyPresetId(item.id), descEn: '', descZh: '' }
                return {
                  id: item.id,
                  name: nameIsId ? fallback.en : declaredName,
                  nameZh: nameIsId ? fallback.zh : declaredName,
                  description: declaredDescription || fallback.descEn,
                  descriptionZh: declaredDescription || fallback.descZh,
                  isDefault: item.isDefault === true,
                }
              })
          }
          // The preset of the most recent conversation: the chooser should open
          // on the mode the user was last working in, not the registry default.
          const query = typeof ctx.get === 'function' ? ctx.get('sessionQuery') : null
          if (query && typeof query.listSessions === 'function') {
            const records = await query.listSessions()
            const recent = (Array.isArray(records) ? records : [])
              .filter(record => record && record.header && record.header.agentPreset && record.header.origin !== 'subagent')
              .sort((left, right) => (Number(right.header.createdAt) || 0) - (Number(left.header.createdAt) || 0))
            if (recent.length > 0) lastUsedPreset = String(recent[0].header.agentPreset)
          }
        } catch {
          presets = []
        }
        sendJson(res, 200, { presets, lastUsedPreset })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/workspaces`,
      handler: (_req, res) => {
        // The Client half cannot list workspaces, so the Host serves the registry
        // for the "start working" chooser.
        let workspaces = []
        try {
          const registry = typeof ctx.get === 'function' ? ctx.get('workspaceRegistry') : null
          if (registry && typeof registry.list === 'function') {
            workspaces = (Array.isArray(registry.list()) ? registry.list() : [])
              .filter(item => item && typeof item.id === 'string')
              .map(item => ({
                id: item.id,
                title: typeof item.title === 'string' && item.title ? item.title : item.path,
                path: typeof item.path === 'string' ? item.path : '',
              }))
          }
        } catch {
          workspaces = []
        }
        sendJson(res, 200, { workspaces })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/sessions`,
      handler: async (req, res) => {
        // Sessions of one workspace, so a task can continue an earlier
        // conversation instead of always starting a new one.
        const url = new URL(req.url ?? `${BASE}/sessions`, 'http://127.0.0.1')
        const workspaceId = url.searchParams.get('workspace') || ''
        let sessions = []
        let hiddenSummary = { archived: 0, unnamed: 0, shown: 0 }
        try {
          const registry = typeof ctx.get === 'function' ? ctx.get('workspaceRegistry') : null
          const workspace = registry && workspaceId && typeof registry.get === 'function'
            ? registry.get(workspaceId)
            : null
          const cwd = workspace && typeof workspace.path === 'string' ? workspace.path : ''
          const query = typeof ctx.get === 'function' ? ctx.get('sessionQuery') : null
          if (cwd && query && typeof query.listSessions === 'function') {
            const normalize = value =>
              String(value || '')
                .replace(/\\/g, '/')
                .replace(/\/+$/, '')
                .toLowerCase()
            const target = normalize(cwd)
            const records = await query.listSessions()
            const matching = (Array.isArray(records) ? records : []).filter(
              record =>
                record &&
                record.header &&
                typeof record.header.cwd === 'string' &&
                normalize(record.header.cwd) === target &&
                record.header.origin !== 'subagent',
            )
            const includeAll = url.searchParams.get('all') === '1'
            const flags = readWorkspaceFlags()
            const candidates = matching.slice(0, 120)
            const titleById = new Map()
            if (candidates.length > 0 && typeof query.readTitleSnapshots === 'function') {
              try {
                const observations = await query.readTitleSnapshots(candidates.map(record => record.header.id))
                for (const observation of Array.isArray(observations) ? observations : []) {
                  if (observation && observation.status === 'fulfilled' && observation.value?.title?.title) {
                    titleById.set(observation.sessionId, observation.value.title.title)
                  }
                }
              } catch {
                /* titles are cosmetic */
              }
            }
            const entries = candidates.map(record => {
              const id = record.header.id
              return {
                id,
                title: titleById.get(id) || '',
                createdAt: Number(record.header.createdAt) || 0,
                live: record.live === true,
                archived: flags.archived.has(id),
                pinned: flags.pinned.has(id),
              }
            })
            const archivedCount = entries.filter(entry => entry.archived).length
            const unnamedCount = entries.filter(entry => !entry.archived && entry.title === '').length
            // Default view: named, unarchived conversations only — the chooser is
            // for continuing real work, not for browsing every empty shell.
            const visible = entries
              .filter(entry => (includeAll ? true : !entry.archived && entry.title !== ''))
              .sort(
                (left, right) =>
                  Number(right.pinned) - Number(left.pinned) || right.createdAt - left.createdAt,
              )
            sessions = visible.slice(0, 30).map(entry => ({
              id: entry.id,
              title: entry.title || '(未命名会话)',
              createdAt: entry.createdAt,
              live: entry.live,
              archived: entry.archived,
              pinned: entry.pinned,
            }))
            hiddenSummary = { archived: archivedCount, unnamed: unnamedCount, shown: sessions.length }
          }
        } catch {
          sessions = []
        }
        sendJson(res, 200, { sessions, hidden: hiddenSummary })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/cost`,
      handler: async (req, res) => {
        const rejected = rejectMutation(req)
        if (rejected) {
          sendJson(res, rejected, { error: 'rejected' })
          return
        }
        let body
        try {
          body = await readBody(req)
        } catch (error) {
          sendJson(res, 400, { error: String(error.message || error) })
          return
        }
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date || '')) ? body.date : localDateKey()
        const day = readDayUsage(date)
        const ratePerToken = day.tokens > 0 ? day.cost / day.tokens : FALLBACK_CNY_PER_MILLION / 1e6
        const query = typeof ctx.get === 'function' ? ctx.get('sessionQuery') : null
        // Bound the work a single panel load can trigger: each task may read one
        // conversation log, so keep the batch small.
        const tasks = Array.isArray(body?.tasks) ? body.tasks.slice(0, 40) : []
        const usageCache = new Map()
        const perTask = {}
        for (const item of tasks) {
          const id = typeof item?.id === 'string' ? item.id : ''
          const sessionId = typeof item?.sessionId === 'string' ? item.sessionId : ''
          if (!id || !sessionId) continue
          const since = Number.isFinite(item?.since) ? Number(item.since) : 0
          const key = `${sessionId}@${since}`
          let usage = usageCache.get(key)
          if (!usage) {
            usage = await readSessionUsage(query, sessionId, since)
            usageCache.set(key, usage)
          }
          perTask[id] = {
            tokens: usage.tokens,
            calls: usage.calls,
            cost: usage.tokens * ratePerToken,
            ...(usage.error ? { unavailable: true } : {}),
          }
        }
        sendJson(res, 200, {
          date,
          currency: 'CNY',
          approximate: true,
          source: day.tokens > 0 ? 'usage-ledger' : 'fallback-rate',
          ratePerToken,
          day,
          tasks: perTask,
        })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/export`,
      handler: (_req, res) => {
        const dates = Object.keys(document.entries).sort().reverse()
        const lines = ['# 工作日志导出', '']
        for (const date of dates) {
          const entry = document.entries[date]
          lines.push(`## ${date}`, '')
          if (entry.summary.trim()) lines.push(entry.summary.trim(), '')
          if (entry.tasks.length > 0) {
            entry.tasks.forEach((task, index) => {
              lines.push(`${index + 1}. [${task.done ? 'x' : ' '}] ${task.text}`)
            })
            lines.push('')
          }
        }
        const body = lines.join('\n')
        res.writeHead(200, {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'Cache-Control': 'no-store',
        })
        res.end(body)
      },
    })
  }, 'daily-log storage routes')
}
