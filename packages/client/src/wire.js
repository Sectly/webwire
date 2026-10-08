import {
  EventEmitter,
  FrameType,
  encodeFrame, decodeFrame,
  encodeHandshake, decodeHandshake,
  encodeEventPayload, decodeEventPayload,
  encodeRequestPayload, decodeRequestPayload,
  encodeResponsePayload, decodeResponsePayload,
  encodeErrorPayload, decodeErrorPayload,
  encodeClosePayload, decodeClosePayload,
  jsonCodec,
  PROTOCOL_VERSION,
  DEFAULT_REQUEST_TIMEOUT,
  DEFAULT_RECONNECT_INITIAL,
  DEFAULT_RECONNECT_MAX,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_HEARTBEAT_TIMEOUT,
  TimeoutError,
  AuthError,
  ProtocolError,
  TransportError,
} from "@webwirejs/core";
import { selectTransport } from "./transport-selector.js";

/** @enum {string} */
const States = Object.freeze({
  DISCONNECTED: "disconnected",
  CONNECTING:   "connecting",
  CONNECTED:    "connected",
  RECONNECTING: "reconnecting",
  CLOSING:      "closing",
});

const LIFECYCLE_EVENTS = new Set(["connecting", "connect", "disconnect", "reconnecting", "error"]);

/**
 * @typedef {object} WebWireOptions
 * @property {string[]} [transports] - Transport priority order. Default: `['webtransport', 'websocket', 'polling']`.
 * @property {import('@webwirejs/core').Codec} [codec] - Codec to use. Default: {@link jsonCodec}.
 * @property {false | { enabled: boolean, threshold?: number }} [compression]
 * @property {unknown} [auth] - Auth credentials sent in the handshake.
 * @property {number} [requestTimeout] - Default request timeout in ms.
 * @property {boolean | { initialDelay?: number, maxDelay?: number }} [reconnect]
 * @property {boolean | { interval?: number, timeout?: number }} [heartbeat]
 * @property {unknown} [WebSocket] - Override the WebSocket constructor.
 * @property {unknown} [WebTransport] - Override the WebTransport constructor.
 */

export class WebWire extends EventEmitter {
  /**
   * @param {string} url
   * @param {WebWireOptions} [opts]
   */
  constructor(url, opts = {}) {
    super();
    this._url   = url;
    this._opts  = opts;
    this._codec = opts.codec ?? jsonCodec;
    this._state = States.DISCONNECTED;
    this._transport = null;
    this._transportName = null;

    this._nextRequestId = 1;
    /** @type {Map<number, { resolve: Function, reject: Function, timer: ReturnType<typeof setTimeout> }>} */
    this._pending = new Map();
    this._requestTimeout = opts.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;

    const rc = opts.reconnect;
    this._reconnect        = rc !== false;
    this._reconnectInitial = (rc && typeof rc === "object" ? rc.initialDelay : null) ?? DEFAULT_RECONNECT_INITIAL;
    this._reconnectMax     = (rc && typeof rc === "object" ? rc.maxDelay     : null) ?? DEFAULT_RECONNECT_MAX;
    this._reconnectDelay   = this._reconnectInitial;
    this._reconnectTimer   = null;

    const hb = opts.heartbeat;
    this._heartbeatEnabled  = hb !== false;
    this._heartbeatInterval = (hb && typeof hb === "object" ? hb.interval : null) ?? DEFAULT_HEARTBEAT_INTERVAL;
    this._heartbeatTimeout  = (hb && typeof hb === "object" ? hb.timeout  : null) ?? DEFAULT_HEARTBEAT_TIMEOUT;
    this._heartbeatTimer    = null;
    this._pingTimer         = null;
    this._awaitingPong      = false;

    this._recvBuffer = new Uint8Array(0);
    this._forceTransportReset = false;
  }

  /** @returns {string} One of the {@link States} values. */
  get state() { return this._state; }

  /** @returns {string | null} Active transport name, or null when disconnected. */
  get transport() { return this._transportName; }

  /** @returns {Promise<void>} */
  async connect() {
    if (this._state !== States.DISCONNECTED) return;
    await this._doConnect();
  }

  disconnect() {
    this._state = States.CLOSING;
    this._stopHeartbeat();
    clearTimeout(this._reconnectTimer);
    if (this._transport) {
      this._sendFrame(FrameType.CLOSE, encodeClosePayload(1000, "client disconnect"));
      this._transport.close();
      this._transport = null;
    }
    this._cancelPendingRequests(new TransportError("Disconnected"));
    this._setState(States.DISCONNECTED);
    this.emit("disconnect", { reason: "client disconnect" });
  }

  /**
   * Close the current connection, reset transport selection state, and reconnect
   * starting from the highest-priority transport.
   * @returns {Promise<void>}
   */
  async forceReconnect() {
    this._forceTransportReset = true;
    if (this._transport) {
      this._transport.close();
      this._transport = null;
    }
    this._stopHeartbeat();
    clearTimeout(this._reconnectTimer);
    this._reconnectDelay = this._reconnectInitial;
    await this._doConnect();
  }

  /**
   * Send an event to the server. Lifecycle event names are dispatched locally only.
   * @param {string} event
   * @param {unknown} data
   * @returns {this}
   */
  emit(event, data) {
    if (event.startsWith("$ww:") || LIFECYCLE_EVENTS.has(event)) {
      return super.emit(event, data);
    }
    if (this._state !== States.CONNECTED) {
      throw new TransportError("Not connected");
    }
    const encoded = this._codec.encode(data);
    this._sendFrame(FrameType.EVENT, encodeEventPayload(event, encoded));
    return this;
  }

  /**
   * Send a request to the server and await a typed response.
   * @param {string} event
   * @param {unknown} data
   * @param {number} [timeout]
   * @returns {Promise<unknown>}
   */
  request(event, data, timeout = this._requestTimeout) {
    if (this._state !== States.CONNECTED) {
      return Promise.reject(new TransportError("Not connected"));
    }
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

  /** @returns {Promise<void>} */
  async _doConnect() {
    this._setState(States.CONNECTING);
    this.emit("connecting", {});

    try {
      const transport = await selectTransport(this._url, this._opts);
      this._forceTransportReset = false;
      this._transport = transport;
      this._transportName = transport.name;

      transport.onData(data => this._onData(data));
      transport.onClose((code, reason) => this._onTransportClose(code, reason));
      transport.onError(err => this._onTransportError(err));

      await this._handshake();

      this._reconnectDelay = this._reconnectInitial;
      this._setState(States.CONNECTED);
      this.emit("connect", { transport: this._transportName });
      this._startHeartbeat();
    } catch (err) {
      this._transport = null;
      this._handleConnectError(err);
    }
  }

  /** @returns {Promise<void>} */
  async _handshake() {
    const offer = encodeHandshake({
      version: PROTOCOL_VERSION,
      codecs: [this._codec.name ?? "json"],
      compressionAlgos: [],
      auth: this._opts.auth,
    });
    this._sendFrame(FrameType.HANDSHAKE, offer);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new TimeoutError("Handshake timed out")), 10_000);
      this._pendingHandshake = { resolve, reject, timer };
    });
  }

  /** @param {Uint8Array} chunk */
  _onData(chunk) {
    const combined = new Uint8Array(this._recvBuffer.length + chunk.length);
    combined.set(this._recvBuffer);
    combined.set(chunk, this._recvBuffer.length);
    this._recvBuffer = combined;

    try {
      while (this._recvBuffer.length > 0) {
        let frame;
        try {
          const { type, flags, payload, bytesRead } = decodeFrame(this._recvBuffer, 0);
          frame = { type, flags, payload };
          this._recvBuffer = this._recvBuffer.slice(bytesRead);
        } catch {
          break; // incomplete frame, wait for more data
        }
        this._handleFrame(frame);
      }
    } catch (err) {
      this.emit("$ww:error", err);
    }
  }

  /** @param {{ type: number, flags: number, payload: Uint8Array }} frame */
  _handleFrame({ type, flags, payload }) {
    switch (type) {
      case FrameType.HANDSHAKE: {
        if (this._pendingHandshake) {
          const { resolve, reject, timer } = this._pendingHandshake;
          this._pendingHandshake = null;
          clearTimeout(timer);
          try {
            decodeHandshake(payload);
            resolve();
          } catch (e) {
            reject(e);
          }
        }
        break;
      }
      case FrameType.EVENT: {
        const { event, data: encoded } = decodeEventPayload(payload);
        super.emit(event, this._codec.decode(encoded));
        break;
      }
      case FrameType.REQUEST: {
        const { id, event, data: encoded } = decodeRequestPayload(payload);
        super.emit("$ww:request", { id, event, data: this._codec.decode(encoded) });
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
        } else {
          super.emit("error", new ProtocolError(`${code}: ${message}`));
        }
        break;
      }
      case FrameType.PING:
        this._sendFrame(FrameType.PONG, payload);
        break;
      case FrameType.PONG:
        this._awaitingPong = false;
        clearTimeout(this._pingTimer);
        break;
      case FrameType.AUTH:
        super.emit("$ww:auth", payload);
        break;
      case FrameType.CLOSE: {
        const { code, reason } = decodeClosePayload(payload);
        this._transport?.close();
        this._transport = null;
        this._onTransportClose(code, reason);
        break;
      }
    }
  }

  /**
   * @param {number} code
   * @param {string} reason
   */
  _onTransportClose(code, reason) {
    if (this._state === States.CLOSING) return;
    this._stopHeartbeat();
    this._transport = null;
    this.emit("disconnect", { code, reason });

    // 401/403 means auth was rejected; do not loop reconnects indefinitely.
    if (code === 401 || code === 403) {
      this._cancelPendingRequests(new AuthError(reason));
      this._setState(States.DISCONNECTED);
      return;
    }

    this._cancelPendingRequests(new TransportError("Disconnected"));
    if (this._reconnect) {
      this._scheduleReconnect();
    } else {
      this._setState(States.DISCONNECTED);
    }
  }

  /** @param {Error} err */
  _onTransportError(err) {
    super.emit("error", err);
  }

  _scheduleReconnect() {
    this._setState(States.RECONNECTING);
    this.emit("reconnecting", { delay: this._reconnectDelay });
    this._reconnectTimer = setTimeout(async () => {
      await this._doConnect();
    }, this._reconnectDelay);

    const jitter = Math.random() * 0.2 * this._reconnectDelay;
    this._reconnectDelay = Math.min(this._reconnectDelay * 2 + jitter, this._reconnectMax);
  }

  /** @param {Error} err */
  _handleConnectError(err) {
    super.emit("error", err);
    if (this._reconnect && this._state !== States.CLOSING) {
      this._scheduleReconnect();
    } else {
      this._setState(States.DISCONNECTED);
    }
  }

  _startHeartbeat() {
    if (!this._heartbeatEnabled) return;
    this._heartbeatTimer = setInterval(() => this._sendPing(), this._heartbeatInterval);
  }

  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    clearTimeout(this._pingTimer);
    this._heartbeatTimer = null;
    this._awaitingPong = false;
  }

  _sendPing() {
    if (this._state !== States.CONNECTED) return;
    this._awaitingPong = true;
    this._sendFrame(FrameType.PING, new Uint8Array(0));
    this._pingTimer = setTimeout(() => {
      if (this._awaitingPong) {
        this._transport?.close();
        this._transport = null;
        this._onTransportClose(0, "heartbeat timeout");
      }
    }, this._heartbeatTimeout);
  }

  /**
   * @param {number} type
   * @param {Uint8Array} payload
   */
  _sendFrame(type, payload) {
    if (!this._transport) return;
    this._transport.send(encodeFrame({ type, payload }));
  }

  /** @returns {number} */
  _nextId() {
    const id = this._nextRequestId;
    this._nextRequestId = (this._nextRequestId + 1) & 0xffffffff;
    if (this._nextRequestId === 0) this._nextRequestId = 1;
    return id;
  }

  /** @param {Error} err */
  _cancelPendingRequests(err) {
    for (const { reject, timer } of this._pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this._pending.clear();
  }

  /** @param {string} s */
  _setState(s) {
    this._state = s;
  }
}
