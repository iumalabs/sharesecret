import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "../src/worker/lib/pin";

const PEPPER = "unit-test-pepper";

describe("PIN hashing", () => {
  it("verifies a correct PIN against its own hash", async () => {
    const stored = await hashPin("12345", PEPPER);
    expect(await verifyPin("12345", PEPPER, stored)).toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    const stored = await hashPin("12345", PEPPER);
    expect(await verifyPin("54321", PEPPER, stored)).toBe(false);
  });

  it("rejects the correct PIN under a different pepper", async () => {
    const stored = await hashPin("12345", PEPPER);
    expect(await verifyPin("12345", "a-different-pepper", stored)).toBe(false);
  });

  it("produces a different hash (and salt) on every call for the same PIN", async () => {
    const a = await hashPin("12345", PEPPER);
    const b = await hashPin("12345", PEPPER);
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    await expect(verifyPin("12345", PEPPER, "not-a-real-hash")).resolves.toBe(false);
  });
});
