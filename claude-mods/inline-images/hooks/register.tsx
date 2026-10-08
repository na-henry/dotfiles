import { update } from 'claude-code'
import type { EngineInterface, Register, SessionAppendInput, SessionAppendResult } from 'claude-code'

import type { Thumb } from '../types'
import {
  capRecord,
  fnv,
  imageNumbers,
  packLines,
  parseConverted,
  picturesOf,
  planThumb,
  textKey,
  textOf,
  thumbSize,
  toolResultPictures,
  type Picture,
} from './lib'

const THUMBS = { plugin: 'inline-images', key: 'thumbs' } as const
const BY_TEXT = { plugin: 'inline-images', key: 'byText' } as const

/** Prompts a resumed session backfills, newest first. */
const RESUME_LIMIT = 20
const TEXT_INDEX_LIMIT = 200

/**
 * Converts one picture to an inline PNG with the mod's own bin/topng (ImageIO,
 * base64 in, "<w> <h>" + base64 PNG out); the thumb as it should now be drawn.
 * Nothing touches disk: sips' temp-and-rename write is refused under the mod.
 */
async function convert($: EngineInterface, picture: Picture, thumb: Thumb): Promise<Thumb> {
  if (picture.data === undefined) {
    $.ui.log('inline-images: conversion skipped, the image block carried no data')
    return { ...thumb, status: 'failed' }
  }
  try {
    const ran = await $.process.run([`${$.plugin.root}/bin/topng`], { stdin: picture.data, timeoutMs: 20_000 })
    const out = ran.exitCode === 0 ? parseConverted(ran.stdout) : undefined
    if (out === undefined) {
      $.ui.log(`inline-images: conversion exited ${ran.exitCode}: ${ran.stderr.trim().slice(0, 300)}`)
      return { ...thumb, status: 'failed' }
    }
    return { ...thumb, ...out }
  } catch (err) {
    $.ui.log(`inline-images: conversion threw: ${String(err).slice(0, 300)}`)
    return { ...thumb, status: 'failed' }
  }
}

/** Stores a row's thumbs, then converts the ones that need it outside the dispatch. */
async function keep($: EngineInterface, id: string, pictures: Picture[], text?: string) {
  const numbers = imageNumbers(text)
  const thumbs = pictures.map((picture, i) => planThumb(picture, numbers[i]))
  await $.state.set({ ...THUMBS, id }, thumbs)
  const key = text === undefined ? undefined : textKey(text)
  if (key !== undefined) {
    await update($, BY_TEXT, index => capRecord({ ...(index ?? {}), [key]: id }, TEXT_INDEX_LIMIT))
  }
  if (!thumbs.some(t => t.status === 'pending')) return
  $.clock.after(0, () => {
    void (async () => {
      for (const [i, thumb] of thumbs.entries()) {
        if (thumb.status !== 'pending') continue
        const done = await convert($, pictures[i]!, thumb)
        await update($, { ...THUMBS, id }, list => {
          const next = [...(list ?? thumbs)]
          next[i] = done
          return next
        }).catch(() => undefined)
      }
    })().catch(() => undefined)
  })
}

async function capturePrompt($: EngineInterface, e: SessionAppendInput, next: (e: SessionAppendInput) => Promise<SessionAppendResult>) {
  const stored = await next(e)
  try {
    if (e.agentId === undefined && e.message.role === 'user') {
      const pictures = picturesOf(e.message.content)
      if (pictures.length > 0) {
        const id = 'uuid' in stored && typeof stored.uuid === 'string' ? stored.uuid : e.uuid
        await keep($, id, pictures, textOf(e.message.content))
      }
    }
  } catch {
    // never in the way of the row
  }
  return stored
}

export const register: Register = on => {
  // A failure after `next` replays the stored row; nothing is ever refused.
  on('session.append', { door: 'prompt' }, capturePrompt).catch(($, e, next) => next(e))
  on('session.append', { door: 'delivery' }, capturePrompt).catch(($, e, next) => next(e))

  on('session.append', { door: 'tool-result' }, async ($, e, next) => {
    const stored = await next(e)
    try {
      if (e.agentId === undefined) {
        for (const [toolUseId, pictures] of toolResultPictures(e.message.content)) {
          await keep($, `tool:${toolUseId}`, pictures)
        }
      }
    } catch {
      // never in the way of the row
    }
    return stored
  }).catch(($, e, next) => next(e))

  // A resumed session's rows are loads, not appends: backfill the newest prompts
  // with images from the transcript, matched to their rows by text.
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    $.clock.after(0, () => {
      void (async () => {
        const messages = await $.session.messages({ as: 'api' })
        if (!Array.isArray(messages)) return
        const withImages = messages
          .filter(m => m.role === 'user')
          .map(m => ({ pictures: picturesOf(m.content), text: textOf(m.content) }))
          .filter(m => m.pictures.length > 0 && textKey(m.text) !== undefined)
          .slice(-RESUME_LIMIT)
        for (const m of withImages) await keep($, `text:${textKey(m.text)}`, m.pictures, m.text)
      })().catch(() => undefined)
    })
    return started
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    let thumbs: Thumb[] = []
    try {
      thumbs = (await $.state.get({ ...THUMBS, id: e.requestId })).value ?? []
      if (thumbs.length === 0) {
        const key = textKey(e.props.text)
        const index = key === undefined ? undefined : (await $.state.get(BY_TEXT)).value
        const id = key === undefined ? undefined : index?.[key]
        if (id !== undefined) thumbs = (await $.state.get({ ...THUMBS, id })).value ?? []
      }
    } catch {
      thumbs = []
    }
    const base = await next(e)
    if (thumbs.length === 0) return base
    try {
      const { Box, Image, Text } = $.ui.resolve(e)
      const room = Math.max(8, (e.viewport?.columns ?? 80) - 4)
      const sized = thumbs.map(t => thumbSize(t.width && t.height ? { width: t.width, height: t.height } : undefined, room))
      const lines = packLines(sized.map(s => s.columns), room)
      const draw = (i: number) => {
        const t = thumbs[i]!
        const { columns, rows } = sized[i]!
        if (t.status === 'ready' && t.png !== undefined) {
          return <Image key={`img-${i}`} source={{ png: t.png }} columns={columns} rows={rows} alt={t.alt} />
        }
        if (t.status === 'ready' && t.file !== undefined) {
          return <Image key={`img-${i}`} source={{ file: t.file, format: 'png' }} columns={columns} rows={rows} alt={t.alt} />
        }
        return (
          <Text key={`alt-${i}`} dimColor>
            [{t.alt}{t.status === 'pending' ? ', preparing…' : ''}]
          </Text>
        )
      }
      return (
        <Box flexDirection="column">
          {base}
          <Box flexDirection="column" marginLeft={2} marginTop={1}>
            {lines.map((line, n) => (
              <Box key={`line-${n}`} flexDirection="row" columnGap={1}>
                {line.map(draw)}
              </Box>
            ))}
          </Box>
        </Box>
      )
    } catch {
      return base
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    let thumbs: Thumb[] = []
    try {
      thumbs = (await $.state.get({ ...THUMBS, id: `tool:${e.props.tool_use_id}` })).value ?? []
    } catch {
      thumbs = []
    }
    const base = await next(e)
    const ready = thumbs.filter(t => t.status === 'ready')
    if (ready.length === 0) return base
    try {
      const { Box, Image } = $.ui.resolve(e)
      const room = Math.max(8, (e.viewport?.columns ?? 80) - 6)
      return (
        <Box flexDirection="column">
          {base}
          {ready.map((t, i) => {
            const { columns, rows } = thumbSize(t.width && t.height ? { width: t.width, height: t.height } : undefined, room)
            const source = t.png !== undefined ? { png: t.png } : { file: t.file ?? '', format: 'png' as const }
            return (
              <Box key={`tool-img-${i}`} marginLeft={4}>
                <Image key={`timg-${i}`} source={source} columns={columns} rows={rows} alt={t.alt} />
              </Box>
            )
          })}
        </Box>
      )
    } catch {
      return base
    }
  }).catch(($, e, next) => next(e))
}
