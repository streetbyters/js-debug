import moment from 'moment'

let _eventCount = 0,
  _timeFunc = moment(),
  _allow = false,
  _debug = false,
  _priority = false,
  _ttl = undefined,
  _ttlInterval = undefined,
  _storedStackSize = 0,
  _stored = false,
  _logs = [],
  _oldRecord = undefined,
  _record = undefined,
  _recordedLogs = new Map()

export function SetStoreTTL(ttl) {
  if (!ttl) return

  _ttl = ttl
  _ttlControl()
}

/**
 * @param {boolean} stored
 */
export function SetStored(stored) {
  _stored = stored
}

/**
 * @param {number} stackSize
 */
export function SetStoredStackSize(stackSize) {
  _storedStackSize = stackSize
}

/**
 * @param {boolean} utc
 */
export function SetUTC(utc) {
  if (utc) _timeFunc = moment.utc()
  else _timeFunc = moment()
}

/**
 * @param {boolean} allow
 */
export function SetAllow(allow) {
  _allow = allow
}

/**
 * @param {boolean} dev
 */
export function SetDebug(dev) {
  _debug = dev
}

/**
 * @param {boolean} priority
 */
export function SetPriority(priority) {
  _priority = priority
}

export class Debug {
  static startRecording(stage) {
    _doTry('startRecording', () => {
      if (!_record) {
        _record = stage
        _recordedLogs.set(_record, [])
      } else {
        const _or = _record ?? stage
        _record = [_record, stage].join(',')
        _recordedLogs.set(_record, [...(_recordedLogs.get(_or) ?? [])])
      }
    })
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
    return _recordedLogs.get(stage ?? _record) ?? []
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
        _flushStack()
        _logs.push(...arguments)
        _infoF(arguments)
      })
    }
  }

  static priotiriedInfo() {
    if (checkENV(true)) {
      _doTry('priotiriedInfo', () => {
        _flushStack()
        _logs.push(...arguments)
        _infoF(arguments)
      })
    }
  }

  static allowedInfo() {
    _doTry('allowedInfo', () => {
      _flushStack()
      _logs.push(...arguments)
      _infoF(arguments)
    })
  }

  static warn() {
    if (checkENV()) {
      _doTry('warn', () => {
        _flushStack()
        _logs.push(...arguments)
        _warnF(arguments)
      })
    }
  }

  static allowedWarn() {
    _doTry('allowedWarn', () => {
      _flushStack()
      _logs.push(...arguments)
      _warnF(arguments)
    })
  }

  static error() {
    if (checkENV()) {
      _doTry('error', () => {
        _flushStack()
        _logs.push(...arguments)
        _errorF(arguments)
      })
    }
  }

  static allowedError() {
    _doTry('allowedError', () => {
      _flushStack()
      _logs.push(...arguments)
      _errorF(arguments)
    })
  }

  static debug() {
    if (_debug) {
      _doTry('debug', () => {
        _flushStack()
        _logs.push(...arguments)
        _debugF(arguments)
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
    return _logs
  }
}

function checkENV(prioritised = false) {
  if (prioritised || _priority) return true

  return _allow
}

function _infoF(infos) {
  if (!infos || !infos.length || !Array.from(infos).filter((v) => !!v).length) {
    _warnF('Logs are empty!!')
    return
  }

  _eventCount++
  _pushRecord(['[' + _eventCount + '] ' + '[INFO]: ', ...infos])

  // eslint-disable-next-line
  console.log(
    '%c' +
      _timeFunc.toISOString(true) +
      ' [' +
      _eventCount +
      '] ' +
      '%c[INFO]: ',
    ...['color: Green', 'color: Green; font-weight: bold', ...infos]
  )
}

function _errorF(errors) {
  if (
    !errors ||
    !errors.length ||
    !Array.from(errors).filter((v) => !!v).length
  ) {
    _warnF('Logs are empty!!')
    return
  }

  _eventCount++
  _pushRecord(['[' + _eventCount + '] ' + '[ERROR]:', ...errors])
  // eslint-disable-next-line
  console.error(
    '%c' +
      _timeFunc.toISOString(true) +
      ' [' +
      _eventCount +
      '] ' +
      '%c[ERROR]:',
    ...['color: Red', 'color: Red; font-weight: bold', ...errors]
  )
}

function _warnF(warns) {
  if (!warns || !warns.length || !Array.from(warns).filter((v) => !!v).length) {
    _warnF('Logs are empty!!')
    return
  }

  _eventCount++
  _pushRecord(['[' + _eventCount + '] ' + '[WARN]:', ...warns])
  // eslint-disable-next-line
  console.info(
    '%c' +
      _timeFunc.toISOString(true) +
      ' [' +
      _eventCount +
      '] ' +
      '%c[WARN]:',
    ...['color: #f59905', 'color: #f59905; font-weight: bold', ...warns]
  )
}

function _debugF(debugs) {
  if (
    !debugs ||
    !debugs.length ||
    !Array.from(debugs).filter((v) => !!v).length
  ) {
    _warnF('Logs are empty!!')
    return
  }

  _eventCount++
  _pushRecord(['[' + _eventCount + '] ' + '[DEBUG]:', ...debugs])
  // eslint-disable-next-line
  console.log(
    '%c' + _timeFunc.toISOString() + ' [' + _eventCount + '] ' + '%c[DEBUG]:',
    ...['color: #999999', 'color: #999999; font-weight: bold', ...debugs]
  )
}

function log(...logs) {
  if (!logs || !logs.length || !logs.filter((v) => !!v).length) {
    _warnF('Logs are empty!!')
    return
  }

  console.log(...logs) // eslint-disable-line
}

function _pushRecord() {
  if (!_record) return

  _recordedLogs.set(_record, [
    ...(_recordedLogs.get(_record) ?? []),
    ...arguments
  ])
}

function _flushStack() {
  if (!_stored) return
  if (_logs.length <= _storedStackSize) return

  _logs = _logs.slice(_logs.length - 1 - _storedStackSize, _logs.length)
}

function _ttlControl() {
  if (_ttlInterval) clearInterval(_ttlInterval)

  _ttlInterval = setInterval(() => {
    _logs.length = 0
    _recordedLogs.clear()
  }, _ttl)
}

function _doTry(name, fn) {
  if (!fn) return

  try {
    fn()
  } catch (e) {
    console.error(name, e) // eslint-disable-line
  }
}
