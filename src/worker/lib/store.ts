export interface StoredMessage {
  id: string;
  /** Unix seconds. */
  exp: number;
  /** Opaque client-encrypted ciphertext -- the server never decodes this. */
  data: Uint8Array;
  pinHash: string;
  errors: number;
}

export class D1Store {
  constructor(private readonly db: D1Database) {}

  async save(msg: StoredMessage): Promise<void> {
    await this.db
      .prepare("INSERT INTO messages (id, exp, data, pin_hash, errors) VALUES (?, ?, ?, ?, 0)")
      .bind(msg.id, msg.exp, msg.data, msg.pinHash)
      .run();
  }

  /** Returns null if the message doesn't exist or has expired (expired rows are deleted lazily). */
  async load(id: string): Promise<StoredMessage | null> {
    const row = await this.db
      .prepare("SELECT id, exp, data, pin_hash AS pinHash, errors FROM messages WHERE id = ?")
      .bind(id)
      .first<{ id: string; exp: number; data: ArrayBuffer; pinHash: string; errors: number }>();
    if (!row) return null;

    if (row.exp < nowSeconds()) {
      await this.remove(id);
      return null;
    }

    return { ...row, data: new Uint8Array(row.data) };
  }

  /** Atomically increments the failed-attempt counter and returns the new count. */
  async incrementErrors(id: string): Promise<number> {
    const row = await this.db
      .prepare("UPDATE messages SET errors = errors + 1 WHERE id = ? RETURNING errors")
      .bind(id)
      .first<{ errors: number }>();
    return row?.errors ?? 0;
  }

  async remove(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
  }

  /** Deletes all expired rows. Intended to be called from a Cron Trigger. */
  async purgeExpired(): Promise<number> {
    const result = await this.db.prepare("DELETE FROM messages WHERE exp < ?").bind(nowSeconds()).run();
    return result.meta.changes;
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
