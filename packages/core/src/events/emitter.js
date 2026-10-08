import { INTERNAL_EVENTS } from "../protocol/constants.js";

/**
 * Wildcard pattern matching rules:
 *   `*`        - matches every application event (not `$ww:` internal events)
 *   `ns:*`     - matches `ns:<single-segment>`, e.g. `user:*` matches `user:joined`
 *   `*:suffix` - matches `<single-segment>:suffix`
 *
 * Single-segment means the dynamic part contains no additional colon.
 *
 * @param {string} pattern
 * @param {string} event
 * @returns {boolean}
 */
function matchesPattern(pattern, event) {
  if (pattern === event) return true;
  if (pattern === "*") return !INTERNAL_EVENTS.has(event);

  const colonIdx = pattern.indexOf(":");
  if (colonIdx === -1) return false;

  const prefix = pattern.slice(0, colonIdx);
  const suffix = pattern.slice(colonIdx + 1);

  if (suffix === "*") {
    if (!event.startsWith(prefix + ":")) return false;
    const rest = event.slice(prefix.length + 1);
    return rest.length > 0 && !rest.includes(":");
  }

  if (prefix === "*") {
    if (!event.endsWith(":" + suffix)) return false;
    const rest = event.slice(0, event.length - suffix.length - 1);
    return rest.length > 0 && !rest.includes(":");
  }

  return false;
}

export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Set<Function>} */
    this._anyListeners = new Set();
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {this}
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return this;
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {this}
   */
  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      this.off(event, wrapper);
    };
    wrapper._original = handler;
    return this.on(event, wrapper);
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {this}
   */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (!set) return this;
    for (const fn of set) {
      if (fn === handler || fn._original === handler) {
        set.delete(fn);
        break;
      }
    }
    if (set.size === 0) this._listeners.delete(event);
    return this;
  }

  /**
   * Dispatch an event. Checks exact matches first, then wildcard patterns,
   * then `onAny` listeners.
   * @param {string} event
   * @param {unknown} data
   * @returns {this}
   */
  emit(event, data) {
    const exact = this._listeners.get(event);
    if (exact) {
      for (const fn of [...exact]) fn(data, event);
    }

    for (const [pattern, fns] of this._listeners) {
      if (pattern === event) continue;
      if (matchesPattern(pattern, event)) {
        for (const fn of [...fns]) fn(data, event);
      }
    }

    for (const fn of this._anyListeners) fn(data, event);

    return this;
  }

  /**
   * Register a listener that receives every emitted event.
   * @param {Function} handler
   * @returns {this}
   */
  onAny(handler) {
    this._anyListeners.add(handler);
    return this;
  }

  /**
   * @param {Function} handler
   * @returns {this}
   */
  offAny(handler) {
    this._anyListeners.delete(handler);
    return this;
  }

  /**
   * @param {string} [event] - If omitted, removes all listeners for all events.
   * @returns {this}
   */
  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
      this._anyListeners.clear();
    }
    return this;
  }
}
