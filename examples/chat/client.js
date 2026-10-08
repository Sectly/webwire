import { WebWire } from '@webwirejs/client'
import { createInterface } from 'readline'

const username = process.argv[2] ?? 'user' + Math.floor(Math.random() * 1000)
const wire = new WebWire('http://localhost:3000/wire')

wire.on('chat:joined',  ({ username, online }) => console.log(`--> ${username} joined (${online} online)`))
wire.on('chat:left',    ({ username, online }) => console.log(`<-- ${username} left (${online} online)`))
wire.on('chat:typing',  ({ username })         => process.stdout.write(`\r${username} is typing...  \r`))
wire.on('chat:message', ({ username, text })   => console.log(`${username}: ${text}`))

await wire.connect()
wire.emit('chat:join', { username })
console.log(`Joined as "${username}". Type a message and press Enter. Ctrl+C to exit.\n`)

const rl = createInterface({ input: process.stdin })

rl.on('line', (text) => {
  if (text.trim()) {
    wire.emit('chat:message', { text: text.trim() })
  }
})

rl.on('close', () => wire.disconnect())

// Emit typing indicator on input
process.stdin.on('keypress', () => wire.emit('chat:typing'))
