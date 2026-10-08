import { describe, it, expect } from "bun:test";
import { encodeHandshake, decodeHandshake, negotiate } from "../src/protocol/handshake.js";
import { PROTOCOL_VERSION } from "../src/protocol/constants.js";

describe("handshake", () => {
  it("round-trips basic handshake", () => {
    const encoded = encodeHandshake({ version: PROTOCOL_VERSION, codecs: ["json"] });
    const decoded = decodeHandshake(encoded);
    expect(decoded.version).toBe(PROTOCOL_VERSION);
    expect(decoded.codecs).toContain("json");
  });

  it("includes auth field when provided", () => {
    const encoded = encodeHandshake({ auth: { token: "abc" } });
    const decoded = decodeHandshake(encoded);
    expect(decoded.auth).toEqual({ token: "abc" });
  });

  it("throws on invalid payload", () => {
    expect(() => decodeHandshake(new Uint8Array([0xff]))).toThrow();
  });

  it("negotiate picks first matching codec", () => {
    const { codec } = negotiate(
      { codecs: ["msgpack", "json"], compressionAlgos: [] },
      { codecs: ["json"], compressionAlgos: [] }
    );
    expect(codec).toBe("json");
  });

  it("negotiate throws when no common codec", () => {
    expect(() => negotiate(
      { codecs: ["msgpack"], compressionAlgos: [] },
      { codecs: ["json"], compressionAlgos: [] }
    )).toThrow();
  });

  it("negotiate picks compression algo", () => {
    const { compressionAlgo } = negotiate(
      { codecs: ["json"], compressionAlgos: ["gzip", "deflate"] },
      { codecs: ["json"], compressionAlgos: ["deflate"] }
    );
    expect(compressionAlgo).toBe("deflate");
  });

  it("negotiate returns null compressionAlgo when none match", () => {
    const { compressionAlgo } = negotiate(
      { codecs: ["json"], compressionAlgos: ["gzip"] },
      { codecs: ["json"], compressionAlgos: [] }
    );
    expect(compressionAlgo).toBeNull();
  });
});
