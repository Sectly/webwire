import { describe, it, expect } from "bun:test";
import { encodeVarint, decodeVarint } from "../src/protocol/varint.js";

describe("varint", () => {
  const cases = [0, 1, 127, 128, 255, 300, 16383, 16384, 0xffffffff];

  for (const n of cases) {
    it(`round-trips ${n}`, () => {
      const encoded = encodeVarint(n);
      const { value, bytesRead } = decodeVarint(encoded, 0);
      expect(value).toBe(n);
      expect(bytesRead).toBe(encoded.length);
    });
  }

  it("decodes at offset", () => {
    const prefix = new Uint8Array([0xde, 0xad]);
    const varBytes = encodeVarint(300);
    const buf = new Uint8Array([...prefix, ...varBytes]);
    const { value, bytesRead } = decodeVarint(buf, 2);
    expect(value).toBe(300);
    expect(bytesRead).toBe(varBytes.length);
  });

  it("throws on truncated varint", () => {
    expect(() => decodeVarint(new Uint8Array([0x80]), 0)).toThrow();
  });
});
