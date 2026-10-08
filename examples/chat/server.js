import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'

const app = express()
const wire = new WebWireServer()

const users = new Map() // conn.id -> username

wire.on('connection', (conn) => {
  conn.on('chat:join', ({ username }) => {
    users.set(conn.id, username)
    wire.broadcast('chat:joined', { username, online: users.size })
    console.log(`${username} joined (${users.size} online)`)
  })

  conn.on('chat:message', ({ text }) => {
    const username = users.get(conn.id) ?? 'anonymous'
    wire.broadcast('chat:message', { username, text, time: Date.now() })
  })

  conn.on('chat:typing', () => {
    const username = users.get(conn.id)
    if (username) conn.broadcast('chat:typing', { username })
  })

  conn.on('disconnect', () => {
    const username = users.get(conn.id)
    if (username) {
      users.delete(conn.id)
      wire.broadcast('chat:left', { username, online: users.size })
      console.log(`${username} left (${users.size} online)`)
    }
  })
})

app.use('/wire', webwire(wire))
createServer(app).listen(3000, () => {
  console.log('Chat server on http://localhost:3000')
})
