# @webwirejs/fastify

Fastify plugin for WebWire.js. Registers WebSocket and HTTP Long Polling routes.

## Install

```bash
bun add @webwirejs/fastify @webwirejs/server fastify @fastify/websocket
# or
npm install @webwirejs/fastify @webwirejs/server fastify @fastify/websocket
```

## Usage

```js
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/fastify'

const fastify = Fastify()
const wire = new WebWireServer()

wire.on('connection', (conn) => {
  conn.on('message', (data) => wire.broadcast('message', data))
})

await fastify.register(websocket)
await fastify.register(webwire, { wireServer: wire, prefix: '/wire' })

await fastify.listen({ port: 3000 })
```

`@fastify/websocket` must be registered before `@webwirejs/fastify`.

## Plugin options

| Option | Type | Required | Description |
|---|---|---|---|
| `wireServer` | `WebWireServer` | yes | The WebWire server instance |
| `prefix` | `string` | no | Route prefix, e.g. `'/wire'` |
