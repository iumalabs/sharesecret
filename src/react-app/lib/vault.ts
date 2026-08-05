// Local-only history of secrets created in this browser. Zero-knowledge
// constraint holds here too: only the id, timestamps, and revoked flag are
// ever stored -- never the plaintext or the decryption key, so this list is
// purely for tracking "what did I send and is it still live", not for
// re-opening a secret's contents.

export interface VaultEntry {
  id: string;
  createdAt: number; // ms epoch
  expiresAt: number; // seconds epoch, matches the server's `exp`
  revoked: boolean;
}

const STORAGE_KEY = "sharesecret:vault";

function readAll(): VaultEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VaultEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: VaultEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) -- the
    // vault is a convenience layer, so silently no-op rather than break
    // secret creation over it.
  }
}

export function listVaultEntries(): VaultEntry[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function addVaultEntry(entry: VaultEntry): void {
  writeAll([entry, ...readAll()]);
}

export function markVaultEntryRevoked(id: string): void {
  writeAll(readAll().map((e) => (e.id === id ? { ...e, revoked: true } : e)));
}

// Entries not yet known to be dead (revoked or past their local expiry) --
// a cheap, network-free approximation used for the nav badge. The Vault
// page itself checks each one against the server for the precise status.
export function countLikelyLive(entries: VaultEntry[]): number {
  const nowSeconds = Date.now() / 1000;
  return entries.filter((e) => !e.revoked && e.expiresAt > nowSeconds).length;
}
