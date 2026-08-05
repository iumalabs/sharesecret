# ShareSecret

Zero-knowledge, one-time secret sharing on Cloudflare Workers.

Inspired by [safesecret.info](https://safesecret.info) — encrypt a message or
file in your browser, share a link, the recipient reads it once and it's
gone. The server never sees the plaintext or the decryption key.

> 🚧 Under active development. Core secret create/reveal flow lands in
> follow-up PRs — see [open PRs](../../pulls) for progress.

## How it works (planned)

1. Your browser generates a random AES-256-GCM key and encrypts your message
   or file locally (Web Crypto API).
2. The ciphertext (plus a PIN hash) is sent to the Worker and stored in D1
   with an expiry.
3. The decryption key lives only in the URL fragment (`#key`) — fragments are
   never sent to any server, including this one.
4. The recipient opens the link, enters the PIN, and the browser decrypts
   locally. The message is deleted after the first successful read.

## Stack

Cloudflare Workers · Hono · TypeScript · React · D1 — see
[CONTRIBUTING.md](CONTRIBUTING.md) for local setup and development scripts.

## Security

See [SECURITY.md](SECURITY.md) for the threat model and how to report
vulnerabilities.

## License

[MIT](LICENSE)
