/**
 * @typedef {object} Compressor
 * @property {string} name - Identifier used in handshake negotiation.
 * @property {(bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>} compress
 * @property {(bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>} decompress
 */

/**
 * Returns true if the given object satisfies the {@link Compressor} interface.
 * @param {unknown} compressor
 * @returns {compressor is Compressor}
 */
export function isCompressor(compressor) {
  return (
    compressor !== null &&
    typeof compressor === "object" &&
    typeof compressor.name === "string" &&
    typeof compressor.compress === "function" &&
    typeof compressor.decompress === "function"
  );
}
