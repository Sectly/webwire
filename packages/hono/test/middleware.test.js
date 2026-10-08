import { describe, it, expect } from "bun:test";
import { WebWireServer } from "@webwire/server";
import { webwire } from "../src/middleware.js";
import {
  encodeFrame,
  encodeHandshake,
  decodeFrame,
  FrameType,
  PROTOCOL_VERSION,
} from "@webwire/core";

/**
 * Minimal upgradeWebSocket mock that synchronously invokes onOpen then
 * returns the handlers object so callers can drive onMessage / onClose.
 */
function makeUpgradeWS() {
  const captured = { handlers: null, ws: null };

  const mockWs = {
    _sent: [],
    send(data) { this._sent.push(data); },
    close() {},
  };

  function upgradeWebSocket(factory) {
    return async (c) => {
      captured.handlers = factory(c);
      captured.ws = mockWs;
      await captured.handlers.onOpen?.(null, mockWs);
      return new Response(null, { status: 101 });
    };
  }

  return { upgradeWebSocket, captured, mockWs };
}

describe("@webwire/hono middleware", () => {
  it("POST /connect returns sessionId", async () => {
    const wire = new WebWireServer();
    const { upgradeWebSocket } = makeUpgradeWS();
    const app = webwire(wire, upgradeWebSocket);

    const res = await app.fetch(
      new Request("http://localhost/connect", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const { sessionId } = await res.json();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it("GET /poll with unknown session → 410", async () => {
    const wire = new WebWireServer();
    const { upgradeWebSocket } = makeUpgradeWS();
    const app = webwire(wire, upgradeWebSocket);

    const res = await app.fetch(
      new Request("http://localhost/poll", {
        headers: { "X-WebWire-Session": "bogus" },
      })
    );
    expect(res.status).toBe(410);
  });

  it("POST /send with unknown session → 410", async () => {
    const wire = new WebWireServer();
    const { upgradeWebSocket } = makeUpgradeWS();
    const app = webwire(wire, upgradeWebSocket);

    const res = await app.fetch(
      new Request("http://localhost/send", {
        method: "POST",
        headers: { "X-WebWire-Session": "bogus" },
        body: new Uint8Array(0),
      })
    );
    expect(res.status).toBe(410);
  });

  it("WebSocket handshake fires 'connection' and server sends HANDSHAKE response", async () => {
    const wire = new WebWireServer();
    const connPromise = new Promise((resolve) => wire.once("connection", resolve));

    const { upgradeWebSocket, captured, mockWs } = makeUpgradeWS();
    const app = webwire(wire, upgradeWebSocket);

    // Trigger the WS upgrade route (mocked - returns 101).
    await app.fetch(new Request("http://localhost/"));

    const offer = encodeHandshake({
      version: PROTOCOL_VERSION,
      codecs: ["json"],
      compressionAlgos: [],
    });
    const frame = encodeFrame({ type: FrameType.HANDSHAKE, payload: offer });

    await captured.handlers.onMessage({ data: frame }, mockWs);

    const conn = await connPromise;
    expect(conn).toBeDefined();

    // Server should have responded with a HANDSHAKE frame.
    expect(mockWs._sent.length).toBeGreaterThan(0);
    const { type } = decodeFrame(mockWs._sent[0], 0);
    expect(type).toBe(FrameType.HANDSHAKE);
  });

  it("polling: full session connect → send handshake → connection fired", async () => {
    const wire = new WebWireServer();
    const connPromise = new Promise((resolve) => wire.once("connection", resolve));

    const { upgradeWebSocket } = makeUpgradeWS();
    const app = webwire(wire, upgradeWebSocket);

    const connectRes = await app.fetch(
      new Request("http://localhost/connect", { method: "POST" })
    );
    const { sessionId } = await connectRes.json();

    const offer = encodeHandshake({
      version: PROTOCOL_VERSION,
      codecs: ["json"],
      compressionAlgos: [],
    });
    const frame = encodeFrame({ type: FrameType.HANDSHAKE, payload: offer });

    const sendRes = await app.fetch(
      new Request("http://localhost/send", {
        method: "POST",
        headers: { "X-WebWire-Session": sessionId },
        body: frame,
      })
    );
    expect(sendRes.status).toBe(204);

    const conn = await connPromise;
    expect(conn).toBeDefined();
  });
});
