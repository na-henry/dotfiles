import type { GhPrsChecks, GhPrsPr } from '../types'

// Pure helpers: parsing gh's JSON and turning a PR into coloured segments.
// No `$` here, so the tests exercise them directly.

export const VIEW_FIELDS =
  'number,title,state,isDraft,url,reviewDecision,statusCheckRollup,mergeable,headRefName'
export const LIST_FIELDS =
  'number,title,state,isDraft,url,reviewDecision,statusCheckRollup,headRefName'

export type Segment = { text: string; color?: string; isDim?: boolean }

type RollupItem = {
  __typename?: string
  status?: string
  conclusion?: string
  state?: string
}

const PASSED = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const PENDING_STATES = new Set(['PENDING', 'EXPECTED'])

// gh mixes CheckRun (status + conclusion) and StatusContext (state) entries.
export function summarizeChecks(rollup: unknown): GhPrsChecks {
  const counts: GhPrsChecks = { passed: 0, failed: 0, pending: 0 }
  if (!Array.isArray(rollup)) return counts

  for (const raw of rollup as RollupItem[]) {
    if (raw === null || typeof raw !== 'object') continue
    const isStatusContext = raw.__typename === 'StatusContext' || (raw.state !== undefined && raw.status === undefined)

    if (isStatusContext) {
      const state = String(raw.state ?? '').toUpperCase()
      if (state === 'SUCCESS') counts.passed += 1
      else if (PENDING_STATES.has(state) || state === '') counts.pending += 1
      else counts.failed += 1
      continue
    }

    const status = String(raw.status ?? '').toUpperCase()
    const conclusion = String(raw.conclusion ?? '').toUpperCase()
    if (status !== 'COMPLETED' || conclusion === '') counts.pending += 1
    else if (PASSED.has(conclusion)) counts.passed += 1
    else counts.failed += 1
  }

  return counts
}

export function checkSegments(checks: GhPrsChecks): Segment[] {
  const parts: Segment[] = []
  if (checks.failed > 0) parts.push({ text: `✗ ${checks.failed} failed`, color: 'error' })
  if (checks.pending > 0) parts.push({ text: `● ${checks.pending} pending`, color: 'warning' })
  if (checks.passed > 0) parts.push({ text: `✓ ${checks.passed} passed`, color: 'success' })
  if (parts.length === 0) return [{ text: 'no checks', isDim: true }]

  return parts.flatMap((part, i) => (i === 0 ? [part] : [{ text: ' ', isDim: true }, part]))
}

export function reviewSegment(decision: string): Segment | undefined {
  switch (decision) {
    case 'APPROVED':
      return { text: 'approved', color: 'success' }
    case 'CHANGES_REQUESTED':
      return { text: 'changes requested', color: 'error' }
    case 'REVIEW_REQUIRED':
      return { text: 'review required', color: 'warning' }
    default:
      return undefined
  }
}

export function stateSegment(pr: Pick<GhPrsPr, 'state' | 'isDraft' | 'mergeable'>): Segment | undefined {
  if (pr.state === 'MERGED') return { text: 'merged', color: 'merged' }
  if (pr.state === 'CLOSED') return { text: 'closed', color: 'error' }
  if (pr.isDraft) return { text: 'draft', isDim: true }
  if (pr.mergeable === 'CONFLICTING') return { text: 'conflicts', color: 'error' }

  return undefined
}

export function truncate(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length <= width) return text
  if (width <= 1) return width === 1 ? '…' : ''

  return chars.slice(0, width - 1).join('') + '…'
}

const SEPARATOR: Segment = { text: ' · ', isDim: true }

function widthOf(segments: readonly Segment[]): number {
  return segments.reduce((sum, s) => sum + Array.from(s.text).length, 0)
}

// One line: `#123 title · checks · review · state`, the title cut to fit.
export function prSegments(pr: GhPrsPr, columns: number): Segment[] {
  const tail: Segment[] = [SEPARATOR, ...checkSegments(pr.checks)]
  const review = reviewSegment(pr.reviewDecision)
  if (review) tail.push(SEPARATOR, review)
  const state = stateSegment(pr)
  if (state) tail.push(SEPARATOR, state)

  const head: Segment = { text: `#${pr.number}`, color: 'suggestion' }
  const room = columns - widthOf(tail) - widthOf([head]) - 1
  const title = truncate(pr.title, Math.max(room, 8))

  return [head, { text: ` ${title}` }, ...tail]
}

function toPr(raw: unknown): GhPrsPr | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.number !== 'number' || typeof o.url !== 'string') return null

  return {
    number: o.number,
    title: String(o.title ?? ''),
    url: o.url,
    state: String(o.state ?? 'OPEN'),
    isDraft: o.isDraft === true,
    reviewDecision: String(o.reviewDecision ?? ''),
    mergeable: String(o.mergeable ?? ''),
    branch: String(o.headRefName ?? ''),
    checks: summarizeChecks(o.statusCheckRollup),
  }
}

// `gh pr view --json ...` stdout to a PR; null for anything that is not one.
export function parsePrView(stdout: string): GhPrsPr | null {
  try {
    return toPr(JSON.parse(stdout))
  } catch {
    return null
  }
}

// `gh pr list --json ...` stdout to PRs; [] for anything that is not a list.
export function parsePrList(stdout: string): GhPrsPr[] {
  try {
    const raw: unknown = JSON.parse(stdout)
    if (!Array.isArray(raw)) return []

    return raw.map(toPr).filter((pr): pr is GhPrsPr => pr !== null)
  } catch {
    return []
  }
}

// gh's answers that only mean "nothing to show here": never worth a log line.
const QUIET_FAILURE =
  /no pull requests found|not a git repository|no git remotes|none of the git remotes|could not determine current branch|no default remote/i

export function isQuietFailure(stderr: string): boolean {
  return QUIET_FAILURE.test(stderr)
}
