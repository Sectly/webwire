import { WebWire } from '@webwirejs/client'
import { msgpackCodec } from './codec.js'

const wire = new WebWire('http://localhost:3000/wire', { codec: msgpackCodec })

wire.on('data:echo',   (d) => console.log('echo:', d))
wire.on('binary:echo', (b) => console.log('binary echo, length:', b.length))

await wire.connect()
console.log('connected with msgpack codec\n')

// Send structured data.
wire.emit('data', { message: 'hello msgpack', value: 42, nested: { ok: true } })

// Send raw binary.
wire.emit('binary', new Uint8Array([1, 2, 3, 4, 5]))

setTimeout(() => wire.disconnect(), 1000)
