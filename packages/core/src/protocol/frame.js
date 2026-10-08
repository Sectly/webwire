import { encodeVarint, decodeVarint } from "./varint.js";
import { MAX_FRAME_SIZE, FrameFlag } from "./constants.js";
import { ProtocolError } from "../shared/errors.js";

/**
 * Encode a frame to bytes.
 *
 * Wire layout: [ flags: u8 ][ type: u8 ][ length: varint ][ payload: bytes ]
 *
 * @param {{ type: number, flags?: number, payload?: Uint8Array }} frame
 * @returns {Uint8Array}
 */
export function encodeFrame({ type, flags = 0, payload = new Uint8Array(0) }) {
  if (payload.length > MAX_FRAME_SIZE) {
    throw new ProtocolError(`Frame payload exceeds max size (${MAX_FRAME_SIZE})`);
  }
  const lenBytes = encodeVarint(payload.length);
  const out = new Uint8Array(2 + lenBytes.length + payload.length);
  out[0] = flags & 0xff;
  out[1] = type & 0xff;
  out.set(lenBytes, 2);
  out.set(payload, 2 + lenBytes.length);
  return out;
}

/**
 * Decode one frame from a buffer.
 * @param {Uint8Array} buf
 * @param {number} [offset=0]
 * @returns {{ type: number, flags: number, payload: Uint8Array, bytesRead: number }}
 */
export function decodeFrame(buf, offset = 0) {
  if (buf.length - offset < 3) {
    throw new ProtocolError("Frame too short");
  }
  const flags = buf[offset];
  const type  = buf[offset + 1];
  const { value: payloadLen, bytesRead: varintBytes } = decodeVarint(buf, offset + 2);

  if (payloadLen > MAX_FRAME_SIZE) {
    throw new ProtocolError(`Frame payload length ${payloadLen} exceeds max size`);
  }

  const headerSize = 2 + varintBytes;
  const totalSize  = headerSize + payloadLen;

  if (buf.length - offset < totalSize) {
    throw new ProtocolError("Frame payload truncated");
  }

  const payload = buf.slice(offset + headerSize, offset + totalSize);
  return { type, flags, payload, bytesRead: totalSize };
}

/**
 * Returns true if the frame flags include the COMPRESSED bit.
 * @param {number} flags
 * @returns {boolean}
 */
export function isCompressed(flags) {
  return (flags & FrameFlag.COMPRESSED) !== 0;
}

/**
 * Decode all frames from a contiguous buffer.
 * @param {Uint8Array} buf
 * @returns {Array<{ type: number, flags: number, payload: Uint8Array }>}
 */
export function decodeFrames(buf) {
  const frames = [];
  let offset = 0;
  while (offset < buf.length) {
    const frame = decodeFrame(buf, offset);
    frames.push({ type: frame.type, flags: frame.flags, payload: frame.payload });
    offset += frame.bytesRead;
  }
  return frames;
}
