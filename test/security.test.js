/* eslint-disable no-console -- Tests replace console sinks to observe leaks. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  Debug,
  SetAllow,
  SetDebug,
  SetPriority,
  SetStored,
  SetStoredStackSize,
  SetStoreTTL,
  SetUTC
} from '../index.js'

let output, original
beforeEach(() => {
  Debug.dispose()
  SetStoredStackSize(100)
  output = []
  original = { log: console.log, info: console.info, error: console.error }
  for (const method of Object.keys(original)) {
    console[method] = (...args) => output.push([method, ...args])
  }
})
afterEach(() => {
  Debug.dispose()
  Object.assign(console, original)
})

const methods = [
  'info',
  'warn',
  'error',
  'debug',
  'allowedInfo',
  'allowedWarn',
  'allowedError',
  'priotiriedInfo',
  'log'
]

test('every output path masks structured values without inspecting them', () => {
  SetAllow(true)
  SetDebug(true)
  SetStored(true)
  Debug.startRecording('test')
  let invoked = false
  const hostile = new Proxy(
    {},
    {
      get() {
        invoked = true
        throw new Error('fixture-secret')
      },
      ownKeys() {
        invoked = true
        throw new Error('fixture-secret')
      }
    }
  )
  const { proxy, revoke } = Proxy.revocable({}, {})
  revoke()
  const bytes = Buffer.from('fixture-secret'),
    values = [
      { password: 'fixture-secret' },
      new Error('fixture-secret'),
      bytes,
      new Uint8Array([1, 2, 3]),
      hostile,
      proxy,
      () => 'fixture-secret',
      Symbol('fixture-secret'),
      ['fixture-secret'],
      42n
    ]
  for (const method of methods) Debug[method](...values)
  assert.equal(invoked, false)
  assert.equal(output.length, methods.length)
  assert.equal(JSON.stringify(output).includes('fixture-secret'), false)
  assert.ok(Debug.listStack().every((value) => value === '[REDACTED]'))
  for (const event of Debug.listRecordedLogs()) {
    assert.ok(event.slice(1).every((value) => value === '[REDACTED]'))
  }
  assert.equal(bytes.toString(), 'fixture-secret')
})

test('disabled storage never retains stack arguments and disabling clears it', () => {
  SetAllow(true)
  SetDebug(true)
  for (const method of methods) Debug[method]('message')
  assert.deepEqual(Debug.listStack(), [])
  SetStored(true)
  Debug.info('one')
  assert.deepEqual(Debug.listStack(), ['one'])
  SetStored(false)
  Debug.allowedInfo('two')
  assert.deepEqual(Debug.listStack(), [])
})

test('capacity applies after multi-argument writes, resize and zero', () => {
  SetStored(true)
  SetStoredStackSize(2)
  Debug.allowedInfo(1, 2, 3, 4)
  assert.deepEqual(Debug.listStack(), [3, 4])
  SetStoredStackSize(1)
  assert.deepEqual(Debug.listStack(), [4])
  SetStoredStackSize(0)
  Debug.allowedWarn('ignored')
  assert.deepEqual(Debug.listStack(), [])
  for (const invalid of [-1, 0.5, NaN, Infinity, 1001, '10', null]) {
    assert.throws(() => SetStoredStackSize(invalid), RangeError)
  }
  assert.throws(() => SetStored('false'), TypeError)
})

test('arguments, text, record events and session counts are bounded', () => {
  SetStored(true)
  Debug.startRecording('initial')
  Debug.allowedInfo(...Array(30).fill('x'.repeat(2000)))
  assert.equal(Debug.listStack().length, 20)
  assert.ok(Debug.listStack().every((value) => value === '[TRUNCATED]'))
  for (let i = 0; i < 150; i++) Debug.allowedInfo(i)
  assert.equal(Debug.listRecordedLogs().length, 100)
  assert.equal(Debug.listRecordedLogs().at(-1).at(-1), 149)
  Debug.stopRecording(true)
  for (let i = 0; i < 15; i++) {
    Debug.startRecording(`stage-${i}`)
    Debug.allowedInfo(i)
    Debug.stopRecording(true)
  }
  assert.deepEqual(Debug.listRecordedLogs('initial'), [])
  assert.deepEqual(Debug.listRecordedLogs('stage-4'), [])
  assert.equal(Debug.listRecordedLogs('stage-5').length, 1)
  assert.equal(Debug.listRecordedLogs('stage-14').length, 1)
})

test('returned arrays cannot modify stored values', () => {
  SetStored(true)
  Debug.startRecording('test')
  Debug.allowedInfo('message', { token: 'fixture-secret' })
  const stack = Debug.listStack()
  stack[0] = 'changed'
  stack.length = 0
  const records = Debug.listRecordedLogs()
  records[0][1] = 'changed'
  records.length = 0
  assert.deepEqual(Debug.listStack(), ['message', '[REDACTED]'])
  assert.deepEqual(Debug.listRecordedLogs()[0].slice(1), [
    'message',
    '[REDACTED]'
  ])
})

test('sink failures never forward raw error data or mutate caller buffers', async () => {
  SetStored(true)
  Debug.startRecording('test')
  const left = Buffer.from('left-fixture-secret'),
    right = Buffer.from('right-fixture-secret')
  console.log = () => {
    throw new Error('sink-fixture-secret')
  }
  await Promise.all(
    [left, right].map(async (value) => {
      Debug.allowedInfo(value)
    })
  )
  assert.equal(left.toString(), 'left-fixture-secret')
  assert.equal(right.toString(), 'right-fixture-secret')
  assert.equal(JSON.stringify(output).includes('fixture-secret'), false)
  assert.ok(Debug.listStack().every((value) => value === '[REDACTED]'))
  console.error = () => {
    throw new Error('nested-fixture-secret')
  }
  assert.doesNotThrow(() => Debug.allowedInfo(left))
})

test('priority and allowed bypasses still use safe output', () => {
  Debug.info('disabled')
  Debug.debug('disabled')
  assert.equal(output.length, 0)
  Debug.priotiriedInfo({ token: 'fixture-secret' })
  Debug.allowedWarn({ token: 'fixture-secret' })
  SetPriority(true)
  Debug.error({ token: 'fixture-secret' })
  assert.equal(output.length, 3)
  assert.equal(JSON.stringify(output).includes('fixture-secret'), false)
})

test('safe primitives remain usable; arbitrary string secrets are caller responsibility', () => {
  SetStored(true)
  Debug.allowedInfo(0, false, '', null, undefined, 'plain-text')
  assert.deepEqual(Debug.listStack(), [
    0,
    false,
    '',
    null,
    undefined,
    'plain-text'
  ])
})

test('stage inputs are bounded and rejected without logging their content', () => {
  for (const value of ['', 'x'.repeat(129), {}, null]) {
    assert.throws(() => Debug.startRecording(value), TypeError)
  }
  Debug.startRecording('a'.repeat(128))
  assert.throws(() => Debug.startRecording('b'.repeat(128)), RangeError)
  assert.equal(output.length, 0)
})

test('TTL reset, disable and disposal release retained data', async () => {
  SetStored(true)
  Debug.startRecording('test')
  Debug.allowedInfo('message')
  SetStoreTTL(10000)
  SetStoreTTL(5)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.deepEqual(Debug.listStack(), [])
  assert.deepEqual(Debug.listRecordedLogs(), [])
  SetStoreTTL(0)
  Debug.allowedInfo('survives-disabled-ttl')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(Debug.listStack(), ['survives-disabled-ttl'])
  Debug.dispose()
  assert.deepEqual(Debug.listStack(), [])
  assert.deepEqual(Debug.listRecordedLogs('test'), [])
  assert.equal(Debug.getRecordName(), null)
  assert.equal(Debug.getOldRecordName(), null)
  Debug.info('disabled')
  assert.deepEqual(Debug.listStack(), [])
  for (const value of [-1, 0.1, Infinity, NaN, 2147483648, '5']) {
    assert.throws(() => SetStoreTTL(value), RangeError)
  }
})

test('TTL does not keep a Node process alive, including disposal', () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url))
  for (const cleanup of ['', 'Debug.dispose()']) {
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { Debug, SetStoreTTL } from './index.js'; SetStoreTTL(60000); ${cleanup}`
      ],
      { cwd, timeout: 3000, encoding: 'utf8' }
    )
    assert.equal(child.error, undefined)
    assert.equal(child.status, 0, child.stderr)
  }
})

test('configuration flags reject objects instead of retaining caller data', () => {
  for (const setter of [SetAllow, SetDebug, SetPriority, SetStored, SetUTC]) {
    for (const value of [{ token: 'fixture-secret' }, 'true', 1, null]) {
      assert.throws(() => setter(value), TypeError)
    }
  }
})
