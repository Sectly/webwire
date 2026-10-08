# Framework adapters

## Express

```bash
bun add @webwire/express express
```

```js
import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/express'

const app = express()
const wire = new WebWireServer()

app.use('/wire', webwire(wire))
createServer(app).listen(3000)
```

The middleware handles WebSocket upgrades and all three polling routes automatically. Mount it at whatever path your client uses as the base URL.

## Hono - Bun

```bash
bun add @webwire/hono hono
```

```js
import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/hono'

const app = new Hono()
const wire = new WebWireServer()
const { upgradeWebSocket, websocket } = createBunWebSocket()

app.route('/wire', webwire(wire, upgradeWebSocket))

Bun.serve({ fetch: app.fetch, websocket, port: 3000 })
```

## Hono - Node.js

```bash
npm install @webwire/hono hono @hono/node-server
```

```js
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-server/ws'
import { Hono } from 'hono'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/hono'

const app = new Hono()
const wire = new WebWireServer()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.route('/wire', webwire(wire, upgradeWebSocket))

const server = serve({ fetch: app.fetch, port: 3000 })
injectWebSocket(server)
```

`upgradeWebSocket` must come from your runtime's Hono adapter. Pass it as the second argument to `webwire()`.

## Fastify

```bash
bun add @webwire/fastify fastify @fastify/websocket
```

```js
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/fastify'

const fastify = Fastify()
const wire = new WebWireServer()

await fastify.register(websocket)
await fastify.register(webwire, { wireServer: wire, prefix: '/wire' })

await fastify.listen({ port: 3000 })
```

`@fastify/websocket` must be registered before `@webwire/fastify`.

## Custom

Use `createConnection` to integrate with any byte-stream transport:

```js
// send  - write bytes to the remote peer
// close - close the underlying transport
// req   - original request, forwarded to the authenticate hook
const handler = wire.createConnection(send, close, req)

// Feed incoming bytes - the first call must carry the WebWire HANDSHAKE frame
transport.onmessage = (bytes) => handler.onData(bytes)
transport.onclose   = ()      => handler.onClose()
transport.onerror   = (err)   => handler.onError(err)
```
