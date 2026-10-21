window.__ModuleLoader__.load({
  id: '@buxihuanxibei/dsh-task-done-chime',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef } = React

    const BASE = '/task-done-chime'
    const STORE_KEY = 'dsh.taskDoneChime.v1'
    const CURSOR_KEY = 'dsh.taskDoneChime.cursor'
    const TOAST_TTL_MS = 9000
    const DEFAULTS = { sound: '', volume: 0.6, soundOn: true }

    // --------------------------------------------------------------------- //
    // copy (Chinese source text with English fallbacks)
    // --------------------------------------------------------------------- //
    const ZH = {
      title: '任务完成提醒',
      done: '任务完成',
      test: '测试提醒',
      testBody: '这是一条测试提醒：Host 检测、声音播放、右上角提示都正常。',
      open: '回来看看',
      dismiss: '关闭提醒',
      muted: '已静音，仅显示提示',
      sound: '提示音',
      preview: '试听',
      use: '使用',
      using: '使用中',
      volume: '音量',
      soundOn: '提醒',
      on: '提醒开',
      off: '提醒关',
      testSend: '发一条测试提醒',
      testHint: '会走完整的 Host → 浏览器链路：响一声，并在右上角出现提示。',
      desc: '当某个会话的一轮对话跑完（运行中 → 空闲），播放你选的柔和提示音，并在页面右上角提示是哪个会话完成。',
      enabled: '已开启',
      disabled: '已关闭',
      offHint: '关闭后不会再响，也不会弹出提示。',
      errorReason: '（出错结束）',
      maxTokensReason: '（达到输出上限）',
      noSoundList: '正在读取声音列表…',
      unmuteFirst: '试听需要先打开「提醒」。',
      testFailed: '测试请求失败',
      testSent: '已发送测试提醒，注意右上角。',
      audioFailed: '声音加载失败，本次仅显示提示。',
      finishedOne: '有一轮对话已完成。',
      finishedNamed: '「{name}」的一轮对话已完成。',
      dockOn: '任务完成提醒 · 提示音：{sound}',
      dockOff: '任务完成提醒（已关闭）',
    }
    const EN = {
      title: 'Task done chime',
      done: 'Task finished',
      test: 'Test reminder',
      testBody: 'Test reminder: host detection, audio playback, and the top-right notice all work.',
      open: 'Open this chat',
      dismiss: 'Dismiss',
      muted: 'Muted — notice only',
      sound: 'Chime',
      preview: 'Preview',
      use: 'Use',
      using: 'In use',
      volume: 'Volume',
      soundOn: 'Reminders',
      on: 'Chime on',
      off: 'Chime off',
      testSend: 'Send a test reminder',
      testHint: 'Exercises the whole Host → browser path: one chime and a top-right notice.',
      desc: 'When a chat finishes a turn (running → idle), play the gentle chime you picked and show which chat completed in the top-right corner.',
      enabled: 'On',
      disabled: 'Off',
      offHint: 'When off, nothing plays and no notice appears.',
      errorReason: ' (ended with an error)',
      maxTokensReason: ' (hit the output limit)',
      noSoundList: 'Loading chimes…',
      unmuteFirst: 'Turn reminders on before previewing.',
      testFailed: 'Test request failed',
      testSent: 'Test reminder sent — check the top-right corner.',
      audioFailed: 'Could not load the chime; showing the notice only.',
      finishedOne: 'A turn has finished.',
      finishedNamed: 'A turn in “{name}” has finished.',
      dockOn: 'Task done chime · {sound}',
      dockOff: 'Task done chime (off)',
    }
    let language = 'zh'
    function T(key, params) {
      const table = language === 'zh' ? ZH : EN
      let out = table[key] !== undefined ? table[key] : ZH[key] !== undefined ? ZH[key] : key
      if (params) {
        out = out.replace(/\{(\w+)\}/g, (match, name) =>
          name in params ? String(params[name]) : match,
        )
      }
      return out
    }


    // --------------------------------------------------------------------- //
    // minimal external store (one for preferences, one for host catalogue)
    // --------------------------------------------------------------------- //
    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          value = typeof next === 'function' ? next(value) : next
          for (const listener of [...listeners]) {
            try {
              listener()
            } catch {
              /* ignore */
            }
          }
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    function readPrefs() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') return { ...DEFAULTS, ...parsed }
        }
      } catch {
        /* ignore corrupted storage */
      }
      return { ...DEFAULTS }
    }

    const prefsStore = createStore(readPrefs())
    const catalogueStore = createStore({ sounds: [], defaultSound: 'music-box', loaded: false, error: null })
    const toastStore = createStore([])

    function savePrefs(patch) {
      const next = { ...prefsStore.get(), ...patch }
      prefsStore.set(next)
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota / privacy mode */
      }
    }

    function useStore(store) {
      const [value, setValue] = useState(store.get)
      useEffect(() => store.subscribe(() => setValue(store.get())), [store])
      return value
    }

    /** Bumped on every language switch so components re-read `T()`. */
    const localeStore = createStore(0)

    function useLocale() {
      useStore(localeStore)
    }

    // --------------------------------------------------------------------- //
    // audio
    // --------------------------------------------------------------------- //
    let audioCtx = null
    let audioUnlocked = false
    let fallbackAudio = null
    /** @type {Map<string, Promise<AudioBuffer|null>>} */
    const bufferCache = new Map()

    function soundUrl(id) {
      return `${BASE}/sounds/${encodeURIComponent(id)}`
    }

    function ensureAudioContext() {
      if (audioCtx) return audioCtx
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      try {
        audioCtx = new Ctor()
      } catch {
        audioCtx = null
      }
      return audioCtx
    }

    function loadBuffer(id) {
      if (bufferCache.has(id)) return bufferCache.get(id)
      const pending = (async () => {
        const ctx = ensureAudioContext()
        const response = await fetch(soundUrl(id), { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (!ctx) return null
        const bytes = await response.arrayBuffer()
        return await ctx.decodeAudioData(bytes.slice(0))
      })()
      bufferCache.set(id, pending)
      pending.catch(() => {
        if (bufferCache.get(id) === pending) bufferCache.delete(id)
      })
      return pending
    }

    function warmUp(id) {
      if (!id) return
      loadBuffer(id).catch(() => {})
    }

    function unlockAudio() {
      const ctx = ensureAudioContext()
      if (!ctx) return
      if (ctx.state === 'suspended') {
        ctx.resume().then(
          () => {
            audioUnlocked = true
          },
          () => {},
        )
      } else if (ctx.state === 'running') {
        audioUnlocked = true
      }
      warmUp(prefsStore.get().sound || catalogueStore.get().defaultSound)
    }

    async function playSound(id) {
      if (!id) throw new Error('no-sound')
      const volume = Math.min(1, Math.max(0, Number(prefsStore.get().volume) || 0))
      const ctx = ensureAudioContext()
      if (ctx) {
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume()
          } catch {
            /* fall through */
          }
        }
        if (ctx.state === 'running') {
          audioUnlocked = true
          const buffer = await loadBuffer(id)
          if (buffer) {
            const source = ctx.createBufferSource()
            const gain = ctx.createGain()
            source.buffer = buffer
            gain.gain.value = volume
            source.connect(gain)
            gain.connect(ctx.destination)
            source.start()
            return
          }
        }
      }
      // Last resort. Browsers may reject this before the first gesture; the
      // toast still tells the user what finished.
      const element = fallbackAudio || (fallbackAudio = new Audio())
      element.src = soundUrl(id)
      element.volume = volume
      element.currentTime = 0
      await element.play()
    }

    let playChain = Promise.resolve()
    function enqueuePlay(id) {
      playChain = playChain
        .catch(() => {})
        .then(() => playSound(id))
        .catch(error => {
          catalogueStore.set(current => ({
            ...current,
            error: String(error && error.message ? error.message : error),
          }))
        })
      return playChain
    }

    function pickSoundId(prefs, catalogue) {
      return prefs.sound || catalogue.defaultSound || ''
    }

    // --------------------------------------------------------------------- //
    // host feed (long poll)
    // --------------------------------------------------------------------- //
    const feed = { cursor: NaN, controller: null, stopped: false, active: false }
    const toastTimers = new Map()

    function readCursor() {
      try {
        const parsed = Number.parseInt(window.localStorage.getItem(CURSOR_KEY) || '', 10)
        return Number.isFinite(parsed) ? parsed : NaN
      } catch {
        return NaN
      }
    }

    function writeCursor(value) {
      try {
        window.localStorage.setItem(CURSOR_KEY, String(value))
      } catch {
        /* ignore */
      }
    }

    function pushToast(item) {
      const prefs = prefsStore.get()
      const soundOn = prefs.soundOn !== false
      const toast = {
        key: `${item.id}-${Math.random().toString(36).slice(2, 8)}`,
        sessionId: item.sessionId || '',
        sessionTitle: item.sessionTitle || '',
        reason: item.reason || 'completed',
        test: item.test === true,
        muted: !soundOn,
      }
      toastStore.set(current => current.concat(toast).slice(-3))
      const timer = setTimeout(() => {
        toastTimers.delete(toast.key)
        toastStore.set(current => current.filter(entry => entry.key !== toast.key))
      }, TOAST_TTL_MS)
      toastTimers.set(toast.key, timer)
      if (soundOn) {
        const id = pickSoundId(prefs, catalogueStore.get())
        if (id) enqueuePlay(id)
      }
      return toast
    }

    function dismissToast(key) {
      const timer = toastTimers.get(key)
      if (timer) {
        clearTimeout(timer)
        toastTimers.delete(key)
      }
      toastStore.set(current => current.filter(entry => entry.key !== key))
    }

    async function pollOnce() {
      const controller = new AbortController()
      feed.controller = controller
      const since = Number.isFinite(feed.cursor) ? feed.cursor : 0
      try {
        const response = await fetch(`${BASE}/feed?since=${since}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (feed.stopped) return
        const items = Array.isArray(data.items) ? data.items : []
        if (!Number.isFinite(feed.cursor)) {
          // First successful poll after (re)load: adopt the Host head so old
          // completions are never replayed, but do announce something that just
          // landed while the page was loading.
          const head = Number.isFinite(data.nextCursor) ? data.nextCursor : since
          feed.cursor = head
          writeCursor(head)
          const fresh = items.filter(item => Date.now() - Number(item.at || 0) < 8000)
          for (const item of fresh) pushToast(item)
          return
        }
        if (items.length === 0 && Number.isFinite(data.nextCursor) && data.nextCursor < since) {
          // The Host's id counter went backwards (its process restarted with an
          // older storage scheme). Adopt the new head instead of waiting forever
          // for ids that will never exceed the stale cursor.
          feed.cursor = data.nextCursor
          writeCursor(data.nextCursor)
          return
        }
        if (items.length > 0) {
          const latest = items[items.length - 1]
          feed.cursor = latest.id
          writeCursor(latest.id)
          for (const item of items) pushToast(item)
        }
      } catch (error) {
        if (feed.stopped || controller.signal.aborted) return
        await new Promise(resolve => setTimeout(resolve, 2500))
      } finally {
        if (feed.controller === controller) feed.controller = null
      }
    }

    function startFeed() {
      if (feed.active) return
      feed.active = true
      feed.stopped = false
      feed.cursor = readCursor()
      const loop = async () => {
        while (!feed.stopped) {
          await pollOnce()
          if (feed.stopped) return
          await new Promise(resolve => setTimeout(resolve, 350))
        }
      }
      loop()
    }

    function stopFeed() {
      feed.stopped = true
      feed.active = false
      if (feed.controller) feed.controller.abort()
    }

    // --------------------------------------------------------------------- //
    // styles
    // --------------------------------------------------------------------- //
    const CSS = `
      .tdc-stack { position: fixed; top: 56px; right: 16px; display: flex; flex-direction: column; gap: 10px; z-index: 60; pointer-events: none; width: min(380px, calc(100vw - 32px)); }
      .tdc-toast { pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 12px 12px 12px 12px; border-radius: 12px; background: var(--dsw-alias-bg-overlay, #23262b); color: var(--dsw-alias-label-primary, #f2f3f5); border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); box-shadow: 0 12px 32px rgba(0,0,0,.28); animation: tdc-in .22s ease-out; font-size: 13px; line-height: 1.45; }
      @keyframes tdc-in { from { opacity: 0; transform: translateY(-6px) scale(.985); } to { opacity: 1; transform: none; } }
      .tdc-icon { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: color-mix(in srgb, var(--dsw-alias-brand-primary, #6aa9ff) 16%, transparent); color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .tdc-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
      .tdc-toast-title { font-weight: 600; }
      .tdc-toast-text { color: var(--dsw-alias-label-secondary, #a9afb8); word-break: break-word; }
      .tdc-actions { display: flex; gap: 8px; margin-top: 4px; }
      .tdc-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)); color: var(--dsw-alias-label-primary, #f2f3f5); border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
      .tdc-btn:hover { border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .tdc-btn:disabled { cursor: default; opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.16)); color: var(--dsw-alias-label-secondary, #8b919a); border-color: var(--dsw-alias-border-l1, rgba(127,127,127,.22)); }
      .tdc-btn-primary { background: var(--dsw-alias-brand-primary, #6aa9ff); border-color: transparent; color: var(--dsw-alias-bg-base, #0b0d10); font-weight: 600; }
      .tdc-close { flex: none; appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); cursor: pointer; font-size: 13px; line-height: 1; padding: 3px 5px; border-radius: 6px; }
      .tdc-close:hover { color: var(--dsw-alias-label-primary, #f2f3f5); }
      .tdc-settings { display: flex; flex-direction: column; gap: 18px; padding: 4px 2px 24px; color: var(--dsw-alias-label-primary, #f2f3f5); font-size: 13px; }
      .tdc-caption { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .tdc-card { border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.1)); background: var(--dsw-alias-bg-layer-1, #1e2126); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
      .tdc-sound { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.1)); background: var(--dsw-alias-bg-layer-1, #1e2126); }
      .tdc-sound.is-active { border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .tdc-sound-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .tdc-name { font-weight: 600; }
      .tdc-hint { color: var(--dsw-alias-label-secondary, #a9afb8); font-size: 12px; }
      .tdc-row { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
      .tdc-row-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .tdc-range { width: 180px; max-width: 40vw; accent-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .tdc-switch { appearance: none; width: 38px; height: 22px; border-radius: 999px; background: var(--dsw-alias-border-l2, rgba(255,255,255,.18)); position: relative; cursor: pointer; transition: background .15s; border: 0; flex: none; }
      .tdc-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; }
      .tdc-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary, #6aa9ff); }
      .tdc-switch[aria-checked="true"]::after { transform: translateX(16px); }
      .tdc-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #a9afb8); flex: none; }
      .tdc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-success-primary, #59c07a); }
      .tdc-dot.is-off { background: var(--dsw-alias-state-idle-primary, #8b919a); }
      .tdc-warn { color: var(--dsw-alias-state-warn-primary, #e0a24a); }
      .tdc-dock { display: flex; align-items: center; gap: 6px; }
      .tdc-dock-btn { appearance: none; display: inline-flex; align-items: center; gap: 5px; border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); border-radius: 8px; padding: 2px 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
      .tdc-dock-btn:hover { background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)); color: var(--dsw-alias-label-primary, #f2f3f5); }
      .tdc-dock-btn.is-off { opacity: .6; }
    `

    // --------------------------------------------------------------------- //
    // icons
    // --------------------------------------------------------------------- //
    function BellIcon(props) {
      const size = props.size || 16
      const off = props.off === true
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9' }),
        h('path', { d: 'M10.3 21a2 2 0 0 0 3.4 0' }),
        off ? h('path', { d: 'M4 4l16 16' }) : null,
      )
    }

    function NoteIcon(props) {
      const size = props.size || 16
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M9 18V5l11-2v13' }),
        h('circle', { cx: 6, cy: 18, r: 3 }),
        h('circle', { cx: 17, cy: 16, r: 3 }),
      )
    }

    // --------------------------------------------------------------------- //
    // toast stack — root overlay; owns the poll, the audio, and the notices
    // --------------------------------------------------------------------- //
    function ToastStack() {
      const prefs = useStore(prefsStore)
      const toasts = useStore(toastStore)
      const catalogue = useStore(catalogueStore)
      useLocale()

      useEffect(() => {
        // Deliberately no mount guard: a remount (slot re-collapse, React
        // StrictMode's double effect) must restart the poll instead of leaving
        // the feed permanently stopped by the previous cleanup.
        // Keep listening for gestures instead of removing after the first one: a
        // resume that arrives before the browser trusts the page leaves the
        // context suspended, and the next click must be able to unlock it.
        const unlock = () => {
          unlockAudio()
        }
        document.addEventListener('pointerdown', unlock, true)
        document.addEventListener('keydown', unlock, true)
        startFeed()
        return () => {
          document.removeEventListener('pointerdown', unlock, true)
          document.removeEventListener('keydown', unlock, true)
          stopFeed()
        }
      }, [])

      useEffect(() => {
        if (catalogue.loaded) return
        let disposed = false
        fetch(`${BASE}/config`, { cache: 'no-store' })
          .then(response => response.json())
          .then(data => {
            if (disposed) return
            catalogueStore.set({
              sounds: Array.isArray(data.sounds) ? data.sounds : [],
              defaultSound: typeof data.defaultSound === 'string' ? data.defaultSound : 'music-box',
              loaded: true,
              error: null,
            })
            const chosen = prefsStore.get().sound || data.defaultSound
            if (chosen) warmUp(chosen)
          })
          .catch(error => {
            if (!disposed) {
              catalogueStore.set(current => ({
                ...current,
                loaded: true,
                error: String(error && error.message ? error.message : error),
              }))
            }
          })
        return () => {
          disposed = true
        }
      }, [catalogue.loaded])

      useEffect(() => {
        const chosen = prefs.sound || catalogue.defaultSound
        if (chosen) warmUp(chosen)
      }, [prefs.sound, catalogue.defaultSound])

      const openSession = sessionId => {
        if (!sessionId) return
        try {
          const workspace = window.__PluginCtx__ && window.__PluginCtx__.get
            ? window.__PluginCtx__.get('uiWorkspace')
            : null
          if (workspace && typeof workspace.openSession === 'function') workspace.openSession(sessionId)
        } catch {
          /* navigation is best-effort */
        }
      }

      return h(
        'div',
        { className: 'tdc-stack', 'aria-live': 'polite' },
        toasts.map(toast => {
          const detail = toast.test
            ? T('testBody')
            : toast.sessionTitle
              ? T('finishedNamed', { name: toast.sessionTitle }) +
                (toast.reason === 'error'
                  ? T('errorReason')
                  : toast.reason === 'max-tokens'
                    ? T('maxTokensReason')
                    : '')
              : T('finishedOne')
          return h(
            'div',
            { key: toast.key, className: 'tdc-toast', role: 'status' },
            h('div', { className: 'tdc-icon' }, h(toast.test ? BellIcon : NoteIcon, { size: 17 })),
            h(
              'div',
              { className: 'tdc-body' },
              h('div', { className: 'tdc-toast-title' }, toast.test ? T('test') : T('done')),
              h('div', { className: 'tdc-toast-text' }, detail),
              toast.muted ? h('div', { className: 'tdc-toast-text' }, T('muted')) : null,
              h(
                'div',
                { className: 'tdc-actions' },
                toast.sessionId
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'tdc-btn tdc-btn-primary',
                        onClick: () => {
                          openSession(toast.sessionId)
                          dismissToast(toast.key)
                        },
                      },
                      T('open'),
                    )
                  : null,
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'tdc-btn',
                    onClick: () => {
                      const id = pickSoundId(prefsStore.get(), catalogueStore.get())
                      if (id) enqueuePlay(id)
                    },
                  },
                  T('preview'),
                ),
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tdc-close',
                'aria-label': T('dismiss'),
                onClick: () => dismissToast(toast.key),
              },
              '✕',
            ),
          )
        }),
      )
    }

    // --------------------------------------------------------------------- //
    // settings page
    // --------------------------------------------------------------------- //
    function SettingsPage() {
      const prefs = useStore(prefsStore)
      const catalogue = useStore(catalogueStore)
      useLocale()
      const [notice, setNotice] = useState('')
      const activeId = prefs.sound || catalogue.defaultSound
      const soundOn = prefs.soundOn !== false

      const preview = id => {
        unlockAudio()
        if (!soundOn) {
          setNotice(T('unmuteFirst'))
          return
        }
        setNotice('')
        enqueuePlay(id)
      }

      const sendTest = async () => {
        unlockAudio()
        setNotice('')
        try {
          const response = await fetch(`${BASE}/test`, { method: 'POST', cache: 'no-store' })
          if (!response.ok) {
            setNotice(`${T('testFailed')}（HTTP ${response.status}）`)
            return
          }
          setNotice(T('testSent'))
        } catch (error) {
          setNotice(`${T('testFailed')}：${error && error.message ? error.message : error}`)
        }
      }

      const toggleSound = () => {
        savePrefs({ soundOn: !soundOn })
        if (!soundOn) unlockAudio()
      }

      return h(
        'div',
        { className: 'tdc-settings' },
        h(
          'div',
          { className: 'tdc-row' },
          h(
            'div',
            { className: 'tdc-row-label' },
            h('div', { className: 'tdc-name' }, T('title')),
            h('div', { className: 'tdc-hint' }, T('desc')),
          ),
          h(
            'div',
            { className: 'tdc-pill' },
            h('span', { className: `tdc-dot${soundOn ? '' : ' is-off'}` }),
            soundOn ? T('enabled') : T('disabled'),
          ),
        ),
        h(
          'div',
          { className: 'tdc-row' },
          h(
            'div',
            { className: 'tdc-row-label' },
            h('div', null, T('soundOn')),
            h('div', { className: 'tdc-hint' }, soundOn ? T('testHint') : T('offHint')),
          ),
          h('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': soundOn,
            'aria-label': T('soundOn'),
            className: 'tdc-switch',
            onClick: toggleSound,
          }),
        ),
        h(
          'div',
          { className: 'tdc-row' },
          h(
            'div',
            { className: 'tdc-row-label' },
            h('div', null, T('volume')),
            h('div', { className: 'tdc-hint' }, `${Math.round((prefs.volume ?? 0.6) * 100)}%`),
          ),
          h('input', {
            type: 'range',
            min: 0,
            max: 100,
            step: 5,
            value: Math.round((prefs.volume ?? 0.6) * 100),
            className: 'tdc-range',
            'aria-label': T('volume'),
            onChange: event => savePrefs({ volume: Number(event.target.value) / 100 }),
          }),
        ),
        h('div', { className: 'tdc-caption' }, T('sound')),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          catalogue.sounds.map(sound => {
            const active = sound.id === activeId
            const hint = [sound.hint, sound.durationMs > 0 ? `${(sound.durationMs / 1000).toFixed(1)}s` : null]
              .filter(Boolean)
              .join(' · ')
            return h(
              'div',
              { key: sound.id, className: `tdc-sound${active ? ' is-active' : ''}` },
              h(
                'div',
                { className: 'tdc-sound-main' },
                h('div', { className: 'tdc-name' }, sound.label || sound.id),
                h('div', { className: 'tdc-hint' }, hint),
              ),
              h('button', { type: 'button', className: 'tdc-btn', onClick: () => preview(sound.id) }, T('preview')),
              h(
                'button',
                {
                  type: 'button',
                  className: `tdc-btn${active ? ' tdc-btn-primary' : ''}`,
                  disabled: active,
                  onClick: () => {
                    savePrefs({ sound: sound.id })
                    warmUp(sound.id)
                    setNotice('')
                  },
                },
                active ? T('using') : T('use'),
              ),
            )
          }),
          catalogue.sounds.length === 0 ? h('div', { className: 'tdc-hint' }, T('noSoundList')) : null,
        ),
        h(
          'div',
          { className: 'tdc-card' },
          h('div', { className: 'tdc-name' }, T('testSend')),
          h('div', { className: 'tdc-hint' }, T('testHint')),
          h(
            'div',
            { style: { marginTop: '6px' } },
            h('button', { type: 'button', className: 'tdc-btn tdc-btn-primary', onClick: sendTest }, T('testSend')),
          ),
        ),
        notice ? h('div', { className: 'tdc-hint' }, notice) : null,
        catalogue.error ? h('div', { className: 'tdc-hint tdc-warn' }, `${T('audioFailed')}（${catalogue.error}）`) : null,
      )
    }

    // --------------------------------------------------------------------- //
    // composer-dock quick toggle
    // --------------------------------------------------------------------- //
    function DockToggle() {
      const prefs = useStore(prefsStore)
      const catalogue = useStore(catalogueStore)
      useLocale()
      const on = prefs.soundOn !== false
      const sound = catalogue.sounds.find(item => item.id === (prefs.sound || catalogue.defaultSound))
      const label = on
        ? T('dockOn', { sound: sound ? sound.label : '—' })
        : T('dockOff')
      return h(
        'div',
        { className: 'tdc-dock' },
        h(
          'button',
          {
            type: 'button',
            className: `tdc-dock-btn${on ? '' : ' is-off'}`,
            title: label,
            'aria-label': label,
            onClick: () => {
              savePrefs({ soundOn: !on })
              if (!on) unlockAudio()
            },
          },
          h(BellIcon, { size: 14, off: !on }),
          h('span', null, on ? T('on') : T('off')),
        ),
      )
    }

    // --------------------------------------------------------------------- //
    // module
    // --------------------------------------------------------------------- //
    const LOCALE_NS = 'task-done-chime'
    let localeService = null
    let localeRegistered = false

    function isZhLocale(id) {
      return typeof id !== 'string' || /^zh\b/i.test(id)
    }

    /** Re-read the active language and re-render every plugin component. */
    function syncLanguage() {
      let next = 'zh'
      try {
        const snapshot = localeService && localeService.getSnapshot()
        next = isZhLocale(snapshot && snapshot.active) ? 'zh' : 'en'
      } catch {
        next = 'zh'
      }
      if (next !== language) {
        language = next
        localeStore.set(value => value + 1)
      }
    }

    /**
     * Follow the Host locale service. The dynamic Client half has no dependency
     * injection for it, so it is read optionally; a missing service simply keeps
     * the Chinese source text (the same posture the shipped wallpaper bundle uses).
     */
    function attachLocale(locale) {
      if (!locale) return
      if (localeService !== locale) {
        localeService = locale
        localeRegistered = false
      }
      if (!localeRegistered) {
        try {
          locale.register(LOCALE_NS, { zh: ZH, en: EN })
          localeRegistered = true
        } catch {
          /* older hosts: keep the local fallback table */
        }
      }
      syncLanguage()
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          // `styles` is a documented Client builtin; the element fallback keeps
          // the plugin usable if a host ever removes it.
          let dispose = null
          let element = null
          let hasStyles = false
          try {
            if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
              hasStyles = true
              dispose = styles.insert(CSS)
            }
          } catch {
            dispose = null
          }
          if (!hasStyles && typeof document !== 'undefined') {
            element = document.createElement('style')
            element.setAttribute('data-task-done-chime', '')
            element.textContent = CSS
            document.head.appendChild(element)
          }
          return () => {
            try {
              if (dispose) dispose()
            } catch {
              /* ignore */
            }
            try {
              if (element && element.parentNode) element.parentNode.removeChild(element)
            } catch {
              /* ignore */
            }
          }
        })

        // Locale first, so every registered label reads the active language.
        ctx.effect(() => {
          let disposed = false
          const attempt = () => {
            if (disposed) return
            let locale = null
            try {
              locale = typeof ctx.get === 'function' ? ctx.get('locale') : null
            } catch {
              locale = null
            }
            if (!locale || typeof locale.register !== 'function') {
              setTimeout(attempt, 300)
              return
            }
            attachLocale(locale)
          }
          attempt()
          const off = ctx.on('locale/change', () => {
            if (localeService) syncLanguage()
            else attempt()
          })
          return () => {
            disposed = true
            try {
              off()
            } catch {
              /* ignore */
            }
          }
        })

        ctx.effect(() =>
          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'task-done-chime.toast', order: 40 }, ToastStack),
          ),
        )

        ctx.effect(() =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'task-done-chime',
                order: 30,
                label: () => T('title'),
              },
              SettingsPage,
            ),
          ),
        )

        ctx.effect(() =>
          ctx.slots.inject('conversation.composer.dock', () =>
            ctx.slots.register(
              { name: 'conversation.composer.dock', id: 'task-done-chime.dock', order: 20 },
              DockToggle,
            ),
          ),
        )
      },
    }
  },
})
