/** Digits-only PIN, fixed length -- keeps the UI a numeric keypad and keeps
 * PIN-space calculations simple (10^PIN_SIZE combinations). */
export const PIN_SIZE = 5;

/** Delete the message and refuse further attempts after this many wrong PINs. */
export const PIN_ATTEMPTS = 3;

export const MIN_EXPIRE_SECONDS = 60;
export const MAX_EXPIRE_SECONDS = 24 * 60 * 60;
export const DEFAULT_EXPIRE_SECONDS = 60 * 60;

/**
 * Ciphertext blobs are base64url-encoded on the wire. This caps the
 * *encoded* string length; text-only in v1 (file uploads land in a later
 * PR with their own, larger limit).
 */
export const MAX_MESSAGE_BYTES = 64 * 1024;

export const ID_LENGTH = 12;
