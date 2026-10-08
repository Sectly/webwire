import express from 'express'
import { createServer } from 'http'
import { WebWireServer } from '@webwirejs/server'
import { webwire } from '@webwirejs/express'

const wire = new WebWireServer()

wire.on('connection', (conn) => {
  console.log(`[+] client ${conn.id} connected`)

  // Client can call these like RPC.
  conn.handle('math:add',      async ({ a, b })  => ({ result: a + b }))
  conn.handle('math:multiply', async ({ a, b })  => ({ result: a * b }))
  conn.handle('user:greet',    async ({ name })  => ({ message: `Hello, ${name}!` }))

  conn.handle('task:slow', async (data) => {
    // Simulate async work.
    await new Promise(r => setTimeout(r, 500))
    return { done: true, input: data }
  })

  // Server-initiated request to the client after 2 seconds.
  setTimeout(async () => {
    try {
      const res = await conn.request('client:info', {})
      console.log('client info:', res)
    } catch (err) {
      console.warn('client did not respond:', err.message)
    }
  }, 2000)

  conn.on('disconnect', () => console.log(`[-] client ${conn.id} disconnected`))
})

const app = express()
app.use('/wire', webwire(wire))
createServer(app).listen(3000, () => {
  console.log('Request/response server on http://localhost:3000')
})
