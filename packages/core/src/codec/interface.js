/**
 * @typedef {object} Codec
 * @property {string} name - Identifier used in handshake negotiation.
 * @property {(value: unknown) => Uint8Array} encode
 * @property {(data: Uint8Array) => unknown} decode
 */

/**
 * Returns true if the given object satisfies the {@link Codec} interface.
 * @param {unknown} codec
 * @returns {codec is Codec}
 */
export function isCodec(codec) {
  return (
    codec !== null &&
    typeof codec === "object" &&
    typeof codec.name === "string" &&
    typeof codec.encode === "function" &&
    typeof codec.decode === "function"
  );
}
