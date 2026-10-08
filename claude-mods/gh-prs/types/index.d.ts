export type GhPrsChecks = { passed: number; failed: number; pending: number }

export type GhPrsPr = {
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  reviewDecision: string
  mergeable: string
  branch: string
  checks: GhPrsChecks
}

export type GhPrsLists = {
  mine: GhPrsPr[]
  review: GhPrsPr[]
  isLoading: boolean
  hasFailed: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'gh-prs': {
      current: GhPrsPr | null
      lists: GhPrsLists | null
      hasLogged: boolean
    }
  }
}
