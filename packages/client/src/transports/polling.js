import { TransportError } from "@webwirejs/core";

const POLL_PATH = "/poll";
const SEND_PATH = "/send";

export class PollingTransport {
  name = "polling";

  /**
   * @param {string} baseUrl - e.g. `https://example.com/wire`
   */
  constructor(baseUrl) {
    this._base = baseUrl.replace(/\/$/, "");
    this._sessionId = null;
    this._active = false;
    this._onData = null;
    this._onClose = null;
    this._onError = null;
  }

  /** @returns {boolean} */
  static isAvailable() {
    return typeof globalThis.fetch === "function";
  }

  /** @returns {Promise<void>} */
  async connect() {
    const res = await fetch(this._base + "/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transport: "polling" }),
    });
    if (!res.ok) throw new TransportError(`Polling connect failed: ${res.status}`);
    const { sessionId } = await res.json();
    this._sessionId = sessionId;
    this._active = true;
    this._pollLoop();
  }

  /** @returns {Promise<void>} */
  async _pollLoop() {
    while (this._active) {
      try {
        const res = await fetch(this._base + POLL_PATH, {
          headers: { "X-WebWire-Session": this._sessionId },
        });
        if (!res.ok) {
          if (res.status === 410) {
            this._active = false;
            this._onClose?.(410, "Session expired");
            return;
          }
          throw new TransportError(`Poll error: ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) {
          this._onData?.(new Uint8Array(buf));
        }
      } catch (err) {
        if (!this._active) return;
        this._onError?.(err instanceof TransportError ? err : new TransportError(err.message));
        await sleep(500);
      }
    }
  }

  /** @param {Uint8Array} data */
  async send(data) {
    if (!this._sessionId) throw new TransportError("Polling not connected");
    const res = await fetch(this._base + SEND_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-WebWire-Session": this._sessionId,
      },
      body: data,
    });
    if (!res.ok) throw new TransportError(`Polling send failed: ${res.status}`);
  }

  close() {
    this._active = false;
    this._sessionId = null;
  }

  /** @param {(data: Uint8Array) => void} cb */
  onData(cb)  { this._onData  = cb; }
  /** @param {(code: number, reason: string) => void} cb */
  onClose(cb) { this._onClose = cb; }
  /** @param {(err: Error) => void} cb */
  onError(cb) { this._onError = cb; }
}

/** @param {number} ms @returns {Promise<void>} */
const sleep = ms => new Promise(r => setTimeout(r, ms));
