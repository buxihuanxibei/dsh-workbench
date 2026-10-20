/**
 * Host half of the "task done chime" bundle.
 *
 * Responsibility split:
 *   - Host: watch agent lifecycle events and record one notification per finished
 *     turn; expose that feed, the sound catalogue, and the audio bytes over the
 *     web carrier.
 *   - Client (`client.js`): poll the feed, play the chosen chime, and render the
 *     in-page toast / controls.
 *
 * Why an HTTP feed instead of push: the dynamic Client half has no documented
 * push channel to its Host half, while `ctx.webServer.register()` is the same
 * transport the shipped wallpaper bundle relies on. The poll is one lightweight
 * long-polling GET that the Host answers from memory.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url))
const SOUND_DIR = join(PACKAGE_DIR, 'sounds')
const BASE = '/task-done-chime'

/** Built-in chimes. The id is the value persisted by the Client. */
const BUILTIN_SOUNDS = [
  {
    id: 'glass-ding',
    file: '06-glass-ding.wav',
    label: '玻璃叮',
    labelEn: 'Glass ding',
    hint: '一记清脆的玻璃叮，0.9 秒收尾，不打断思路',
    hintEn: 'A single bright glass ding that ends in 0.9 s and never interrupts',
    durationMs: 900,
  },
  {
    id: 'music-box',
    file: '04-music-box.wav',
    label: '八音盒',
    labelEn: 'Music box',
    hint: '四个音符的小旋律，最像「任务完成」',
    hintEn: 'A short four-note phrase; the clearest "done" signal',
    durationMs: 3400,
  },
  {
    id: 'crystal-chime',
    file: '01-crystal-chime.wav',
    label: '水晶风铃',
    labelEn: 'Crystal chime',
    hint: '清透晶莹，尾音较长',
    hintEn: 'Bright and glassy, with a long tail',
    durationMs: 3200,
  },
  {
    id: 'soft-marimba',
    file: '02-soft-marimba.wav',
    label: '软木琴',
    labelEn: 'Soft marimba',
    hint: '单个木质音，最短最克制',
    hintEn: 'One wooden note; the shortest and most restrained',
    durationMs: 2400,
  },
  {
    id: 'warm-pad',
    file: '03-warm-pad.wav',
    label: '暖光长音',
    labelEn: 'Warm pad',
    hint: '和弦缓起缓收，最柔软',
    hintEn: 'A slowly swelling chord; the softest',
    durationMs: 3600,
  },
  {
    id: 'water-drop',
    file: '05-water-drop.wav',
    label: '清泉滴落',
    labelEn: 'Water drop',
    hint: '水滴「啵」声，短促圆润',
    hintEn: 'A rounded water-drop blip',
    durationMs: 2600,
  },
]

/** Kept short: only the most recent completions are ever played. */
const FEED_LIMIT = 40
/** Long-poll hold time; the browser re-issues immediately after a timeout. */
const HOLD_MS = 20_000
const TEST_RATE_WINDOW_MS = 10_000
const TEST_RATE_LIMIT = 3

export const inject = ['webServer']

// This profile bundle cannot depend on the schema package inside the dsh
// installation (module resolution does not reach it), so the row's `config` is
// consumed as plain values with the same defaults the patch ships.
export function resolveSettings(config) {
  return {
    defaultSound: typeof config?.defaultSound === 'string' ? config.defaultSound : 'glass-ding',
    announceSubagents: config?.announceSubagents === true,
    mergeWindowMs: typeof config?.mergeWindowMs === 'number' ? config.mergeWindowMs : 1200,
  }
}

// --------------------------------------------------------------------------- //
// helpers
// --------------------------------------------------------------------------- //
function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function listExtraSounds(takenFiles) {
  let names = []
  try {
    names = readdirSync(SOUND_DIR)
  } catch {
    return []
  }
  const extra = []
  for (const name of names.sort()) {
    const ext = extname(name).toLowerCase()
    if (!['.wav', '.mp3', '.ogg', '.m4a'].includes(ext)) continue
    if (takenFiles.has(name)) continue
    const id = name.slice(0, -ext.length)
    extra.push({
      id,
      file: name,
      label: id,
      labelEn: id,
      hint: '自定义音频',
      hintEn: 'Custom audio file',
      durationMs: 0,
      custom: true,
    })
  }
  return extra
}

function soundMime(ext) {
  switch (ext) {
    case '.wav':
      return 'audio/wav'
    case '.mp3':
      return 'audio/mpeg'
    case '.ogg':
      return 'audio/ogg'
    case '.m4a':
      return 'audio/mp4'
    default:
      return 'application/octet-stream'
  }
}

function sendJson(res, status, value) {
  if (res.writableEnded || res.destroyed) return
  const body = JSON.stringify(value)
  // The long-poll below flushes its 200 header before a body exists. Calling
  // writeHead again then throws ERR_HTTP_HEADERS_SENT; that throw runs inside a
  // timer callback, so it is uncaught and takes the whole host process down.
  if (res.headersSent) {
    res.end(body)
    return
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

// --------------------------------------------------------------------------- //
// plugin
// --------------------------------------------------------------------------- //
export function apply(ctx, config) {
  const settings = resolveSettings(config)

  const takenFiles = new Set(BUILTIN_SOUNDS.map(sound => sound.file))
  const catalogue = new Map()
  for (const sound of [...BUILTIN_SOUNDS, ...listExtraSounds(takenFiles)]) {
    catalogue.set(sound.id, sound)
  }
  const soundList = [...catalogue.values()].map(({ file, ...publicPart }) => publicPart)
  if (!catalogue.has(settings.defaultSound)) settings.defaultSound = 'glass-ding'

  // Ids are wall-clock based so they stay monotonic across a Host restart. A
  // plain counter would reset to 1 and every browser that kept a cursor from
  // the previous process would silently skip all new notifications.
  let nextId = Date.now()
  /** @type {Array<object>} */
  const recent = []
  /** @type {Set<(status:string) => void>} */
  const waiters = new Set()
  /**
   * Diagnostics for "the plugin never rang": the counters distinguish a host
   * that never records completions from a browser that never polls the feed.
   */
  const stats = { feedCount: 0, lastFeedAt: 0, held: 0, maxHeld: 0, testCount: 0, lastTestAt: 0 }

  const flush = status => {
    const pending = [...waiters]
    waiters.clear()
    for (const wake of pending) {
      try {
        wake(status)
      } catch {
        /* ignore */
      }
    }
  }

  const record = (input, { test = false } = {}) => {
    const entry = {
      id: nextId++,
      sessionId: typeof input.sessionId === 'string' ? input.sessionId : '',
      sessionTitle: typeof input.sessionTitle === 'string' ? input.sessionTitle : null,
      turn: Number.isFinite(input.turn) ? input.turn : 0,
      at: Date.now(),
      reason: typeof input.reason === 'string' ? input.reason : 'completed',
      test,
    }
    recent.push(entry)
    if (recent.length > FEED_LIMIT) recent.splice(0, recent.length - FEED_LIMIT)
    flush('new')
    return entry
  }

  /** SessionIds currently running in this Host process. */
  const running = new Set()
  /** Last finished turn per Session, consumed by its idle transition. */
  const finishedTurn = new Map()
  let mergeTimer = null
  let merged = null

  const isSubagent = session => {
    try {
      return session?.header?.origin === 'subagent'
    } catch {
      return false
    }
  }

  const announce = (session, finished) => {
    let sessionTitle = null
    try {
      const title = session.header?.title
      if (typeof title === 'string') sessionTitle = title
    } catch {
      /* no title available */
    }
    const payload = {
      sessionId: session.id,
      sessionTitle,
      turn: finished.turn,
      reason: finished.reason,
    }
    if (settings.mergeWindowMs <= 0) {
      record(payload)
      return
    }
    // Several sessions can settle in the same tick (a team fan-out): collapse
    // them into one chime carrying the latest completion, so the browser never
    // plays two overlapping chimes.
    merged = payload
    if (mergeTimer === null) {
      mergeTimer = setTimeout(() => {
        mergeTimer = null
        const latest = merged
        merged = null
        if (latest) record(latest)
      }, settings.mergeWindowMs)
    }
  }

  // ----------------------------------------------------------------------- //
  // lifecycle detection
  // ----------------------------------------------------------------------- //
  ctx.effect(function* () {
    ctx.on('session/event', (session, event) => {
      if (event?.type !== 'turn/end') return
      const reason = event.data?.reason?.kind
      if (typeof reason !== 'string') return
      if (reason !== 'completed' && reason !== 'error' && reason !== 'max-tokens') return
      finishedTurn.set(session.id, { turn: event.data.turn, reason })
      if (finishedTurn.size > 256) {
        const first = finishedTurn.keys().next().value
        if (first !== undefined) finishedTurn.delete(first)
      }
    })

    ctx.on('session/disposed', session => {
      try {
        running.delete(session.id)
        finishedTurn.delete(session.id)
      } catch {
        /* ignore */
      }
    })

    ctx.on('agent/status', ({ agent, status }) => {
      let session
      try {
        session = agent.session
      } catch {
        return
      }
      if (!session?.id) return

      if (status === 'running') {
        running.add(session.id)
        finishedTurn.delete(session.id)
        return
      }
      if (status !== 'idle') return
      // Only a genuine running -> idle transition counts. A Host restart starts
      // with no sessions in `running`, so it never fires a burst of stale chimes.
      if (!running.delete(session.id)) return
      const finished = finishedTurn.get(session.id)
      finishedTurn.delete(session.id)
      if (!finished) return
      if (!settings.announceSubagents && isSubagent(session)) return
      announce(session, finished)
    })

    yield () => {
      if (mergeTimer !== null) {
        clearTimeout(mergeTimer)
        mergeTimer = null
      }
      flush('closed')
    }
  }, 'task-done-chime lifecycle')

  // ----------------------------------------------------------------------- //
  // web routes
  // ----------------------------------------------------------------------- //
  ctx.effect(function* () {
    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/config`,
      handler: (_req, res) => {
        sendJson(res, 200, {
          defaultSound: settings.defaultSound,
          announceSubagents: settings.announceSubagents,
          mergeWindowMs: settings.mergeWindowMs,
          sounds: soundList,
        })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/feed`,
      handler: (req, res) => {
        const url = new URL(req.url ?? `${BASE}/feed`, 'http://127.0.0.1')
        const raw = Number.parseInt(url.searchParams.get('since') ?? '0', 10)
        const cursor = Number.isFinite(raw) ? raw : 0

        let closed = false
        let timer = null
        let wake = null
        let held = false

        stats.feedCount += 1
        stats.lastFeedAt = Date.now()

        const finish = () => {
          if (closed) return
          closed = true
          if (held) {
            held = false
            stats.held = Math.max(0, stats.held - 1)
          }
          if (timer !== null) clearTimeout(timer)
          if (wake) waiters.delete(wake)
          req.off('close', finish)
          res.off('close', finish)
        }

        const reply = status => {
          if (closed) return
          finish()
          const items = recent.filter(item => item.id > cursor)
          try {
            sendJson(res, 200, {
              cursor: items.length > 0 ? items[items.length - 1].id : cursor,
              nextCursor: nextId - 1,
              status,
              items,
            })
          } catch (error) {
            // A socket that died mid-hold must never reach the uncaught handler.
            console.error('[task-done-chime] feed reply failed:', error)
            if (!res.writableEnded && !res.destroyed) res.destroy()
          }
        }

        const immediate = recent.filter(item => item.id > cursor)
        if (immediate.length > 0) {
          reply('new')
          return
        }

        // Hold the response open without writing a body: the long-poll shape.
        if (res.writableEnded || res.destroyed) return
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        wake = status => reply(status)
        waiters.add(wake)
        held = true
        stats.held += 1
        stats.maxHeld = Math.max(stats.maxHeld, stats.held)
        timer = setTimeout(() => reply('timeout'), HOLD_MS)
        req.once('close', finish)
        res.once('close', finish)
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/stats`,
      handler: (_req, res) => {
        sendJson(res, 200, {
          ...stats,
          now: Date.now(),
          nextId,
          recent: recent.slice(-5),
        })
      },
    })

    yield ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/test`,
      handler: (_req, res) => {
        const now = Date.now()
        stats.testCount += 1
        stats.lastTestAt = now
        const hits = recent.filter(item => item.test && now - item.at < TEST_RATE_WINDOW_MS)
        if (hits.length >= TEST_RATE_LIMIT) {
          sendJson(res, 429, { error: 'rate-limited', retryAfterMs: TEST_RATE_WINDOW_MS })
          return
        }
        const entry = record({ sessionId: '', sessionTitle: null, turn: 0, reason: 'test' }, { test: true })
        sendJson(res, 200, { ok: true, notification: entry })
      },
    })

    yield ctx.webServer.register({
      kind: 'prefix',
      path: `${BASE}/sounds`,
      handler: (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const rest = url.pathname.slice(`${BASE}/sounds/`.length)
        let id = rest
        try {
          id = decodeURIComponent(rest)
        } catch {
          /* keep the raw segment */
        }
        const sound = catalogue.get(id)
        if (!sound) {
          sendJson(res, 404, { error: 'unknown-sound', id })
          return
        }
        const file = join(SOUND_DIR, sound.file)
        if (!isFile(file)) {
          sendJson(res, 404, { error: 'missing-file', id })
          return
        }
        const bytes = readFileSync(file)
        const etag = `"${bytes.length.toString(36)}-${bytes.readUInt32BE(0).toString(36)}"`
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag })
          res.end()
          return
        }
        res.writeHead(200, {
          'Content-Type': soundMime(extname(sound.file).toLowerCase()),
          'Content-Length': bytes.length,
          ETag: etag,
          'Cache-Control': 'public, max-age=3600',
        })
        res.end(bytes)
      },
    })
  }, 'task-done-chime routes')
}
