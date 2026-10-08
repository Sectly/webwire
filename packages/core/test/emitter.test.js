import { describe, it, expect, mock } from "bun:test";
import { EventEmitter } from "../src/events/emitter.js";

describe("EventEmitter", () => {
  it("on/emit", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("msg", fn);
    ee.emit("msg", 42);
    expect(fn).toHaveBeenCalledWith(42, "msg");
  });

  it("once fires once", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.once("x", fn);
    ee.emit("x", 1);
    ee.emit("x", 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("off removes listener", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("x", fn);
    ee.off("x", fn);
    ee.emit("x", 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("off removes once wrapper by original", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.once("x", fn);
    ee.off("x", fn);
    ee.emit("x", 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("* matches all application events", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("*", fn);
    ee.emit("message", "hi");
    ee.emit("user:joined", {});
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("* does not match internal $ww: events", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("*", fn);
    ee.emit("$ww:connect", {});
    expect(fn).not.toHaveBeenCalled();
  });

  it("ns:* wildcard", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("user:*", fn);
    ee.emit("user:joined", {});
    ee.emit("user:left", {});
    ee.emit("order:created", {});
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("*:suffix wildcard", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("*:created", fn);
    ee.emit("user:created", {});
    ee.emit("order:created", {});
    ee.emit("user:deleted", {});
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("ns:* does not match multi-segment", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("user:*", fn);
    ee.emit("user:sub:event", {});
    expect(fn).not.toHaveBeenCalled();
  });

  it("onAny receives all events", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.onAny(fn);
    ee.emit("a", 1);
    ee.emit("b", 2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("removeAllListeners clears everything", () => {
    const ee = new EventEmitter();
    const fn = mock();
    ee.on("x", fn);
    ee.onAny(fn);
    ee.removeAllListeners();
    ee.emit("x", 1);
    expect(fn).not.toHaveBeenCalled();
  });
});
