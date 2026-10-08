import { describe, it, expect } from "bun:test";
import { jsonCodec } from "../src/codec/json.js";

describe("jsonCodec", () => {
  const cases = [
    "hello",
    42,
    3.14,
    true,
    false,
    null,
    { name: "Alice", age: 20 },
    [1, 2, 3],
    { nested: { deep: true } },
  ];

  for (const val of cases) {
    it(`round-trips ${JSON.stringify(val)}`, () => {
      const encoded = jsonCodec.encode(val);
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(jsonCodec.decode(encoded)).toEqual(val);
    });
  }

  it("round-trips Uint8Array as bytes type", () => {
    const bytes = new Uint8Array([1, 2, 3, 255]);
    const encoded = jsonCodec.encode(bytes);
    const decoded = jsonCodec.decode(encoded);
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded)).toEqual([1, 2, 3, 255]);
  });

  it("round-trips object containing Uint8Array", () => {
    const val = { data: new Uint8Array([10, 20]), name: "test" };
    const decoded = jsonCodec.decode(jsonCodec.encode(val));
    expect(decoded.name).toBe("test");
    expect(decoded.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded.data)).toEqual([10, 20]);
  });
});
