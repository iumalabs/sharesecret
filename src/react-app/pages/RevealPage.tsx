import { useEffect, useState } from "react";
import { checkMessage, revealMessage } from "../lib/api";
import { decryptText, importKey } from "../lib/crypto";
import Logo from "../components/Logo";
import CopyButton from "../components/CopyButton";

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

  if (status.kind === "loading") return null;

  if (status.kind === "missing-key") {
    return (
      <div className="status-page">
        <div className="status-icon" aria-hidden="true">
          ∅
        </div>
        <h2>Incomplete link</h2>
        <p>
          This link is missing its decryption key. Make sure you copied the entire link, including everything after the{" "}
          <code>#</code>.
        </p>
      </div>
    );
  }

  if (status.kind === "not-found") {
    return (
      <div className="status-page">
        <div className="status-icon" aria-hidden="true">
          ∅
        </div>
        <h2>Secret not found</h2>
        <p>This secret has already been viewed, has expired, or never existed.</p>
      </div>
    );
  }

  if (status.kind === "destroyed") {
    return (
      <div className="status-page">
        <div className="status-icon" aria-hidden="true">
          ∅
        </div>
        <h2>Secret destroyed</h2>
        <p role="alert">{status.message}</p>
      </div>
    );
  }

  if (status.kind === "revealed") {
    return (
      <>
        <div className="badge">
          <span className="badge-dot" aria-hidden="true" />
          decrypted locally
        </div>
        <h1>Secret revealed</h1>
        <p className="lede left">
          This secret has now been deleted and can't be viewed again -- copy it somewhere safe.
        </p>
        <div className="result-panel">
          <pre className="secret-body">{status.plaintext}</pre>
        </div>
        <CopyButton
          value={status.plaintext}
          label="Copy content"
          copiedLabel="✓ Copied to clipboard"
          className="btn-secondary block"
          icon
        />
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <span className="pin-icon" aria-hidden="true">
          <Logo size={30} />
        </span>
        <h2>Someone left you a sealed note</h2>
        <p className="lede">Enter the PIN they gave you on another channel.</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="pin">PIN</label>
        <div className="field-wrap bare">
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
        </div>

        {pinError && (
          <p role="alert" className="error">
            {pinError}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={submitting || !key || pin.length === 0}>
          {submitting ? "Checking…" : "Reveal secret"}
        </button>
      </form>
    </>
  );
}
