import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

import { checkSegments, parsePrView, prSegments, summarizeChecks } from '../hooks/format'

const ROLLUP = [
  { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SKIPPED' },
  { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' },
  { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' },
  { __typename: 'StatusContext', state: 'PENDING' },
  { __typename: 'StatusContext', state: 'SUCCESS' },
  { __typename: 'StatusContext', state: 'ERROR' },
]

const PR_JSON = JSON.stringify({
  number: 123,
  title: 'Add the PR band',
  state: 'OPEN',
  isDraft: false,
  url: 'https://github.com/o/r/pull/123',
  reviewDecision: 'CHANGES_REQUESTED',
  statusCheckRollup: ROLLUP,
  mergeable: 'MERGEABLE',
  headRefName: 'feature',
})

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

// The engine's own drawing beneath the plugin: an empty band.
function engineDrawsNothing(on: On) {
  on('ui.render', () => h('Box', {}) as RenderElement)
}

// gh answered from memory: every `$.process.run` beneath the plugin.
function fakeGh(on: On, answer: { exitCode: number; stdout?: string; stderr?: string }, calls: string[][]) {
  on('process.run', ($, e) => {
    calls.push([...e.argv])
    return {
      value: {
        exitCode: answer.exitCode,
        stdout: answer.stdout ?? '',
        stderr: answer.stderr ?? '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
}

describe('checks summary', () => {
  test('counts CheckRuns and StatusContexts', () => {
    expect(summarizeChecks(ROLLUP)).toEqual({ passed: 3, failed: 2, pending: 2 })
    expect(summarizeChecks(null)).toEqual({ passed: 0, failed: 0, pending: 0 })
  })

  test('formats coloured counts, failures first', () => {
    const segments = checkSegments({ passed: 3, failed: 1, pending: 2 })
    const drawn = segments.filter(s => s.text.trim() !== '')
    expect(drawn).toEqual([
      { text: '✗ 1 failed', color: 'error' },
      { text: '● 2 pending', color: 'warning' },
      { text: '✓ 3 passed', color: 'success' },
    ])
    expect(checkSegments({ passed: 0, failed: 0, pending: 0 })).toEqual([{ text: 'no checks', isDim: true }])
  })

  test('the band line reads #n title · checks · review', () => {
    const pr = parsePrView(PR_JSON)
    expect(pr).not.toBeNull()
    if (pr === null) return
    const text = prSegments(pr, 120).map(s => s.text).join('')
    expect(text).toBe('#123 Add the PR band · ✗ 2 failed ● 2 pending ✓ 3 passed · changes requested')
    const narrow = prSegments({ ...pr, title: 'x'.repeat(200) }, 80).map(s => s.text).join('')
    expect(narrow.length <= 80).toBe(true)
  })

  test('gh output that is not a PR parses to null', () => {
    expect(parsePrView('')).toBeNull()
    expect(parsePrView('[]')).toBeNull()
  })
})

describe('the band', () => {
  test('draws nothing when the branch has no PR', async ($, on) => {
    const clock = mock.clock(on)
    engineDrawsNothing(on)
    const calls: string[][] = []
    fakeGh(on, { exitCode: 1, stderr: 'no pull requests found for branch "main"' }, calls)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'gh-prs', surface, ...BAND })
      await clock.settle()
      expect(await ui.find({ type: 'Button' })).toBeUndefined()
      expect(await ui.find({ text: /#\d+/ })).toBeUndefined()
      await ui.unmount()
    }
    expect(calls.some(argv => argv.includes('view'))).toBe(true)
  })

  test('draws the PR with an open button when there is one', async ($, on) => {
    const clock = mock.clock(on)
    engineDrawsNothing(on)
    fakeGh(on, { exitCode: 0, stdout: PR_JSON }, [])

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'gh-prs', surface, ...BAND })
      await clock.settle()
      expect((await ui.find({ type: 'Button', key: 'open' }))?.props.hotkey).toBe('o')
      expect(await ui.find({ type: 'Text', text: /#123 Add the PR band/ })).toBeDefined()
      await ui.unmount()
    }
  })
})

describe('/prs', () => {
  test('lists PRs as keyboard rows, hotkeys 1-9', async ($, on) => {
    const clock = mock.clock(on)
    engineDrawsNothing(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    const list = JSON.stringify([JSON.parse(PR_JSON), { ...JSON.parse(PR_JSON), number: 124, title: 'Second' }])
    fakeGh(on, { exitCode: 0, stdout: list }, [])

    await $.command.run({
      command: 'prs',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })
    await clock.settle()
    const pane = {
      title: 'Pull requests',
      isFocused: true,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    } as const
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'gh-prs', surface, component: 'Pane', requestId: 'gh-prs', props: pane })
      const buttons = await ui.findAll({ type: 'Button' })
      // Two PRs in each section (the fake answers both lists), then refresh.
      expect(buttons.map(b => b.props.hotkey)).toEqual(['1', '2', '3', '4', 'r'])
      expect(buttons[0]?.props.autoFocus).toBe(true)
      expect(await ui.find({ type: 'Text', text: /#124 Second/ })).toBeDefined()
      await ui.unmount()
    }
  })
})
