import { describe, it, expect, afterEach } from "bun:test";
import http from "http";
import express from "express";
import WebSocket from "ws";
import { WebWireServer } from "@webwirejs/server";
import { webwire } from "../src/middleware.js";
import {
  encodeFrame,
  encodeHandshake,
  FrameType,
  PROTOCOL_VERSION,
} from "@webwirejs/core";

function startServer(wireServer) {
  const app = express();
  app.use(webwire(wireServer));
  const server = http.createServer(app);
  return new Promise((resolve) =>
    server.listen(0, () => resolve({ server, port: server.address().port }))
  );
}

describe("@webwirejs/express middleware", () => {
  let server;

  afterEach(() => new Promise((r) => (server ? server.close(r) : r())));

  it("POST /connect returns sessionId", async () => {
    const wire = new WebWireServer();
    ({ server } = await startServer(wire));

    const res = await fetch(`http://localhost:${server.address().port}/connect`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const { sessionId } = await res.json();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it("GET /poll with unknown session → 410", async () => {
    const wire = new WebWireServer();
    ({ server } = await startServer(wire));

    const res = await fetch(`http://localhost:${server.address().port}/poll`, {
      headers: { "X-WebWire-Session": "bogus" },
    });
    expect(res.status).toBe(410);
  });

  it("POST /send with unknown session → 410", async () => {
    const wire = new WebWireServer();
    ({ server } = await startServer(wire));

    const res = await fetch(`http://localhost:${server.address().port}/send`, {
      method: "POST",
      headers: { "X-WebWire-Session": "bogus" },
      body: new Uint8Array(0),
    });
    expect(res.status).toBe(410);
  });

  it("WebSocket handshake fires 'connection' event", async () => {
    const wire = new WebWireServer();
    const connPromise = new Promise((resolve) => wire.once("connection", resolve));

    ({ server } = await startServer(wire));
    const port = server.address().port;

    // One HTTP request triggers wireServer.attach() on the express server.
    await fetch(`http://localhost:${port}/connect`, { method: "POST" });

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const offer = encodeHandshake({
      version: PROTOCOL_VERSION,
      codecs: ["json"],
      compressionAlgos: [],
    });
    ws.send(encodeFrame({ type: FrameType.HANDSHAKE, payload: offer }));

    const conn = await connPromise;
    expect(conn).toBeDefined();
    ws.close();
  });

  it("polling: full session connect → send handshake → connection fired", async () => {
    const wire = new WebWireServer();
    const connPromise = new Promise((resolve) => wire.once("connection", resolve));

    ({ server } = await startServer(wire));
    const port = server.address().port;

    const { sessionId } = await fetch(`http://localhost:${port}/connect`, {
      method: "POST",
    }).then((r) => r.json());

    const offer = encodeHandshake({
      version: PROTOCOL_VERSION,
      codecs: ["json"],
      compressionAlgos: [],
    });
    const frame = encodeFrame({ type: FrameType.HANDSHAKE, payload: offer });

    const sendRes = await fetch(`http://localhost:${port}/send`, {
      method: "POST",
      headers: { "X-WebWire-Session": sessionId },
      body: frame,
    });
    expect(sendRes.status).toBe(204);

    const conn = await connPromise;
    expect(conn).toBeDefined();
  });
});
