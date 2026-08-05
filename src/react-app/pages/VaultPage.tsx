import { useEffect, useState } from "react";
import { checkMessage, revokeMessage } from "../lib/api";
import { listVaultEntries, markVaultEntryRevoked, type VaultEntry } from "../lib/vault";

type Status = "checking" | "live" | "read" | "expired" | "revoked";

const STATUS_LABEL: Record<Status, string> = {
  checking: "Checking…",
  live: "Live",
  read: "Read",
  expired: "Expired",
  revoked: "Revoked by you",
};

export default function VaultPage() {
  const [entries] = useState<VaultEntry[]>(() => listVaultEntries());
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const initial: Record<string, Status> = {};
    for (const entry of entries) {
      if (entry.revoked) initial[entry.id] = "revoked";
      else if (entry.expiresAt * 1000 <= Date.now()) initial[entry.id] = "expired";
    }
    return initial;
  });
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    for (const entry of entries) {
      if (entry.revoked || entry.expiresAt * 1000 <= Date.now()) continue;
      checkMessage(entry.id).then((res) => {
        if (cancelled) return;
        setStatuses((prev) => ({ ...prev, [entry.id]: res.ok ? "live" : "read" }));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [entries]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    const res = await revokeMessage(id);
    if (res.ok) {
      markVaultEntryRevoked(id);
      setStatuses((prev) => ({ ...prev, [id]: "revoked" }));
    }
    setRevoking(null);
  }

  const counts = { live: 0, read: 0, expired: 0, revoked: 0 };
  for (const entry of entries) {
    const s = statuses[entry.id];
    if (s && s !== "checking") counts[s] += 1;
  }

  return (
    <>
      <div className="badge">
        <span className="badge-dot" aria-hidden="true" />
        local only · never synced
      </div>
      <h1>Vault</h1>
      <p className="lede left">
        A history of secrets you've created in this browser -- ids and status only. We never store the plaintext or the
        decryption key here, so this can't be used to re-open a secret's contents, only to check on it.
      </p>

      {entries.length === 0
        ? (
          <div className="result-panel vault-empty">
            <p>No secrets created in this browser yet.</p>
            <a href="/" className="btn-primary inline">
              Send a secret →
            </a>
          </div>
        )
        : (
          <>
            <div className="vault-counts">
              <span>
                <strong>{counts.live}</strong>Live
              </span>
              <span>
                <strong>{counts.read}</strong>Read
              </span>
              <span>
                <strong>{counts.expired}</strong>Expired
              </span>
              <span>
                <strong>{counts.revoked}</strong>Revoked
              </span>
            </div>

            <div className="vault-list">
              {entries.map((entry) => (
                <VaultRow
                  key={entry.id}
                  entry={entry}
                  status={statuses[entry.id] ?? "checking"}
                  revoking={revoking === entry.id}
                  onRevoke={() => handleRevoke(entry.id)}
                />
              ))}
            </div>
          </>
        )}
    </>
  );
}

function VaultRow({
  entry,
  status,
  revoking,
  onRevoke,
}: {
  entry: VaultEntry;
  status: Status;
  revoking: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className="result-panel vault-item">
      <div className="vault-item-head">
        <span className="vault-item-id">{entry.id}</span>
        <span className={`status-pill status-pill--${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <div className="vault-item-meta">Created {new Date(entry.createdAt).toLocaleString()}</div>
      <div className="result-row">
        <a href={`/s/${entry.id}`} className="btn-secondary">
          Open
        </a>
        {status === "live" && (
          <button type="button" className="btn-secondary" onClick={onRevoke} disabled={revoking}>
            {revoking ? "Revoking…" : "Revoke"}
          </button>
        )}
      </div>
    </div>
  );
}
