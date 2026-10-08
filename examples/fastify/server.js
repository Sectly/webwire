import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/fastify'

const fastify = Fastify({ logger: false })
const wire = new WebWireServer()

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

await fastify.register(websocket)
await fastify.register(webwire, { wireServer: wire, prefix: '/wire' })

fastify.get('/', async () => 'WebWire Fastify example running')

await fastify.listen({ port: 3000 })
console.log('Server listening on http://localhost:3000')
console.log('WebWire endpoint: ws://localhost:3000/wire')
