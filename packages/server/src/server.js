import {
  EventEmitter,
  FrameType,
  encodeFrame, decodeFrame,
  encodeHandshake, decodeHandshake, negotiate,
  encodeEventPayload,
  jsonCodec,
  PROTOCOL_VERSION,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_HEARTBEAT_TIMEOUT,
  MAX_EVENT_NAME_LEN,
  AuthError,
  ProtocolError,
} from "@webwirejs/core";
import { WireConnection } from "./connection.js";

/**
 * @typedef {object} WebWireServerOptions
 * @property {import('@webwirejs/core').Codec} [codec]
 * @property {(ctx: { token?: unknown, request?: unknown }) => Promise<unknown>} [authenticate]
 * @property {boolean | { interval?: number, timeout?: number }} [heartbeat]
 * @property {number} [requestTimeout]
 */

/**
 * @typedef {object} ConnectionHandler
 * @property {(bytes: Uint8Array) => Promise<void>} onData - Feed incoming bytes into the connection.
 * @property {() => void} onClose - Call when the underlying transport closes.
 * @property {(err: Error) => void} onError - Forward transport-level errors to the connection.
 */

export class WebWireServer extends EventEmitter {
  /** @param {WebWireServerOptions} [opts] */
  constructor(opts = {}) {
    super();
    this._opts = opts;
    this._codec = opts.codec ?? jsonCodec;
    this._authenticate = opts.authenticate ?? null;

    const hb = opts.heartbeat;
    this._heartbeatEnabled  = hb !== false;
    this._heartbeatInterval = (hb && typeof hb === "object" ? hb.interval : null) ?? DEFAULT_HEARTBEAT_INTERVAL;
    this._heartbeatTimeout  = (hb && typeof hb === "object" ? hb.timeout  : null) ?? DEFAULT_HEARTBEAT_TIMEOUT;

    /** @type {Set<WireConnection>} */
    this._connections = new Set();

    this._heartbeatTimer = setInterval(() => this._checkHeartbeats(), this._heartbeatInterval);
  }

  /**
   * Broadcast an event to all connected clients.
   * @param {string} event
   * @param {unknown} data
   */
  broadcast(event, data) {
    const frame = encodeFrame({
      type: FrameType.EVENT,
      payload: encodeEventPayload(event, this._codec.encode(data)),
    });
    for (const conn of this._connections) {
      try { conn._send(frame); } catch {}
    }
  }

  /**
   * Attach to a Node.js `http.Server` to handle WebSocket upgrades.
   * @param {import('http').Server} httpServer
   */
  attach(httpServer) {
    httpServer.on("upgrade", async (req, socket, head) => {
      await this._handleUpgrade(req, socket, head);
    });
  }

  /**
   * Handle a Fetch API `Request`. Returns a `Response` for polling routes,
   * or `null` if the request is not a WebWire route.
   * @param {Request} req
   * @returns {Promise<Response | null>}
   */
  async handleRequest(req) {
    const url = new URL(req.url);

    if (url.pathname.endsWith("/connect") && req.method === "POST") {
      return this._handlePollingConnect(req);
    }
    if (url.pathname.endsWith("/poll") && req.method === "GET") {
      return this._handlePollingPoll(req);
    }
    if (url.pathname.endsWith("/send") && req.method === "POST") {
      return this._handlePollingSend(req);
    }
    return null;
  }

  /**
   * Create a connection handler for an arbitrary transport.
   *
   * This is the integration point for framework adapters. The caller supplies
   * `send` and `close` callbacks, then feeds incoming bytes through the
   * returned `onData`. The first call to `onData` is expected to carry the
   * WebWire handshake frame; subsequent calls carry normal frames.
   *
   * @param {(data: Uint8Array) => void} send - Write bytes to the remote peer.
   * @param {() => void} close - Close the underlying transport.
   * @param {unknown} [req] - Original HTTP request, passed to the `authenticate` hook.
   * @returns {ConnectionHandler}
   */
  createConnection(send, close, req) {
    let conn = null;
    let handshakeDone = false;

    const onData = async (bytes) => {
      if (!handshakeDone) {
        try {
          conn = await this._doHandshake(bytes, send, close, req);
          handshakeDone = true;
          this._connections.add(conn);
          this.emit("connection", conn);
        } catch (err) {
          close();
        }
        return;
      }
      conn?.onData(bytes);
    };

    const onClose = () => {
      if (conn) {
        this._connections.delete(conn);
        conn.emit("disconnect", {});
        conn = null;
      }
    };

    const onError = (err) => conn?.emit("error", err);

    return { onData, onClose, onError };
  }

  /** @param {import('http').IncomingMessage} req @param {import('net').Socket} socket @param {Buffer} head */
  async _handleUpgrade(req, socket, head) {
    let WebSocketServer;
    try {
      ({ WebSocketServer } = await import("ws"));
    } catch {
      socket.destroy();
      return;
    }

    if (!this._wss) {
      this._wss = new WebSocketServer({ noServer: true });
    }

    this._wss.handleUpgrade(req, socket, head, (ws) => {
      this._acceptWebSocket(ws, req);
    });
  }

  /**
   * @param {import('ws').WebSocket} ws
   * @param {import('http').IncomingMessage} req
   */
  _acceptWebSocket(ws, req) {
    ws.binaryType = "nodebuffer";

    const handler = this.createConnection(
      (data) => ws.send(data),
      () => ws.close(),
      req,
    );

    ws.on("message", async (raw) => {
      const bytes = raw instanceof Buffer ? new Uint8Array(raw) : raw;
      await handler.onData(bytes);
    });

    ws.on("close", () => handler.onClose());
    ws.on("error", (err) => handler.onError(err));
  }

  /**
   * @param {Uint8Array} data
   * @param {(data: Uint8Array) => void} send
   * @param {() => void} close
   * @param {unknown} req
   * @returns {Promise<WireConnection>}
   */
  async _doHandshake(data, send, close, req) {
    let frame;
    try {
      frame = decodeFrame(data, 0);
    } catch {
      throw new ProtocolError("Invalid handshake frame");
    }
    if (frame.type !== FrameType.HANDSHAKE) {
      throw new ProtocolError(`Expected HANDSHAKE frame, got type ${frame.type}`);
    }
    let offer;
    try {
      offer = decodeHandshake(frame.payload);
    } catch {
      throw new ProtocolError("Invalid handshake");
    }

    if (offer.version !== PROTOCOL_VERSION) {
      throw new ProtocolError(`Unsupported protocol version ${offer.version}`);
    }

    let negotiated;
    try {
      negotiated = negotiate(offer, {
        codecs: [this._codec.name ?? "json"],
        compressionAlgos: [],
      });
    } catch {
      throw new ProtocolError("No mutually supported codec");
    }

    let authContext = null;
    if (this._authenticate) {
      try {
        authContext = await this._authenticate({ token: offer.auth, request: req });
      } catch (err) {
        throw new AuthError(err.message ?? "Authentication failed");
      }
    }

    send(encodeFrame({
      type: FrameType.HANDSHAKE,
      payload: encodeHandshake({
        version: PROTOCOL_VERSION,
        codecs: [negotiated.codec],
        compressionAlgos: negotiated.compressionAlgo ? [negotiated.compressionAlgo] : [],
      }),
    }));

    const conn = new WireConnection({ send, close, codec: this._codec, server: this });
    conn.auth = authContext;
    return conn;
  }

  _pollingSessions = new Map();

  /** @param {Request} req @returns {Promise<Response>} */
  async _handlePollingConnect(req) {
    const sessionId = randomId();
    const session = { queue: [], waiters: [], conn: null, req };

    session.send = (data) => {
      if (session.waiters.length > 0) {
        session.waiters.shift().resolve(data);
      } else {
        session.queue.push(data);
      }
    };

    // Reap sessions that never complete the handshake within 60 s.
    session._ttlTimer = setTimeout(() => {
      if (!session.conn) {
        this._pollingSessions.delete(sessionId);
        for (const w of session.waiters) {
          w.resolve(new Uint8Array(0));
        }
        session.waiters.length = 0;
      }
    }, 60_000);

    this._pollingSessions.set(sessionId, session);

    return new Response(JSON.stringify({ sessionId }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /** @param {Request} req @returns {Promise<Response>} */
  async _handlePollingPoll(req) {
    const sessionId = req.headers.get("X-WebWire-Session");
    const session = this._pollingSessions.get(sessionId);
    if (!session) return new Response(null, { status: 410 });

    if (session.queue.length > 0) {
      const data = session.queue.shift();
      return new Response(data, { headers: { "Content-Type": "application/octet-stream" } });
    }

    return new Promise((resolve) => {
      const waiter = {
        resolve: (data) => resolve(new Response(data, { headers: { "Content-Type": "application/octet-stream" } })),
      };
      session.waiters.push(waiter);
      setTimeout(() => {
        const idx = session.waiters.indexOf(waiter);
        if (idx !== -1) session.waiters.splice(idx, 1);
        resolve(new Response(new Uint8Array(0), { headers: { "Content-Type": "application/octet-stream" } }));
      }, 30_000);
    });
  }

  /** @param {Request} req @returns {Promise<Response>} */
  async _handlePollingSend(req) {
    const sessionId = req.headers.get("X-WebWire-Session");
    const session = this._pollingSessions.get(sessionId);
    if (!session) return new Response(null, { status: 410 });

    const body = new Uint8Array(await req.arrayBuffer());

    if (!session.conn) {
      try {
        session.conn = await this._doHandshake(
          body,
          session.send,
          () => this._pollingSessions.delete(sessionId),
          req,
        );
        clearTimeout(session._ttlTimer);
        this._connections.add(session.conn);
        this.emit("connection", session.conn);
      } catch (err) {
        clearTimeout(session._ttlTimer);
        this._pollingSessions.delete(sessionId);
        return new Response(err.message, { status: 400 });
      }
    } else {
      session.conn.onData(body);
    }

    return new Response(null, { status: 204 });
  }

  _checkHeartbeats() {
    if (!this._heartbeatEnabled) return;
    for (const conn of this._connections) {
      conn._awaitingPong = true;
      conn.ping();
      conn._pingTimer = setTimeout(() => {
        if (conn._awaitingPong) {
          this._connections.delete(conn);
          conn._close();
          conn.emit("disconnect", { reason: "heartbeat timeout" });
        }
      }, this._heartbeatTimeout);

      conn.once("$ww:pong", () => {
        conn._awaitingPong = false;
        clearTimeout(conn._pingTimer);
      });
    }
  }

  /** Gracefully close all connections and stop the heartbeat timer. */
  stop() {
    clearInterval(this._heartbeatTimer);
    for (const conn of this._connections) {
      conn.close(1001, "server shutting down");
    }
    this._connections.clear();
    for (const session of this._pollingSessions.values()) {
      clearTimeout(session._ttlTimer);
      for (const w of session.waiters) w.resolve(new Uint8Array(0));
    }
    this._pollingSessions.clear();
  }
}

/** @returns {string} */
function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
