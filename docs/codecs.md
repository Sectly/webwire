# Custom codecs

The default codec is JSON. `Uint8Array` values are transparently base64-encoded inside the JSON envelope and decoded back on receive.

## Implementing a codec

A codec is a plain object with three fields:

```js
const myCodec = {
  name:   'msgpack',                     // must be unique; negotiated in handshake
  encode: (value)  => Uint8Array,        // serialize value to bytes
  decode: (bytes)  => value,             // deserialize bytes to value
}
```

## Example: MessagePack

```js
import * as msgpack from '@msgpack/msgpack'

const msgpackCodec = {
  name:   'msgpack',
  encode: (value) => msgpack.encode(value),
  decode: (bytes) => msgpack.decode(bytes),
}

const client = new WebWire(url,  { codec: msgpackCodec })
const server = new WebWireServer({ codec: msgpackCodec })
```

Both sides must use the same codec name. The server picks the codec by intersecting what the client advertises with what the server supports during the handshake. If no overlap exists, the connection is rejected with a protocol error.
