// Force HTTP Long Polling by restricting the transport list.
// Useful for environments where WebSocket is blocked (proxies, firewalls).
import { WebWire } from '@webwire/client'

const wire = new WebWire('http://localhost:3000/wire', {
  transports: ['polling'], // skip WebTransport and WebSocket entirely
})

wire.on('connect', () => console.log('connected via', wire.transport)) // 'polling'
wire.on('pong',    (d) => console.log('pong:', d))

await wire.connect()

wire.emit('ping', { from: 'polling-client', t: Date.now() })

setTimeout(() => wire.disconnect(), 2000)
