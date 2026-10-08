import { describe, expect, test } from 'claude-code/testing'

import {
  dimsOf,
  imageNumbers,
  packLines,
  parseConverted,
  picturesOf,
  planThumb,
  textKey,
  textOf,
  thumbSize,
  toolResultPictures,
} from '../hooks/lib'
import { image, JPEG_800x600, PNG_200x100 } from './fixtures'

describe('reading blocks', () => {
  test('finds image blocks and text, ignoring other kinds', () => {
    const content = [image('image/png', PNG_200x100), { type: 'text', text: '[Image #1] what is this?' }, { type: 'thinking' }]
    expect(picturesOf(content)).toEqual([{ mediaType: 'image/png', data: PNG_200x100 }])
    expect(textOf(content)).toBe('[Image #1] what is this?')
  })

  test('a non-base64 image keeps only its type', () => {
    expect(picturesOf([{ type: 'image', source: { type: 'url', url: 'https://x/y.png' } }])).toEqual([{ mediaType: 'image' }])
  })

  test('tool results map their images by tool_use_id', () => {
    const found = toolResultPictures([
      { type: 'tool_result', tool_use_id: 'toolu_1', content: [image('image/png', PNG_200x100)] },
      { type: 'tool_result', tool_use_id: 'toolu_2', content: 'text only' },
    ])
    expect([...found.keys()]).toEqual(['toolu_1'])
  })
})

describe('row to image mapping', () => {
  test('text keys ignore whitespace differences', () => {
    expect(textKey('  look at\n\nthis  ')).toBe(textKey('look at this'))
    expect(textKey('look at this')).not.toBe(textKey('look at that'))
    expect(textKey('   ')).toBeUndefined()
  })
})

describe('sizing', () => {
  test('reads PNG and JPEG dimensions from their headers', () => {
    expect(dimsOf({ mediaType: 'image/png', data: PNG_200x100 })).toEqual({ width: 200, height: 100 })
    expect(dimsOf({ mediaType: 'image/jpeg', data: JPEG_800x600 })).toEqual({ width: 800, height: 600 })
  })

  test('40 columns, rows from aspect, capped at 16', () => {
    expect(thumbSize({ width: 200, height: 100 }, 120)).toEqual({ columns: 40, rows: 10 })
    expect(thumbSize({ width: 800, height: 600 }, 120)).toEqual({ columns: 40, rows: 15 })
    // tall: rows cap at 16 and columns shrink to keep the aspect
    expect(thumbSize({ width: 100, height: 400 }, 120)).toEqual({ columns: 8, rows: 16 })
    // narrow terminal
    expect(thumbSize({ width: 200, height: 100 }, 20).columns).toBe(20)
    // unknown size
    expect(thumbSize(undefined, 120)).toEqual({ columns: 40, rows: 10 })
  })

  test('several thumbs go side by side, wrapping when the row is full', () => {
    expect(packLines([40, 40, 40], 100)).toEqual([[0, 1], [2]])
    expect(packLines([40, 40], 81)).toEqual([[0, 1]])
    expect(packLines([40, 40], 60)).toEqual([[0], [1]])
  })

  test('parses the converter output', () => {
    expect(parseConverted('640 480\niVBORw0KGgo=\n')).toEqual({ status: 'ready', png: 'iVBORw0KGgo=', width: 640, height: 480 })
    expect(parseConverted('garbage')).toBeUndefined()
    expect(parseConverted('640 480\n')).toBeUndefined()
  })
})

describe('labels', () => {
  test('numbers come from the prompt text, the way Claude Code numbered them', () => {
    expect(imageNumbers('[Image #6] and [Image #7] compare')).toEqual([6, 7])
    expect(imageNumbers('no placeholders')).toEqual([])
    expect(imageNumbers(undefined)).toEqual([])
  })
})

describe('failure fallback', () => {
  test('a small PNG is ready inline; a JPEG needs converting', () => {
    const png = planThumb({ mediaType: 'image/png', data: PNG_200x100 }, 1)
    expect(png.status).toBe('ready')
    expect(png.png).toBe(PNG_200x100)
    const jpeg = planThumb({ mediaType: 'image/jpeg', data: JPEG_800x600 }, 2)
    expect(jpeg).toEqual({ alt: 'Image #2 (JPEG 800×600)', width: 800, height: 600, status: 'pending' })
  })

  test('garbage data never throws, and an image without bytes is drawn as alt text', () => {
    expect(dimsOf({ mediaType: 'image/png', data: '!!!not base64!!!' })).toBeUndefined()
    expect(planThumb({ mediaType: 'image/webp' })).toEqual({ alt: 'Image (WEBP)', status: 'failed' })
  })
})
