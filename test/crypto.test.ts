import { describe, expect, it } from "vitest";
import { DecryptError, decryptText, encryptText, exportKey, generateKey, importKey } from "../src/react-app/lib/crypto";

describe("client-side crypto", () => {
  it("round-trips plaintext through encrypt/decrypt with the same key", async () => {
    const key = await generateKey();
    const ciphertext = await encryptText(key, "hello, world");
    expect(await decryptText(key, ciphertext)).toBe("hello, world");
  });

  it("survives exporting and re-importing the key (as it would via the URL fragment)", async () => {
    const key = await generateKey();
    const ciphertext = await encryptText(key, "round trip via url fragment");

    const exported = await exportKey(key);
    const reimported = await importKey(exported);

    expect(await decryptText(reimported, ciphertext)).toBe("round trip via url fragment");
  });

  it("fails to decrypt with the wrong key", async () => {
    const key = await generateKey();
    const wrongKey = await generateKey();
    const ciphertext = await encryptText(key, "secret");

    await expect(decryptText(wrongKey, ciphertext)).rejects.toThrow(DecryptError);
  });

  it("fails to decrypt truncated/corrupted ciphertext instead of throwing an opaque error", async () => {
    const key = await generateKey();
    const ciphertext = await encryptText(key, "secret");

    await expect(decryptText(key, ciphertext.slice(0, -4))).rejects.toThrow(DecryptError);
  });

  it("produces a different exported key every time (fresh key per secret)", async () => {
    const a = await exportKey(await generateKey());
    const b = await exportKey(await generateKey());
    expect(a).not.toBe(b);
  });
});
