// Usage: node client.js token-alice
//        node client.js token-bob
//        node client.js bad-token
import { WebWire } from '@webwirejs/client'

const token = process.argv[2] ?? 'token-alice'

const wire = new WebWire('http://localhost:3000/wire', { auth: token })

wire.on('connect',          ()    => console.log('connected'))
wire.on('error',            (err) => console.error('error:', err.message))
wire.on('secret:data',      (d)   => console.log('secret:', d.value))
wire.on('error:forbidden',  (d)   => console.warn('forbidden:', d.message))
wire.on('admin:done',       (d)   => console.log('admin action result:', d))

try {
  await wire.connect()

  wire.emit('secret:read')
  wire.emit('admin:action', { cmd: 'restart-service' })

  setTimeout(() => wire.disconnect(), 1000)
} catch (err) {
  console.error('connection rejected:', err.message)
}
