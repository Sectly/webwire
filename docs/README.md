# WebWire.js - Documentation

WebWire is a minimal realtime bidirectional event library for JavaScript. It gives you a single unified API for sending and receiving events between a server and any number of clients, regardless of which transport is actually carrying the data.

## How it works

When a client connects, WebWire automatically picks the best available transport:

1. **WebTransport** - fastest, uses HTTP/3, requires HTTPS
2. **WebSocket** - the standard realtime transport, widely supported
3. **HTTP Long Polling** - plain HTTP fallback, works everywhere

The client tries each in order and uses the first one that succeeds. If a connection drops, it reconnects automatically with exponential backoff and retries transport selection from the top. Your application code sees none of this - it just emits and listens to events.

## Architecture

The library is split into focused packages:

- **`@webwire/core`** - the protocol layer. Binary framing, LEB128 varints, handshake negotiation, JSON codec, event emitter with wildcard support, and all shared error types. Nothing runtime-specific lives here.
- **`@webwire/client`** - the client. Wraps the three transports, handles reconnect/heartbeat/request-response, and exposes the `WebWire` class.
- **`@webwire/server`** - the server. Manages connections, dispatches frames, runs heartbeats, and exposes `WebWireServer` and `WireConnection`. Framework-agnostic - it speaks Fetch API `Request`/`Response` and raw byte callbacks.
- **`@webwire/express`**, **`@webwire/hono`**, **`@webwire/fastify`** - thin adapters that wire the server into each framework.

## Guides

- [Client](client.md) - `WebWire` constructor, methods, lifecycle events, wildcards, reconnect
- [Server](server.md) - `WebWireServer` constructor, `WireConnection` API
- [Framework adapters](frameworks.md) - Express, Hono, Fastify, custom integration
- [Authentication](auth.md) - `authenticate` hook, per-event authorization
- [Request / response](request-response.md) - bidirectional request/response, timeouts
- [Custom codecs](codecs.md) - implementing and using a custom codec
- [Protocol](protocol.md) - binary framing, frame types, handshake, limits

## Examples

Working code examples for every integration and common pattern live in [`examples/`](../examples/).
