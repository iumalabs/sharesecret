import { fromBase64Url, toBase64Url } from "./base64url";

// OWASP 2023 recommendation for PBKDF2-HMAC-SHA256.
const ITERATIONS = 210_000;
const HASH = "SHA-256";
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

/**
 * `pepper` is a server-only secret (env var, never in the DB) mixed into
 * every hash. If the D1 database is ever exfiltrated without the Worker's
 * environment, stored hashes are useless to an attacker without it.
 */
export async function hashPin(pin: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await derive(pin, pepper, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}

export async function verifyPin(pin: string, pepper: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);
  const actual = await derive(pin, pepper, salt, iterations);
  return timingSafeEqual(actual, expected);
}

async function derive(pin: string, pepper: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${pin}:${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: HASH },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
