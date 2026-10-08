// Run this alongside any of the server examples.
// By default it connects to localhost:3000/wire.
import { WebWire } from '@webwire/client'

const wire = new WebWire('http://localhost:3000/wire')

wire.on('connecting',   ()        => console.log('connecting...'))
wire.on('connect',      ()        => console.log('connected via', wire.transport))
wire.on('disconnect',   ()        => console.log('disconnected'))
wire.on('reconnecting', ({ delay }) => console.log(`reconnecting in ${delay}ms`))
wire.on('error',        (err)     => console.error('error:', err.message))

wire.on('pong', (data) => {
  console.log('pong received:', data)
})

wire.on('message', (data) => {
  console.log('broadcast message:', data)
})

await wire.connect()

// Send a ping every 2 seconds, three times, then disconnect.
let count = 0
const interval = setInterval(async () => {
  wire.emit('ping', { n: ++count })

  if (count >= 3) {
    clearInterval(interval)
    wire.disconnect()
  }
}, 2000)
