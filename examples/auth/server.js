import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'

// Simple token store - replace with a real DB/JWT check in production.
const VALID_TOKENS = new Map([
  ['token-alice', { id: 1, name: 'Alice', role: 'admin' }],
  ['token-bob',   { id: 2, name: 'Bob',   role: 'user'  }],
])

const wire = new WebWireServer({
  authenticate: async ({ token }) => {
    const user = VALID_TOKENS.get(token)
    if (!user) throw new Error('Invalid token')
    return user
  },
})

wire.on('connection', (conn) => {
  const { name, role } = conn.auth
  console.log(`[+] ${name} (${role}) connected`)

  conn.on('secret:read', () => {
    conn.emit('secret:data', { value: 'top secret info' })
  })

  conn.on('admin:action', (data) => {
    if (conn.auth.role !== 'admin') {
      conn.emit('error:forbidden', { message: 'Admin only' })
      return
    }
    console.log(`Admin action from ${name}:`, data)
    conn.emit('admin:done', { ok: true })
  })

  conn.on('disconnect', () => console.log(`[-] ${name} disconnected`))
})

const app = express()
app.use('/wire', webwire(wire))
createServer(app).listen(3000, () => {
  console.log('Auth server on http://localhost:3000')
  console.log('Valid tokens: token-alice (admin), token-bob (user)')
})
