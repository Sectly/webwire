# Client

## Installation

```bash
bun add @webwirejs/client
# or
npm install @webwirejs/client
```

## Constructor

```js
import { WebWire } from '@webwirejs/client'

const wire = new WebWire(url, options?)
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `transports` | `string[]` | `['webtransport','websocket','polling']` | Transport priority order |
| `auth` | `unknown` | - | Credentials forwarded to the server `authenticate` hook |
| `requestTimeout` | `number` | `10000` | Default timeout for `wire.request()` in ms |
| `reconnect` | `boolean \| { initialDelay?, maxDelay? }` | `true` | `false` disables auto-reconnect |
| `heartbeat` | `boolean \| { interval?, timeout? }` | `true` | `false` disables heartbeat |
| `codec` | `Codec` | `jsonCodec` | See [Custom codecs](codecs.md) |
| `WebSocket` | constructor | `globalThis.WebSocket` | Override for custom environments |
| `WebTransport` | constructor | `globalThis.WebTransport` | Override for custom environments |

## Methods

```js
wire.connect()                           // → Promise<void>
wire.disconnect()                        // graceful close
wire.forceReconnect()                    // drop and reconnect, restart transport selection

wire.emit('event:name', data)            // fire-and-forget
wire.request('event:name', data)         // → Promise<response>
wire.request('event:name', data, 5000)   // with custom timeout in ms

wire.on('event:name', handler)
wire.once('event:name', handler)
wire.off('event:name', handler)
wire.onAny(handler)                      // called for every incoming app event
```

## Lifecycle events

```js
wire.on('connecting',   () => {})
wire.on('connect',      () => {})
wire.on('disconnect',   () => {})
wire.on('reconnecting', ({ delay }) => {})
wire.on('error',        (err) => {})
```

## State and active transport

```js
wire.state     // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'closing'
wire.transport // 'webtransport' | 'websocket' | 'polling' | null
```

## Wildcard listeners

```js
wire.on('*',         handler)   // all app events
wire.on('chat:*',    handler)   // namespace wildcard
wire.on('*:message', handler)   // suffix wildcard
```

Internal `$ww:` events are excluded from `*` wildcards.

## Reconnect

When a connection drops, WebWire restarts transport selection from the top and retries with exponential backoff (default 500 ms → 30 s with 20 % jitter).

```js
const wire = new WebWire(url, {
  reconnect: { initialDelay: 500, maxDelay: 30_000 },
})

wire.on('reconnecting', ({ delay }) => {
  console.log(`reconnecting in ${delay}ms`)
})
```

Authentication failures (HTTP 401/403) permanently stop reconnect attempts.
