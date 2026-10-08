export class WebWireError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   */
  constructor(message, code) {
    super(message);
    this.name = "WebWireError";
    this.code = code;
  }
}

export class ProtocolError extends WebWireError {
  /** @param {string} message */
  constructor(message) {
    super(message, "PROTOCOL_ERROR");
    this.name = "ProtocolError";
  }
}

export class TimeoutError extends WebWireError {
  /** @param {string} [message] */
  constructor(message) {
    super(message ?? "Operation timed out", "TIMEOUT");
    this.name = "TimeoutError";
  }
}

export class AuthError extends WebWireError {
  /** @param {string} [message] */
  constructor(message) {
    super(message ?? "Authentication failed", "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class TransportError extends WebWireError {
  /** @param {string} message */
  constructor(message) {
    super(message, "TRANSPORT_ERROR");
    this.name = "TransportError";
  }
}
