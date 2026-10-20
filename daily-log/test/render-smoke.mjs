/**
 * Render smoke test for the daily-log panel.
 *
 * The dynamic Client half is a plain module loaded by `window.__ModuleLoader__`.
 * This harness provides a tiny React-compatible runtime (createElement + the
 * hooks the panel uses), stubs `fetch`, renders the panel, and asserts the
 * numbered task list appears for both the populated and the empty day.
 *
 * Run: node test/render-smoke.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')

// ------------------------------------------------------------------------- //
// minimal React runtime
// ------------------------------------------------------------------------- //
const state = {
  slots: [],
  index: 0,
  effects: [],
  dirty: false,
  tree: null,
  promises: [],
}

function createElement(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false),
  }
}

function useState(initial) {
  const index = state.index++
  if (!(index in state.slots)) state.slots[index] = { kind: 'state', value: initial }
  const slot = state.slots[index]
  const set = next => {
    const value = typeof next === 'function' ? next(slot.value) : next
    if (Object.is(value, slot.value)) return
    slot.value = value
    state.dirty = true
  }
  return [slot.value, set]
}

function useRef(initial) {
  const index = state.index++
  if (!(index in state.slots)) state.slots[index] = { kind: 'ref', current: initial }
  return state.slots[index]
}

function depsChanged(a, b) {
  if (!a || !b || a.length !== b.length) return true
  return a.some((value, i) => !Object.is(value, b[i]))
}

function useMemo(factory, deps) {
  const index = state.index++
  const slot = state.slots[index]
  if (!slot || slot.kind !== 'memo' || depsChanged(slot.deps, deps)) {
    state.slots[index] = { kind: 'memo', deps, value: factory() }
  }
  return state.slots[index].value
}

function useEffect(effect, deps) {
  const index = state.index++
  const slot = state.slots[index]
  if (!slot || slot.kind !== 'effect' || depsChanged(slot.deps, deps)) {
    const previous = slot && slot.cleanup
    state.slots[index] = { kind: 'effect', deps, cleanup: undefined, previous }
    state.effects.push({ slot: state.slots[index], effect })
  }
}

const React = { createElement, useState, useRef, useMemo, useEffect, useSyncExternalStore: () => undefined }

// ------------------------------------------------------------------------- //
// fetch stub
// ------------------------------------------------------------------------- //
const scenario = { entry: null, touched: null, boardPost: null }
const workspaceCalls = []
const promptCalls = []
const openedSessions = []
const sessionStub = {
  sessionId: 'session-new',
  binding: {
    session: {
      async prompt(content, mode) {
        promptCalls.push({ content, mode })
        return { ok: true, value: { accepted: true } }
      },
    },
  },
}
const workspaceStub = {
  async connectWorkspace(workspaceId, options) {
    workspaceCalls.push({ workspaceId, options })
    return 'session-new'
  },
  openSession(sessionId) {
    openedSessions.push(sessionId)
  },
  startSession(workspaceId, options) {
    workspaceCalls.push({ workspaceId, options })
  },
}
const usingTargets = []
const sessionsStub = {
  async using(target, options, operation) {
    usingTargets.push(target)
    return operation(sessionStub)
  },
}
const encoder = new TextEncoder()

function json(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body
    },
    async arrayBuffer() {
      return encoder.encode('').buffer
    },
  }
}

const fetchStub = async (url, init) => {
  const path = String(url)
  // Specific routes first: the task-board state URL also contains "/state".
  if (path.includes('/api/task-board/state')) {
    return json({
      tasks: [
        { id: 'card-1', title: '发布插件', status: 'todo' },
        { id: 'card-2', title: '写文档', status: 'running' },
        { id: 'card-1-sub', title: '子任务', status: 'todo', parentId: 'card-1' },
      ],
    })
  }
  if (path.includes('/api/task-board/action')) {
    scenario.boardPost = init && typeof init.body === 'string' ? JSON.parse(init.body) : null
    return json({ ok: true })
  }
  if (path.includes('/daily-log/cost')) {
    return json({
      date: '2026-10-20',
      currency: 'CNY',
      approximate: true,
      source: 'usage-ledger',
      ratePerToken: 5e-7,
      day: { cost: 3.37, tokens: 2_000_000, calls: 20, byModel: [] },
      tasks: {
        imp: { tokens: 100_000, calls: 5, cost: 0.05 },
        cont: { tokens: 20_000, calls: 2, cost: 0.01 },
      },
    })
  }
  if (path.includes('/daily-log/sessions')) {
    const all = path.includes('all=1')
    return json({
      sessions: all
        ? [
            { id: 'session-old', title: '昨天的发布流程', createdAt: Date.UTC(2026, 9, 19), live: false },
            { id: 'session-live', title: '正在进行的对话', createdAt: Date.UTC(2026, 9, 20), live: true },
            { id: 'session-arch', title: '归档的旧对话', createdAt: Date.UTC(2026, 9, 18), live: false, archived: true },
            { id: 'session-unnamed', title: '(未命名会话)', createdAt: Date.UTC(2026, 9, 17), live: false },
          ]
        : [
            { id: 'session-old', title: '昨天的发布流程', createdAt: Date.UTC(2026, 9, 19), live: false },
            { id: 'session-live', title: '正在进行的对话', createdAt: Date.UTC(2026, 9, 20), live: true },
          ],
      hidden: { archived: 1, unnamed: 1, shown: 2 },
    })
  }
  if (path.includes('/daily-log/workspaces')) {
    return json({
      workspaces: [
        { id: 'ws-1', title: 'deepseek-harness', path: 'C:/work/deepseek-harness' },
        { id: 'ws-2', title: 'notes', path: 'C:/work/notes' },
      ],
    })
  }
  if (path.includes('/daily-log/presets')) {
    return json({
      presets: [
        { id: 'preset-standard', name: 'Standard mode', nameZh: '标准模式', description: 'Work with code', descriptionZh: '处理代码、文件和资料，适合大多数任务。', isDefault: true },
        { id: 'preset-ptc', name: 'PTC mode', nameZh: 'PTC 模式', description: 'Batch tool calls', descriptionZh: '包含标准模式的所有能力，更适合批量调用工具。', isDefault: false },
        { id: 'preset-cordis', name: 'Creator mode', nameZh: '创造模式', description: 'Customize DSH', descriptionZh: '用对话定制 DSH：让 Agent 编写插件。', isDefault: false },
      ],
      lastUsedPreset: 'preset-ptc',
    })
  }
  if (path.includes('/daily-log/state')) {
    return json({
      version: 1,
      entries: scenario.entry ? { [scenario.entry.date]: scenario.entry } : {},
      lastOpenedAt: Date.now() - 86_400_000,
      lastOpenedDate: scenario.touched || '2000-01-01',
    })
  }
  if (path.includes('/touch')) {
    return json({ ok: true, previous: { lastOpenedAt: Date.now() - 86_400_000, lastOpenedDate: '2000-01-01' }, state: { entries: {} } })
  }
  if (path.includes('/save')) {
    return json({ ok: true, state: { entries: scenario.entry ? { [scenario.entry.date]: scenario.entry } : {} } })
  }
  return json({})
}

// ------------------------------------------------------------------------- //
// module harness
// ------------------------------------------------------------------------- //
let factory = null
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(spec) {
        factory = spec.factory
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    AudioContext: undefined,
    Audio: undefined,
  },
  document: {
    addEventListener: () => {},
    removeEventListener: () => {},
    head: { appendChild: () => {} },
    createElement: () => ({ setAttribute: () => {}, style: {}, textContent: '', parentNode: null }),
  },
  fetch: fetchStub,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  console,
  navigator: { clipboard: { writeText: async () => {} } },
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Promise,
  URLSearchParams,
  encodeURIComponent,
  decodeURIComponent,
}

vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'client.js' })

const module_ = factory(requireName => (requireName === 'react' ? React : undefined))
const Panel = (() => {
  // The panel component is internal; register it through the slot system and
  // capture the render function the plugin would hand to the slot.
  let captured = null
  const fakeCtx = {
    slots: {
      inject: (_name, callback) => {
        callback()
        return () => {}
      },
      register: (registration, component) => {
        if (registration.key === 'daily-log' || registration.name === 'main') captured = component
        return () => {}
      },
    },
    get: name => (name === 'uiWorkspace' ? workspaceStub : name === 'sessions' ? sessionsStub : null),
    on: () => () => {},
    effect: callback => {
      const cleanup = callback()
      return () => {
        if (typeof cleanup === 'function') cleanup()
      }
    },
  }
  sandbox.window.__PluginTestCtx__ = fakeCtx
  module_.apply(fakeCtx)
  return captured
})()

if (typeof Panel !== 'function') {
  console.error('FAIL: panel component was not registered')
  process.exit(1)
}

// ------------------------------------------------------------------------- //
// render loop
// ------------------------------------------------------------------------- //
async function render() {
  for (let pass = 0; pass < 25; pass += 1) {
    state.index = 0
    state.effects = []
    state.dirty = false
    state.tree = Panel({})
    for (const item of state.effects) {
      if (item.slot.previous) {
        try {
          item.slot.previous()
        } catch {
          /* ignore */
        }
      }
      const cleanup = item.effect()
      item.slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    }
    // let fetch promises settle (the load effect awaits two requests)
    for (let i = 0; i < 6; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    if (!state.dirty) break
  }
  return state.tree
}

function walk(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) walk(child, predicate, out)
    return out
  }
  if (predicate(node)) out.push(node)
  if (node.children) for (const child of node.children) walk(child, predicate, out)
  return out
}

function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return (node.children || []).map(textOf).join('')
}

function numbers(tree) {
  return walk(tree, node => node.props && node.props.className === 'dlg-task-no').map(textOf)
}

function byClass(tree, className) {
  return walk(tree, node => node.props && node.props.className === className)
}

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ------------------------------------------------------------------------- //
// case 1: a day with three tasks
// ------------------------------------------------------------------------- //
const today = (() => {
  const d = new Date()
  const p = value => String(value).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()

scenario.entry = {
  date: today,
  summary: '把编号做出来',
  tasks: [
    { id: 'a', text: '第一件事', done: false },
    { id: 'b', text: '第二件事', done: true },
    { id: 'c', text: '第三件事', done: false },
  ],
  updatedAt: Date.now(),
}
state.slots = []
state.tree = null
let tree = await render()
let numbersShown = numbers(tree)
check('three tasks render three numbers', JSON.stringify(numbersShown) === JSON.stringify(['1', '2', '3']), JSON.stringify(numbersShown))
check('task rows are present', walk(tree, node => node.props && typeof node.props.className === 'string' && /(^| )dlg-task( |$)/.test(node.props.className)).length === 3, 'row count mismatch')
check('count label shows total and done', textOf(byClass(tree, 'dlg-card')[1] || tree).includes('共 3 件') || textOf(tree).includes('共 3 件'), 'missing 共 3 件')
check('done task keeps its number', numbersShown[1] === '2')
check('summary is rendered', walk(tree, node => node.type === 'textarea' && node.props.value === '把编号做出来').length === 1)
check('day spend is shown in the summary header', textOf(tree).includes('今日花费') && textOf(tree).includes('¥3.37'), textOf(tree).slice(0, 160))

// ------------------------------------------------------------------------- //
// case 2: an empty day still shows the numbered first slot
// ------------------------------------------------------------------------- //
scenario.entry = { date: today, summary: '', tasks: [], updatedAt: Date.now() }
state.slots = []
state.tree = null
tree = await render()
numbersShown = numbers(tree)
check('empty day shows number 1', numbersShown.includes('1'), JSON.stringify(numbersShown))
check('empty day explains how to add', textOf(tree).includes('第 1 件任务从这里开始'), textOf(tree).slice(0, 120))

// ------------------------------------------------------------------------- //
// case 3: history tab numbers chips
// ------------------------------------------------------------------------- //
scenario.entry = { date: today, summary: '总结', tasks: [{ id: 'h', text: '历史任务', done: false }], updatedAt: Date.now() }
state.slots = []
state.tree = null
tree = await render()
// click the history tab
const tabs = walk(tree, node => node.type === 'button' && node.props && typeof node.props.className === 'string' && node.props.className.startsWith('dlg-tab'))
const historyTab = tabs.find(node => textOf(node).includes('历史'))
if (historyTab && typeof historyTab.props.onClick === 'function') {
  historyTab.props.onClick()
  tree = await render()
  const chips = byClass(tree, 'dlg-chip')
  check('history chip carries its number', chips.length > 0 && textOf(chips[0]) === '1. 历史任务', chips.map(textOf).join(' | '))
} else {
  check('history tab found', false)
}
// ------------------------------------------------------------------------- //
// case 4: the import chooser starts work in a workspace
// ------------------------------------------------------------------------- //
scenario.entry = {
  date: today,
  summary: '',
  tasks: [{ id: 'imp', text: '把发布流程跑一遍', done: false }],
  updatedAt: Date.now(),
}
scenario.boardPost = null
workspaceCalls.length = 0
promptCalls.length = 0
openedSessions.length = 0
state.slots = []
state.tree = null
tree = await render()

const importButtons = walk(tree, node => node.props && node.props.className === 'dlg-import')
check('each task exposes an import button', importButtons.length === 1, `got ${importButtons.length}`)
if (importButtons[0] && typeof importButtons[0].props.onClick === 'function') {
  importButtons[0].props.onClick()
  tree = await render()
  check('import dialog opens', byClass(tree, 'dlg-modal').length === 1)
  check('work tab is the default', textOf(tree).includes('工作区') && textOf(tree).includes('预设'))
  const selects = walk(tree, node => node.type === 'select')
  check('workspace, conversation and preset pickers render', selects.length === 3, `got ${selects.length}`)
  const workspaceOptions = walk(selects[0], node => node.type === 'option').map(textOf)
  check('workspaces are listed', workspaceOptions.some(text => text.includes('deepseek-harness')), JSON.stringify(workspaceOptions))
  const sessionOptions = walk(selects[1], node => node.type === 'option').map(textOf)
  check('existing conversations are listed first', sessionOptions[0].includes('新开一个会话') && sessionOptions.some(text => text.includes('昨天的发布流程')), JSON.stringify(sessionOptions))
  check('live conversation is marked', sessionOptions.some(text => text.includes('进行中')), JSON.stringify(sessionOptions))
  const presetOptions = walk(selects[2], node => node.type === 'option').map(textOf)
  check('presets use the app Chinese names', presetOptions.includes('标准模式') && presetOptions.includes('PTC 模式') && presetOptions.includes('创造模式'), JSON.stringify(presetOptions))
  check('preset defaults to the last used mode', selects[2].props.value === 'preset-ptc', String(selects[2].props.value))
  check('selected preset shows its description', textOf(tree).includes('包含标准模式的所有能力'), textOf(tree).slice(-200))
  check('hidden archives and unnamed sessions are reported', textOf(tree).includes('已隐藏 1 个已归档') && textOf(tree).includes('1 个未命名对话'), textOf(tree).slice(-200))
  const showAllButton = walk(tree, node => node.type === 'button' && node.props && node.props.className === 'dlg-link')[0]
  check('show-all control is offered', Boolean(showAllButton))
  if (showAllButton && typeof showAllButton.props.onClick === 'function') {
    showAllButton.props.onClick()
    tree = await render()
    const allOptions = walk(walk(tree, node => node.type === 'select')[1], node => node.type === 'option').map(textOf)
    check('show all reveals archived conversations', allOptions.some(text => text.includes('归档的旧对话') && text.includes('已归档')), JSON.stringify(allOptions))
    check('show all reveals unnamed conversations', allOptions.some(text => text.includes('(未命名会话)')), JSON.stringify(allOptions))
  }

  const startButton = walk(tree, node => node.type === 'button' && node.props && node.props.className === 'dlg-btn dlg-btn-primary').find(node => textOf(node).includes('开始工作'))
  check('start-work button is present', Boolean(startButton))
  if (startButton && typeof startButton.props.onClick === 'function') {
    startButton.props.onClick()
    tree = await render()
  }
  check('a session is created in the chosen workspace', workspaceCalls.length === 1 && workspaceCalls[0].workspaceId === 'ws-1', JSON.stringify(workspaceCalls))
  check('the task is sent as the first message', promptCalls.length === 1 && promptCalls[0].content?.[0]?.text === '把发布流程跑一遍' && promptCalls[0].mode === 'queue', JSON.stringify(promptCalls))
  check('the new session is opened', openedSessions.length === 1 && openedSessions[0] === 'session-new', JSON.stringify(openedSessions))
  check('the prompt went into the created session', usingTargets.length === 1 && usingTargets[0] === 'session-new', JSON.stringify(usingTargets))
  check('task shows an imported badge', byClass(tree, 'dlg-task-imported').length === 1)
  check('task shows its rough spend', byClass(tree, 'dlg-task-cost').length === 1 && textOf(byClass(tree, 'dlg-task-cost')[0]) === '≈ ¥0.05', textOf(byClass(tree, 'dlg-task-cost')[0] || tree).slice(0, 80))
  check('dialog closes after starting', byClass(tree, 'dlg-modal').length === 0)
}

// ------------------------------------------------------------------------- //
// case 5: the board tab still files the task as a subtask
// ------------------------------------------------------------------------- //
state.slots = []
state.tree = null
tree = await render()
const importButton2 = walk(tree, node => node.props && node.props.className === 'dlg-import')[0]
if (importButton2) {
  importButton2.props.onClick()
  tree = await render()
  const boardTab = walk(tree, node => node.type === 'button' && node.props && typeof node.props.className === 'string' && node.props.className.startsWith('dlg-modal-tab')).find(node => textOf(node).includes('任务板'))
  if (boardTab && typeof boardTab.props.onClick === 'function') {
    boardTab.props.onClick()
    tree = await render()
    const cardTitles = walk(tree, node => node.props && node.props.className === 'dlg-option-title').map(textOf)
    check('board cards are listed', cardTitles.includes('发布插件') && cardTitles.includes('写文档'), JSON.stringify(cardTitles))
    check('subtask cards are not offered as parents', !cardTitles.includes('子任务'), JSON.stringify(cardTitles))
    const options = walk(tree, node => node.type === 'button' && node.props && node.props.className === 'dlg-option')
    const target = options.find(node => textOf(node).includes('发布插件'))
    if (target && typeof target.props.onClick === 'function') {
      target.props.onClick()
      tree = await render()
    }
    check('board create posts the task as a subtask', Boolean(
      scenario.boardPost &&
      scenario.boardPost.action &&
      scenario.boardPost.action.kind === 'create' &&
      scenario.boardPost.action.input.parentId === 'card-1' &&
      scenario.boardPost.action.input.prompt === '把发布流程跑一遍',
    ), JSON.stringify(scenario.boardPost))
  } else {
    check('board tab found', false)
  }
}

// ------------------------------------------------------------------------- //
// case 6: continuing an existing conversation of the workspace
// ------------------------------------------------------------------------- //
scenario.entry = {
  date: today,
  summary: '',
  tasks: [{ id: 'cont', text: '接着昨天的发布流程往下做', done: false }],
  updatedAt: Date.now(),
}
workspaceCalls.length = 0
promptCalls.length = 0
openedSessions.length = 0
usingTargets.length = 0
state.slots = []
state.tree = null
tree = await render()
const importButton3 = walk(tree, node => node.props && node.props.className === 'dlg-import')[0]
if (importButton3) {
  importButton3.props.onClick()
  tree = await render()
  const selects = walk(tree, node => node.type === 'select')
  const sessionSelect = selects[1]
  check('conversation picker is selectable', Boolean(sessionSelect))
  if (sessionSelect && typeof sessionSelect.props.onChange === 'function') {
    sessionSelect.props.onChange({ target: { value: 'session-old' } })
    tree = await render()
    const startButton = walk(tree, node => node.type === 'button' && node.props && node.props.className === 'dlg-btn dlg-btn-primary').find(node => textOf(node).includes('开始工作'))
    if (startButton && typeof startButton.props.onClick === 'function') {
      startButton.props.onClick()
      tree = await render()
    }
  }
  check('no new session is created when continuing', workspaceCalls.length === 0, JSON.stringify(workspaceCalls))
  check('the prompt continues the existing session', usingTargets.length === 1 && usingTargets[0] === 'session-old', JSON.stringify(usingTargets))
  check('the existing conversation is opened', openedSessions.length === 1 && openedSessions[0] === 'session-old', JSON.stringify(openedSessions))
  check('the task is sent into it', promptCalls.length === 1 && promptCalls[0].content?.[0]?.text === '接着昨天的发布流程往下做', JSON.stringify(promptCalls))
  check('badge records the continued conversation', byClass(tree, 'dlg-task-imported').length === 1)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
