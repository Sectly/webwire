# Examples

Each example is a self-contained directory. Install its dependencies with `bun install` or `npm install`, then run the scripts shown.

| Directory | What it shows |
|---|---|
| [`express/`](express/) | Express server - basic events, ping/pong, broadcast |
| [`hono-bun/`](hono-bun/) | Hono server running on Bun |
| [`fastify/`](fastify/) | Fastify server with `@fastify/websocket` |
| [`client-node/`](client-node/) | Node.js client connecting to any of the servers above |
| [`chat/`](chat/) | Multi-user chat - join, messages, typing indicator |
| [`auth/`](auth/) | Token authentication and per-event role checks |
| [`request-response/`](request-response/) | RPC-style request/response in both directions |
| [`custom-codec/`](custom-codec/) | MessagePack codec replacing the default JSON codec |
| [`polling-only/`](polling-only/) | Force HTTP Long Polling transport on the client |

## Running an example

```bash
cd examples/chat
bun install   # or npm install

# terminal 1
bun run server  # or: node server.js

# terminal 2
bun run client Alice
bun run client Bob
```

All server examples listen on `http://localhost:3000` with the WebWire endpoint at `/wire`.
