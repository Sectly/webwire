/**
 * @typedef {import('./interface.js').Codec} Codec
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function replacer(_key, value) {
  if (value instanceof Uint8Array) {
    return { $t: "bytes", $v: bytesToBase64(value) };
  }
  return value;
}

function reviver(_key, value) {
  if (value && typeof value === "object" && value.$t === "bytes" && typeof value.$v === "string") {
    return base64ToBytes(value.$v);
  }
  return value;
}

/**
 * Default codec. Serializes JavaScript values to/from UTF-8 JSON.
 *
 * Supported types: string, number, boolean, null, plain objects, arrays.
 * `Uint8Array` is encoded as `{ $t: "bytes", $v: "<base64>" }` and decoded back.
 * Other typed arrays or class instances are encoded with whatever `JSON.stringify` produces.
 *
 * @type {Codec}
 */
export const jsonCodec = {
  name: "json",
  /** @param {unknown} value @returns {Uint8Array} */
  encode(value) {
    return enc.encode(JSON.stringify(value, replacer));
  },
  /** @param {Uint8Array} data @returns {unknown} */
  decode(data) {
    return JSON.parse(dec.decode(data), reviver);
  },
};

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
