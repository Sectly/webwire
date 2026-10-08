import { TransportError } from "@webwirejs/core";

export class WebTransportTransport {
  name = "webtransport";

  /**
   * @param {string} url
   * @param {{ WebTransport?: typeof WebTransport }} [opts]
   */
  constructor(url, opts = {}) {
    this._url = url;
    this._WT = opts.WebTransport ?? globalThis.WebTransport;
    this._wt = null;
    this._writer = null;
    this._onData = null;
    this._onClose = null;
    this._onError = null;
  }

  /**
   * @param {{ WebTransport?: typeof WebTransport }} [opts]
   * @returns {boolean}
   */
  static isAvailable(opts = {}) {
    return !!(opts.WebTransport ?? globalThis.WebTransport);
  }

  /** @returns {Promise<void>} */
  async connect() {
    const wt = new this._WT(this._url);
    this._wt = wt;
    await wt.ready;

    // Bidirectional stream for reliable, ordered delivery.
    const stream = await wt.createBidirectionalStream();
    this._writer = stream.writable.getWriter();

    this._readLoop(stream.readable).catch(err => this._onError?.(err));

    wt.closed.then(
      () => this._onClose?.(0, "closed"),
      (err) => {
        this._onError?.(new TransportError(err?.message ?? "WebTransport closed with error"));
        this._onClose?.(1, err?.message ?? "error");
      }
    );
  }

  /**
   * @param {ReadableStream} readable
   * @returns {Promise<void>}
   */
  async _readLoop(readable) {
    const reader = readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        this._onData?.(new Uint8Array(value));
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** @param {Uint8Array} data */
  async send(data) {
    if (!this._writer) throw new TransportError("WebTransport not connected");
    await this._writer.write(data);
  }

  close() {
    this._writer?.close().catch(() => {});
    this._wt?.close();
    this._wt = null;
    this._writer = null;
  }

  /** @param {(data: Uint8Array) => void} cb */
  onData(cb)  { this._onData  = cb; }
  /** @param {(code: number, reason: string) => void} cb */
  onClose(cb) { this._onClose = cb; }
  /** @param {(err: Error) => void} cb */
  onError(cb) { this._onError = cb; }
}
