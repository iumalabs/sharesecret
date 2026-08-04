-- Messages table: one row per secret. `data` is always an opaque
-- client-encrypted blob (zero-knowledge) -- the server never sees plaintext
-- or the decryption key. `pin_hash` is a PBKDF2 hash of the (optional) PIN.
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  exp INTEGER NOT NULL,
  data BLOB NOT NULL,
  pin_hash TEXT NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_exp ON messages (exp);
