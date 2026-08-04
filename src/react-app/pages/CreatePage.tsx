import { useEffect, useState } from "react";
import { createMessage, getParams, type Params } from "../lib/api";
import { encryptText, exportKey, generateKey } from "../lib/crypto";

const EXPIRY_PRESETS = [
  { label: "15 minutes", seconds: 15 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "6 hours", seconds: 6 * 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
];

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

  return (
    <form onSubmit={handleSubmit}>
      <h1>Share a secret</h1>
      <p className="hint">
        Encrypted in your browser before it's sent. We never see your message, and the decryption key never leaves this
        link.
      </p>

      <label htmlFor="message">Secret message</label>
      <textarea
        id="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        required
        maxLength={40_000}
        placeholder="Type or paste your secret here"
      />

      <label htmlFor="expire">Expires after</label>
      <select id="expire" value={expireSeconds} onChange={(e) => setExpireSeconds(Number(e.target.value))}>
        {EXPIRY_PRESETS.map((p) => (
          <option key={p.seconds} value={p.seconds}>
            {p.label}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting || !params || !message.trim()}>
        {submitting ? "Encrypting…" : "Create secret link"}
      </button>
    </form>
  );
}

function CreatedResult({ result, onReset }: { result: CreatedSecret; onReset: () => void }) {
  return (
    <div>
      <h1>Your secret link is ready</h1>
      <p className="hint">
        Share the link and the PIN <strong>separately</strong> -- e.g. link by email, PIN by text message. Anyone with
        both can read the secret exactly once.
      </p>

      <label htmlFor="link">Link</label>
      <div className="copy-row">
        <input id="link" type="text" readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={() => navigator.clipboard.writeText(result.link)}>
          Copy
        </button>
      </div>

      <label htmlFor="pin">PIN</label>
      <div className="copy-row">
        <input id="pin" type="text" readOnly value={result.pin} />
        <button type="button" onClick={() => navigator.clipboard.writeText(result.pin)}>
          Copy
        </button>
      </div>

      <button type="button" onClick={onReset}>
        Create another secret
      </button>
    </div>
  );
}
