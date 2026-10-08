// Same server as any other example - the transport choice is made on the client.
import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'

const wire = new WebWireServer()

wire.on('connection', (conn) => {
  console.log(`[+] client ${conn.id} connected`)

  conn.on('ping', (data) => conn.emit('pong', { echo: data, time: Date.now() }))
  conn.on('disconnect', () => console.log(`[-] client ${conn.id} disconnected`))
})

const app = express()
app.use('/wire', webwire(wire))
createServer(app).listen(3000, () => {
  console.log('Server on http://localhost:3000 (accepts any transport)')
})
