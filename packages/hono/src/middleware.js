import { Hono } from "hono";

/**
 * Create a Hono app that handles all WebWire routes (WebSocket + polling).
 *
 * Mount it under your wire path with `app.route('/wire', webwire(...))`.
 *
 * The `upgradeWebSocket` function must come from your runtime's Hono adapter:
 * - Bun:     `import { createBunWebSocket } from 'hono/bun'`
 * - Node.js: `import { createNodeWebSocket } from '@hono/node-server/ws'`
 * - Deno:    `import { upgradeWebSocket } from 'hono/deno'`
 *
 * @example
 * // Bun
 * import { createBunWebSocket } from 'hono/bun'
 * const { upgradeWebSocket, websocket } = createBunWebSocket()
 * app.route('/wire', webwire(wireServer, upgradeWebSocket))
 * Bun.serve({ fetch: app.fetch, websocket })
 *
 * @example
 * // Node.js
 * import { createNodeWebSocket } from '@hono/node-server/ws'
 * const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })
 * app.route('/wire', webwire(wireServer, upgradeWebSocket))
 * const server = serve({ fetch: app.fetch, port: 3000 })
 * injectWebSocket(server)
 *
 * @param {import('@webwirejs/server').WebWireServer} wireServer
 * @param {Function} upgradeWebSocket - Runtime-specific upgrade helper from Hono.
 * @returns {Hono}
 */
export function webwire(wireServer, upgradeWebSocket) {
  const app = new Hono();

  app.get(
    "/",
    upgradeWebSocket((c) => {
      let wsRef = null;
      const handler = wireServer.createConnection(
        (data) => wsRef?.send(data),
        () => wsRef?.close(),
        c.req.raw,
      );

      return {
        onOpen(_event, ws) {
          wsRef = ws;
        },
        async onMessage(event, ws) {
          wsRef = ws;
          const bytes = toBytes(event.data);
          await handler.onData(bytes);
        },
        onClose() {
          handler.onClose();
        },
        onError(event) {
          handler.onClose();
        },
      };
    }),
  );

  app.post("/connect", (c) => wireServer.handleRequest(c.req.raw));
  app.get("/poll",    (c) => wireServer.handleRequest(c.req.raw));
  app.post("/send",   (c) => wireServer.handleRequest(c.req.raw));

  return app;
}

/**
 * @param {string | ArrayBuffer | ArrayBufferView} data
 * @returns {Uint8Array}
 */
function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new TextEncoder().encode(String(data));
}
