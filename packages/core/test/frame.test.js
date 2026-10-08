import { describe, it, expect } from "bun:test";
import { encodeFrame, decodeFrame, decodeFrames } from "../src/protocol/frame.js";
import { FrameType } from "../src/protocol/constants.js";

describe("frame", () => {
  it("round-trips an EVENT frame", () => {
    const payload = new TextEncoder().encode(JSON.stringify({ e: "message", d: "aGVsbG8=" }));
    const encoded = encodeFrame({ type: FrameType.EVENT, flags: 0, payload });
    const { type, flags, bytesRead } = decodeFrame(encoded, 0);
    expect(type).toBe(FrameType.EVENT);
    expect(flags).toBe(0);
    expect(bytesRead).toBe(encoded.length);
  });

  it("round-trips empty payload", () => {
    const encoded = encodeFrame({ type: FrameType.PING });
    const { type, payload } = decodeFrame(encoded, 0);
    expect(type).toBe(FrameType.PING);
    expect(payload.length).toBe(0);
  });

  it("decodes multiple frames", () => {
    const f1 = encodeFrame({ type: FrameType.PING });
    const f2 = encodeFrame({ type: FrameType.PONG });
    const combined = new Uint8Array([...f1, ...f2]);
    const frames = decodeFrames(combined);
    expect(frames.length).toBe(2);
    expect(frames[0].type).toBe(FrameType.PING);
    expect(frames[1].type).toBe(FrameType.PONG);
  });

  it("throws on truncated frame", () => {
    const encoded = encodeFrame({ type: FrameType.EVENT, payload: new Uint8Array(10) });
    expect(() => decodeFrame(encoded.slice(0, 5))).toThrow();
  });

  it("throws on oversized payload declaration", () => {
    // Manually craft a frame claiming >4MB payload
    const buf = new Uint8Array([0x00, FrameType.EVENT, 0x81, 0x80, 0x80, 0x82]);
    expect(() => decodeFrame(buf)).toThrow();
  });
});
