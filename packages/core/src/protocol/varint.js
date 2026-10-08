/**
 * Encode a non-negative integer as an unsigned LEB128 varint.
 * @param {number} value
 * @returns {Uint8Array}
 */
export function encodeVarint(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

/**
 * Decode an unsigned LEB128 varint from a buffer at the given offset.
 * @param {Uint8Array} buf
 * @param {number} [offset=0]
 * @returns {{ value: number, bytesRead: number }}
 */
export function decodeVarint(buf, offset = 0) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  while (offset + bytesRead < buf.length) {
    const byte = buf[offset + bytesRead];
    bytesRead++;
    value = (value | ((byte & 0x7f) << shift)) >>> 0;
    shift += 7;
    if ((byte & 0x80) === 0) return { value, bytesRead };
    if (shift >= 35) throw new Error("Varint overflow");
  }
  throw new Error("Varint truncated");
}
