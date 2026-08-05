/**
 * Zero-knowledge client-side crypto: AES-256-GCM via Web Crypto. The key is
 * generated in the browser, never sent to the server, and lives only in the
 * URL fragment (`#key`) -- fragments are never included in HTTP requests, so
 * the server (and anything logging its requests) never sees it.
 *
 * Wire format for the ciphertext blob (base64url): IV[12] || AES-GCM(IV, payload)
 * Payload: 0x00 || utf8(plaintext)  -- the leading byte is a format tag,
 * reserved so a future file-sharing PR can add 0x01 without breaking
 * existing links.
 */

const IV_BYTES = 12;
const TEXT_TAG = 0x00;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64Url(new Uint8Array(raw));
}

export async function importKey(encoded: string): Promise<CryptoKey> {
  const raw = fromBase64Url(encoded);
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["decrypt"]);
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const body = new TextEncoder().encode(plaintext);
  const payload = new Uint8Array(1 + body.length);
  payload[0] = TEXT_TAG;
  payload.set(body, 1);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, payload),
  );

  const blob = new Uint8Array(iv.length + ciphertext.length);
  blob.set(iv, 0);
  blob.set(ciphertext, iv.length);
  return toBase64Url(blob);
}

export class DecryptError extends Error {
  constructor() {
    super("Failed to decrypt -- the link may be incomplete, corrupted, or the key is wrong.");
    this.name = "DecryptError";
  }
}

export async function decryptText(key: CryptoKey, blob: string): Promise<string> {
  const bytes = fromBase64Url(blob);
  if (bytes.length < IV_BYTES + 1) throw new DecryptError();

  const iv = bytes.slice(0, IV_BYTES);
  const ciphertext = bytes.slice(IV_BYTES);

  let payload: Uint8Array;
  try {
    payload = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource),
    );
  } catch {
    throw new DecryptError();
  }

  if (payload[0] !== TEXT_TAG) throw new DecryptError();
  return new TextDecoder().decode(payload.slice(1));
}
