import { describe, expect, it } from "vitest";
import { fromBase64Url, toBase64Url } from "../src/worker/lib/base64url";

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 254, 255, 127, 128]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it("round-trips an empty byte array", () => {
    const bytes = new Uint8Array([]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it("produces URL-safe output with no +, /, or = padding", () => {
    // All-0xFF bytes are chosen to force '+'/'/' in standard base64 output.
    const bytes = new Uint8Array(16).fill(255);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("decodes both padded and unpadded input the same way", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const unpadded = toBase64Url(bytes);
    const padded = unpadded + "=".repeat((4 - (unpadded.length % 4)) % 4);
    expect(fromBase64Url(unpadded)).toEqual(fromBase64Url(padded));
  });

  it("round-trips through every byte value 0-255", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });
});
