import { PROTOCOL_VERSION } from "./constants.js";
import { ProtocolError } from "../shared/errors.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encode a handshake payload.
 * @param {{
 *   version?: number,
 *   codecs?: string[],
 *   compressionAlgos?: string[],
 *   auth?: unknown
 * }} [opts]
 * @returns {Uint8Array}
 */
export function encodeHandshake({ version = PROTOCOL_VERSION, codecs = ["json"], compressionAlgos = [], auth } = {}) {
  const obj = { version, codecs, compressionAlgos };
  if (auth !== undefined) obj.auth = auth;
  return encoder.encode(JSON.stringify(obj));
}

/**
 * Decode a handshake payload.
 * @param {Uint8Array} bytes
 * @returns {{ version: number, codecs: string[], compressionAlgos: string[], auth?: unknown }}
 */
export function decodeHandshake(bytes) {
  let obj;
  try {
    obj = JSON.parse(decoder.decode(bytes));
  } catch {
    throw new ProtocolError("Invalid handshake payload");
  }
  if (typeof obj.version !== "number") {
    throw new ProtocolError("Handshake missing version");
  }
  return {
    version: obj.version,
    codecs: Array.isArray(obj.codecs) ? obj.codecs : ["json"],
    compressionAlgos: Array.isArray(obj.compressionAlgos) ? obj.compressionAlgos : [],
    auth: obj.auth,
  };
}

/**
 * Negotiate the first mutually supported codec and compression algorithm.
 * @param {{ codecs: string[], compressionAlgos: string[] }} clientOffer
 * @param {{ codecs: string[], compressionAlgos: string[] }} serverSupport
 * @returns {{ codec: string, compressionAlgo: string | null }}
 */
export function negotiate(clientOffer, serverSupport) {
  const codec = clientOffer.codecs.find(c => serverSupport.codecs.includes(c));
  if (!codec) throw new ProtocolError("No mutually supported codec");

  const compressionAlgo = clientOffer.compressionAlgos.find(a => serverSupport.compressionAlgos.includes(a)) ?? null;

  return { codec, compressionAlgo };
}
