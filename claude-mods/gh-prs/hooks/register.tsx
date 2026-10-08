import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { GhPrsLists, GhPrsPr } from '../types'
import {
  LIST_FIELDS,
  VIEW_FIELDS,
  isQuietFailure,
  parsePrList,
  parsePrView,
  prSegments,
} from './format'
import type { Segment } from './format'

type Engine = EngineInterface

const PANE = 'gh-prs'
const PENDING_EVERY_MS = 60_000
const IDLE_EVERY_MS = 5 * 60_000
const AFTER_PUSH_MS = 20_000
const GH_CANDIDATES = ['gh', '/opt/homebrew/bin/gh', '/usr/local/bin/gh']
const TRIGGER = /\bgit\s+(push|checkout|switch)\b|\bgh\s+pr\b/

const current = atom({ plugin: 'gh-prs', key: 'current' } as const, null)
const lists = atom({ plugin: 'gh-prs', key: 'lists' } as const, null)
const hasLogged = atom({ plugin: 'gh-prs', key: 'hasLogged' } as const, false)

type GhResult = { isOk: true; stdout: string } | { isOk: false; stderr: string }

// Module state: a hot reload drops it with the timers, and the band's first
// draw after the reload starts things again.
let isStarted = false
let ghPath: string | undefined
let timer: Timer | undefined
let isRefreshing = false
let isRefreshAgain = false

// Runs gh by argv; finds the binary once (the host PATH may lack Homebrew).
async function gh($: Engine, args: string[]): Promise<GhResult> {
  const candidates = ghPath === undefined ? GH_CANDIDATES : [ghPath]
  for (const candidate of candidates) {
    try {
      const ran = await $.process.run([candidate, ...args], { timeoutMs: 20_000 })
      ghPath = candidate
      return ran.exitCode === 0 ? { isOk: true, stdout: ran.stdout } : { isOk: false, stderr: ran.stderr }
    } catch (error) {
      if (ghPath !== undefined) return { isOk: false, stderr: String(error) }
    }
  }

  return { isOk: false, stderr: 'gh: not found on this machine' }
}

// One quiet line, once per session, and never for "no PR here" answers.
async function noteFailure($: Engine, stderr: string): Promise<void> {
  if (isQuietFailure(stderr) || (await read($, hasLogged))) return
  await update($, hasLogged, () => true)
  const line = stderr.trim().split('\n')[0] ?? ''
  $.ui.log(`gh-prs: gh failed (${line.slice(0, 160)}); the PR band stays hidden.`)
}

function schedule($: Engine, ms: number): void {
  timer?.cancel()
  timer = $.clock.after(ms, () => void refresh($))
}

async function refresh($: Engine): Promise<void> {
  if (isRefreshing) {
    isRefreshAgain = true
    return
  }
  isRefreshing = true
  let pr: GhPrsPr | null = null
  try {
    const ran = await gh($, ['pr', 'view', '--json', VIEW_FIELDS])
    if (ran.isOk) pr = parsePrView(ran.stdout)
    else await noteFailure($, ran.stderr)
    await update($, current, () => pr)
  } catch {
    // A refresh never throws into a timer or a tool call.
  } finally {
    isRefreshing = false
    schedule($, pr !== null && pr.checks.pending > 0 ? PENDING_EVERY_MS : IDLE_EVERY_MS)
  }
  if (isRefreshAgain) {
    isRefreshAgain = false
    void refresh($)
  }
}

async function loadLists($: Engine): Promise<void> {
  const [mine, review] = await Promise.all([
    gh($, ['pr', 'list', '--author', '@me', '--json', LIST_FIELDS]),
    gh($, ['pr', 'list', '--search', 'review-requested:@me', '--json', LIST_FIELDS]),
  ])
  for (const ran of [mine, review]) if (!ran.isOk) await noteFailure($, ran.stderr)
  const next: GhPrsLists = {
    mine: mine.isOk ? parsePrList(mine.stdout) : [],
    review: review.isOk ? parsePrList(review.stdout) : [],
    isLoading: false,
    hasFailed: !mine.isOk && !review.isOk,
  }
  await update($, lists, () => next)
}

async function start($: Engine): Promise<void> {
  if (isStarted) return
  isStarted = true
  try {
    await $.command.register({
      name: 'prs',
      description: 'List your open PRs and PRs awaiting your review in this repo',
      immediate: true,
    })
  } catch {
    // A refused registration leaves the band working.
  }
  void refresh($)
}

function openUrl($: Engine, url: string): void {
  void $.process.run(['open', url]).catch(() => undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await start($)

    return started
  })

  // React after the tool ran; the refresh is never awaited by the call.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (TRIGGER.test(e.command)) {
      void refresh($)
      $.clock.after(AFTER_PUSH_MS, () => void refresh($))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'prs' }, async $ => {
    await update($, lists, old => ({
      mine: old?.mine ?? [],
      review: old?.review ?? [],
      isLoading: true,
      hasFailed: false,
    }))
    await $.ui.open({ id: PANE, title: 'Pull requests', focus: true, closeOnEscape: true })
    void loadLists($)

    return { text: 'Opened the pull request list.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isStarted) $.clock.after(0, () => void start($))
    if (e.props.hasSurvey) return next(e)
    const pr = await read($, current)
    if (pr === null) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const button = ' o: open'

    return (
      <Box flexDirection="row">
        <Text wrap="truncate-end">
          {prSegments(pr, e.props.bodyColumns - button.length).map(segment => draw(Text, segment))}
        </Text>
        <Text> </Text>
        <Button
          key="open"
          label="open"
          hotkey="o"
          plain
          dimColor
          onPress={() => openUrl($, pr.url)}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const state = await read($, lists)
    const columns = e.props.bodyColumns
    let hotkey = 0

    const section = (heading: string, prs: readonly GhPrsPr[]) => (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>{heading}</Text>
        {prs.length === 0 ? (
          <Text dimColor>{state?.isLoading ? 'loading…' : 'none'}</Text>
        ) : (
          prs.map(pr => {
            hotkey += 1
            const isFirst = hotkey === 1
            const key = hotkey <= 9 ? String(hotkey) : undefined
            // `n: ` before the button, the button itself and a space.
            const room = columns - (key ? 3 : 0) - 1

            return (
              <Box flexDirection="row">
                <Button
                  key={`open:${heading}:${pr.number}`}
                  label="open"
                  hotkey={key}
                  plain
                  dimColor
                  autoFocus={isFirst ? true : undefined}
                  onPress={() => openUrl($, pr.url)}
                />
                <Text> </Text>
                <Text wrap="truncate-end">
                  {prSegments(pr, room - 5).map(segment => draw(Text, segment))}
                </Text>
              </Box>
            )
          })
        )}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {state?.hasFailed === true && <Text dimColor>gh could not list pull requests here.</Text>}
        {section('Your open pull requests', state?.mine ?? [])}
        {section('Review requested', state?.review ?? [])}
        <Box flexDirection="row">
          <Button key="refresh" label="refresh" hotkey="r" plain dimColor onPress={() => loadLists($)} />
          <Text dimColor> · Tab moves, Enter opens, Esc closes</Text>
        </Box>
      </Box>
    )
  })
}

type TextTag = ReturnType<EngineInterface['ui']['resolve']>['Text']

function draw(Text: TextTag, segment: Segment) {
  return (
    <Text color={segment.color} dimColor={segment.isDim}>
      {segment.text}
    </Text>
  )
}
