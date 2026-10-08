import { expect, mock, test } from 'claude-code/testing'
import type { On, SessionAppendInput } from 'claude-code'

import { image, JPEG_800x600, PNG_200x100 } from './fixtures'

const PLUGIN = 'inline-images'
const VIEWPORT = { columns: 120, rows: 40 }

// The engine's own UserMessage row, standing beneath the plugin.
function userRowBottom(on: On) {
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine-row">{'> ' + e.props.text}</Text>
  })
}

const prompt = (uuid: string, content: SessionAppendInput['message']['content']): SessionAppendInput => ({
  uuid,
  door: 'prompt',
  origin: { kind: 'composer' },
  message: { type: 'user', role: 'user', content },
})

const row = (text: string) => ({ text, origin: { kind: 'composer' as const }, isExpanded: false })

test('a PNG prompt draws its row then the thumbnail, matched by message id', async ($, on) => {
  userRowBottom(on)
  mock.session(on)
  await $.session.append(prompt('u-1', [image('image/png', PNG_200x100), { type: 'text', text: '[Image #6] what is this?' }]))

  const ui = await $.ui.mount({
    plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', requestId: 'u-1', viewport: VIEWPORT, props: row('[Image #6] what is this?'),
  })
  expect(await ui.find({ type: 'Text', text: '> [Image #6] what is this?' })).toBeDefined()
  const img = await ui.find({ type: 'Image' })
  expect(img?.props).toMatchObject({ columns: 40, rows: 10, alt: 'Image #6 (PNG 200×100)', source: { png: PNG_200x100 } })
  await ui.unmount()
})

test('a row with another id finds its images by text; two images sit side by side', async ($, on) => {
  userRowBottom(on)
  mock.session(on)
  await $.session.append(prompt('u-2', [
    image('image/png', PNG_200x100),
    image('image/png', PNG_200x100),
    { type: 'text', text: 'compare\nthese' },
  ]))
  const ui = await $.ui.mount({
    plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', requestId: 'other-id', viewport: VIEWPORT, props: row('compare these'),
  })
  expect(await ui.findAll({ type: 'Image' })).toHaveLength(2)
  expect(await ui.find({ key: 'line-0' })).toBeDefined()
  expect(await ui.find({ key: 'line-1' })).toBeUndefined()
  await ui.unmount()
})

test('a JPEG is converted to an inline PNG on the host', async ($, on) => {
  userRowBottom(on)
  mock.session(on)
  const clock = mock.clock(on)
  const runs: string[][] = []
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: `800 600\n${PNG_200x100}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.session.append(prompt('u-3', [image('image/jpeg', JPEG_800x600), { type: 'text', text: 'photo' }]))

  const ui = await $.ui.mount({
    plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', requestId: 'u-3', viewport: VIEWPORT, props: row('photo'),
  })
  expect((await ui.find({ type: 'Text', text: /preparing/ }))?.text).toContain('Image (JPEG 800×600)')

  await clock.advance(1)
  await clock.settle()
  await ui.redraw()
  const img = await ui.find({ type: 'Image' })
  expect(img?.props).toMatchObject({ columns: 40, rows: 15, source: { png: PNG_200x100 } })
  expect(runs.some(argv => argv[0]?.endsWith('/bin/topng'))).toBe(true)
  await ui.unmount()
})

test('a failed conversion leaves alt text naming the image', async ($, on) => {
  userRowBottom(on)
  mock.session(on)
  const clock = mock.clock(on)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'sips: no', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.session.append(prompt('u-4', [image('image/jpeg', JPEG_800x600), { type: 'text', text: 'broken' }]))
  await clock.advance(1)
  await clock.settle()
  const ui = await $.ui.mount({
    plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', requestId: 'u-4', viewport: VIEWPORT, props: row('broken'),
  })
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /Image/ }))?.text).toBe('[Image (JPEG 800×600)]')
  await ui.unmount()
})

test('rows without images, and other surfaces, are left exactly as drawn', async ($, on) => {
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine-row">{e.props.text}</Text>
  })
  mock.session(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'UserMessage', requestId: 'plain', props: row('hello') })
    const drawn = await ui.drawn()
    expect(drawn).toMatchObject({ type: 'Text', children: ['hello'] })
    await ui.unmount()
  }
})
