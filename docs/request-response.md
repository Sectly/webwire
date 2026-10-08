# Request / response

WebWire supports request/response on top of the event model. Either side can initiate.

## Client → Server

```js
// Server registers a handler
conn.handle('math:add', async ({ a, b }) => ({ result: a + b }))

// Client sends a request and awaits the response
const { result } = await wire.request('math:add', { a: 1, b: 2 })
// result === 3
```

## Server → Client

```js
wire.on('connection', async (conn) => {
  const ack = await conn.request('confirm:action', { id: 42 })
})
```

## Timeouts

The default timeout is 10 seconds. Override per-call or globally:

```js
// Per-call (ms)
const res = await wire.request('slow:op', data, 30_000)

// Global default
const wire = new WebWire(url, { requestTimeout: 30_000 })
```

A `TimeoutError` is thrown if the peer does not respond in time.

## Error handling

```js
import { TimeoutError } from '@webwirejs/core'

try {
  const res = await wire.request('some:op', data)
} catch (err) {
  if (err instanceof TimeoutError) {
    console.error('request timed out')
  }
}
```

If the server handler throws, the client receives an error response and the promise rejects with an `Error` carrying the server's message.
