# @webwire/core

Shared protocol implementation for WebWire.js - binary framing, codecs, event emitter, and error types.

You rarely need to import this directly. It is a peer dependency of `@webwire/client` and `@webwire/server`.

## What's in here

- **Binary framing** - `encodeFrame` / `decodeFrame` / `decodeFrames`
- **Varint** - LEB128 encode/decode used for frame length
- **Handshake** - `encodeHandshake` / `decodeHandshake` / `negotiate`
- **Message helpers** - encode/decode for EVENT, REQUEST, RESPONSE, ERROR, AUTH, CLOSE payloads
- **JSON codec** - default codec with transparent `Uint8Array` ↔ base64 round-trip
- **EventEmitter** - `on`, `once`, `off`, `emit`, `onAny`, wildcard matching
- **Error types** - `WebWireError`, `ProtocolError`, `TimeoutError`, `AuthError`, `TransportError`
- **Constants** - `FrameType`, `FrameFlag`, protocol version, size limits, default timeouts

## Usage

```js
import {
  encodeFrame,
  decodeFrame,
  FrameType,
  jsonCodec,
  ProtocolError,
} from '@webwire/core'
```

## Error types

| Class | When |
|---|---|
| `ProtocolError` | Malformed frame or unexpected frame type |
| `TimeoutError` | `request()` exceeded its timeout |
| `AuthError` | Server rejected authentication |
| `TransportError` | Underlying transport failure |

All extend `WebWireError`.

## Frame format

```
[ flags: u8 ][ type: u8 ][ length: varint (LEB128) ][ payload: bytes ]
```

See the [protocol docs](../../docs/protocol.md) for full details.
