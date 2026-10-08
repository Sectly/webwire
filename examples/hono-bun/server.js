import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/hono'

const app = new Hono()
const wire = new WebWireServer()
const { upgradeWebSocket, websocket } = createBunWebSocket()

wire.on('connection', (conn) => {
  console.log(`[+] client ${conn.id} connected`)

  conn.on('ping', (data) => {
    conn.emit('pong', { echo: data, time: Date.now() })
  })

  conn.on('broadcast', (data) => {
    wire.broadcast('message', data)
  })

  conn.on('disconnect', () => {
    console.log(`[-] client ${conn.id} disconnected`)
  })
})

app.get('/', (c) => c.text('WebWire Hono/Bun example running'))
app.route('/wire', webwire(wire, upgradeWebSocket))

Bun.serve({
  fetch: app.fetch,
  websocket,
  port: 3000,
})

console.log('Server listening on http://localhost:3000')
console.log('WebWire endpoint: ws://localhost:3000/wire')
