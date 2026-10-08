# @webwirejs/server

Framework-agnostic WebWire.js server for Node.js and Bun.

## Install

```bash
bun add @webwirejs/server
# or
npm install @webwirejs/server
```

## Usage

```js
import { WebWireServer } from '@webwirejs/server'

const wire = new WebWireServer({
  authenticate: async ({ token, request }) => {
    const user = await db.verifyToken(token)
    if (!user) throw new Error('Unauthorized')
    return user  // available as conn.auth
  },
})

wire.on('connection', (conn) => {
  console.log('connected:', conn.id, conn.auth)

  conn.on('chat:message', (data) => {
    wire.broadcast('chat:message', data)
  })

  conn.handle('math:add', async ({ a, b }) => ({ result: a + b }))

  conn.on('disconnect', () => console.log('disconnected:', conn.id))
})
```

## Attaching to a framework

Use one of the framework packages for the simplest setup:

- [`@webwirejs/express`](../express) - Express middleware
- [`@webwirejs/hono`](../hono) - Hono app factory
- [`@webwirejs/fastify`](../fastify) - Fastify plugin

Or integrate manually with `createConnection`:

```js
const handler = wire.createConnection(send, close, req)

transport.onmessage = (bytes) => handler.onData(bytes)
transport.onclose   = ()      => handler.onClose()
transport.onerror   = (err)   => handler.onError(err)
```

## Key options

| Option | Default | Description |
|---|---|---|
| `authenticate` | - | `async ({ token, request }) => context` - throw to reject |
| `heartbeat` | `true` | `false` disables heartbeat |
| `requestTimeout` | `10000` | Timeout for server-initiated requests in ms |

## Broadcasting

```js
wire.broadcast('event', data)  // all connected clients
conn.broadcast('event', data)  // all clients except this one
```

Full API: [`docs/server.md`](../../docs/server.md)
