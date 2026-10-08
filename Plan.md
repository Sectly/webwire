
# WebWire.js — Implementation Plan

## 1. Project Goal

Build **WebWire.js**, a minimal realtime, bidirectional event library for JavaScript.

WebWire provides a unified event-based API regardless of the underlying transport.

Transport preference:

1. WebTransport
2. WebSocket
3. HTTP Long Polling

The application using WebWire should not normally need to know which transport is active.

The library must work out of the box with sensible defaults while allowing users to configure advanced behavior when necessary.

Core principles:

- Minimal
- Transport-agnostic
- Standard web transports
- ESM source
- Plain JavaScript
- Browser compatible
- Node.js compatible
- Bun compatible
- Published as both ESM and CommonJS
- No TypeScript source
- No CommonJS source
- No unnecessary runtime dependencies
- WebWire server is optional
- Protocol is independent from the server implementation

---

# 2. Package Structure

Use a monorepo containing four initial packages:

```text
@webwire/core
@webwire/client
@webwire/server
@webwire/express
```

Recommended repository:

```text
webwire/
├── package.json
├── bun.lock
├── README.md
├── LICENSE
│
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── client/
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── server/
│   │   ├── package.json
│   │   └── src/
│   │
│   └── express/
│       ├── package.json
│       └── src/
│
└── scripts/
```

Use Bun for package management, scripts, tests, and building.

---

# 3. Source Language and Build

Write the implementation entirely in **plain JavaScript**.

Use native ESM syntax in source:

```js
import { something } from "./something.js";
export { something };
```

Do not use:

```js
require()
module.exports
```

in source code.

Every package should use:

```json
{
  "type": "module"
}
```

Bun Build should generate both:

```text
dist/
├── index.js
└── index.cjs
```

where:

- `index.js` = ESM
- `index.cjs` = CommonJS distribution build

Package exports should support both:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

The CommonJS build exists solely for npm consumer compatibility. The actual project source remains ESM.

Use JSDoc where useful for editor support and documentation.

TypeScript is not required.

---

# 4. Package Responsibilities

## `@webwire/core`

Contains the WebWire protocol and shared functionality.

Must not depend on:

- Node.js
- Bun
- Express
- WebSocket
- WebTransport
- browser-specific APIs

Core should contain:

```text
protocol/
    framing
    handshake
    events
    requests
    responses
    heartbeat
    authentication
    errors

codec/
    codec interface
    JSON codec

compression/
    compression interface

events/
    event emitter
    wildcard matching

transport/
    transport interface

shared/
    constants
    protocol version
    errors
```

`core` works with bytes and abstract interfaces.

It should not know how those bytes are transported.

---

# 5. `@webwire/client`

The universal client.

Example:

```js
import { WebWire } from "@webwire/client";

const wire = new WebWire("https://example.com/wire");

await wire.connect();

wire.on("message", data => {
    console.log(data);
});

wire.emit("message", {
    hello: "world"
});
```

The client must work in:

- Browser
- Node.js
- Bun

The client automatically selects a transport.

Default order:

```text
WebTransport
    ↓
WebSocket
    ↓
Long Polling
```

Feature detection should be used instead of hardcoded runtime detection wherever possible.

For example:

```js
globalThis.WebTransport
globalThis.WebSocket
globalThis.fetch
```

Do not make Node/Bun/browser-specific branches unless actually necessary.

---

# 6. `@webwire/server`

The default WebWire server implementation.

It implements the WebWire protocol and provides:

- connections
- events
- authentication hooks
- request/response
- heartbeat
- compression negotiation
- encoding
- broadcasting
- connection lifecycle

It should be usable without Express.

The server should provide a runtime-neutral interface wherever practical so Node.js and Bun integrations can share most of the implementation.

The server should not require the Express package.

---

# 7. `@webwire/express`

A thin Express integration layer.

Its only purpose is to make `@webwire/server` easy to use with Express.

Example:

```js
import express from "express";
import { WebWireServer } from "@webwire/server";
import { webwire } from "@webwire/express";

const app = express();

const wire = new WebWireServer();

app.use("/wire", webwire(wire));
```

Keep this package thin.

Do not move protocol or server logic into the Express package.

---

# 8. Hono

Hono compatibility should be considered in the server architecture, particularly by keeping the server integration compatible with standard `Request`/`Response` APIs.

Do not add a `@webwire/hono` package to the initial four-package scope unless explicitly requested.

The server should not become dependent on Express or Hono.

---

# 9. Transport Architecture

Define a transport interface in `@webwire/core`.

Conceptually:

```js
class Transport {
    connect() {}
    send(data) {}
    close() {}

    onData(callback) {}
    onClose(callback) {}
    onError(callback) {}
}
```

The exact implementation can use a formal interface contract rather than an actual base class.

The transport works with:

```js
Uint8Array
```

The WebWire protocol never directly depends on WebSocket/WebTransport APIs.

Transport implementations belong outside `core`.

---

# 10. Standard Transport Requirement

WebWire must not invent custom versions of WebTransport or WebSocket.

The underlying connection must use the normal platform APIs and semantics.

Conceptually:

```text
WebWire protocol
       ↓
standard WebTransport
```

or:

```text
WebWire protocol
       ↓
standard WebSocket
```

or:

```text
WebWire protocol
       ↓
WebWire HTTP polling transport
```

The WebWire server is not mandatory.

A third-party implementation can implement the WebWire protocol.

This should make it possible for other languages and runtimes to eventually implement WebWire.

Important distinction:

A completely ordinary WebSocket/WebTransport server that does **not speak the WebWire protocol** cannot provide WebWire events automatically.

Standard transport compatibility means WebWire uses the standard transport, not that arbitrary non-WebWire servers magically implement the WebWire protocol.

If a raw transport mode is implemented, it must remain separate from the WebWire protocol/event API.

---

# 11. Data Model

Users should be able to emit arbitrary normal JavaScript values.

Examples:

```js
wire.emit("message", "hello");

wire.emit("count", 42);

wire.emit("enabled", true);

wire.emit("user", {
    name: "Alice",
    age: 20
});

wire.emit("nothing", null);
```

The library handles serialization automatically.

The public API should accept:

```js
unknown
```

conceptually.

The transport only ever receives bytes.

Pipeline:

```text
JavaScript value
      ↓
codec
      ↓
Uint8Array
      ↓
compression
      ↓
WebWire frame
      ↓
transport
```

Incoming:

```text
transport
      ↓
WebWire frame
      ↓
decompression
      ↓
codec
      ↓
JavaScript value
```

---

# 12. Codec System

Define a codec abstraction:

```js
encode(value) → Uint8Array
decode(data) → value
```

The default codec should be JSON-based.

The API should allow custom codecs later.

Do not make MessagePack, CBOR, etc. mandatory dependencies.

The core should be designed so additional codecs can be supplied without changing the protocol architecture.

Binary values such as `Uint8Array` should be handled deliberately rather than accidentally converted into unusable JSON objects.

Document exactly which built-in JavaScript values are supported by the default codec.

---

# 13. Compression

Compression is **optional**.

Default:

```js
compression: false
```

When enabled, users can specify the compression threshold.

Example:

```js
const wire = new WebWire(url, {
    compression: {
        enabled: true,
        threshold: 1024
    }
});
```

Meaning:

```text
encoded message
      ↓
size < 1024
      ↓
send uncompressed
```

and:

```text
encoded message
      ↓
size >= 1024
      ↓
compress
      ↓
send
```

The threshold applies to the encoded byte size, not the original JavaScript object's apparent size.

Compression must be negotiated between peers.

Do not compress messages automatically unless the user enabled compression.

Do not introduce multiple compression algorithms in the initial implementation unless required by the protocol design.

---

# 14. WebWire Frames

Define a small binary framing protocol.

A frame should contain enough information to determine:

- frame type
- flags
- payload length
- payload

Conceptually:

```text
┌────────┬────────┬──────────┬──────────────┐
│ flags  │ type   │ length   │ payload      │
└────────┴────────┴──────────┴──────────────┘
```

Use a compact variable-length integer for payload length if practical.

Initial frame types should include:

```text
EVENT
REQUEST
RESPONSE
ERROR
PING
PONG
AUTH
CLOSE
```

Keep the protocol extensible.

Protocol version must be negotiated during the handshake.

---

# 15. Handshake

After establishing the underlying transport, WebWire performs a small protocol handshake.

The handshake should negotiate:

- WebWire protocol version
- encoding
- compression capabilities
- authentication state/capability
- protocol capabilities

Do not make the handshake unnecessarily large.

The transport connection itself remains standard.

---

# 16. Event API

Basic API:

```js
wire.on("message", handler);
wire.once("message", handler);
wire.off("message", handler);

wire.emit("message", data);
```

Also support:

```js
wire.onAny(handler);
```

if useful, although `*` is the primary wildcard API.

---

# 17. Wildcards

WebWire must support wildcard event listeners.

At minimum:

```js
wire.on("*", (data, event) => {
    console.log(event, data);
});
```

Also support namespace wildcards:

```js
wire.on("user:*", (data, event) => {
    console.log(event, data);
});
```

Example:

```js
wire.emit("user:joined", user);
wire.emit("user:left", user);
```

Both match:

```text
user:*
```

Keep wildcard semantics deliberately simple.

Recommended initial semantics:

```text
*           matches every application event
user:*      matches user:<single segment>
*:created   matches <single segment>:created
```

Do not initially implement arbitrary glob expressions.

Internal WebWire protocol frames such as PING/PONG/ACK must not appear as normal application events when listening with `*`.

---

# 18. Request/Response API

Support request/response in addition to fire-and-forget events.

Client:

```js
const user = await wire.request("user:get", {
    id: 123
});
```

Server:

```js
connection.handle("user:get", async data => {
    return getUser(data.id);
});
```

Requests require IDs so responses can be matched to requests.

Requests must have a timeout.

Default request timeout should be reasonable and configurable.

---

# 19. Authentication

Authentication must be extensible but minimal.

WebWire should not implement:

- user accounts
- OAuth
- JWT issuance
- password storage
- sessions

Instead, provide authentication hooks.

Example:

```js
const wire = new WebWireServer({
    authenticate: async ({ token, request }) => {
        return authenticateUser(token);
    }
});
```

The authenticated user/context can then be associated with the connection.

Client authentication should support common mechanisms such as:

```js
auth: {
    token: "..."
}
```

and browser-compatible credentials/cookies where appropriate.

Do not make authentication implementation-specific.

---

# 20. Heartbeat

Automatic heartbeat is enabled by default.

The connection should periodically verify that the peer is still alive.

Conceptually:

```text
PING
  ↓
PONG
```

If the peer does not respond within the heartbeat timeout:

```text
connection considered dead
        ↓
transport closed
        ↓
reconnect
```

Heartbeat should avoid unnecessary traffic when appropriate, but correctness is more important than micro-optimizing the first implementation.

---

# 21. Reconnection

Automatic reconnect is enabled by default.

Use exponential backoff with jitter.

Suggested defaults:

```text
initial delay: 500ms
maximum delay: 30s
```

Example sequence:

```text
500ms
1s
2s
4s
8s
16s
30s
30s
...
```

Authentication failures such as an explicit unauthorized response should not blindly cause infinite reconnect loops.

Temporary network/server failures should reconnect.

---

# 22. `forceReconnect()`

Do not implement automatic transport upgrades yet.

Instead, expose:

```js
await wire.forceReconnect();
```

`forceReconnect()` means:

1. Close the current connection.
2. Reset transport selection/fallback state.
3. Attempt the preferred transport again.
4. Fall back through the normal transport order.
5. Establish a new WebWire session.

Example:

```text
Current:
WebTransport unavailable
        ↓
WebSocket active

forceReconnect()
        ↓
try WebTransport again
        ↓
available?
   ├── yes → WebTransport
   └── no  → WebSocket
```

This provides a manual way to test whether a better transport has become available without implementing active migration.

Normal reconnects should not be treated as transport upgrades.

---

# 23. Transport Selection

Default priority:

```js
[
    "webtransport",
    "websocket",
    "polling"
]
```

Users should be able to configure the allowed/preferred transports.

For example:

```js
new WebWire(url, {
    transports: ["websocket", "polling"]
});
```

Forcing a single transport should also be possible:

```js
transports: ["websocket"]
```

The client should expose the active transport for diagnostics:

```js
wire.transport
```

Possible values:

```text
"webtransport"
"websocket"
"polling"
```

---

# 24. Connection State

Expose a small connection state model:

```text
disconnected
connecting
connected
reconnecting
closing
```

Provide lifecycle events such as:

```js
wire.on("connecting", ...)
wire.on("connect", ...)
wire.on("disconnect", ...)
wire.on("reconnecting", ...)
wire.on("error", ...)
```

Optionally expose transport changes separately.

Do not expose transport implementation details through normal application events.

---

# 25. Server Broadcasting

The server should support basic broadcasting.

For example:

```js
connection.broadcast("message", data);
```

and:

```js
server.broadcast("announcement", data);
```

Rooms/channels should **not** be required for the first implementation.

Avoid adding a large room system until the core library is stable.

---

# 26. Long Polling

Long polling is the compatibility fallback.

It can use HTTP endpoints along the lines of:

```text
GET  /wire/poll
POST /wire/send
```

The exact protocol should be designed so it integrates cleanly with the same WebWire framing/protocol layer.

The rest of WebWire must not know that it is polling.

The polling transport implements the same transport interface as WebTransport and WebSocket.

---

# 27. Node.js and Bun Server

The default server should work with built-in HTTP(S) infrastructure where practical.

Bun should be a first-class runtime.

Avoid requiring Express for normal Node/Bun server usage.

The server architecture should favor standard `Request`/`Response` style interfaces where possible because this makes future Hono integration easier.

---

# 28. Browser/Node/Bun Client Runtime Design

Prefer capability detection:

```js
if (globalThis.WebTransport) {
    ...
}
```

rather than:

```js
if (isNode) {
    ...
}
```

WebSocket and WebTransport implementations can optionally be injected if a runtime does not expose them globally.

For example:

```js
new WebWire(url, {
    WebSocket: CustomWebSocket,
    WebTransport: CustomWebTransport
});
```

Do not bundle platform implementations unnecessarily.

---

# 29. Dependencies

Keep runtime dependencies minimal.

Ideal:

```text
@webwire/core
    0 required runtime dependencies

@webwire/client
    minimal/zero runtime dependencies

@webwire/server
    minimal dependencies

@webwire/express
    express as peer dependency
```

Do not make a third-party WebTransport implementation a mandatory dependency of the client.

Native WebTransport should be preferred when available.

---

# 30. Testing

Build comprehensive automated tests using Bun's test tooling.

Test at several levels.

### Core tests

- frame encoding/decoding
- malformed frames
- protocol versions
- codec behavior
- compression negotiation
- wildcard matching
- request IDs
- request timeouts
- heartbeat state
- protocol errors

### Client tests

- WebTransport selection
- WebSocket fallback
- polling fallback
- reconnect
- exponential backoff
- forceReconnect
- transport re-evaluation
- authentication
- event dispatch
- wildcard dispatch
- request/response
- compression threshold

### Server tests

- connection handling
- event handling
- broadcasting
- authentication
- heartbeat
- request handlers
- malformed clients
- payload limits

### Integration tests

Test:

```text
client ↔ server
```

using:

```text
WebTransport
WebSocket
Long Polling
```

where the runtime environment supports each transport.

Also test ESM and CommonJS package consumers.

---

# 31. Security/Robustness Requirements

Implement basic safeguards from the beginning:

- maximum frame size
- maximum event name length
- maximum request count where necessary
- malformed frame rejection
- protocol version validation
- authentication failure handling
- compression/decompression failure handling
- connection timeout
- heartbeat timeout
- request timeout

Do not introduce advanced security systems that aren't required by the protocol.

The library should fail closed on malformed protocol input.

---

# 32. API Philosophy

The common case should be extremely small.

This should work:

```js
import { WebWire } from "@webwire/client";

const wire = new WebWire("https://example.com/wire");

wire.on("message", console.log);

await wire.connect();

wire.emit("message", {
    hello: "world"
});
```

No configuration should be required for:

- transport selection
- encoding
- heartbeat
- reconnect
- timeouts

Advanced users can configure those features.

---

# 33. Example Server

Target API:

```js
import { WebWireServer } from "@webwire/server";

const wire = new WebWireServer();

wire.on("connection", connection => {
    connection.on("message", data => {
        connection.broadcast("message", data);
    });

    connection.handle("ping", async data => {
        return {
            pong: data
        };
    });
});
```

The exact server attachment API can be determined during implementation based on the cleanest Node/Bun abstraction.

---

# 34. Example Express

Target API:

```js
import express from "express";
import { WebWireServer } from "@webwire/server";
import { webwire } from "@webwire/express";

const app = express();

const wire = new WebWireServer();

app.use("/wire", webwire(wire));

app.listen(3000);
```

The Express adapter should do as little as possible.

---

# 35. Documentation

Documentation should explain:

1. What WebWire is
2. Why it exists
3. Installation
4. Basic client usage
5. Basic server usage
6. Events
7. Wildcards
8. Request/response
9. Authentication
10. Compression
11. Reconnection
12. `forceReconnect()`
13. Transport selection
14. Browser usage
15. Node.js usage
16. Bun usage
17. Express integration
18. Protocol specification
19. Custom codecs
20. Implementing another WebWire server

The protocol documentation should be sufficiently precise that another language could implement WebWire without reading the JavaScript source.

---

# 36. Implementation Order

Build in this order.

## Phase 1 — Repository

- Create Bun monorepo
- Create four packages
- Configure ESM source
- Configure Bun Build
- Configure ESM + CJS output
- Configure package exports
- Add basic lint/test scripts

## Phase 2 — Core protocol

Implement:

- frame format
- frame parser
- protocol constants
- handshake
- event frames
- request/response frames
- errors
- codec interface
- JSON codec
- transport interface

Do not implement actual transports yet.

## Phase 3 — Event system

Implement:

- `.on()`
- `.once()`
- `.off()`
- `.emit()`
- wildcard `*`
- namespace wildcards
- event dispatch

Test extensively.

## Phase 4 — WebSocket transport

Implement the standard WebSocket client/server transport.

Get:

```text
client ↔ WebSocket ↔ WebWire server
```

working before adding other transports.

## Phase 5 — WebTransport

Implement WebTransport using the platform's standard API.

Add:

```text
WebTransport → WebSocket fallback
```

## Phase 6 — Long Polling

Implement the HTTP polling transport.

Add:

```text
WebTransport
    ↓
WebSocket
    ↓
Polling
```

## Phase 7 — Connection management

Add:

- heartbeat
- timeouts
- automatic reconnect
- exponential backoff
- transport state
- `forceReconnect()`

## Phase 8 — Authentication

Add protocol-level authentication negotiation and server authentication hooks.

## Phase 9 — Compression

Add optional compression.

Implement configurable encoded-byte threshold.

Compression must remain disabled by default.

## Phase 10 — Server features

Add:

- broadcasting
- request handlers
- connection context
- authenticated user/context

## Phase 11 — Express

Implement the thin Express adapter.

## Phase 12 — Packaging

Build every package as:

```text
ESM
CJS
```

Verify:

```js
import ...
```

and:

```js
require(...)
```

both work.

## Phase 13 — Documentation and protocol specification

Document the final protocol and APIs.

---

# 37. Explicit Non-Goals for v1

Do not implement these unless required:

- Automatic active transport migration/upgrades
- Rooms/channels
- Presence system
- Persistence
- Message queues
- Offline message storage
- OAuth
- JWT management
- User accounts
- Database integration
- Message history
- File transfer abstraction
- Complex middleware system
- Arbitrary glob pattern matching
- Mandatory MessagePack/CBOR
- Mandatory compression
- Mandatory third-party WebTransport implementation

`forceReconnect()` is the intended way to explicitly re-evaluate whether a better transport is available.

---

# 38. Final Architecture

```text
                         ┌───────────────────────┐
                         │     WebWire API       │
                         │ events / requests     │
                         │ auth / heartbeat      │
                         │ reconnect / wildcard  │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │    @webwire/core      │
                         │                       │
                         │ WebWire protocol      │
                         │ framing               │
                         │ codecs                │
                         │ compression           │
                         │ event matching        │
                         │ transport interface   │
                         └───────────┬───────────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
                  ▼                  ▼                  ▼
          WebTransport          WebSocket         Long Polling
          standard API          standard API       HTTP
                  │                  │                  │
                  └──────────────────┼──────────────────┘
                                     │
                              WebWire endpoint
                                     │
                  ┌──────────────────┴──────────────────┐
                  │                                     │
                  ▼                                     ▼
          @webwire/server                       Other implementations
                  │
                  ▼
          @webwire/express
```

The fundamental rule for the implementation is:

**`@webwire/core` defines what WebWire is. The client and server implement it. Transports only move bytes.**

The implementation should resist adding abstractions unless they directly support that model.
