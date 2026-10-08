# @webwire/hono

Hono integration for WebWire.js. Returns a Hono app that you mount at your chosen path.

## Install

```bash
bun add @webwire/hono @webwire/server hono
```

## Usage - Bun

```js
import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/hono'

const app = new Hono()
const wire = new WebWireServer()
const { upgradeWebSocket, websocket } = createBunWebSocket()

wire.on('connection', (conn) => {
  conn.on('message', (data) => wire.broadcast('message', data))
})

app.route('/wire', webwire(wire, upgradeWebSocket))

Bun.serve({ fetch: app.fetch, websocket, port: 3000 })
```

## Usage - Node.js

```bash
npm install @webwire/hono @webwire/server hono @hono/node-server
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

`upgradeWebSocket` must come from your runtime's Hono adapter - pass it as the second argument to `webwire()`.
