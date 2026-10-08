/**
 * One thumbnail of a transcript row: ready (inline PNG bytes or a PNG file the
 * terminal reads), pending (being converted to PNG on the host), or failed
 * (drawn as its alt text).
 */
export type Thumb = {
  alt: string
  status: 'ready' | 'pending' | 'failed'
  width?: number
  height?: number
  /** Base64 PNG, at most 2 MiB decoded. */
  png?: string
  /** Absolute path of a PNG on this machine. */
  file?: string
}

declare module 'claude-code' {
  interface PluginState {
    'inline-images': {
      /** Thumbs per row: a message uuid, `tool:<tool_use_id>`, or `text:<hash>` for a resumed session. */
      thumbs: StateFamily<Thumb[]>
      /** Normalized prompt text hash -> the thumbs member that row's images live under. */
      byText: Record<string, string>
    }
  }
}
