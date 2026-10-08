# @webwire/client

Browser / Node.js / Bun client for WebWire.js with automatic transport fallback:
**WebTransport → WebSocket → HTTP Long Polling**

## Install

```bash
bun add @webwire/client
# or
npm install @webwire/client
```

## Usage

```js
import { WebWire } from '@webwire/client'

const wire = new WebWire('http://localhost:3000/wire', {
  auth: { token: 'my-token' },
})

wire.on('connect',      () => console.log('connected via', wire.transport))
wire.on('chat:message', (msg) => console.log(msg))

await wire.connect()

wire.emit('chat:message', { text: 'hello' })
```

## Key options

| Option | Default | Description |
|---|---|---|
| `transports` | `['webtransport','websocket','polling']` | Transport priority order |
| `auth` | - | Credentials sent in the handshake |
| `requestTimeout` | `10000` | Timeout for `wire.request()` in ms |
| `reconnect` | `true` | `false` disables auto-reconnect |

## Events

```js
wire.on('connecting',   () => {})
wire.on('connect',      () => {})
wire.on('disconnect',   () => {})
wire.on('reconnecting', ({ delay }) => {})
wire.on('error',        (err) => {})
```

## Request / response

```js
// Server must register a handler for this event
const result = await wire.request('math:add', { a: 1, b: 2 })
```

## State

```js
wire.state     // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'closing'
wire.transport // 'webtransport' | 'websocket' | 'polling' | null
```

Full API: [`docs/client.md`](../../docs/client.md)
