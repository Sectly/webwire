/**
 * @typedef {object} Transport
 * @property {string} name - One of `'webtransport'`, `'websocket'`, `'polling'`.
 * @property {() => Promise<void>} connect
 * @property {(data: Uint8Array) => void | Promise<void>} send
 * @property {() => void} close
 * @property {(callback: (data: Uint8Array) => void) => void} onData
 * @property {(callback: (code: number, reason: string) => void) => void} onClose
 * @property {(callback: (err: Error) => void) => void} onError
 */

/**
 * Returns true if the given object satisfies the {@link Transport} interface.
 * @param {unknown} transport
 * @returns {transport is Transport}
 */
export function isTransport(transport) {
  return (
    transport !== null &&
    typeof transport === "object" &&
    typeof transport.connect === "function" &&
    typeof transport.send === "function" &&
    typeof transport.close === "function" &&
    typeof transport.onData === "function" &&
    typeof transport.onClose === "function" &&
    typeof transport.onError === "function" &&
    typeof transport.name === "string"
  );
}
