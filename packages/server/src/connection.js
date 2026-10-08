import {
  EventEmitter,
  FrameType,
  encodeFrame, decodeFrame,
  encodeEventPayload, decodeEventPayload,
  encodeRequestPayload, decodeRequestPayload,
  encodeResponsePayload, decodeResponsePayload,
  encodeErrorPayload, decodeErrorPayload,
  encodeClosePayload,
  jsonCodec,
  DEFAULT_REQUEST_TIMEOUT,
  TimeoutError,
  ProtocolError,
} from "@webwire/core";

let nextConnectionId = 1;

const LIFECYCLE_EVENTS = new Set(["error", "close", "connect", "disconnect"]);

export class WireConnection extends EventEmitter {
  /**
   * @param {{
   *   send: (data: Uint8Array) => void,
   *   close: () => void,
   *   codec?: import('@webwire/core').Codec,
   *   requestTimeout?: number,
   *   server: import('./server.js').WebWireServer,
   * }} opts
   */
  constructor(opts) {
    super();
    this.id = nextConnectionId++;
    this._send = opts.send;
    this._close = opts.close;
    this._codec = opts.codec ?? jsonCodec;
    this._server = opts.server;
    this._requestTimeout = opts.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;

    /** @type {unknown} Authenticated user context set after successful auth. */
    this.auth = null;

    /** @type {Map<string, Function>} */
    this._handlers = new Map();
    /** @type {Map<number, { resolve: Function, reject: Function, timer: ReturnType<typeof setTimeout> }>} */
    this._pending = new Map();
    this._nextRequestId = 1;

    /** @type {Uint8Array} */
    this._recvBuffer = new Uint8Array(0);
  }

  /** @param {Uint8Array} chunk */
  onData(chunk) {
    const combined = new Uint8Array(this._recvBuffer.length + chunk.length);
    combined.set(this._recvBuffer);
    combined.set(chunk, this._recvBuffer.length);
    this._recvBuffer = combined;

    while (this._recvBuffer.length > 0) {
      let frame;
      try {
        frame = decodeFrame(this._recvBuffer, 0);
      } catch {
        break; // incomplete frame, wait for more data
      }
      this._recvBuffer = this._recvBuffer.slice(frame.bytesRead);
      this._handleFrame(frame).catch(err => this.emit("error", err));
    }
  }

  /** @param {{ type: number, flags: number, payload: Uint8Array }} frame */
  async _handleFrame({ type, payload }) {
    switch (type) {
      case FrameType.HANDSHAKE:
        break;
      case FrameType.EVENT: {
        const { event, data: encoded } = decodeEventPayload(payload);
        this.emit(event, this._codec.decode(encoded));
        break;
      }
      case FrameType.REQUEST: {
        const { id, event, data: encoded } = decodeRequestPayload(payload);
        const value = this._codec.decode(encoded);
        const handler = this._handlers.get(event);
        if (handler) {
          try {
            const result = await handler(value, this);
            this._sendFrame(FrameType.RESPONSE, encodeResponsePayload(id, this._codec.encode(result ?? null)));
          } catch (err) {
            this._sendFrame(FrameType.ERROR, encodeErrorPayload({
              id,
              code: err.code ?? "HANDLER_ERROR",
              message: err.message,
            }));
          }
        } else {
          this._sendFrame(FrameType.ERROR, encodeErrorPayload({
            id,
            code: "NO_HANDLER",
            message: `No handler registered for "${event}"`,
          }));
        }
        break;
      }
      case FrameType.RESPONSE: {
        const { id, data: encoded } = decodeResponsePayload(payload);
        const pending = this._pending.get(id);
        if (pending) {
          this._pending.delete(id);
          clearTimeout(pending.timer);
          pending.resolve(this._codec.decode(encoded));
        }
        break;
      }
      case FrameType.ERROR: {
        const { id, code, message } = decodeErrorPayload(payload);
        if (id !== undefined) {
          const pending = this._pending.get(id);
          if (pending) {
            this._pending.delete(id);
            clearTimeout(pending.timer);
            pending.reject(new ProtocolError(`${code}: ${message}`));
          }
        }
        break;
      }
      case FrameType.PING:
        this._sendFrame(FrameType.PONG, payload);
        break;
      case FrameType.PONG:
        this.emit("$ww:pong", null);
        break;
      case FrameType.AUTH:
        this.emit("$ww:auth", payload);
        break;
      case FrameType.CLOSE:
        this.emit("close", {});
        break;
    }
  }

  /**
   * Send an event to this client. Application events are sent over the wire
   * and also dispatched locally for server-side listeners.
   * @param {string} event
   * @param {unknown} data
   * @returns {this}
   */
  emit(event, data) {
    if (!event.startsWith("$ww:") && !LIFECYCLE_EVENTS.has(event)) {
      this._sendFrame(FrameType.EVENT, encodeEventPayload(event, this._codec.encode(data)));
      super.emit(event, data);
    } else {
      super.emit(event, data);
    }
    return this;
  }

  /**
   * Register a handler for server-initiated requests from this client.
   * @param {string} event
   * @param {(data: unknown, connection: WireConnection) => Promise<unknown>} handler
   * @returns {this}
   */
  handle(event, handler) {
    this._handlers.set(event, handler);
    return this;
  }

  /**
   * Broadcast an event to all connections via the server.
   * @param {string} event
   * @param {unknown} data
   */
  broadcast(event, data) {
    this._server.broadcast(event, data);
  }

  /**
   * Send a request to the client and await a response.
   * @param {string} event
   * @param {unknown} data
   * @param {number} [timeout]
   * @returns {Promise<unknown>}
   */
  request(event, data, timeout = this._requestTimeout) {
    const id = this._nextId();
    const encoded = this._codec.encode(data);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new TimeoutError(`Request "${event}" timed out`));
      }, timeout);
      this._pending.set(id, { resolve, reject, timer });
      this._sendFrame(FrameType.REQUEST, encodeRequestPayload(id, event, encoded));
    });
  }

  /**
   * @param {number} [code=1000]
   * @param {string} [reason=""]
   */
  close(code = 1000, reason = "") {
    this._sendFrame(FrameType.CLOSE, encodeClosePayload(code, reason));
    this._close();
  }

  ping() {
    this._sendFrame(FrameType.PING, new Uint8Array(0));
  }

  /**
   * @param {number} type
   * @param {Uint8Array} payload
   */
  _sendFrame(type, payload) {
    try {
      this._send(encodeFrame({ type, payload }));
    } catch {
      // connection may already be closed
    }
  }

  /** @returns {number} */
  _nextId() {
    const id = this._nextRequestId;
    this._nextRequestId = (this._nextRequestId + 1) & 0xffffffff || 1;
    return id;
  }
}
