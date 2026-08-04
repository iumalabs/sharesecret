import { useEffect, useState } from "react";
import { checkMessage, revealMessage } from "../lib/api";
import { decryptText, importKey } from "../lib/crypto";

type Status =
  | { kind: "loading" }
  | { kind: "missing-key" }
  | { kind: "not-found" }
  | { kind: "ready" }
  | { kind: "destroyed"; message: string }
  | { kind: "revealed"; plaintext: string };

export default function RevealPage({ id }: { id: string }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<Status>(() =>
    window.location.hash.length > 1 ? { kind: "loading" } : { kind: "missing-key" },
  );
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    if (!fragment) return; // initial state already reflects this (see useState above)

    // Pull the key out of the URL immediately and scrub it from the visible
    // address bar / history -- we hold it in memory for the rest of this
    // page's life instead.
    window.history.replaceState(null, "", window.location.pathname);

    importKey(fragment)
      .then(setKey)
      .catch(() => setStatus({ kind: "missing-key" }));

    checkMessage(id).then((res) => {
      setStatus(res.ok ? { kind: "ready" } : { kind: "not-found" });
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;

    setSubmitting(true);
    setPinError(null);
    try {
      const res = await revealMessage(id, pin);
      if (!res.ok) {
        if (res.status === 404) {
          setStatus({ kind: "not-found" });
        } else if (res.attemptsRemaining === undefined) {
          setStatus({ kind: "destroyed", message: res.error });
        } else {
          setPinError(`${res.error} (${res.attemptsRemaining} attempt${res.attemptsRemaining === 1 ? "" : "s"} left)`);
          setPin("");
        }
        return;
      }

      const plaintext = await decryptText(key, res.data.data);
      setStatus({ kind: "revealed", plaintext });
    } catch {
      setPinError("Failed to decrypt. The link may be corrupted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status.kind === "loading") return <p>Loading…</p>;

  if (status.kind === "missing-key") {
    return (
      <div>
        <h1>Incomplete link</h1>
        <p>
          This link is missing its decryption key. Make sure you copied the <em>entire</em> link, including everything
          after the <code>#</code>.
        </p>
      </div>
    );
  }

  if (status.kind === "not-found") {
    return (
      <div>
        <h1>Secret not found</h1>
        <p>This secret has already been viewed, has expired, or never existed.</p>
      </div>
    );
  }

  if (status.kind === "destroyed") {
    return (
      <div>
        <h1>Secret destroyed</h1>
        <p role="alert">{status.message}</p>
      </div>
    );
  }

  if (status.kind === "revealed") {
    return (
      <div>
        <h1>Secret revealed</h1>
        <p className="hint">This secret has now been deleted and can't be viewed again.</p>
        <pre className="secret-text">{status.plaintext}</pre>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Enter PIN</h1>
      <p className="hint">Enter the PIN you were given separately to reveal this secret.</p>

      <label htmlFor="pin">PIN</label>
      <input
        id="pin"
        type="text"
        inputMode="numeric"
        pattern="\d*"
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        autoFocus
        required
      />

      {pinError && (
        <p role="alert" className="error">
          {pinError}
        </p>
      )}

      <button type="submit" disabled={submitting || !key || pin.length === 0}>
        {submitting ? "Checking…" : "Reveal secret"}
      </button>
    </form>
  );
}
