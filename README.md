# JSDebug

Small ESM logger for JavaScript and Node.js.

```js
import { Debug, SetAllow } from '@streetbyters/js-debug'

SetAllow(true)
Debug.info('Upload finished', 3)
Debug.warn('Retrying')

// Release stored logs and timers when finished.
Debug.cleanup()
```

Stack storage is off by default. To keep recent arguments:

```js
import { SetStored, SetStoredStackSize, SetStoreTTL } from '@streetbyters/js-debug'

SetStoredStackSize(50)
SetStored(true)
SetStoreTTL(60_000) // Clear retained logs every minute; 0 stops the timer.
```

Objects, buffers and errors become `[REDACTED]`. Text over 1000 characters
becomes `[TRUNCATED]`; at most 20 arguments are processed per call. Never pass
passwords, tokens or keys as text, including recording names. Plain-text secrets
are not detected automatically. `allowed*` and priority methods bypass
`SetAllow`; masking still applies. `cleanup()` releases references; it cannot
guarantee memory erasure or clear console output.

Use `Debug.prioritizedInfo()` for priority logging. The old `priotiriedInfo()`
name remains available as a deprecated alias.

Development (Node >=20.19.5): `pnpm test`, `pnpm lint`, `pnpm format:check`.

Licensed under [MIT](LICENSE).
