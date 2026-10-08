import { describe, it, expect, afterEach } from "bun:test";
import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import WebSocket from "ws";
import { WebWireServer } from "@webwire/server";
import { webwire } from "../src/plugin.js";
import {
  encodeFrame,
  encodeHandshake,
  decodeFrame,
  FrameType,
  PROTOCOL_VERSION,
} from "@webwire/core";

async function buildApp(wireServer) {
  const fastify = Fastify({ logger: false });
  await fastify.register(websocketPlugin);
  await fastify.register(webwire, { wireServer });
  return fastify;
}

describe("@webwire/fastify plugin", () => {
  let fastify;

  afterEach(() => fastify?.close());

  it("POST /connect returns sessionId", async () => {
    const wire = new WebWireServer();
    fastify = await buildApp(wire);

    const res = await fastify.inject({ method: "POST", url: "/connect" });
    expect(res.statusCode).toBe(200);
    const { sessionId } = JSON.parse(res.body);
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it("GET /poll with unknown session → 410", async () => {
    const wire = new WebWireServer();
    fastify = await buildApp(wire);

    const res = await fastify.inject({
      method: "GET",
      url: "/poll",
      headers: { "X-WebWire-Session": "bogus" },
    });
    expect(res.statusCode).toBe(410);
  });

  it("POST /send with unknown session → 410", async () => {
    const wire = new WebWireServer();
    fastify = await buildApp(wire);

    const res = await fastify.inject({
      method: "POST",
      url: "/send",
      headers: { "X-WebWire-Session": "bogus" },
      body: Buffer.alloc(0),
    });
    expect(res.statusCode).toBe(410);
  });

  it("WebSocket handshake fires 'connection' and server sends HANDSHAKE response", async () => {
    const wire = new WebWireServer();
    const connPromise = new Promise((resolve) => wire.once("connection", resolve));

    fastify = await buildApp(wire);
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const port = fastify.server.address().port;

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const receivedFrames = [];
    ws.on("message", (raw) => receivedFrames.push(new Uint8Array(raw)));

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

    // Wait briefly for the HANDSHAKE response frame to arrive.
    await new Promise((r) => setTimeout(r, 50));
    expect(receivedFrames.length).toBeGreaterThan(0);
    const { type } = decodeFrame(receivedFrames[0], 0);
    expect(type).toBe(FrameType.HANDSHAKE);

    ws.close();
  });

  it("polling: full session connect → send handshake → connection fired", async () => {
    const wire = new WebWireServer();
    const connPromise = new Promise((resolve) => wire.once("connection", resolve));

    fastify = await buildApp(wire);

    const connectRes = await fastify.inject({ method: "POST", url: "/connect" });
    const { sessionId } = JSON.parse(connectRes.body);

    const offer = encodeHandshake({
      version: PROTOCOL_VERSION,
      codecs: ["json"],
      compressionAlgos: [],
    });
    const frame = encodeFrame({ type: FrameType.HANDSHAKE, payload: offer });

    const sendRes = await fastify.inject({
      method: "POST",
      url: "/send",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-WebWire-Session": sessionId,
      },
      body: Buffer.from(frame),
    });
    expect(sendRes.statusCode).toBe(204);

    const conn = await connPromise;
    expect(conn).toBeDefined();
  });
});
