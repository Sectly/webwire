import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwire/server'
import { webwire } from '@webwire/express'

const app = express()
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

app.get('/', (_req, res) => res.send('WebWire Express example running'))
app.use('/wire', webwire(wire))

const server = createServer(app)
server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000')
  console.log('WebWire endpoint: ws://localhost:3000/wire')
})
