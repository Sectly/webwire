import * as msgpack from '@msgpack/msgpack'

export const msgpackCodec = {
  name:   'msgpack',
  encode: (value) => msgpack.encode(value),
  decode: (bytes) => msgpack.decode(bytes),
}
