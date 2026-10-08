import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'
import { msgpackCodec } from './codec.js'

const wire = new WebWireServer({ codec: msgpackCodec })

wire.on('connection', (conn) => {
  console.log(`[+] client ${conn.id} connected (codec: msgpack)`)

  conn.on('data', (payload) => {
    console.log('received:', payload)
    // Echo back with a server timestamp.
    conn.emit('data:echo', { ...payload, serverTime: Date.now() })
  })

  // Binary data round-trip - msgpack handles Uint8Array natively.
  conn.on('binary', (bytes) => {
    console.log('received binary, length:', bytes.length)
    conn.emit('binary:echo', bytes)
  })

  conn.on('disconnect', () => console.log(`[-] client ${conn.id} disconnected`))
})

const app = express()
app.use('/wire', webwire(wire))
createServer(app).listen(3000, () => {
  console.log('Custom codec (msgpack) server on http://localhost:3000')
})
