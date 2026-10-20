window.__ModuleLoader__.load({
  id: '@local/dsh-daily-log',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const BASE = '/daily-log'
    const LAST_PRESET_KEY = 'dsh.dailyLog.lastPreset'
    const PANEL_ID = 'daily-log'
    const HISTORY_DAYS = 21
    const SAVE_DEBOUNCE_MS = 700
    /** Restricted Client context, captured in `apply` for services like uiWorkspace. */
    let pluginCtx = null

    // --------------------------------------------------------------------- //
    // copy
    // --------------------------------------------------------------------- //
    const ZH = {
      panel: '工作日志',
      panelHint: '每天写几句总结，下次打开时先看任务概览',
      today: '今天',
      history: '历史',
      welcomeBack: '欢迎回来',
      sameDay: '继续今天的工作',
      firstRun: '第一次打开',
      firstRunBody: '在这里写今天做完的事，明天再打开时会先给你看概览。',
      yesterday: '上次停留',
      noDate: '还没有记录',
      lastSummary: '上次的总结',
      openTasks: '还没完成的事',
      openCount: '{n} 项待继续',
      overdue: '已经放了好几天',
      carryHint: '它们还在等你，可以被带到今天。',
      carry: '带到今天',
      carried: '已把 {n} 项未完成事项带到今天',
      summaryTitle: '今日总结',
      summaryPlaceholder: '今天做完了什么？卡在哪里？明天第一件事做什么？',
      summaryEmpty: '今天还没有记录',
      tasksTitle: '接下来要做',
      taskPlaceholder: '添加一件要做的事，回车确认',
      add: '添加',
      noTasks: '暂时没有待办；完成的事也可以记在这里。',
      firstTaskHint: '第 1 件任务从这里开始：在上面输入，按回车添加。',
      moveTomorrow: '未完成的带到明天',
      moved: '已把 {n} 项未完成事项记到明天',
      nothingToMove: '没有未完成的事项',
      saved: '已保存',
      saving: '保存中…',
      saveFailed: '保存失败',
      retry: '重试',
      exportMd: '导出 Markdown',
      clearDone: '清空已完成',
      historyTitle: '往日总结',
      historyEmpty: '还没有往日记录。',
      tasksDone: '共 {total} 件 · 完成 {done}',
      noSummary: '（这天没有写总结）',
      loadFailed: '无法读取日志',
      loading: '读取中…',
      storageHint: '保存在 DSH 的 plugin-data 里，换浏览器也在。',
      deleteTask: '删除这项',
      importAction: '导入',
      importTitle: '把任务导入工作区',
      importTaskLabel: '任务 {n}：{text}',
      importSubtitle: '选好工作区和预设，直接开始干活；也可以归档到任务板。',
      tabWork: '开始工作',
      tabBoard: '任务板',
      workHint: '会新建一个会话（复用空白会话），把这条任务作为第一条消息发出去，并切换到该会话。',
      workWorkspace: '工作区',
      workTarget: '在哪个对话里继续',
      workNewSession: '＋ 新开一个会话',
      workContinueHint: '会把任务发进这个已有对话，接着之前的上下文继续跑；预设跟随该对话。',
      sessionsLoading: '正在读取该工作区的对话…',
      workPresetLocked: '已有对话沿用自身的预设',
      hiddenSessions: '已隐藏 {archived} 个已归档 · {unnamed} 个未命名对话',
      showingAll: '正在显示全部对话（含未命名与已归档）',
      showAllSessions: '显示全部',
      showNamedOnly: '只看有名字的',
      workPreset: '预设',
      workDefaultPreset: '默认预设',
      workUseDefault: '跟随默认',
      workStart: '开始工作',
      workStarting: '正在开始…',
      workNoWorkspace: '没有可用的工作区',
      workspaceLoading: '正在读取工作区…',
      workspaceEmpty: '还没有工作区，请先在左侧新建或连接一个工作区。',
      importedWork: '已开始工作',
      costToday: '今日花费',
      costHint: '按当天用量账本折算：{tokens} tokens · {calls} 次调用（粗略估算）',
      boardLoading: '正在读取任务板…',
      boardEmpty: '任务板里还没有卡片。',
      boardEmptyHint: '新建一张卡片后，它就能当作工作流，把今天的任务挂进去。',
      boardNew: '新建一张卡片',
      boardNewHint: '不挂在任何卡片下，直接建在待办列',
      boardSubtaskNote: '会作为子任务挂在所选卡片下面',
      boardUnavailable: '读不到任务板（{error}），可改用「新会话」。',
      boardColumn: '当前列：{status}',
      sessionHint: '用所选预设开一个新会话，任务内容会预填在输入框里。',
      sessionEmpty: '没有可用的智能体预设。',
      sessionLoading: '正在读取预设…',
      sessionUse: '用这个预设开会话',
      defaultPreset: '默认',
      cancel: '取消',
      importFailed: '导入失败：{error}',
      importedBoard: '已导入任务板',
      importedSession: '已开新会话',
      importedTip: '已导入 · {label}',
      searchPlaceholder: '搜索卡片或预设…',
      noMatch: '没有匹配项',
      markDone: '标记完成',
      markOpen: '标记未完成',
      copy: '复制概览',
      copied: '概览已复制到剪贴板',
      copyFailed: '复制失败',
      overviewHeading: '任务概览',
      overviewToday: '今天',
      overviewPrev: '上次记录',
      overviewPending: '待继续',
      earlier: '更早',
      daysApart: '{n} 天没见',
    }
    const EN = {
      panel: 'Work log',
      panelHint: 'Jot down a short summary; your task overview greets you next time',
      today: 'Today',
      history: 'History',
      welcomeBack: 'Welcome back',
      sameDay: 'Continue today',
      firstRun: 'First time here',
      firstRunBody: 'Write down what you finished today; next time this opens you see the overview first.',
      yesterday: 'Last visit',
      noDate: 'No entries yet',
      lastSummary: 'Last summary',
      openTasks: 'Still open',
      openCount: '{n} to continue',
      overdue: 'Carried for days',
      carryHint: 'They are still waiting — bring them to today.',
      carry: 'Bring to today',
      carried: 'Brought {n} open item(s) to today',
      summaryTitle: "Today's summary",
      summaryPlaceholder: 'What did you finish? Where did you get stuck? What is the first thing tomorrow?',
      summaryEmpty: 'Nothing written for today yet',
      tasksTitle: 'Next up',
      taskPlaceholder: 'Add a task, press Enter',
      add: 'Add',
      noTasks: 'No open tasks yet; finished work can live here too.',
      firstTaskHint: 'Task #1 starts here — type above and press Enter.',
      moveTomorrow: 'Carry open items to tomorrow',
      moved: 'Moved {n} open item(s) to tomorrow',
      nothingToMove: 'Nothing open to carry',
      saved: 'Saved',
      saving: 'Saving…',
      saveFailed: 'Save failed',
      retry: 'Retry',
      exportMd: 'Export Markdown',
      clearDone: 'Clear done',
      historyTitle: 'Past days',
      historyEmpty: 'No past entries yet.',
      tasksDone: '{total} items · {done} done',
      noSummary: '(no summary that day)',
      loadFailed: 'Could not load the log',
      loading: 'Loading…',
      storageHint: 'Stored in DSH plugin-data, so it survives a browser switch.',
      deleteTask: 'Delete this task',
      markDone: 'Mark done',
      markOpen: 'Mark open',
      copy: 'Copy overview',
      copied: 'Overview copied',
      copyFailed: 'Copy failed',
      overviewHeading: 'Task overview',
      overviewToday: 'Today',
      overviewPrev: 'Last entry',
      overviewPending: 'Open',
      earlier: 'Earlier',
      daysApart: '{n} days away',
      importAction: 'Import',
      importTitle: 'Import the task into a workspace',
      importTaskLabel: 'Task {n}: {text}',
      importSubtitle: 'Pick a workspace and preset to start working immediately, or file it on the board.',
      tabWork: 'Start working',
      tabBoard: 'Task board',
      workHint: 'Creates (or reuses a blank) session, sends this task as its first message, and switches to it.',
      workWorkspace: 'Workspace',
      workTarget: 'Continue in',
      workNewSession: '＋ Start a new conversation',
      workContinueHint: 'Sends the task into that existing conversation, continuing its context; the preset is inherited.',
      sessionsLoading: 'Reading conversations…',
      workPresetLocked: 'An existing conversation keeps its preset',
      hiddenSessions: 'Hidden {archived} archived · {unnamed} unnamed conversations',
      showingAll: 'Showing every conversation (archived and unnamed included)',
      showAllSessions: 'Show all',
      showNamedOnly: 'Only named ones',
      workPreset: 'Preset',
      workDefaultPreset: 'Default preset',
      workUseDefault: 'Use deployment default',
      workStart: 'Start working',
      workStarting: 'Starting…',
      workNoWorkspace: 'No workspace available',
      workspaceLoading: 'Reading workspaces…',
      workspaceEmpty: 'No workspace yet — create or connect one from the sidebar first.',
      importedWork: 'Work started',
      costToday: 'Today',
      costHint: 'Prorated from the day ledger: {tokens} tokens · {calls} calls (rough estimate)',
      boardLoading: 'Reading the task board…',
      boardEmpty: 'The task board has no cards yet.',
      boardEmptyHint: 'Create one card and it can act as a workflow for today\'s tasks.',
      boardNew: 'Create a new card',
      boardNewHint: 'Lands in the todo column, under no parent',
      boardSubtaskNote: 'It becomes a subtask of the selected card',
      boardUnavailable: 'Task board unreachable ({error}); use “New session” instead.',
      boardColumn: 'Column: {status}',
      sessionHint: 'Opens a new session with the chosen preset and this task prefilled in the composer.',
      sessionEmpty: 'No agent presets available.',
      sessionLoading: 'Reading presets…',
      sessionUse: 'Start with this preset',
      defaultPreset: 'Default',
      cancel: 'Cancel',
      importFailed: 'Import failed: {error}',
      importedBoard: 'Imported to the task board',
      importedSession: 'Opened a new session',
      importedTip: 'Imported · {label}',
      searchPlaceholder: 'Search cards or presets…',
      noMatch: 'Nothing matches',
    }
    let language = 'zh'
    function T(key, params) {
      const table = language === 'zh' ? ZH : EN
      let out = table[key] !== undefined ? table[key] : ZH[key] !== undefined ? ZH[key] : key
      if (params) {
        out = out.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      }
      return out
    }

    // --------------------------------------------------------------------- //
    // dates (all local, so "today" matches what the user sees)
    // --------------------------------------------------------------------- //
    function dateKey(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    function todayKey() {
      return dateKey(new Date())
    }

    function shiftDate(key, days) {
      const [year, month, day] = key.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() + days)
      return dateKey(date)
    }

    function humanDate(key) {
      if (!key) return '—'
      const [year, month, day] = key.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const weekday = language === 'zh' ? weekdays[date.getDay()] : date.toLocaleDateString('en', { weekday: 'short' })
      return language === 'zh' ? `${year}年${month}月${day}日 ${weekday}` : `${year}-${month}-${day} ${weekday}`
    }

    function emptyEntry(key) {
      return { date: key, summary: '', tasks: [], updatedAt: Date.now() }
    }

    // --------------------------------------------------------------------- //
    // tiny external store for language changes
    // --------------------------------------------------------------------- //
    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          value = next
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

    const localeStore = createStore(0)

    function useLocale() {
      const [tick, setTick] = useState(0)
      useEffect(() => localeStore.subscribe(() => setTick(value => value + 1)), [])
      return tick
    }

    // --------------------------------------------------------------------- //
    // styles
    // --------------------------------------------------------------------- //
    const CSS = `
      .dlg-root { display: flex; flex-direction: column; height: 100%; min-height: 0; color: var(--dsw-alias-label-primary, #f2f3f5); background: var(--dsw-alias-bg-base, #16181c); }
      .dlg-head { display: flex; align-items: flex-start; gap: 14px; padding: 18px 22px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08)); }
      .dlg-head-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .dlg-title { font-size: 17px; font-weight: 650; }
      .dlg-sub { font-size: 12px; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-tabs { display: inline-flex; gap: 4px; padding: 3px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)); }
      .dlg-tab { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); font: inherit; font-size: 12px; padding: 4px 12px; border-radius: 7px; cursor: pointer; }
      .dlg-tab.is-active { background: var(--dsw-alias-bg-layer-1, #1e2126); color: var(--dsw-alias-label-primary, #f2f3f5); font-weight: 600; }
      .dlg-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 22px 40px; }
      .dlg-wrap { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
      .dlg-card { border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.1)); background: var(--dsw-alias-bg-layer-1, #1e2126); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .dlg-card-hero { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #6aa9ff) 45%, transparent); background: linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary, #6aa9ff) 10%, var(--dsw-alias-bg-layer-1, #1e2126)), var(--dsw-alias-bg-layer-1, #1e2126)); }
      .dlg-row { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
      .dlg-row-left { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .dlg-section { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-brand-primary, #6aa9ff) 18%, transparent); color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-hint { font-size: 12px; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-quote { border-left: 3px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #6aa9ff) 65%, transparent); padding: 2px 0 2px 10px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: var(--dsw-alias-label-primary, #f2f3f5); max-height: 160px; overflow: auto; }
      .dlg-textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 132px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); background: var(--dsw-alias-bg-base, #16181c); color: var(--dsw-alias-label-primary, #f2f3f5); padding: 10px 12px; font: inherit; font-size: 13px; line-height: 1.6; outline: none; }
      .dlg-textarea:focus { border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .dlg-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)); color: var(--dsw-alias-label-primary, #f2f3f5); border-radius: 8px; padding: 5px 11px; font: inherit; font-size: 12px; cursor: pointer; }
      .dlg-btn:hover { border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-btn:disabled { cursor: default; opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18)); color: var(--dsw-alias-label-secondary, #8b919a); border-color: var(--dsw-alias-border-l1, rgba(127,127,127,.22)); }
      .dlg-btn-primary { background: var(--dsw-alias-brand-primary, #6aa9ff); border-color: transparent; color: var(--dsw-alias-bg-base, #0b0d10); font-weight: 600; }
      .dlg-btn-ghost { border-color: transparent; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-status { font-size: 12px; color: var(--dsw-alias-label-secondary, #a9afb8); margin-left: auto; }
      .dlg-status.is-error { color: var(--dsw-alias-state-warn-primary, #e0a24a); }
      .dlg-task-input { display: flex; gap: 8px; }
      .dlg-input { flex: 1; min-width: 0; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); background: var(--dsw-alias-bg-base, #16181c); color: var(--dsw-alias-label-primary, #f2f3f5); padding: 7px 11px; font: inherit; font-size: 13px; outline: none; }
      .dlg-input:focus { border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-tasks { display: flex; flex-direction: column; gap: 2px; }
      .dlg-task { display: flex; align-items: flex-start; gap: 9px; padding: 7px 8px; border-radius: 8px; }
      .dlg-task:hover { background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.05)); }
      .dlg-task-no { flex: none; width: 18px; margin-top: 1px; text-align: right; font-size: 11.5px; line-height: 17px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #a9afb8); opacity: .9; }
      .dlg-task.is-done .dlg-task-no { opacity: .45; }
      .dlg-task.is-empty .dlg-task-text { color: var(--dsw-alias-label-secondary, #a9afb8); font-style: italic; }
      .dlg-check { appearance: none; flex: none; width: 17px; height: 17px; margin-top: 1px; border-radius: 5px; border: 1.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,.28)); background: transparent; cursor: pointer; position: relative; }
      .dlg-check:checked { background: var(--dsw-alias-brand-primary, #6aa9ff); border-color: transparent; }
      .dlg-check:checked::after { content: ""; position: absolute; left: 5px; top: 1.5px; width: 4px; height: 9px; border: solid var(--dsw-alias-bg-layer-1, #fff); border-width: 0 2px 2px 0; transform: rotate(45deg); }
      .dlg-task-text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; word-break: break-word; }
      .dlg-task.is-done .dlg-task-text { color: var(--dsw-alias-label-secondary, #a9afb8); text-decoration: line-through; }
      .dlg-x { appearance: none; flex: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); cursor: pointer; font-size: 13px; padding: 1px 5px; border-radius: 6px; opacity: 0; }
      .dlg-task:hover .dlg-x { opacity: 1; }
      .dlg-x:hover { color: var(--dsw-alias-state-error-primary, #e06c6c); }
      .dlg-empty { font-size: 12px; color: var(--dsw-alias-label-secondary, #a9afb8); padding: 4px 2px; }
      .dlg-day { display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08)); padding: 0 0 12px; }
      .dlg-day:last-child { border-bottom: 0; padding-bottom: 0; }
      .dlg-day-head { display: flex; align-items: baseline; gap: 8px; }
      .dlg-day-date { font-size: 13px; font-weight: 600; }
      .dlg-day-summary { font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: var(--dsw-alias-label-primary, #f2f3f5); }
      .dlg-day-tasks { display: flex; flex-wrap: wrap; gap: 6px; }
      .dlg-chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.12)); color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-chip.is-done { text-decoration: line-through; opacity: .7; }
      .dlg-icon-root { display: inline-flex; align-items: center; justify-content: center; color: inherit; }
      .dlg-import { appearance: none; flex: none; border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); cursor: pointer; font: inherit; font-size: 11px; line-height: 1; padding: 3px 7px; border-radius: 6px; opacity: .75; white-space: nowrap; }
      .dlg-task:hover .dlg-import { opacity: 1; border-color: var(--dsw-alias-border-l1, rgba(255,255,255,.14)); }
      .dlg-import:hover { color: var(--dsw-alias-brand-primary, #6aa9ff); border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-task-imported { flex: none; font-size: 11px; color: var(--dsw-alias-state-success-primary, #59c07a); white-space: nowrap; }
      .dlg-task-cost { flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary, #a9afb8); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .dlg-cost { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #59c07a) 14%, transparent); color: var(--dsw-alias-state-success-primary, #59c07a); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .dlg-backdrop { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(6, 8, 11, .55); backdrop-filter: blur(2px); }
      .dlg-modal { width: min(560px, 100%); max-height: min(82vh, 620px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay, #23262b); color: var(--dsw-alias-label-primary, #f2f3f5); border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.45); overflow: hidden; }
      .dlg-modal-head { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08)); }
      .dlg-modal-head-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .dlg-modal-title { font-size: 15px; font-weight: 650; word-break: break-word; }
      .dlg-modal-sub { font-size: 12px; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-modal-tabs { display: inline-flex; gap: 3px; padding: 3px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)); flex: none; }
      .dlg-modal-tab { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #a9afb8); font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
      .dlg-modal-tab.is-active { background: var(--dsw-alias-bg-layer-1, #1e2126); color: var(--dsw-alias-label-primary, #f2f3f5); font-weight: 600; }
      .dlg-modal-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
      .dlg-option { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; font: inherit; color: inherit; background: transparent; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.1)); border-radius: 10px; padding: 9px 11px; cursor: pointer; }
      .dlg-option:hover { border-color: var(--dsw-alias-brand-primary, #6aa9ff); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.05)); }
      .dlg-option:disabled { opacity: .55; cursor: default; }
      .dlg-option-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .dlg-option-title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dlg-option-sub { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-option-go { flex: none; font-size: 11.5px; color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-modal-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08)); font-size: 11.5px; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-pill-default { font-size: 10.5px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-brand-primary, #6aa9ff) 18%, transparent); color: var(--dsw-alias-brand-primary, #6aa9ff); flex: none; }
      .dlg-modal-error { font-size: 12px; color: var(--dsw-alias-state-warn-primary, #e0a24a); }
      .dlg-field { display: flex; flex-direction: column; gap: 5px; }
      .dlg-field-label { font-size: 11.5px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; color: var(--dsw-alias-label-secondary, #a9afb8); }
      .dlg-select { width: 100%; box-sizing: border-box; appearance: none; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); background: var(--dsw-alias-bg-base, #16181c); color: var(--dsw-alias-label-primary, #f2f3f5); padding: 8px 10px; font: inherit; font-size: 13px; outline: none; }
      .dlg-select:focus { border-color: var(--dsw-alias-brand-primary, #6aa9ff); }
      .dlg-select:disabled { opacity: .6; }
      .dlg-hidden { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .dlg-link { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-brand-primary, #6aa9ff); font: inherit; font-size: 11.5px; padding: 0; cursor: pointer; white-space: nowrap; }
      .dlg-link:hover { text-decoration: underline; }
      .dlg-link:disabled { opacity: .5; cursor: default; text-decoration: none; }
    `

    // --------------------------------------------------------------------- //
    // icons
    // --------------------------------------------------------------------- //
    function LogIcon(props) {
      const size = props.size || 16
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M6 3.5h9.5L19 7v13.5H6z' }),
        h('path', { d: 'M15 3.5V7h4' }),
        h('path', { d: 'M9 11.5h7M9 15h5' }),
      )
    }

    // --------------------------------------------------------------------- //
    // API
    // --------------------------------------------------------------------- //
    async function apiGet(path) {
      const response = await fetch(`${BASE}${path}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    }

    async function apiPost(path, body) {
      const response = await fetch(`${BASE}${path}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    }

    /** The preset this browser used last, so the chooser reopens on it. */
    function readLastPreset() {
      try {
        return window.localStorage.getItem(LAST_PRESET_KEY) || ''
      } catch {
        return ''
      }
    }

    function writeLastPreset(id) {
      try {
        if (id) window.localStorage.setItem(LAST_PRESET_KEY, id)
      } catch {
        /* ignore */
      }
    }

    /** Preset name/description in the active language (host supplies both). */
    function presetDisplayName(preset) {
      if (!preset) return ''
      return language === 'zh'
        ? preset.nameZh || preset.name || preset.id
        : preset.name || preset.nameZh || preset.id
    }

    function presetDisplayDescription(preset) {
      if (!preset) return ''
      return language === 'zh'
        ? preset.descriptionZh || preset.description || ''
        : preset.description || preset.descriptionZh || ''
    }

    /** Rough money display: two decimals once it matters, more when it is tiny. */
    function formatCny(value) {
      const amount = Number(value)
      if (!Number.isFinite(amount) || amount <= 0) return '¥0.00'
      if (amount >= 0.1) return `¥${amount.toFixed(2)}`
      // Tiny amounts keep four decimals, with trailing zeros trimmed so a clean
      // 0.05 reads as ¥0.05 instead of ¥0.050.
      const precise = amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
      return `¥${precise}`
    }

    // --------------------------------------------------------------------- //
    // task board + workflow targets
    // --------------------------------------------------------------------- //
    const BOARD_BASE = '/api/task-board'

    function randomId(prefix) {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    async function readBoardCards() {
      const response = await fetch(`${BOARD_BASE}/state`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const state = await response.json()
      const tasks = Array.isArray(state && state.tasks) ? state.tasks : []
      return tasks
        .filter(task => task && typeof task.id === 'string')
        .map(task => ({
          id: task.id,
          title: typeof task.title === 'string' && task.title ? task.title : '(未命名)',
          status: typeof task.status === 'string' ? task.status : 'todo',
          parentId: typeof task.parentId === 'string' ? task.parentId : null,
          subtasks: tasks.filter(other => other && other.parentId === task.id).length,
        }))
    }

    async function createBoardCard({ title, description, prompt, parentId }) {
      const suffix = randomId('dl')
      const response = await fetch(`${BOARD_BASE}/action`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: suffix,
          action: {
            kind: 'create',
            id: suffix,
            input: {
              title: title.slice(0, 120),
              description,
              prompt,
              ...(parentId ? { parentId } : {}),
            },
          },
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    }

    // --------------------------------------------------------------------- //
    // panel
    // --------------------------------------------------------------------- //
    function Panel() {
      useLocale()
      const [tab, setTab] = useState('today')
      const [loading, setLoading] = useState(true)
      const [loadError, setLoadError] = useState('')
      const [entries, setEntries] = useState({})
      const [previousOpen, setPreviousOpen] = useState(null)
      const [draft, setDraft] = useState(() => emptyEntry(todayKey()))
      const [saveState, setSaveState] = useState('idle')
      const [notice, setNotice] = useState('')
      const [importTask, setImportTask] = useState(null)
      const [importTab, setImportTab] = useState('work')
      const [importData, setImportData] = useState({
        loading: false,
        presets: [],
        workspaces: [],
        cards: [],
        cardError: '',
        presetError: '',
        workspaceError: '',
      })
      const [importWorkspace, setImportWorkspace] = useState('')
      const [importPreset, setImportPreset] = useState('')
      const [importSessions, setImportSessions] = useState([])
      const [importSessionsLoading, setImportSessionsLoading] = useState(false)
      const [importSessionId, setImportSessionId] = useState('')
      const [importShowAll, setImportShowAll] = useState(false)
      const [importHidden, setImportHidden] = useState({ archived: 0, unnamed: 0, shown: 0 })
      const [importBusy, setImportBusy] = useState('')
      const [importError, setImportError] = useState('')
      const [importQuery, setImportQuery] = useState('')
      const [newTask, setNewTask] = useState('')
      const [costData, setCostData] = useState({
        loading: false,
        error: '',
        source: '',
        day: { cost: 0, tokens: 0, calls: 0, byModel: [] },
        tasks: {},
      })
      const saveTimer = useRef(null)
      const latestDraft = useRef(draft)
      const loadedRef = useRef(false)

      latestDraft.current = draft
      const today = todayKey()

      // Load once. `/touch` also reports when this panel was last opened, which
      // is what drives the welcome-back overview.
      useEffect(() => {
        let disposed = false
        ;(async () => {
          try {
            const state = await apiGet('/state')
            if (disposed) return
            const all = state && state.entries && typeof state.entries === 'object' ? state.entries : {}
            setEntries(all)
            const current = all[today] || emptyEntry(today)
            setDraft({ ...current, tasks: Array.isArray(current.tasks) ? current.tasks : [] })
            const touched = await apiPost('/touch', { date: today })
            if (disposed) return
            setPreviousOpen(touched && touched.previous ? touched.previous : null)
            setLoading(false)
            loadedRef.current = true
            loadCosts(Array.isArray(current.tasks) ? current.tasks : [])
          } catch (error) {
            if (disposed) return
            setLoadError(String(error && error.message ? error.message : error))
            setLoading(false)
          }
        })()
        return () => {
          disposed = true
          if (saveTimer.current) clearTimeout(saveTimer.current)
          // Flush a pending edit so closing the panel never loses the last words.
          const pending = latestDraft.current
          if (loadedRef.current && pending && pending.__dirty) {
            const clean = { ...pending }
            delete clean.__dirty
            fetch(`${BASE}/save`, {
              method: 'POST',
              keepalive: true,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entry: clean }),
            }).catch(() => {})
          }
        }
      }, [])

      const persist = payload => {
        setSaveState('saving')
        const clean = { ...payload }
        delete clean.__dirty
        apiPost('/save', { entry: clean })
          .then(result => {
            setSaveState('saved')
            if (result && result.state && result.state.entries) setEntries(result.state.entries)
          })
          .catch(() => setSaveState('failed'))
      }

      const scheduleSave = next => {
        setDraft({ ...next, __dirty: true })
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          saveTimer.current = null
          persist(latestDraft.current)
        }, SAVE_DEBOUNCE_MS)
      }

      const flushNow = next => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        persist(next)
      }

      // ------------------------------------------------------------------- //
      // rough per-task money: day spend comes from the priced usage ledger, a
      // task's share is its conversation's tokens after the import instant.
      // ------------------------------------------------------------------- //
      const loadCosts = async tasks => {
        const list = Array.isArray(tasks) ? tasks : []
        const scoped = list
          .filter(task => task && task.imported && task.imported.sessionId)
          .map(task => ({
            id: task.id,
            sessionId: String(task.imported.sessionId),
            since: Number(task.imported.at) || 0,
          }))
        setCostData(current => ({ ...current, loading: true }))
        try {
          const data = await apiPost('/cost', { date: today, tasks: scoped })
          setCostData({
            loading: false,
            error: '',
            source: typeof data.source === 'string' ? data.source : '',
            day:
              data.day && typeof data.day === 'object'
                ? data.day
                : { cost: 0, tokens: 0, calls: 0, byModel: [] },
            tasks: data.tasks && typeof data.tasks === 'object' ? data.tasks : {},
          })
        } catch (error) {
          setCostData(current => ({
            ...current,
            loading: false,
            error: String(error && error.message ? error.message : error),
          }))
        }
      }

      // ------------------------------------------------------------------- //
      // import a task: start working in a workspace, or file it on the board
      // ------------------------------------------------------------------- //
      const loadImportTargets = async () => {
        setImportData({
          loading: true,
          presets: [],
          workspaces: [],
          cards: [],
          cardError: '',
          presetError: '',
          workspaceError: '',
        })
        const [presetsResult, workspacesResult, cardsResult] = await Promise.allSettled([
          apiGet('/presets'),
          apiGet('/workspaces'),
          readBoardCards(),
        ])
        const presets =
          presetsResult.status === 'fulfilled' && Array.isArray(presetsResult.value?.presets)
            ? presetsResult.value.presets
            : []
        const workspaces =
          workspacesResult.status === 'fulfilled' && Array.isArray(workspacesResult.value?.workspaces)
            ? workspacesResult.value.workspaces
            : []
        setImportData({
          loading: false,
          presets,
          workspaces,
          cards: cardsResult.status === 'fulfilled' ? cardsResult.value : [],
          presetError:
            presetsResult.status === 'rejected' ? String(presetsResult.reason?.message || presetsResult.reason) : '',
          workspaceError:
            workspacesResult.status === 'rejected'
              ? String(workspacesResult.reason?.message || workspacesResult.reason)
              : '',
          cardError: cardsResult.status === 'rejected' ? String(cardsResult.reason?.message || cardsResult.reason) : '',
        })
        if (!importWorkspace && workspaces.length > 0) setImportWorkspace(workspaces[0].id)
        // Open on the mode the user last worked in; fall back to the registry
        // default, then to the first preset.
        const lastUsed = presetsResult.status === 'fulfilled' ? presetsResult.value?.lastUsedPreset : ''
        const remembered = readLastPreset()
        const preferred =
          (remembered && presets.find(preset => preset.id === remembered)) ||
          (typeof lastUsed === 'string' && presets.find(preset => preset.id === lastUsed)) ||
          presets.find(preset => preset.isDefault) ||
          presets[0]
        if (preferred) setImportPreset(preferred.id)
        loadSessionsFor(importWorkspace || (workspaces[0] && workspaces[0].id) || '')
      }

      const loadSessionsFor = async (workspaceId, showAll = importShowAll) => {
        setImportSessionId('')
        if (!workspaceId) {
          setImportSessions([])
          return
        }
        setImportSessionsLoading(true)
        try {
          const suffix = showAll ? '&all=1' : ''
          const data = await apiGet(`/sessions?workspace=${encodeURIComponent(workspaceId)}${suffix}`)
          setImportSessions(Array.isArray(data?.sessions) ? data.sessions : [])
          setImportHidden(
            data && data.hidden && typeof data.hidden === 'object'
              ? {
                  archived: Number(data.hidden.archived) || 0,
                  unnamed: Number(data.hidden.unnamed) || 0,
                  shown: Number(data.hidden.shown) || 0,
                }
              : { archived: 0, unnamed: 0, shown: 0 },
          )
        } catch {
          setImportSessions([])
        } finally {
          setImportSessionsLoading(false)
        }
      }

      const chooseWorkspace = workspaceId => {
        setImportWorkspace(workspaceId)
        loadSessionsFor(workspaceId)
      }

      const toggleShowAll = () => {
        const next = !importShowAll
        setImportShowAll(next)
        loadSessionsFor(importWorkspace, next)
      }

      const openImport = task => {
        setImportTask({ id: task.id, text: task.text })
        setImportTab('work')
        setImportError('')
        setImportQuery('')
        setImportBusy('')
        loadImportTargets()
      }

      const closeImport = () => {
        if (importBusy) return
        setImportTask(null)
        setImportError('')
      }

      const markImported = (taskId, imported) => {
        const next = {
          ...draft,
          tasks: taskList.map(task => (task.id === taskId ? { ...task, imported } : task)),
          updatedAt: Date.now(),
        }
        setDraft({ ...next, __dirty: true })
        flushNow(next)
        // A fresh import gives the conversation new spend; refresh the estimate.
        loadCosts(next.tasks)
      }

      const runBoardImport = async card => {
        const task = importTask
        if (!task) return
        setImportBusy('board')
        setImportError('')
        try {
          await createBoardCard({
            title: task.text,
            description: `来自工作日志 ${today}${card ? `（挂到「${card.title}」下）` : ''}`,
            prompt: task.text,
            parentId: card ? card.id : undefined,
          })
          markImported(task.id, {
            at: Date.now(),
            target: 'board',
            label: card ? card.title : T('boardNew'),
          })
          setNotice(T('importedBoard'))
          setImportBusy('')
          setImportTask(null)
        } catch (error) {
          setImportBusy('')
          setImportError(T('importFailed', { error: error && error.message ? error.message : String(error) }))
        }
      }

      /**
       * The real "import and start working": send the task into the chosen
       * conversation — an existing one to continue it, or a new/reused blank
       * session in the chosen workspace under the chosen preset — then navigate
       * to it. The message is submitted, not left in the composer.
       */
      const runStartWork = async () => {
        const task = importTask
        if (!task) return
        setImportBusy('work')
        setImportError('')
        try {
          const workspace = pluginCtx && typeof pluginCtx.get === 'function' ? pluginCtx.get('uiWorkspace') : null
          const sessions = pluginCtx && typeof pluginCtx.get === 'function' ? pluginCtx.get('sessions') : null
          if (!workspace || typeof workspace.connectWorkspace !== 'function') {
            throw new Error('uiWorkspace unavailable')
          }
          if (!sessions || typeof sessions.using !== 'function') {
            throw new Error('sessions unavailable')
          }
          const workspaceId = importWorkspace || (importData.workspaces[0] && importData.workspaces[0].id)
          if (!workspaceId) throw new Error(T('workNoWorkspace'))
          const existing = importSessions.find(item => item.id === importSessionId) || null
          const presetId = importPreset || undefined
          const sessionId = existing
            ? existing.id
            : await workspace.connectWorkspace(workspaceId, presetId ? { agentPreset: presetId } : undefined)
          await sessions.using(sessionId, { source: 'controllerOperation' }, async reference => {
            // An existing conversation may still be opening its history.
            if (reference && reference.ready && typeof reference.ready.then === 'function') {
              await reference.ready.catch(() => {})
            }
            const result = await reference.binding.session.prompt([{ type: 'text', text: task.text }], 'queue')
            if (!result || result.ok !== true) {
              const reason = result && result.error && result.error.message ? result.error.message : 'prompt rejected'
              throw new Error(reason)
            }
          })
          const workspaceLabel =
            importData.workspaces.find(item => item.id === workspaceId)?.title || workspaceId
          const targetLabel = existing
            ? existing.title || existing.id
            : presetDisplayName(importData.presets.find(preset => preset.id === presetId)) || T('workDefaultPreset')
          markImported(task.id, {
            at: Date.now(),
            target: 'session',
            label: `${workspaceLabel} · ${targetLabel}`,
            sessionId,
          })
          if (presetId) writeLastPreset(presetId)
          setNotice(T('importedWork'))
          setImportBusy('')
          setImportTask(null)
          try {
            workspace.openSession(sessionId)
          } catch {
            /* navigation is best-effort */
          }
        } catch (error) {
          setImportBusy('')
          setImportError(T('importFailed', { error: error && error.message ? error.message : String(error) }))
        }
      }

      const updateSummary = value => {
        scheduleSave({ ...draft, summary: value, updatedAt: Date.now() })
      }

      const addTask = () => {
        const text = newTask.trim()
        if (!text) return
        const task = { id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, text, done: false }
        const next = { ...draft, tasks: draft.tasks.concat(task), updatedAt: Date.now() }
        setNewTask('')
        setDraft({ ...next, __dirty: true })
        flushNow(next)
      }

      const toggleTask = id => {
        const next = {
          ...draft,
          tasks: draft.tasks.map(task => (task.id === id ? { ...task, done: !task.done } : task)),
          updatedAt: Date.now(),
        }
        setDraft({ ...next, __dirty: true })
        flushNow(next)
      }

      const removeTask = id => {
        const next = {
          ...draft,
          tasks: draft.tasks.filter(task => task.id !== id),
          updatedAt: Date.now(),
        }
        setDraft({ ...next, __dirty: true })
        flushNow(next)
      }

      const clearDone = () => {
        const next = {
          ...draft,
          tasks: draft.tasks.filter(task => !task.done),
          updatedAt: Date.now(),
        }
        setDraft({ ...next, __dirty: true })
        flushNow(next)
      }

      // Unfinished items from the most recent earlier day.
      const previous = useMemo(() => {
        const keys = Object.keys(entries)
          .filter(key => key < today)
          .sort()
          .reverse()
        for (const key of keys) {
          const entry = entries[key]
          const open = entry.tasks.filter(task => !task.done)
          if (entry.summary.trim() || open.length > 0) {
            return { date: key, summary: entry.summary, open, total: entry.tasks.length }
          }
        }
        return null
      }, [entries, today])

      const openFromPrevious = useMemo(() => (previous ? previous.open : []), [previous])

      const daysApart = useMemo(() => {
        if (!previousOpen || !previousOpen.lastOpenedDate) return null
        const from = new Date(`${previousOpen.lastOpenedDate}T00:00:00`).getTime()
        const to = new Date(`${today}T00:00:00`).getTime()
        const diff = Math.round((to - from) / 86400000)
        return Number.isFinite(diff) ? diff : null
      }, [previousOpen, today])

      const showWelcome = Boolean(
        previousOpen && previousOpen.lastOpenedDate && previousOpen.lastOpenedDate !== today,
      )

      const carryOpenTasks = () => {
        if (openFromPrevious.length === 0) {
          setNotice(T('nothingToMove'))
          return
        }
        const existing = new Set(draft.tasks.map(task => task.text.trim()))
        const additions = openFromPrevious
          .filter(task => !existing.has(task.text.trim()))
          .map(task => ({
            id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            text: task.text,
            done: false,
          }))
        const next = { ...draft, tasks: draft.tasks.concat(additions), updatedAt: Date.now() }
        setDraft({ ...next, __dirty: true })
        flushNow(next)
        setNotice(T('carried', { n: additions.length }))
      }

      const moveOpenToTomorrow = () => {
        const open = draft.tasks.filter(task => !task.done)
        if (open.length === 0) {
          setNotice(T('nothingToMove'))
          return
        }
        const tomorrow = shiftDate(today, 1)
        const existingEntry = entries[tomorrow] || emptyEntry(tomorrow)
        const existing = new Set(existingEntry.tasks.map(task => task.text.trim()))
        const additions = open
          .filter(task => !existing.has(task.text.trim()))
          .map(task => ({
            id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            text: task.text,
            done: false,
          }))
        const tomorrowEntry = {
          ...existingEntry,
          tasks: existingEntry.tasks.concat(additions),
          updatedAt: Date.now(),
        }
        apiPost('/save', { entry: tomorrowEntry })
          .then(result => {
            if (result && result.state && result.state.entries) setEntries(result.state.entries)
          })
          .catch(() => {})
        setNotice(T('moved', { n: additions.length }))
      }

      const copyOverview = async () => {
        const lines = [T('overviewHeading'), `${T('overviewToday')}: ${humanDate(today)}`]
        if (draft.summary.trim()) lines.push('', draft.summary.trim())
        if (draft.tasks.length > 0) {
          lines.push('', `${T('overviewPending')}:`)
          draft.tasks.forEach((task, index) => {
            lines.push(`${index + 1}. [${task.done ? 'x' : ' '}] ${task.text}`)
          })
        }
        if (previous) {
          lines.push('', `${T('overviewPrev')}: ${previous.date}`)
          if (previous.summary.trim()) lines.push(previous.summary.trim())
        }
        try {
          await navigator.clipboard.writeText(lines.join('\n'))
          setNotice(T('copied'))
        } catch {
          setNotice(T('copyFailed'))
        }
      }

      const history = useMemo(() => {
        const keys = Object.keys(entries).sort().reverse()
        return keys.slice(0, HISTORY_DAYS).map(key => ({ key, entry: entries[key] }))
      }, [entries])

      // Closing the chooser on Escape is expected for a modal; the board/session
      // requests keep running in the background only until they settle.
      useEffect(() => {
        if (!importTask || typeof document === 'undefined') return
        const onKey = event => {
          if (event.key === 'Escape') closeImport()
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [importTask, importBusy])

      const renderImportDialog = () => {
        if (!importTask) return null
        const query = importQuery.trim().toLowerCase()
        const number = taskList.findIndex(task => task.id === importTask.id)
        const cards = importData.cards.filter(card => {
          if (card.parentId) return false
          return query === '' || card.title.toLowerCase().includes(query)
        })
        const workspaceChoices = importData.workspaces
        const presetChoices = importData.presets
        const busy = Boolean(importBusy)
        const selectedWorkspace = importWorkspace || (workspaceChoices[0] ? workspaceChoices[0].id : '')
        const selectedPreset = importPreset || ''

        return h(
          'div',
          {
            className: 'dlg-backdrop',
            role: 'presentation',
            onMouseDown: event => {
              if (event.target === event.currentTarget) closeImport()
            },
          },
          h(
            'div',
            { className: 'dlg-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('importTitle') },
            h(
              'div',
              { className: 'dlg-modal-head' },
              h(
                'div',
                { className: 'dlg-modal-head-main' },
                h('div', { className: 'dlg-modal-title' }, T('importTitle')),
                h(
                  'div',
                  { className: 'dlg-modal-sub' },
                  T('importTaskLabel', { n: number >= 0 ? number + 1 : '?', text: importTask.text }),
                ),
              ),
              h(
                'div',
                { className: 'dlg-modal-tabs' },
                h(
                  'button',
                  { type: 'button', className: `dlg-modal-tab${importTab === 'work' ? ' is-active' : ''}`, onClick: () => setImportTab('work') },
                  T('tabWork'),
                ),
                h(
                  'button',
                  { type: 'button', className: `dlg-modal-tab${importTab === 'board' ? ' is-active' : ''}`, onClick: () => setImportTab('board') },
                  T('tabBoard'),
                ),
              ),
              h(
                'button',
                { type: 'button', className: 'dlg-x', style: { opacity: 1 }, onClick: closeImport, 'aria-label': T('cancel') },
                '✕',
              ),
            ),
            h(
              'div',
              { className: 'dlg-modal-body' },
              importTab === 'work'
                ? [
                    h(
                      'label',
                      { className: 'dlg-field' },
                      h('span', { className: 'dlg-field-label' }, T('workWorkspace')),
                      h(
                        'select',
                        {
                          className: 'dlg-select',
                          value: selectedWorkspace,
                          disabled: busy || workspaceChoices.length === 0,
                          onChange: event => chooseWorkspace(event.target.value),
                        },
                        workspaceChoices.length === 0
                          ? h('option', { value: '' }, importData.loading ? T('workspaceLoading') : T('workspaceEmpty'))
                          : workspaceChoices.map(item =>
                              h('option', { key: item.id, value: item.id }, `${item.title} — ${item.path}`),
                            ),
                      ),
                    ),
                    h(
                      'label',
                      { className: 'dlg-field' },
                      h('span', { className: 'dlg-field-label' }, T('workTarget')),
                      h(
                        'select',
                        {
                          className: 'dlg-select',
                          value: importSessionId,
                          disabled: busy || importSessionsLoading || importSessions.length === 0,
                          onChange: event => setImportSessionId(event.target.value),
                        },
                        h(
                          'option',
                          { value: '' },
                          importSessionsLoading ? T('sessionsLoading') : T('workNewSession'),
                        ),
                        importSessions.map(session =>
                          h(
                            'option',
                            { key: session.id, value: session.id },
                            `${session.title} — ${new Date(session.createdAt || Date.now()).toLocaleDateString()}${session.live ? ' · 进行中' : ''}${session.archived ? ' · 已归档' : ''}${session.pinned ? ' · 置顶' : ''}`,
                          ),
                        ),
                      ),
                      importSessionId ? h('div', { className: 'dlg-hint' }, T('workContinueHint')) : null,
                      importHidden.archived + importHidden.unnamed > 0 || importShowAll
                        ? h(
                            'div',
                            { className: 'dlg-hidden' },
                            importShowAll
                              ? h('span', { className: 'dlg-hint' }, T('showingAll'))
                              : h(
                                  'span',
                                  { className: 'dlg-hint' },
                                  T('hiddenSessions', {
                                    archived: importHidden.archived,
                                    unnamed: importHidden.unnamed,
                                  }),
                                ),
                            h(
                              'button',
                              { type: 'button', className: 'dlg-link', onClick: toggleShowAll, disabled: busy },
                              importShowAll ? T('showNamedOnly') : T('showAllSessions'),
                            ),
                          )
                        : null,
                    ),
                    h(
                      'label',
                      { className: 'dlg-field' },
                      h('span', { className: 'dlg-field-label' }, T('workPreset')),
                      h(
                        'select',
                        {
                          className: 'dlg-select',
                          value: selectedPreset,
                          disabled: busy || Boolean(importSessionId),
                          onChange: event => setImportPreset(event.target.value),
                        },
                        h('option', { value: '' }, T('workUseDefault')),
                        presetChoices.map(preset =>
                          h('option', { key: preset.id, value: preset.id }, presetDisplayName(preset)),
                        ),
                      ),
                      importSessionId
                        ? h('div', { className: 'dlg-hint' }, T('workPresetLocked'))
                        : (() => {
                            const selected = presetChoices.find(preset => preset.id === selectedPreset)
                            const text = presetDisplayDescription(selected)
                            return text ? h('div', { className: 'dlg-hint' }, text) : null
                          })(),
                    ),
                    h('div', { className: 'dlg-hint' }, T('workHint')),
                    importData.workspaceError
                      ? h('div', { className: 'dlg-modal-error' }, T('workspaceEmpty'))
                      : null,
                    h(
                      'div',
                      { className: 'dlg-actions' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'dlg-btn dlg-btn-primary',
                          disabled: busy || !selectedWorkspace,
                          onClick: runStartWork,
                        },
                        importBusy === 'work' ? T('workStarting') : T('workStart'),
                      ),
                    ),
                  ]
                : [
                    h('input', {
                      className: 'dlg-input',
                      placeholder: T('searchPlaceholder'),
                      value: importQuery,
                      onChange: event => setImportQuery(event.target.value),
                    }),
                    importData.loading ? h('div', { className: 'dlg-empty' }, T('boardLoading')) : null,
                    importData.cardError
                      ? h('div', { className: 'dlg-modal-error' }, T('boardUnavailable', { error: importData.cardError }))
                      : null,
                    !importData.loading && !importData.cardError && cards.length === 0 && query !== ''
                      ? h('div', { className: 'dlg-empty' }, T('noMatch'))
                      : null,
                    !importData.loading && !importData.cardError && importData.cards.length === 0 && query === ''
                      ? h(
                          'div',
                          { className: 'dlg-empty' },
                          h('div', null, T('boardEmpty')),
                          h('div', { style: { marginTop: '4px' } }, T('boardEmptyHint')),
                        )
                      : null,
                    cards.map(card =>
                      h(
                        'button',
                        {
                          key: card.id,
                          type: 'button',
                          className: 'dlg-option',
                          disabled: busy,
                          onClick: () => runBoardImport(card),
                        },
                        h(
                          'div',
                          { className: 'dlg-option-main' },
                          h('div', { className: 'dlg-option-title' }, card.title),
                          h(
                            'div',
                            { className: 'dlg-option-sub' },
                            `${T('boardColumn', { status: card.status })}${card.subtasks ? ` · ${card.subtasks} 子任务` : ''}`,
                          ),
                        ),
                        h('span', { className: 'dlg-option-go' }, importBusy === 'board' ? '…' : '＋'),
                      ),
                    ),
                    !importData.loading && !importData.cardError
                      ? h(
                          'button',
                          { type: 'button', className: 'dlg-option', disabled: busy, onClick: () => runBoardImport(null) },
                          h(
                            'div',
                            { className: 'dlg-option-main' },
                            h('div', { className: 'dlg-option-title' }, T('boardNew')),
                            h('div', { className: 'dlg-option-sub' }, T('boardNewHint')),
                          ),
                          h('span', { className: 'dlg-option-go' }, '＋'),
                        )
                      : null,
                  ],
              importError ? h('div', { className: 'dlg-modal-error' }, importError) : null,
            ),
            h(
              'div',
              { className: 'dlg-modal-foot' },
              h('span', null, importTab === 'work' ? T('importSubtitle') : T('boardSubtaskNote')),
              h(
                'button',
                { type: 'button', className: 'dlg-btn', onClick: closeImport, disabled: busy },
                T('cancel'),
              ),
            ),
          ),
        )
      }

      if (loading) {
        return h('div', { className: 'dlg-root' }, h('div', { className: 'dlg-scroll' }, h('div', { className: 'dlg-wrap' }, h('div', { className: 'dlg-empty' }, T('loading')))))
      }
      if (loadError) {
        return h('div', { className: 'dlg-root' }, h('div', { className: 'dlg-scroll' }, h('div', { className: 'dlg-wrap' }, h('div', { className: 'dlg-empty' }, `${T('loadFailed')}：${loadError}`))))
      }

      const taskList = Array.isArray(draft.tasks) ? draft.tasks : []
      const doneCount = taskList.filter(task => task.done).length
      const sameDay = Boolean(previousOpen && previousOpen.lastOpenedDate === today)
      const statusText =
        saveState === 'saving' ? T('saving') : saveState === 'saved' ? T('saved') : saveState === 'failed' ? T('saveFailed') : ''

      return h(
        'div',
        { className: 'dlg-root' },
        h(
          'div',
          { className: 'dlg-head' },
          h(
            'div',
            { className: 'dlg-head-main' },
            h('div', { className: 'dlg-title' }, T('panel')),
            h('div', { className: 'dlg-sub' }, `${humanDate(today)} · ${T('panelHint')}`),
          ),
          h(
            'div',
            { className: 'dlg-tabs' },
            h(
              'button',
              { type: 'button', className: `dlg-tab${tab === 'today' ? ' is-active' : ''}`, onClick: () => setTab('today') },
              T('today'),
            ),
            h(
              'button',
              { type: 'button', className: `dlg-tab${tab === 'history' ? ' is-active' : ''}`, onClick: () => setTab('history') },
              T('history'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dlg-scroll' },
          h(
            'div',
            { className: 'dlg-wrap' },
            tab === 'today'
              ? [
                  h(
                        'div',
                        { key: 'welcome', className: `dlg-card${showWelcome ? ' dlg-card-hero' : ''}` },
                        h(
                          'div',
                          { className: 'dlg-row' },
                          h(
                            'div',
                            { className: 'dlg-row-left' },
                            h('div', { className: 'dlg-title' }, showWelcome ? T('welcomeBack') : T('sameDay')),
                            h(
                              'span',
                              { className: 'dlg-badge' },
                              daysApart !== null && daysApart > 0
                                ? T('daysApart', { n: daysApart })
                                : sameDay
                                  ? T('overviewToday')
                                  : T('earlier'),
                            ),
                          ),
                          previousOpen && previousOpen.lastOpenedAt
                            ? h('div', { className: 'dlg-hint' }, new Date(previousOpen.lastOpenedAt).toLocaleString())
                            : null,
                        ),
                        previous
                          ? h(
                              'div',
                              { key: 'prev', style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                              h(
                                'div',
                                { className: 'dlg-row-left' },
                                h('span', { className: 'dlg-section' }, T('overviewPrev')),
                                h('span', { className: 'dlg-hint' }, previous.date),
                              ),
                              previous.summary.trim()
                                ? h('div', { className: 'dlg-quote' }, previous.summary.trim())
                                : h('div', { className: 'dlg-hint' }, T('noSummary')),
                              previous.open.length > 0
                                ? h(
                                    'div',
                                    { key: 'open' },
                                    h(
                                      'div',
                                      { className: 'dlg-row-left' },
                                      h('span', { className: 'dlg-section' }, T('openTasks')),
                                      h('span', { className: 'dlg-badge' }, T('openCount', { n: previous.open.length })),
                                    ),
                                    h(
                                      'div',
                                      { className: 'dlg-tasks', style: { marginTop: '6px' } },
                                      previous.open.slice(0, 6).map((task, index) =>
                                        h(
                                          'div',
                                          { key: task.id, className: 'dlg-task' },
                                          h('span', { className: 'dlg-task-no' }, String(index + 1)),
                                          h('span', { className: 'dlg-task-text' }, task.text),
                                        ),
                                      ),
                                    ),
                                    h(
                                      'div',
                                      { className: 'dlg-actions', style: { marginTop: '8px' } },
                                      h('button', { type: 'button', className: 'dlg-btn dlg-btn-primary', onClick: carryOpenTasks }, T('carry')),
                                    ),
                                  )
                                : h('div', { className: 'dlg-hint' }, T('openCount', { n: 0 })),
                            )
                          : h('div', { className: 'dlg-hint' }, T('firstRunBody')),
                        h(
                          'div',
                          { className: 'dlg-actions' },
                          h('button', { type: 'button', className: 'dlg-btn', onClick: copyOverview }, T('copy')),
                          previous
                            ? h(
                                'a',
                                {
                                  className: 'dlg-btn dlg-btn-ghost',
                                  href: `${BASE}/export`,
                                  target: '_blank',
                                  rel: 'noreferrer',
                                  style: { textDecoration: 'none' },
                                },
                                T('exportMd'),
                              )
                            : null,
                        ),
                      ),
                  h(
                    'div',
                    { key: 'summary', className: 'dlg-card' },
                    h(
                      'div',
                      { className: 'dlg-row' },
                      h(
                        'div',
                        { className: 'dlg-row-left' },
                        h('div', { className: 'dlg-section' }, T('summaryTitle')),
                        costData.day.cost > 0
                          ? h(
                              'span',
                              {
                                className: 'dlg-cost',
                                title: T('costHint', {
                                  tokens: Number(costData.day.tokens || 0).toLocaleString(),
                                  calls: costData.day.calls,
                                }),
                              },
                              `${T('costToday')} ≈ ${formatCny(costData.day.cost)}`,
                            )
                          : null,
                      ),
                      h('div', { className: `dlg-status${saveState === 'failed' ? ' is-error' : ''}` }, statusText),
                    ),
                    h('textarea', {
                      className: 'dlg-textarea',
                      value: draft.summary,
                      placeholder: T('summaryPlaceholder'),
                      onChange: event => updateSummary(event.target.value),
                      onBlur: () => {
                        if (saveTimer.current) flushNow({ ...latestDraft.current })
                      },
                    }),
                    h('div', { className: 'dlg-hint' }, T('storageHint')),
                  ),
                  h(
                    'div',
                    { key: 'tasks', className: 'dlg-card' },
                    h(
                      'div',
                      { className: 'dlg-row' },
                      h('div', { className: 'dlg-row-left' }, h('div', { className: 'dlg-section' }, T('tasksTitle')), h('span', { className: 'dlg-hint' }, T('tasksDone', { done: doneCount, total: taskList.length }))),
                      taskList.some(task => task.done)
                        ? h('button', { type: 'button', className: 'dlg-btn dlg-btn-ghost', onClick: clearDone }, T('clearDone'))
                        : null,
                    ),
                    h(
                      'div',
                      { className: 'dlg-task-input' },
                      h('input', {
                        className: 'dlg-input',
                        value: newTask,
                        placeholder: T('taskPlaceholder'),
                        onChange: event => setNewTask(event.target.value),
                        onKeyDown: event => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            addTask()
                          }
                        },
                      }),
                      h('button', {
                        type: 'button',
                        className: 'dlg-btn dlg-btn-primary',
                        onClick: addTask,
                        disabled: !newTask.trim(),
                        title: T('add'),
                        'aria-label': T('add'),
                        style: { minWidth: '56px' },
                      }, T('add')),
                    ),
                    h(
                      'div',
                      { className: 'dlg-tasks' },
                      taskList.length === 0
                        ? h(
                            'div',
                            { className: 'dlg-task is-empty' },
                            h('span', { className: 'dlg-task-no', 'aria-hidden': true }, '1'),
                            h('span', { className: 'dlg-task-text' }, T('firstTaskHint')),
                          )
                        : taskList.map((task, index) =>
                            h(
                              'div',
                              { key: task.id, className: `dlg-task${task.done ? ' is-done' : ''}` },
                              h('span', { className: 'dlg-task-no', 'aria-hidden': true }, String(index + 1)),
                              h('input', {
                                type: 'checkbox',
                                className: 'dlg-check',
                                checked: task.done,
                                'aria-label': `${index + 1}. ${task.text} — ${T(task.done ? 'markOpen' : 'markDone')}`,
                                onChange: () => toggleTask(task.id),
                              }),
                              h('span', { className: 'dlg-task-text' }, task.text),
                              task.imported
                                ? h(
                                    'span',
                                    { className: 'dlg-task-imported', title: T('importedTip', { label: task.imported.label }) },
                                    '✓',
                                  )
                                : null,
                              (() => {
                                const spend = task.imported && task.imported.sessionId ? costData.tasks[task.id] : null
                                if (!spend || !(spend.cost > 0)) return null
                                return h(
                                  'span',
                                  {
                                    className: 'dlg-task-cost',
                                    title: T('costHint', {
                                      tokens: Number(spend.tokens || 0).toLocaleString(),
                                      calls: spend.calls || 0,
                                    }),
                                  },
                                  `≈ ${formatCny(spend.cost)}`,
                                )
                              })(),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'dlg-import',
                                  title: T('importAction'),
                                  'aria-label': T('importAction'),
                                  onClick: () => openImport(task),
                                  disabled: Boolean(importBusy),
                                },
                                T('importAction'),
                              ),
                              h(
                                'button',
                                { type: 'button', className: 'dlg-x', title: T('deleteTask'), 'aria-label': T('deleteTask'), onClick: () => removeTask(task.id) },
                                '✕',
                              ),
                            ),
                          ),
                    ),
                    h(
                      'div',
                      { className: 'dlg-actions' },
                      h('button', { type: 'button', className: 'dlg-btn', onClick: moveOpenToTomorrow }, T('moveTomorrow')),
                    ),
                  ),
                  notice ? h('div', { key: 'notice', className: 'dlg-hint' }, notice) : null,
                ]
              : h(
                  'div',
                  { key: 'history', className: 'dlg-card' },
                  h('div', { className: 'dlg-section' }, T('historyTitle')),
                  history.length === 0
                    ? h('div', { className: 'dlg-empty' }, T('historyEmpty'))
                    : history.map(({ key, entry }) => {
                        const done = entry.tasks.filter(task => task.done).length
                        return h(
                          'div',
                          { key, className: 'dlg-day' },
                          h(
                            'div',
                            { className: 'dlg-day-head' },
                            h('span', { className: 'dlg-day-date' }, humanDate(key)),
                            entry.tasks.length > 0 ? h('span', { className: 'dlg-hint' }, T('tasksDone', { done, total: entry.tasks.length })) : null,
                          ),
                          entry.summary.trim()
                            ? h('div', { className: 'dlg-day-summary' }, entry.summary.trim())
                            : h('div', { className: 'dlg-empty' }, T('noSummary')),
                          entry.tasks.length > 0
                            ? h(
                                'div',
                                { className: 'dlg-day-tasks' },
                                entry.tasks.map((task, index) =>
                                  h(
                                    'span',
                                    { key: task.id, className: `dlg-chip${task.done ? ' is-done' : ''}` },
                                    `${index + 1}. ${task.text}`,
                                  ),
                                ),
                              )
                            : null,
                        )
                      }),
                ),
          ),
        ),
        importTask ? renderImportDialog() : null,
      )
    }

    // --------------------------------------------------------------------- //
    // sidebar icon
    // --------------------------------------------------------------------- //
    function PanelIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20
      return h('span', { className: 'dlg-icon-root' }, h(LogIcon, { size }))
    }

    // --------------------------------------------------------------------- //
    // module
    // --------------------------------------------------------------------- //
    const LOCALE_NS = 'daily-log'

    function isZhLocale(id) {
      return typeof id !== 'string' || /^zh\b/i.test(id)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        pluginCtx = ctx
        let disposeStyle = null
        let styleElement = null
        try {
          if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
            disposeStyle = styles.insert(CSS)
          }
        } catch {
          disposeStyle = null
        }
        if (!disposeStyle && typeof document !== 'undefined') {
          styleElement = document.createElement('style')
          styleElement.setAttribute('data-daily-log', '')
          styleElement.textContent = CSS
          document.head.appendChild(styleElement)
        }
        ctx.effect(() => () => {
          try {
            if (disposeStyle) disposeStyle()
          } catch {
            /* ignore */
          }
          try {
            if (styleElement && styleElement.parentNode) styleElement.parentNode.removeChild(styleElement)
          } catch {
            /* ignore */
          }
        })

        ctx.effect(() => {
          let disposed = false
          let offLocale = null
          let localeService = null
          let registered = false
          const attach = () => {
            if (disposed) return
            let locale = null
            try {
              locale = typeof ctx.get === 'function' ? ctx.get('locale') : null
            } catch {
              locale = null
            }
            if (!locale || typeof locale.register !== 'function') {
              setTimeout(attach, 300)
              return
            }
            localeService = locale
            if (!registered) {
              try {
                locale.register(LOCALE_NS, { zh: ZH, en: EN })
                registered = true
              } catch {
                /* keep the local table */
              }
            }
            try {
              const snapshot = locale.getSnapshot()
              const next = isZhLocale(snapshot && snapshot.active) ? 'zh' : 'en'
              if (next !== language) {
                language = next
                localeStore.set(localeStore.get() + 1)
              }
            } catch {
              /* ignore */
            }
          }
          attach()
          try {
            offLocale = ctx.on('locale/change', () => attach())
          } catch {
            offLocale = null
          }
          return () => {
            disposed = true
            try {
              if (offLocale) offLocale()
            } catch {
              /* ignore */
            }
          }
        })

        // The sidebar list renders the icon and opens the keyed main panel; both
        // registrations use the same id so the two halves line up.
        ctx.effect(() =>
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: PANEL_ID, order: 14, label: () => T('panel') },
              PanelIcon,
            ),
          ),
        )

        ctx.effect(() =>
          ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel),
          ),
        )
      },
    }
  },
})
