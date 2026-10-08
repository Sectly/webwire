# WebWire.js

Minimal realtime bidirectional event library with automatic transport fallback:
**WebTransport → WebSocket → HTTP Long Polling**

---

## Install

```bash
bun add @webwire/client @webwire/server @webwire/express
```

## Quick start

**Server**

```js
import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/express'

const app = express()
const wire = new WebWireServer()

wire.on('connection', (conn) => {
  conn.on('chat:message', (data) => wire.broadcast('chat:message', data))
})

app.use('/wire', webwire(wire))
createServer(app).listen(3000)
```

**Client**

```js
import { WebWire } from '@webwire/client'

const wire = new WebWire('http://localhost:3000/wire')
wire.on('chat:message', (msg) => console.log(msg))

await wire.connect()
wire.emit('chat:message', { text: 'hello' })
```

## Packages

| Package | Description |
|---|---|
| `@webwire/client` | Browser / Node / Bun client |
| `@webwire/server` | Framework-agnostic server |
| `@webwire/express` | Express middleware |
| `@webwire/hono` | Hono app factory |
| `@webwire/fastify` | Fastify plugin |
| `@webwire/core` | Protocol, framing, codecs |

## Docs

Full API reference, framework guides, authentication, request/response, custom codecs, and protocol details live in [`docs/`](docs/).

## Development

```bash
bun install
bun test
bun run build
```
