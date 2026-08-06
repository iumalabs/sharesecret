import { useEffect, useState } from "react";
import { createMessage, getParams, type Params } from "../lib/api";
import { encryptText, exportKey, generateKey } from "../lib/crypto";
import CopyButton from "../components/CopyButton";
import QrCode from "../components/QrCode";
import { addVaultEntry } from "../lib/vault";

const EXPIRY_PRESETS = [
  { label: "15 min", seconds: 15 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "6 hours", seconds: 6 * 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
];

const MAX_MESSAGE_CHARS = 40_000;

function generatePin(size: number): string {
  const digits = new Uint32Array(size);
  crypto.getRandomValues(digits);
  return Array.from(digits, (d) => d % 10).join("");
}

interface CreatedSecret {
  link: string;
  pin: string;
}

export default function CreatePage() {
  const [params, setParams] = useState<Params | null>(null);
  const [message, setMessage] = useState("");
  const [expireSeconds, setExpireSeconds] = useState(EXPIRY_PRESETS[1].seconds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedSecret | null>(null);

  useEffect(() => {
    getParams()
      .then((p) => {
        setParams(p);
        setExpireSeconds(p.defaultExpireSeconds);
      })
      .catch(() => setError("Couldn't reach the server. Please reload the page."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !params) return;

    setSubmitting(true);
    setError(null);
    try {
      const key = await generateKey();
      const ciphertext = await encryptText(key, message);
      const pin = generatePin(params.pinSize);

      const res = await createMessage(ciphertext, pin, expireSeconds);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const keyB64 = await exportKey(key);
      const link = `${window.location.origin}/s/${res.data.id}#${keyB64}`;
      addVaultEntry({ id: res.data.id, createdAt: Date.now(), expiresAt: res.data.expiresAt, revoked: false });
      setResult({ link, pin });
      setMessage("");
    } catch {
      setError("Something went wrong while encrypting or sending your secret. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <CreatedResult result={result} onReset={() => setResult(null)} />;
  }

  const activePreset = EXPIRY_PRESETS.find((p) => p.seconds === expireSeconds);

  return (
    <>
      <div className="hero">
        <div className="badge">
          <span className="badge-dot" aria-hidden="true" />
          AES-256-GCM · encrypted in this tab
        </div>
        <h1>
          Say it once.
          <br />
          <span className="accent">Then it never existed.</span>
        </h1>
        <p className="lede">One link, one read, then shredded. We store a blob we can't open.</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="card-label">
          <span>New secret</span>
        </div>

        <div className="field-wrap">
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={MAX_MESSAGE_CHARS}
            placeholder="Type the thing you shouldn't send over chat…"
            spellCheck={false}
            aria-label="Secret message"
          />
          <div className="field-counter">
            <span>{message.length} chars</span>
          </div>
        </div>

        <div className="card-label">
          <span>Self-destruct after</span>
          <span className="accent">{activePreset?.label}</span>
        </div>
        <div className="choice-row" role="group" aria-label="Expiry">
          {EXPIRY_PRESETS.map((p) => (
            <button
              key={p.seconds}
              type="button"
              className="choice"
              aria-pressed={p.seconds === expireSeconds}
              onClick={() => setExpireSeconds(p.seconds)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={submitting || !params || !message.trim()}>
          {submitting ? "Encrypting…" : "Encrypt & get link"}
        </button>
        <div className="foot-note">Key derived locally · never transmitted</div>
      </form>
    </>
  );
}

function CreatedResult({ result, onReset }: { result: CreatedSecret; onReset: () => void }) {
  return (
    <>
      <div className="badge">
        <span className="badge-dot" aria-hidden="true" />
        sealed
      </div>
      <h1>Your secret is now a stranger to us.</h1>
      <p className="lede left">Send the link. Say the PIN out loud on another channel. Nothing else to do.</p>

      <div className="result-panel">
        <div className="card-label">
          <span>One-time link</span>
        </div>
        <div className="result-value">{result.link}</div>
        <div className="result-row">
          <CopyButton value={result.link} label="Copy link" className="btn-primary" />
        </div>
      </div>

      <div className="result-panel">
        <div className="card-label">
          <span>PIN</span>
        </div>
        <div className="pin-row">
          <div className="result-value pin-value">{result.pin}</div>
          <CopyButton value={result.pin} label="Copy PIN" className="btn-secondary" />
        </div>
      </div>

      <div className="result-panel qr-panel">
        <div className="card-label">
          <span>Scan to open</span>
        </div>
        <QrCode value={result.link} />
        <p className="qr-caption">
          The QR carries the key.
          <br />
          Treat it like the secret itself.
        </p>
      </div>

      <button type="button" className="btn-secondary block" onClick={onReset}>
        Send another secret
      </button>
    </>
  );
}
