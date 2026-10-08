# WebWire.js

Minimal realtime bidirectional event library with automatic transport fallback:
**WebTransport → WebSocket → HTTP Long Polling**

---

## Install

```bash
bun add @webwirejs/client @webwirejs/server @webwirejs/express
```

## Quick start

**Server**

```js
import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'

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
import { WebWire } from '@webwirejs/client'

const wire = new WebWire('http://localhost:3000/wire')
wire.on('chat:message', (msg) => console.log(msg))

await wire.connect()
wire.emit('chat:message', { text: 'hello' })
```

## Packages

| Package | Description |
|---|---|
| `@webwirejs/client` | Browser / Node / Bun client |
| `@webwirejs/server` | Framework-agnostic server |
| `@webwirejs/express` | Express middleware |
| `@webwirejs/hono` | Hono app factory |
| `@webwirejs/fastify` | Fastify plugin |
| `@webwirejs/core` | Protocol, framing, codecs |

## Docs

Full API reference, framework guides, authentication, request/response, custom codecs, and protocol details live in [`docs/`](docs/).

## Development

```bash
bun install
bun test
bun run build
```
