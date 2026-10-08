import { TransportError } from "@webwirejs/core";

export class WebSocketTransport {
  name = "websocket";

  /**
   * @param {string} url
   * @param {{ WebSocket?: typeof WebSocket }} [opts]
   */
  constructor(url, opts = {}) {
    this._url = url.replace(/^http/, "ws");
    this._WS = opts.WebSocket ?? globalThis.WebSocket;
    this._ws = null;
    this._onData = null;
    this._onClose = null;
    this._onError = null;
  }

  /**
   * @param {{ WebSocket?: typeof WebSocket }} [opts]
   * @returns {boolean}
   */
  static isAvailable(opts = {}) {
    return !!(opts.WebSocket ?? globalThis.WebSocket);
  }

  /** @returns {Promise<void>} */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new this._WS(this._url);
      ws.binaryType = "arraybuffer";
      this._ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = (e) => {
        const err = new TransportError(`WebSocket error: ${e.message ?? "unknown"}`);
        reject(err);
        this._onError?.(err);
      };
      ws.onclose = (e) => this._onClose?.(e.code, e.reason);
      ws.onmessage = (e) => {
        const data = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data;
        this._onData?.(data);
      };
    });
  }

  /** @param {Uint8Array} data */
  send(data) {
    if (!this._ws || this._ws.readyState !== this._WS.OPEN) {
      throw new TransportError("WebSocket not connected");
    }
    this._ws.send(data);
  }

  close() {
    this._ws?.close();
    this._ws = null;
  }

  /** @param {(data: Uint8Array) => void} cb */
  onData(cb)  { this._onData  = cb; }
  /** @param {(code: number, reason: string) => void} cb */
  onClose(cb) { this._onClose = cb; }
  /** @param {(err: Error) => void} cb */
  onError(cb) { this._onError = cb; }
}
