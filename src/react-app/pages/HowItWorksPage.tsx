const STEPS = [
  {
    step: "01 / SEAL",
    title: "Encrypted in your tab",
    body:
      "A random 256-bit key is generated here and buried in the link fragment -- the part browsers never send to a server.",
  },
  {
    step: "02 / SEND",
    title: "Two channels, one secret",
    body:
      "Link by mail, PIN by voice. Whoever intercepts one half gets an unopenable box -- and three wrong tries burn it.",
  },
  {
    step: "03 / SHRED",
    title: "Read, then deleted",
    body: "The first successful read deletes the row. Reload the link and even we can't tell you what it said.",
  },
];

const GUARANTEES = [
  "Decryption key lives only in the URL fragment",
  "No account, no email, no analytics cookie",
  "PIN attempts limited to 3, then the blob burns",
  "Open source protocol, reproducible builds",
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="badge">
        <span className="badge-dot" aria-hidden="true" />
        how it works
      </div>
      <h1>The three-step protocol</h1>
      <p className="lede left">
        No accounts, no inbox, no archive. A secret exists only between the moment you seal it and the moment it's read.
      </p>

      <div className="steps">
        {STEPS.map((s) => (
          <div key={s.step} className="step-card">
            <div>
              <div className="step-tag">{s.step}</div>
              <div className="step-title">{s.title}</div>
            </div>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <div className="threat-panel">
        <div>
          <div className="card-label">
            <span>Threat model, plainly</span>
          </div>
          <div className="threat-headline">We can't read your secret. Neither can a subpoena.</div>
        </div>
        <div className="threat-list">
          {GUARANTEES.map((g) => (
            <div key={g}>
              <span className="accent" aria-hidden="true">
                ✓
              </span>
              <span>{g}</span>
            </div>
          ))}
        </div>
      </div>

      <a href="/" className="btn-primary inline">
        Send a secret →
      </a>
    </>
  );
}
