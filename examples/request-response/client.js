import { WebWire } from '@webwire/client'
import { TimeoutError } from '@webwire/core'

const wire = new WebWire('http://localhost:3000/wire')

// Server can request info from us too.
wire.on('client:info', async () => ({
  platform: process.platform,
  version:  process.version,
}))

await wire.connect()
console.log('connected\n')

// Basic requests.
const add = await wire.request('math:add', { a: 10, b: 5 })
console.log('math:add 10+5 =', add.result)

const mul = await wire.request('math:multiply', { a: 6, b: 7 })
console.log('math:multiply 6*7 =', mul.result)

const greet = await wire.request('user:greet', { name: 'World' })
console.log('user:greet =', greet.message)

// Slow task with custom timeout.
try {
  const slow = await wire.request('task:slow', { id: 42 }, 2000)
  console.log('task:slow =', slow)
} catch (err) {
  if (err instanceof TimeoutError) {
    console.warn('task:slow timed out')
  }
}

setTimeout(() => wire.disconnect(), 3000)
