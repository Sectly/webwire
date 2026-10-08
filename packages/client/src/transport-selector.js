import { WebTransportTransport } from "./transports/webtransport.js";
import { WebSocketTransport } from "./transports/websocket.js";
import { PollingTransport } from "./transports/polling.js";
import { TransportError } from "@webwirejs/core";

const ALL = ["webtransport", "websocket", "polling"];

/**
 * Try each transport in priority order and return the first one that connects.
 * @param {string} url
 * @param {{
 *   transports?: string[],
 *   WebSocket?: unknown,
 *   WebTransport?: unknown
 * }} [opts]
 * @returns {Promise<WebSocketTransport | WebTransportTransport | PollingTransport>}
 */
export async function selectTransport(url, opts = {}) {
  const priority = opts.transports ?? ALL;
  const errors = [];

  for (const name of priority) {
    if (!ALL.includes(name)) continue;
    const transport = createTransport(name, url, opts);
    if (!transport) continue;
    try {
      await transport.connect();
      return transport;
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new TransportError(`All transports failed:\n  ${errors.join("\n  ")}`);
}

/**
 * @param {string} name
 * @param {string} url
 * @param {object} opts
 * @returns {WebSocketTransport | WebTransportTransport | PollingTransport | null}
 */
function createTransport(name, url, opts) {
  switch (name) {
    case "webtransport":
      if (!WebTransportTransport.isAvailable(opts)) return null;
      return new WebTransportTransport(url, opts);
    case "websocket":
      if (!WebSocketTransport.isAvailable(opts)) return null;
      return new WebSocketTransport(url, opts);
    case "polling":
      if (!PollingTransport.isAvailable()) return null;
      return new PollingTransport(url);
    default:
      return null;
  }
}
