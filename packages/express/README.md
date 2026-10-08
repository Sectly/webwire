# @webwirejs/express

Express middleware for WebWire.js. Handles WebSocket upgrades and HTTP Long Polling routes.

## Install

```bash
bun add @webwirejs/express @webwirejs/server express
# or
npm install @webwirejs/express @webwirejs/server express
```

## Usage

```js
import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'

const app = express()
const wire = new WebWireServer()

wire.on('connection', (conn) => {
  conn.on('message', (data) => wire.broadcast('message', data))
})

app.use('/wire', webwire(wire))
createServer(app).listen(3000)
```

Mount at any path - use the same path as the base URL on the client:

```js
const client = new WebWire('http://localhost:3000/wire')
```

The middleware lazily attaches the WebSocket upgrade handler to the HTTP server on the first request, so no extra setup is needed.
