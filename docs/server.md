# Server

## Installation

```bash
bun add @webwire/server
# or
npm install @webwire/server
```

## Constructor

```js
import { WebWireServer } from '@webwire/server'

const wire = new WebWireServer(options?)
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `authenticate` | `async ({ token, request }) => context` | - | Throw to reject; return value becomes `conn.auth` |
| `heartbeat` | `boolean \| { interval?, timeout? }` | `true` | `false` disables heartbeat |
| `requestTimeout` | `number` | `10000` | Timeout for server-initiated requests in ms |
| `codec` | `Codec` | `jsonCodec` | See [Custom codecs](codecs.md) |

## Events

```js
wire.on('connection', (conn) => { ... })
```

## Methods

```js
wire.broadcast(event, data)    // send event to all connected clients
wire.attach(httpServer)        // hook WebSocket upgrades into a Node.js http.Server
wire.handleRequest(request)    // Fetch API Request → Response (polling routes)
wire.stop()                    // gracefully close all connections and timers
```

## WireConnection

Each connected client is a `WireConnection` instance passed to the `connection` event.

```js
wire.on('connection', (conn) => {
  conn.id    // auto-incrementing numeric ID
  conn.auth  // value returned by authenticate()

  conn.emit('event', data)               // push event to this client
  conn.request('event', data, timeout?)  // → Promise<response>
  conn.handle('event', async (data) => response)  // respond to client requests
  conn.broadcast('event', data)          // send to all other connected clients
  conn.close(code?, reason?)
  conn.ping()

  conn.on('event:name', handler)
  conn.on('disconnect', () => {})
  conn.on('error',      (err) => {})
})
```

## Authentication

See [Authentication guide](auth.md).

## Custom framework integration

See [Framework adapters - Custom](frameworks.md#custom).
