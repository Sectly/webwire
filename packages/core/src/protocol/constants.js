export const PROTOCOL_VERSION = 1;

/** @enum {number} Frame type byte values. */
export const FrameType = Object.freeze({
  EVENT:     0x01,
  REQUEST:   0x02,
  RESPONSE:  0x03,
  ERROR:     0x04,
  PING:      0x05,
  PONG:      0x06,
  AUTH:      0x07,
  CLOSE:     0x08,
  HANDSHAKE: 0x09,
});

/** @enum {number} Frame flag bitmask values. */
export const FrameFlag = Object.freeze({
  COMPRESSED: 0x01,
});

/**
 * Internal protocol event names excluded from wildcard dispatch.
 * @type {Set<string>}
 */
export const INTERNAL_EVENTS = new Set([
  "$ww:connect",
  "$ww:disconnect",
  "$ww:reconnecting",
  "$ww:connecting",
  "$ww:error",
  "$ww:close",
]);

export const MAX_FRAME_SIZE     = 4 * 1024 * 1024; // 4 MiB
export const MAX_EVENT_NAME_LEN = 256;
export const MAX_REQUEST_ID     = 0xffffffff;

export const DEFAULT_REQUEST_TIMEOUT    = 10_000; // ms
export const DEFAULT_HEARTBEAT_INTERVAL = 30_000; // ms
export const DEFAULT_HEARTBEAT_TIMEOUT  = 10_000; // ms
export const DEFAULT_RECONNECT_INITIAL  =    500; // ms
export const DEFAULT_RECONNECT_MAX      = 30_000; // ms
