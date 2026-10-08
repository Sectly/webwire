/**
 * Encode/decode helpers for each frame type's payload.
 *
 * Codec-encoded data bytes are carried as base64 inside the JSON envelope so
 * they survive the JSON round-trip without corruption.
 */

import { MAX_EVENT_NAME_LEN } from "./constants.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

const j = v => enc.encode(JSON.stringify(v));
const p = b => JSON.parse(dec.decode(b));

function assertEventName(name) {
  if (typeof name !== "string" || name.length === 0 || name.length > MAX_EVENT_NAME_LEN) {
    throw new RangeError(`Event name must be 1-${MAX_EVENT_NAME_LEN} characters`);
  }
}

/**
 * @param {string} event
 * @param {Uint8Array} encodedData - codec-encoded value bytes
 * @returns {Uint8Array}
 */
export function encodeEventPayload(event, encodedData) {
  return j({ e: event, d: bytesToBase64(encodedData) });
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ event: string, data: Uint8Array }}
 */
export function decodeEventPayload(bytes) {
  const { e, d } = p(bytes);
  assertEventName(e);
  return { event: e, data: base64ToBytes(d) };
}

/**
 * @param {number} id
 * @param {string} event
 * @param {Uint8Array} encodedData
 * @returns {Uint8Array}
 */
export function encodeRequestPayload(id, event, encodedData) {
  return j({ i: id, e: event, d: bytesToBase64(encodedData) });
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ id: number, event: string, data: Uint8Array }}
 */
export function decodeRequestPayload(bytes) {
  const { i, e, d } = p(bytes);
  assertEventName(e);
  return { id: i, event: e, data: base64ToBytes(d) };
}

/**
 * @param {number} id
 * @param {Uint8Array} encodedData
 * @returns {Uint8Array}
 */
export function encodeResponsePayload(id, encodedData) {
  return j({ i: id, d: bytesToBase64(encodedData) });
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ id: number, data: Uint8Array }}
 */
export function decodeResponsePayload(bytes) {
  const { i, d } = p(bytes);
  return { id: i, data: base64ToBytes(d) };
}

/**
 * @param {{ id?: number, code: string, message: string }} opts
 * @returns {Uint8Array}
 */
export function encodeErrorPayload({ id, code, message }) {
  const obj = { c: code, m: message };
  if (id !== undefined) obj.i = id;
  return j(obj);
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ id: number | undefined, code: string, message: string }}
 */
export function decodeErrorPayload(bytes) {
  const { i, c, m } = p(bytes);
  return { id: i, code: c, message: m };
}

/**
 * @param {unknown} auth
 * @returns {Uint8Array}
 */
export function encodeAuthPayload(auth) {
  return j(auth);
}

/**
 * @param {Uint8Array} bytes
 * @returns {unknown}
 */
export function decodeAuthPayload(bytes) {
  return p(bytes);
}

/**
 * @param {number} code
 * @param {string} reason
 * @returns {Uint8Array}
 */
export function encodeClosePayload(code, reason) {
  return j({ c: code, r: reason });
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ code: number, reason: string }}
 */
export function decodeClosePayload(bytes) {
  const { c, r } = p(bytes);
  return { code: c, reason: r };
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function base64ToBytes(b64) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
