# Security Policy

ShareSecret is a zero-knowledge secret-sharing tool: the encryption key never
leaves the browser (it lives only in the URL fragment, which is never sent to
the server) and the server only ever stores an opaque ciphertext blob.

## Reporting a Vulnerability

Please report security issues privately via [GitHub Security Advisories](../../security/advisories/new)
rather than opening a public issue. We'll acknowledge reports and coordinate
disclosure once a fix is available.

## Scope

- Client-side encryption implementation (`src/react-app/lib/crypto.ts` once added)
- PIN hashing and rate-limiting
- Storage layer / D1 access
- HTTP security headers and CSP

Out of scope: issues requiring physical access to a user's device, or relying
on a compromised browser/extension environment.
