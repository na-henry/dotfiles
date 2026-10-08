// Pure helpers: no `$`, so the tests exercise them directly.
import type { Thumb } from '../types'

/** One image block as the Messages API spells it, reduced to what we draw. */
export type Picture = { mediaType: string; data: string } | { mediaType: string; data?: undefined }

export type Dims = { width: number; height: number }

/** The most bytes an `Image` takes inline as `{ png }`. */
export const INLINE_PNG_LIMIT = 2 * 1024 * 1024
export const THUMB_COLUMNS = 40
export const THUMB_MAX_ROWS = 16
/** Rows when the picture's aspect is unknown. */
export const THUMB_DEFAULT_ROWS = 10

type Block = { type: string; [field: string]: unknown }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

/** The image blocks of a content array, in order; a non-base64 one keeps its type only. */
export function picturesOf(content: readonly Block[] | undefined): Picture[] {
  const found: Picture[] = []
  for (const block of content ?? []) {
    if (!isRecord(block) || block.type !== 'image') continue
    const source = block.source
    if (!isRecord(source)) continue
    const mediaType = typeof source.media_type === 'string' ? source.media_type : 'image'
    if (source.type === 'base64' && typeof source.data === 'string' && source.data.length > 0) {
      found.push({ mediaType, data: source.data })
    } else {
      found.push({ mediaType })
    }
  }
  return found
}

/** The text blocks of a content array, joined as the row reads. */
export function textOf(content: readonly Block[] | undefined): string {
  return (content ?? [])
    .filter(b => isRecord(b) && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text as string)
    .join('\n')
}

/** Images inside a tool-result row, by the tool_use_id each answers. */
export function toolResultPictures(content: readonly Block[] | undefined): Map<string, Picture[]> {
  const out = new Map<string, Picture[]>()
  for (const block of content ?? []) {
    if (!isRecord(block) || block.type !== 'tool_result') continue
    const id = block.tool_use_id
    const inner = block.content
    if (typeof id !== 'string' || !Array.isArray(inner)) continue
    const pictures = picturesOf(inner as Block[])
    if (pictures.length > 0) out.set(id, pictures)
  }
  return out
}

/** Whitespace-insensitive form of a prompt, so a row's text matches its stored blocks. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** FNV-1a, 32-bit, hex: a short stable key for a text or a picture. */
export function fnv(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** The key under which a prompt's text points at its thumbs; undefined for an empty text. */
export function textKey(text: string): string | undefined {
  const normal = normalizeText(text)
  return normal === '' ? undefined : fnv(normal)
}

/** Bytes a base64 string decodes to. */
export function decodedSize(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function bytesOf(base64: string, count: number): Uint8Array {
  const take = Math.min(base64.length, Math.ceil(count / 3) * 4)
  const binary = atob(base64.slice(0, take - (take % 4)))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Pixel size from the file's header (PNG, JPEG, GIF); undefined when it cannot tell. */
export function dimsOf(picture: Picture): Dims | undefined {
  if (picture.data === undefined) return undefined
  try {
    const head = bytesOf(picture.data, 32)
    // PNG: signature, then IHDR width and height, big-endian.
    if (head.length >= 24 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
      const view = new DataView(head.buffer)
      return valid({ width: view.getUint32(16), height: view.getUint32(20) })
    }
    // GIF: logical screen size, little-endian.
    if (head.length >= 10 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) {
      return valid({ width: head[6]! | (head[7]! << 8), height: head[8]! | (head[9]! << 8) })
    }
    if (head.length >= 4 && head[0] === 0xff && head[1] === 0xd8) return jpegDims(bytesOf(picture.data, 512 * 1024))
  } catch {
    return undefined
  }
  return undefined
}

function jpegDims(b: Uint8Array): Dims | undefined {
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return undefined
    const marker = b[i + 1]!
    if (marker === 0xff) {
      i += 1
      continue
    }
    const length = (b[i + 2]! << 8) | b[i + 3]!
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) {
      return valid({ height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! })
    }
    i += 2 + length
  }
  return undefined
}

function valid(d: Dims): Dims | undefined {
  return d.width > 0 && d.height > 0 ? d : undefined
}

/**
 * Cells for one thumbnail: about 40 columns, rows from the aspect (a cell is
 * about twice as tall as wide), at most 16 rows, never wider than `room`.
 */
export function thumbSize(dims: Dims | undefined, room: number): { columns: number; rows: number } {
  const maxColumns = Math.max(4, Math.min(THUMB_COLUMNS, Math.floor(room)))
  if (dims === undefined) return { columns: maxColumns, rows: Math.min(THUMB_DEFAULT_ROWS, THUMB_MAX_ROWS) }
  const ratio = dims.height / dims.width
  let columns = maxColumns
  let rows = Math.round((columns * ratio) / 2)
  if (rows > THUMB_MAX_ROWS) {
    rows = THUMB_MAX_ROWS
    columns = Math.max(4, Math.min(maxColumns, Math.round((rows * 2) / ratio)))
  }
  return { columns: Math.max(1, Math.min(columns, 255)), rows: Math.max(1, Math.min(rows, 255)) }
}

/** Splits widths into lines that fit `room` columns with a one-column gap. */
export function packLines(widths: readonly number[], room: number): number[][] {
  const lines: number[][] = []
  let line: number[] = []
  let used = 0
  widths.forEach((w, index) => {
    const need = line.length === 0 ? w : used + 1 + w
    if (line.length > 0 && need > room) {
      lines.push(line)
      line = []
      used = 0
    }
    used = line.length === 0 ? w : used + 1 + w
    line.push(index)
  })
  if (line.length > 0) lines.push(line)
  return lines
}

function shortType(mediaType: string): string {
  return mediaType.replace(/^image\//, '').toUpperCase()
}

/** The `[Image #N]` numbers a prompt's text carries, in order: Claude Code's own, session-wide. */
export function imageNumbers(text: string | undefined): number[] {
  return [...(text ?? '').matchAll(/\[Image #(\d+)\]/g)].map(m => Number(m[1]))
}

/** What the picture says where it cannot be drawn; numbered only when Claude Code numbered it. */
export function altFor(picture: Picture, dims: Dims | undefined, number?: number): string {
  const size = dims ? ` ${dims.width}×${dims.height}` : ''
  const name = number === undefined ? 'Image' : `Image #${number}`
  return `${name} (${shortType(picture.mediaType)}${size})`
}

/**
 * The first thumb for a picture: a small PNG is ready at once; anything else
 * (JPEG, GIF, WebP, a PNG over the inline limit) needs converting on the host.
 */
export function planThumb(picture: Picture, number?: number): Thumb {
  const dims = dimsOf(picture)
  const alt = altFor(picture, dims, number)
  const base = dims ? { alt, width: dims.width, height: dims.height } : { alt }
  if (picture.data === undefined) return { ...base, status: 'failed' }
  if (picture.mediaType === 'image/png' && decodedSize(picture.data) <= INLINE_PNG_LIMIT) {
    return { ...base, status: 'ready', png: picture.data }
  }
  return { ...base, status: 'pending' }
}

/** Parses bin/topng's "<width> <height>\n<base64 PNG>"; undefined unless whole and inline-sized. */
export function parseConverted(stdout: string): { status: 'ready'; png: string; width: number; height: number } | undefined {
  const [head = '', png = ''] = stdout.split('\n')
  const m = /^(\d+) (\d+)$/.exec(head.trim())
  const dims = m ? valid({ width: Number(m[1]), height: Number(m[2]) }) : undefined
  if (!dims || png.length === 0 || decodedSize(png) > INLINE_PNG_LIMIT) return undefined
  return { status: 'ready', png, ...dims }
}

/** Keeps the newest `limit` entries of a record, in insertion order. */
export function capRecord<T>(record: Record<string, T>, limit: number): Record<string, T> {
  const entries = Object.entries(record)
  return entries.length <= limit ? record : Object.fromEntries(entries.slice(-limit))
}
