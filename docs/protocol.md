# Wire protocol

## Frame format

Every message on the wire is a binary frame:

```
[ flags: u8 ][ type: u8 ][ length: varint (LEB128) ][ payload: bytes ]
```

`length` is an unsigned LEB128 varint encoding the payload byte count.

## Frame types

| Constant | Value | Direction | Description |
|---|---|---|---|
| `HANDSHAKE` | `0x09` | both | First frame on every connection |
| `EVENT` | `0x01` | both | Fire-and-forget event |
| `REQUEST` | `0x02` | both | Request expecting a response |
| `RESPONSE` | `0x03` | both | Response to a REQUEST |
| `ERROR` | `0x04` | both | Error response to a REQUEST |
| `PING` | `0x05` | both | Heartbeat probe |
| `PONG` | `0x06` | both | Heartbeat reply |
| `AUTH` | `0x07` | client→server | Auth token (reserved) |
| `CLOSE` | `0x08` | both | Graceful close with code and reason |

## Handshake

The first frame on every new connection must be a `HANDSHAKE` sent by the client. The server replies with its own `HANDSHAKE` confirming the negotiated codec and compression algorithm.

Handshake payload (JSON):

```json
{
  "version": 1,
  "codecs": ["json"],
  "compressionAlgos": [],
  "auth": { "token": "..." }
}
```

If the protocol versions are incompatible, or no codec overlap exists, the server closes the connection.

## Limits

| Limit | Value |
|---|---|
| Max frame size | 4 MiB |
| Max event name length | 256 bytes |
| Protocol version | 1 |

## Transports

The same framing runs over all three transports:

- **WebTransport** - bidirectional streams (reliable, ordered)
- **WebSocket** - binary messages
- **HTTP Long Polling** - each poll/send is a discrete binary HTTP body

## Event payload (JSON codec)

```json
{ "e": "event:name", "d": "<base64-encoded codec bytes>" }
```

`Uint8Array` values in the data are encoded as `{ "$t": "bytes", "$v": "<base64>" }` and decoded transparently.
