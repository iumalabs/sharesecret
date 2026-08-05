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
  | { kind: "revealed"; plaintext: string }
  | { kind: "cleared" };

// How long a revealed secret stays on screen before it's auto-cleared, to
// limit shoulder-surfing exposure if the tab is left open and unattended.
const AUTO_CLEAR_MS = 60_000;

// Dead ends (not-found / destroyed / cleared) are commonly landed on by a
// visitor who isn't the person who created the original secret and may not
// otherwise know this site is also where *they'd* go to send one back --
// without this, the top nav is the only way out.
function StatusPageActions() {
  return (
    <div className="status-page-actions">
      <a href="/" className="btn-primary inline">
        Send a secret →
      </a>
      <a href="/vault" className="btn-secondary">
        Open vault
      </a>
    </div>
  );
}

export default function RevealPage({ id }: { id: string }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<Status>(() =>
    window.location.hash.length > 1 ? { kind: "loading" } : { kind: "missing-key" }
  );
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(AUTO_CLEAR_MS);

  function clearRevealed() {
    setStatus({ kind: "cleared" });
  }

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

    // These two requests race independently. If the key already failed to
    // import, that's a terminal client-side error -- don't let this later
    // network response silently overwrite it with a functional-looking but
    // dead-end PIN screen (the `key` state would still be null, so "Reveal
    // secret" would stay permanently disabled with no explanation).
    checkMessage(id).then((res) => {
      setStatus((prev) => (prev.kind === "missing-key" ? prev : res.ok ? { kind: "ready" } : { kind: "not-found" }));
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

  useEffect(() => {
    if (status.kind !== "revealed") return;

    // Recomputed from a fixed deadline (not decremented) so the displayed
    // countdown can't drift from AUTO_CLEAR_MS even if the interval is
    // throttled by a backgrounded tab.
    const deadline = Date.now() + AUTO_CLEAR_MS;
    const tick = () => {
      const left = deadline - Date.now();
      if (left <= 0) {
        clearRevealed();
        return;
      }
      setRemainingMs(left);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearRevealed();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [status.kind]);

  if (status.kind === "loading") return null;

  if (status.kind === "missing-key") {
    return (
      <div className="status-page">
        <div className="status-icon" aria-hidden="true">
          ∅
        </div>
        <h1>Incomplete link</h1>
        <p>
          This link is missing its decryption key. Make sure you copied the entire link, including everything after the
          {" "}
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
        <h1>Secret not found</h1>
        <p>This secret has already been viewed, has expired, or never existed.</p>
        <StatusPageActions />
      </div>
    );
  }

  if (status.kind === "destroyed") {
    return (
      <div className="status-page">
        <div className="status-icon" aria-hidden="true">
          ∅
        </div>
        <h1>Secret destroyed</h1>
        <p role="alert">{status.message}</p>
        <StatusPageActions />
      </div>
    );
  }

  if (status.kind === "cleared") {
    return (
      <div className="status-page">
        <div className="status-icon" aria-hidden="true">
          ∅
        </div>
        <h1>Secret cleared</h1>
        <p>
          This secret was already deleted from the server after being read once, and has now been cleared from your
          screen for safety.
        </p>
        <StatusPageActions />
      </div>
    );
  }

  if (status.kind === "revealed") {
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${
      String(remainingSeconds % 60).padStart(2, "0")
    }`;
    const countdownPct = Math.max(0, Math.min(100, Math.round((remainingMs / AUTO_CLEAR_MS) * 100)));

    return (
      <>
        <div className="reveal-head">
          <div className="badge">
            <span className="badge-dot" aria-hidden="true" />
            decrypted locally
          </div>
          <div className="destruct-countdown">
            <span className="destruct-dot" aria-hidden="true" />
            Destruct in {countdown}
          </div>
        </div>
        <div className="countdown-bar" aria-hidden="true">
          <div className="countdown-bar-fill" style={{ width: `${countdownPct}%` }} />
        </div>

        <h1>Secret revealed</h1>
        <p className="lede left">
          This secret has now been deleted and can't be viewed again -- copy it somewhere safe before the timer runs
          out.
        </p>
        <div className="result-panel">
          <pre className="secret-body">{status.plaintext}</pre>
        </div>
        <div className="result-row">
          <CopyButton
            value={status.plaintext}
            label="Copy content"
            copiedLabel="✓ Copied to clipboard"
            className="btn-secondary"
            icon
          />
          <button type="button" className="btn-danger" onClick={clearRevealed}>
            Burn it now
          </button>
        </div>
        <p className="reveal-note">
          Copy it somewhere safe before the timer ends -- this page is the only place this text exists.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <span className="pin-icon" aria-hidden="true">
          <Logo size={30} />
        </span>
        <h1 className="heading-compact">Someone left you a sealed note</h1>
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
