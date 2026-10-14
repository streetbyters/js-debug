import moment from 'moment'

const MAX_ARGUMENTS = 20,
  MAX_TEXT_LENGTH = 1000,
  MAX_RECORDS = 10,
  MAX_RECORD_EVENTS = 100

let _eventCount = 0,
  _timeFunc = moment(),
  _allow = false,
  _debug = false,
  _priority = false,
  _ttlInterval = undefined,
  _storedStackSize = 100,
  _stored = false,
  _logs = [],
  _oldRecord = null,
  _record = null,
  _recordedLogs = new Map()

export function SetStoreTTL(ttl) {
  const valid = Number.isInteger(ttl) && ttl >= 0 && ttl <= 2147483647

  if (!valid)
    throw new RangeError('TTL must be an integer from 0 to 2147483647')

  clearInterval(_ttlInterval)
  _ttlInterval = undefined

  if (ttl === 0) return

  _ttlInterval = setInterval(() => {
    _logs.length = 0
    _recordedLogs.clear()
  }, ttl)

  // A retention timer must not keep a Node process alive.
  if (typeof _ttlInterval.unref === 'function') _ttlInterval.unref()
}

/**
 * @param {boolean} stored
 */
export function SetStored(stored) {
  if (typeof stored !== 'boolean') throw new TypeError('Stored must be boolean')

  _stored = stored

  if (!stored) _logs.length = 0
}

/**
 * @param {number} stackSize
 */
export function SetStoredStackSize(stackSize) {
  const valid =
    Number.isInteger(stackSize) && stackSize >= 0 && stackSize <= 1000

  if (!valid)
    throw new RangeError('Stack size must be an integer from 0 to 1000')

  _storedStackSize = stackSize
  _flushStack()
}

/**
 * @param {boolean} utc
 */
export function SetUTC(utc) {
  if (typeof utc !== 'boolean') throw new TypeError('SetUTC must be boolean')

  if (utc) _timeFunc = moment.utc()
  else _timeFunc = moment()
}

/**
 * @param {boolean} allow
 */
export function SetAllow(allow) {
  if (typeof allow !== 'boolean')
    throw new TypeError('SetAllow must be boolean')

  _allow = allow
}

/**
 * @param {boolean} dev
 */
export function SetDebug(dev) {
  if (typeof dev !== 'boolean') throw new TypeError('SetDebug must be boolean')

  _debug = dev
}

/**
 * @param {boolean} priority
 */
export function SetPriority(priority) {
  if (typeof priority !== 'boolean')
    throw new TypeError('SetPriority must be boolean')

  _priority = priority
}

export class Debug {
  static startRecording(stage) {
    const validStage = typeof stage === 'string' && stage.length > 0

    if (!validStage || stage.length > 128) {
      throw new TypeError(
        'Stage must be a nonempty string of at most 128 characters'
      )
    }

    const name = _record ? `${_record},${stage}` : stage

    if (name.length > 256) throw new RangeError('Combined stage is too long')

    const previous = _recordedLogs.get(_record) ?? []

    _record = name
    _recordedLogs.set(name, previous.slice())

    if (_recordedLogs.size > MAX_RECORDS) {
      _recordedLogs.delete(_recordedLogs.keys().next().value)
    }
  }

  static getRecordName() {
    return _record
  }

  static getOldRecordName() {
    return _oldRecord
  }

  static stopRecording(force = false) {
    if (!force) return

    _oldRecord = _record
    _record = null
  }

  static listRecordedLogs(stage = null) {
    return (_recordedLogs.get(stage ?? _record) ?? []).map((event) =>
      event.slice()
    )
  }

  static clearRecordedLogs(stage = null) {
    _recordedLogs.delete(stage ?? _record)
  }

  static clearEmptyRecordedLogs(stage = null) {
    if (!stage) {
      _recordedLogs.delete(_record)
      return
    }

    if (stage === _record) {
      _recordedLogs.delete(stage)
    }
  }

  static info() {
    if (checkENV()) {
      _doTry('info', () => {
        _write('INFO', 'log', 'Green', arguments)
      })
    }
  }

  static priotiriedInfo() {
    if (checkENV(true)) {
      _doTry('priotiriedInfo', () => {
        _write('INFO', 'log', 'Green', arguments)
      })
    }
  }

  static allowedInfo() {
    _doTry('allowedInfo', () => {
      _write('INFO', 'log', 'Green', arguments)
    })
  }

  static warn() {
    if (checkENV()) {
      _doTry('warn', () => {
        _write('WARN', 'info', '#f59905', arguments)
      })
    }
  }

  static allowedWarn() {
    _doTry('allowedWarn', () => {
      _write('WARN', 'info', '#f59905', arguments)
    })
  }

  static error() {
    if (checkENV()) {
      _doTry('error', () => {
        _write('ERROR', 'error', 'Red', arguments)
      })
    }
  }

  static allowedError() {
    _doTry('allowedError', () => {
      _write('ERROR', 'error', 'Red', arguments)
    })
  }

  static debug() {
    if (_debug) {
      _doTry('debug', () => {
        _write('DEBUG', 'log', '#999999', arguments)
      })
    }
  }

  static log() {
    if (checkENV()) {
      _doTry('log', () => {
        log(...arguments)
      })
    }
  }

  static listStack() {
    return _logs.slice()
  }

  static dispose() {
    SetStoreTTL(0)
    _logs.length = 0
    _recordedLogs.clear()
    _record = null
    _oldRecord = null
    _allow = false
    _debug = false
    _priority = false
    _stored = false
  }
}

function checkENV(prioritised = false) {
  if (prioritised || _priority) return true

  return _allow
}

// Never inspect objects or invoke user-controlled serialization hooks.
// Text is not secret detection: callers must not pass credentials as strings.
function _safeArguments(args) {
  const safe = [],
    count = Math.min(args.length, MAX_ARGUMENTS)

  for (let i = 0; i < count; i++) {
    const value = args[i]

    switch (typeof value) {
      case 'string':
        safe.push(value.length <= MAX_TEXT_LENGTH ? value : '[TRUNCATED]')
        break
      case 'number':
      case 'boolean':
      case 'undefined':
        safe.push(value)
        break
      default:
        safe.push(value === null ? null : '[REDACTED]')
    }
  }

  return safe
}

function _write(level, method, color, args) {
  const safe = _safeArguments(args)

  try {
    if (!safe.length) return

    if (_stored) {
      _logs.push(...safe)
      _flushStack()
    }

    _eventCount++
    _pushRecord([`[${_eventCount}] [${level}]:`, ...safe])

    // eslint-disable-next-line no-console
    console[method](
      `%c${_timeFunc.toISOString(true)} [${_eventCount}] %c[${level}]:`,
      `color: ${color}`,
      `color: ${color}; font-weight: bold`,
      ...safe
    )
  } finally {
    // Release temporary references on success and sink failure, not memory wiping.
    safe.length = 0
  }
}

function log(...args) {
  const safe = _safeArguments(args)

  try {
    if (!safe.length) return

    console.log(...safe) // eslint-disable-line no-console
  } finally {
    safe.length = 0
  }
}

function _pushRecord(event) {
  if (!_record) return

  let events = _recordedLogs.get(_record)

  if (!events) {
    events = []
    _recordedLogs.set(_record, events)

    if (_recordedLogs.size > MAX_RECORDS) {
      _recordedLogs.delete(_recordedLogs.keys().next().value)
    }
  }

  events.push(event)

  if (events.length > MAX_RECORD_EVENTS) events.shift()
}

function _flushStack() {
  const excess = _logs.length - _storedStackSize

  if (excess > 0) _logs.splice(0, excess)
}

function _doTry(name, fn) {
  try {
    fn()
  } catch {
    // Sink errors can contain the original input. Never forward the error.
    try {
      console.error(`js-debug: ${name} failed`) // eslint-disable-line no-console
    } catch {
      // A failing console sink must not escape the logging call.
    }
  }
}
