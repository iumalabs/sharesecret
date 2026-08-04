const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Unbiased base62 id via rejection sampling: reading a random byte and
 * modulo-ing it against 62 would over-represent characters 0-3 (256 % 62 !=
 * 0). Instead we discard any byte >= the largest multiple of 62 that fits in
 * a byte (248) and redraw, so every accepted byte maps to a character with
 * exactly equal probability.
 */
export function generateId(length: number): string {
  const maxAcceptable = 256 - (256 % ALPHABET.length);
  let id = "";
  const buf = new Uint8Array(length * 2);

  while (id.length < length) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= maxAcceptable) continue;
      id += ALPHABET[byte % ALPHABET.length];
      if (id.length === length) break;
    }
  }

  return id;
}
